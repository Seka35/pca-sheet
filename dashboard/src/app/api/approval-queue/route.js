import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';

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
        pp.submitted_at as proof_submitted_at
      FROM approval_queue aq
      LEFT JOIN payment_proofs pp ON pp.id = aq.proof_id
      ORDER BY aq.submitted_at DESC
    `);
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/approval-queue', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}