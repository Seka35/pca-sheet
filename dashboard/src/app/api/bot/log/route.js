import { NextResponse } from 'next/server';
import { all, run } from '@/lib/db';

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

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('client_id');
    const chatId = url.searchParams.get('chat_id');
    const allLogs = url.searchParams.get('all') === 'true';

    let sql = 'DELETE FROM reminder_logs';
    const params = [];
    const where = [];

    if (!allLogs) {
      if (clientId) { where.push('client_id = ?'); params.push(Number(clientId)); }
      if (chatId)   { where.push('chat_id = ?');   params.push(chatId); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
    }

    const result = run(sql, params);

    // Also clear the reminders_sent_json cache so reminders can be re-sent
    if (allLogs) {
      run('UPDATE renewals SET reminders_sent_json = NULL');
    } else if (clientId) {
      run('UPDATE renewals SET reminders_sent_json = NULL WHERE client_id = ?', [Number(clientId)]);
    }

    return NextResponse.json({ ok: true, deleted: result.changes });
  } catch (e) {
    console.error('DELETE /api/bot/log', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
