import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
    const clientId = url.searchParams.get('client_id');
    const chatId = url.searchParams.get('chat_id');

    let sql = `
      SELECT l.id, l.chat_id, l.client_id, l.renewal_sr_no, l.reminder_type,
             l.message, l.status, l.error, l.telegram_message_id, l.sent_at,
             c.name AS client_name
        FROM reminder_logs l
        LEFT JOIN clients c ON c.id = l.client_id
    `;
    const where = [];
    const params = [];
    if (clientId) { where.push('l.client_id = ?'); params.push(Number(clientId)); }
    if (chatId)   { where.push('l.chat_id = ?');   params.push(chatId); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY l.sent_at DESC LIMIT ?';
    params.push(limit);

    const rows = all(sql, params);
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/bot/log', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
