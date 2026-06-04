import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('client_id');
    const status = url.searchParams.get('status');

    let sql = `
      SELECT g.chat_id, g.chat_title, g.client_id, g.status,
             g.linked_at, g.last_seen_at,
             c.name AS client_name, c.status AS client_status,
             c.tele_id AS client_tele_id
        FROM bot_group_links g
        LEFT JOIN clients c ON c.id = g.client_id
    `;
    const where = [];
    const params = [];
    if (clientId) { where.push('g.client_id = ?'); params.push(Number(clientId)); }
    if (status)   { where.push('g.status = ?');    params.push(status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY g.last_seen_at DESC';

    const rows = all(sql, params);
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/bot/groups', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
