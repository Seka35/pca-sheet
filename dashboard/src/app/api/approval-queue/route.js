import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';
import { verifyTransaction, formatVerificationDisplay } from '@/lib/paymentVerification';

const VERIFY_CACHE_MINUTES = 5;

export async function GET() {
  try {
    const rows = all(`
      SELECT
        aq.id,
        aq.proof_id,
        aq.sr_no,
        aq.client_id,
        aq.client_name,
        aq.tele_id,
        aq.product_type,
        aq.amount_due,
        aq.due_date,
        aq.bank_name,
        aq.transaction_id,
        aq.proof_image_url,
        aq.submitted_at,
        aq.status,
        aq.reviewed_at,
        aq.reviewed_by,
        aq.reject_reason,
        aq.auto_verification_status,
        aq.auto_verification_result,
        aq.auto_verification_checked_at,
        aq.fraud_notes,
        pp.submitted_at as proof_submitted_at
      FROM approval_queue aq
      LEFT JOIN payment_proofs pp ON pp.id = aq.proof_id
      ORDER BY aq.submitted_at DESC
    `);

    // Separate PENDING entries that need verification
    const pendingNeedsCheck = [];
    for (const row of rows) {
      if (row.status !== 'PENDING') continue;
      if (!row.transaction_id) continue;

      // Check if we need to re-verify (cache expired)
      let shouldVerify = false;
      if (!row.auto_verification_checked_at) {
        shouldVerify = true;
      } else {
        const checkedAt = new Date(row.auto_verification_checked_at);
        const minutesSince = (Date.now() - checkedAt.getTime()) / 1000 / 60;
        if (minutesSince > VERIFY_CACHE_MINUTES) {
          shouldVerify = true;
        }
      }

      if (shouldVerify) {
        pendingNeedsCheck.push(row);
      }
    }

    // Verify in parallel with concurrency limit of 3
    if (pendingNeedsCheck.length > 0) {
      const CONCURRENCY = 3;
      for (let i = 0; i < pendingNeedsCheck.length; i += CONCURRENCY) {
        const batch = pendingNeedsCheck.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (row) => {
            try {
              const expectedAmount = parseFloat(String(row.amount_due || '0').replace(/[^0-9.]/g, '')) || 0;
              const result = await verifyTransaction(
                row.transaction_id,
                row.bank_name,
                expectedAmount,
                row.client_id
              );

              const display = formatVerificationDisplay(result);
              const fraudNotes = result.fraudFlags?.length > 0 ? result.fraudFlags.join(' | ') : null;

              // Update approval_queue
              run(
                `UPDATE approval_queue SET
                  auto_verification_status = ?,
                  auto_verification_result = ?,
                  auto_verification_checked_at = CURRENT_TIMESTAMP,
                  fraud_notes = ?
                WHERE id = ?`,
                [result.status, JSON.stringify(result), fraudNotes, row.id]
              );

              // Also update payment_proofs
              run(
                `UPDATE payment_proofs SET
                  auto_verification_status = ?,
                  auto_verification_result = ?,
                  auto_verification_checked_at = CURRENT_TIMESTAMP,
                  fraud_notes = ?
                WHERE id = ?`,
                [result.status, JSON.stringify(result), fraudNotes, row.proof_id]
              );

              // Update in-memory row for response
              row.auto_verification_status = result.status;
              row.auto_verification_result = result;
              row.fraud_notes = fraudNotes;
              row.auto_verification_checked_at = new Date().toISOString();
            } catch (e) {
              console.error(`[approval-queue] verify error for row ${row.id}:`, e.message);
              // Mark as ERROR if verification failed
              run(
                `UPDATE approval_queue SET auto_verification_status = 'ERROR', auto_verification_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [row.id]
              );
              run(
                `UPDATE payment_proofs SET auto_verification_status = 'ERROR', auto_verification_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [row.proof_id]
              );
              row.auto_verification_status = 'ERROR';
            }
          })
        );
      }
    }

    // Enrich rows with display info
    const enriched = rows.map(row => {
      let verificationDisplay = null;
      if (row.auto_verification_status && row.auto_verification_status !== 'PENDING') {
        const result = row.auto_verification_result
          ? (typeof row.auto_verification_result === 'string' ? JSON.parse(row.auto_verification_result) : row.auto_verification_result)
          : { status: row.auto_verification_status, fraudFlags: row.fraud_notes ? row.fraud_notes.split(' | ') : [] };
        verificationDisplay = formatVerificationDisplay(result);
      }
      return { ...row, verificationDisplay };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    console.error('GET /api/approval-queue', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
