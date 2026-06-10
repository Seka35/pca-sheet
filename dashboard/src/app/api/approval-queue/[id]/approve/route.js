import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';

export async function POST(req) {
  // Extract ID from URL since params can be empty in Next.js 16
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2]; // /api/approval-queue/[id]/approve -> index -2 is [id]

  console.log('[APPROVE] id from url:', id);

  try {
    let reviewed_by = 'admin';

    const entry = get('SELECT * FROM approval_queue WHERE id = ?', [id]);
    console.log('[APPROVE] entry:', entry ? 'found' : 'NOT FOUND');

    if (!entry) {
      return NextResponse.json({ error: 'Not found', id }, { status: 404 });
    }

    if (entry.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    run(
      `UPDATE approval_queue SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?`,
      [reviewed_by, id]
    );

    run(
      `UPDATE payment_proofs SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [entry.proof_id]
    );

    const existingRenewal = get('SELECT id FROM renewals WHERE sr_no = ?', [entry.sr_no]);

    if (existingRenewal) {
      run(
        `UPDATE renewals SET
          reference_no = ?,
          transaction_id = ?,
          payment_proof_url = ?,
          paid_at = CURRENT_TIMESTAMP,
          payment_received_date = DATE('now'),
          payment_received_month = strftime('%Y-%m', 'now'),
          visual_status = 'paid'
        WHERE sr_no = ?`,
        [entry.transaction_id, entry.transaction_id, entry.proof_image_url, entry.sr_no]
      );
    } else {
      run(
        `INSERT INTO renewals (
          sr_no, client_id, client_name, month,
          reference_no, transaction_id, payment_proof_url,
          paid_at, payment_received_date, payment_received_month,
          visual_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, DATE('now'), strftime('%Y-%m', 'now'), 'paid')`,
        [
          entry.sr_no,
          entry.client_id,
          entry.client_name,
          entry.due_date ? entry.due_date.slice(0, 7) : (new Date().toISOString().slice(0, 7)),
          entry.transaction_id,
          entry.transaction_id,
          entry.proof_image_url,
        ]
      );
    }

    // Send Telegram notification to the client
    try {
      const link = get(`SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`, [entry.client_id]);
      if (link) {
        const bot = getBot();
        if (bot) {
          await bot.sendMessage(
            link.chat_id,
            `✅ <b>Payment Approved!</b>\n\n` +
            `<b>${entry.client_name}</b>, your payment of <b>${entry.amount_due}</b> has been<b>approved</b>!\n\n` +
            `Transaction ID: <code>${entry.transaction_id || 'N/A'}</code>\n\n` +
            `Your account is now active. Thank you for your payment!`,
            { parse_mode: 'HTML' }
          );
        }
      }
    } catch (e) {
      console.error('[APPROVE] Telegram notification failed:', e.message);
    }

    console.log('[APPROVE] success for sr_no:', entry.sr_no);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[APPROVE] ERROR:', e.message);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}