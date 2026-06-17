import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';

export async function POST(req) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2]; // /api/message-approvals/[id]/reject

  try {
    const body = await req.json();
    const { reject_reason } = body;

    if (!reject_reason || typeof reject_reason !== 'string' || !reject_reason.trim()) {
      return NextResponse.json({ error: 'reject_reason is required' }, { status: 400 });
    }

    let reviewed_by = 'admin';

    const entry = get('SELECT * FROM message_approvals WHERE id = ?', [id]);

    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (entry.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    run(
      `UPDATE message_approvals SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, reject_reason = ? WHERE id = ?`,
      [reviewed_by, reject_reason.trim(), id]
    );

    console.log('[reject] message rejected for sr_no:', entry.renewal_sr_no);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[reject] ERROR:', e.message);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}
