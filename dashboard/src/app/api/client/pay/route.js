import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/auth';
import { get, run } from '@/lib/db';

export async function POST(req) {
  const userId = req.cookies.get('pca_user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserById(parseInt(userId, 10));

  if (!user || user.role !== 'client' || !user.client_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sr_no, bank_name, transaction_id, is_topup } = await req.json();

    if (!sr_no || !bank_name || !transaction_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For top-up: verify this renewal belongs to this client
    // For renewal: verify this renewal belongs to this client
    const renewal = get('SELECT * FROM renewals WHERE sr_no = ? AND client_id = ?', [sr_no, user.client_id]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Insert into pending_payments for admin approval
    const now = new Date().toISOString();

    if (is_topup) {
      // Top-up: insert with a unique chat_id per product
      run(`
        INSERT INTO pending_payments (sr_no, chat_id, step, transaction_id, submitted_at)
        VALUES (?, ?, 'AWAIT_TX', ?, ?)
      `, [sr_no, `topup_${user.client_id}_${Date.now()}`, transaction_id, now]);
    } else {
      run(`
        INSERT INTO pending_payments (sr_no, chat_id, step, transaction_id, submitted_at)
        VALUES (?, ?, 'AWAIT_TX', ?, ?)
        ON CONFLICT(sr_no, chat_id) DO UPDATE SET
          step = 'AWAIT_TX',
          transaction_id = excluded.transaction_id,
          submitted_at = excluded.submitted_at
      `, [sr_no, 'client_portal', transaction_id, now]);
    }

    // Also update the renewal with transaction_id
    run('UPDATE renewals SET transaction_id = ?, payment_proof_url = NULL WHERE sr_no = ?', [transaction_id, sr_no]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/client/pay]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
