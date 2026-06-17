import { NextResponse } from 'next/server';
import { all, get } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // optional: 'PENDING', 'APPROVED', 'REJECTED'

    let sql = `
      SELECT
        ma.id,
        ma.renewal_sr_no,
        ma.client_id,
        ma.client_name,
        ma.tele_id,
        ma.chat_id,
        ma.chat_title,
        ma.reminder_type,
        ma.message,
        ma.pdf_path,
        ma.status,
        ma.created_at,
        ma.reviewed_at,
        ma.reviewed_by,
        ma.reject_reason,
        ma.sent_message_id
      FROM message_approvals ma
      ORDER BY
        CASE ma.status WHEN 'PENDING' THEN 0 ELSE 1 END,
        ma.created_at DESC
    `;

    const rows = all(sql);

    // Filter by status if specified
    const filtered = statusFilter
      ? rows.filter(r => r.status === statusFilter)
      : rows;

    return NextResponse.json(filtered);
  } catch (e) {
    console.error('GET /api/message-approvals', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
