import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';
import { get, run } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export async function POST(req) {
  const user = getUserFromRequest(req);

  if (!user || user.role !== 'client' || !user.client_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sr_no, bank_name, transaction_id, is_topup, topup_amount, whop_product_payments_json } = await req.json();

    if (!sr_no || !bank_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For top-up: verify this renewal belongs to this client
    const renewal = get('SELECT * FROM renewals WHERE sr_no = ? AND client_id = ?', [sr_no, user.client_id]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const isTopupFlag = is_topup ? 1 : 0;
    let amountDue;

    if (is_topup) {
      // Top-up: amount is the topup_amount
      amountDue = parseFloat(topup_amount) || 0;

      // Insert into pending_payments with unique chat_id
      run(`
        INSERT INTO pending_payments (sr_no, chat_id, step, transaction_id, submitted_at, topup_amount, tele_id, client_id, whop_product_payments_json)
        VALUES (?, ?, 'AWAIT_TX', ?, ?, ?, ?, ?, ?)
      `, [sr_no, `topup_${user.client_id}_${Date.now()}`, transaction_id, now, topup_amount || null, String(user.tele_id || ''), user.client_id, whop_product_payments_json || null]);
    } else {
      // Regular renewal: calculate amount due
      amountDue = parseAmount(renewal.subscription_fee) + parseAmount(renewal.setup_fee) - parseAmount(renewal.discount);

      run(`
        INSERT INTO pending_payments (sr_no, chat_id, step, transaction_id, submitted_at, client_id, whop_product_payments_json)
        VALUES (?, ?, 'AWAIT_TX', ?, ?, ?, ?)
        ON CONFLICT(sr_no, chat_id) DO UPDATE SET
          step = 'AWAIT_TX',
          transaction_id = excluded.transaction_id,
          submitted_at = excluded.submitted_at,
          client_id = excluded.client_id,
          whop_product_payments_json = excluded.whop_product_payments_json
      `, [sr_no, 'client_portal', transaction_id, now, user.client_id, whop_product_payments_json || null]);
    }

    // Insert into payment_proofs (required for approval_queue)
    run(
      `INSERT INTO payment_proofs (sr_no, client_id, transaction_id, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [sr_no, user.client_id, transaction_id]
    );

    const proofRow = get(
      `SELECT id FROM payment_proofs WHERE sr_no = ? AND client_id = ? ORDER BY id DESC LIMIT 1`,
      [sr_no, user.client_id]
    );

    // Insert into approval_queue for admin review
    run(
      `INSERT INTO approval_queue (proof_id, sr_no, client_id, client_name, tele_id, product_type, amount_due, due_date, bank_name, transaction_id, submitted_at, status, is_topup, topup_amount, whop_product_payments_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING', ?, ?, ?)`,
      [
        proofRow.id,
        sr_no,
        user.client_id,
        user.name || '',
        user.tele_id || '',
        renewal.tier || '',
        amountDue.toFixed(2),
        renewal.valid_stopped_date || '',
        bank_name,
        transaction_id,
        isTopupFlag,
        is_topup ? (topup_amount || null) : null,
        whop_product_payments_json || null,
      ]
    );

    // Also update the renewal with transaction_id
    run('UPDATE renewals SET transaction_id = ?, payment_proof_url = NULL WHERE sr_no = ?', [transaction_id, sr_no]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/client/pay]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}