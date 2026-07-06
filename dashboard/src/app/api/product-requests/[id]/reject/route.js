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

    const request = get('SELECT * FROM product_requests WHERE id = ?', [id]);

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    // Update request status
    run(
      `UPDATE product_requests SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, reject_reason = ? WHERE id = ?`,
      [reviewed_by, reject_reason || '', id]
    );

    // Send Telegram notification to client
    try {
      const link = get(`SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`, [request.client_id]);
      const bot = getBot();

      if (link && bot) {
        const products = JSON.parse(request.products_json || '[]');
        const productNames = products.map(p => `- ${p.name}`).join('\n');
        const message = `❌ <b>Product Request Rejected</b>\n\n<b>${request.client_name}</b>, your product request was rejected.\n\nRequested:\n${productNames}\n\nReason: <i>${reject_reason || 'No reason provided'}</i>\n\nYou can submit a new request from the dashboard.`;
        await bot.sendMessage(link.chat_id, message, { parse_mode: 'HTML' });
      }
    } catch (notifyError) {
      console.error('[product-requests/reject] Failed to send Telegram notification:', notifyError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/product-requests/[id]/reject]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
