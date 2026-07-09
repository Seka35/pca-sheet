import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';

export async function POST(req) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2];

  try {
    const { reject_reason } = await req.json();
    const reviewed_by = 'admin';

    const request = get('SELECT * FROM upgrade_requests WHERE id = ?', [id]);

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (request.status === 'COMPLETED' || request.status === 'REJECTED') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    // Mark as rejected
    run(
      `UPDATE upgrade_requests SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, reject_reason = ? WHERE id = ?`,
      [reviewed_by, reject_reason || '', id]
    );

    // Clear the upgrade status on the renewal
    run('UPDATE renewals SET upgrade_status = NULL WHERE sr_no = ?', [request.renewal_sr_no]);

    // Notify client
    try {
      const link = get('SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = \'linked\' LIMIT 1', [request.client_id]);
      const bot = getBot();

      if (link && bot) {
        const reason = reject_reason ? `\n\nReason: ${reject_reason}` : '';
        const message = `❌ <b>Upgrade Rejected</b>\n\nYour upgrade request for product <b>${request.renewal_sr_no}</b> has been rejected.${reason}\n\nPlease contact support if you have questions.`;
        await bot.sendMessage(link.chat_id, message, { parse_mode: 'HTML' });
      }
    } catch (notifyError) {
      console.error('[upgrade-requests/reject] Failed to send notification:', notifyError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/upgrade-requests/[id]/reject]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
