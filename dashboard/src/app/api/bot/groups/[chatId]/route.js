import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';

export async function PATCH(req, { params }) {
  try {
    const { chatId } = await params;
    const body = await req.json();
    const clientId = Number(body.client_id);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json({ error: 'client_id required' }, { status: 400 });
    }
    const client = get('SELECT id, name, telegram_group_id FROM clients WHERE id = ?', [clientId]);
    if (!client) return NextResponse.json({ error: 'client not found' }, { status: 404 });

    const existing = get('SELECT * FROM bot_group_links WHERE chat_id = ?', [chatId]);
    if (!existing) {
      run(
        `INSERT INTO bot_group_links (chat_id, chat_title, client_id, status, linked_at)
         VALUES (?, ?, ?, 'linked', CURRENT_TIMESTAMP)`,
        [chatId, body.chat_title || '(assigned manually)', clientId]
      );
    } else {
      run(
        `UPDATE bot_group_links
            SET client_id = ?, status = 'linked', linked_at = CURRENT_TIMESTAMP
          WHERE chat_id = ?`,
        [clientId, chatId]
      );
    }

    // First-link-wins for the legacy column.
    run(
      `UPDATE clients SET telegram_group_id = ?
        WHERE id = ? AND (telegram_group_id IS NULL OR telegram_group_id = '')`,
      [chatId, clientId]
    );

    return NextResponse.json({ ok: true, client_id: clientId, client_name: client.name });
  } catch (e) {
    console.error('PATCH /api/bot/groups/[chatId]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { chatId } = await params;
    const row = get('SELECT client_id FROM bot_group_links WHERE chat_id = ?', [chatId]);
    run(`UPDATE bot_group_links SET status = 'archived' WHERE chat_id = ?`, [chatId]);
    if (row && row.client_id) {
      const remaining = get(
        `SELECT 1 AS hit FROM bot_group_links
          WHERE client_id = ? AND status = 'linked' AND chat_id <> ?`,
        [row.client_id, chatId]
      );
      if (!remaining) {
        run('UPDATE clients SET telegram_group_id = NULL WHERE id = ?', [row.client_id]);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/bot/groups/[chatId]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
