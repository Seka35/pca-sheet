import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(req, { params }) {
  try {
    const auth = requirePermission(req, 'read_clients');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    // Get linked chat_id for this client
    const link = get(
      `SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`,
      [Number(id)]
    );

    if (!link) {
      return NextResponse.json({ messages: [], chat_id: null });
    }

    // Fetch messages for this client's group (chronological order)
    const messages = all(
      `SELECT m.*, e.edited_at, e.new_text AS edited_text
       FROM telegram_messages m
       LEFT JOIN telegram_edited_messages e ON e.message_id = m.message_id AND e.chat_id = m.chat_id
       WHERE m.chat_id = ?
       ORDER BY m.message_id ASC
       LIMIT ?`,
      [link.chat_id, limit]
    );

    return NextResponse.json({
      messages,
      chat_id: link.chat_id,
    });
  } catch (e) {
    console.error(`GET /api/clients/${params?.id}/messages error:`, e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const auth = requirePermission(req, 'update_clients');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // Get linked chat_id for this client
    const link = get(
      `SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`,
      [Number(id)]
    );

    if (!link) {
      return NextResponse.json({ error: 'No linked Telegram group' }, { status: 404 });
    }

    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot not running' }, { status: 500 });
    }

    // Send message via bot
    const result = await bot.sendMessage(link.chat_id, text.trim(), {
      parse_mode: 'HTML',
    });

    // Store the sent message in DB (it came from the bot, so is_bot = 1)
    run(
      `INSERT OR IGNORE INTO telegram_messages
         (message_id, chat_id, client_id, user_id, username, first_name, last_name,
          text, file_id, file_type, file_caption, date, is_bot, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.message_id,
        String(link.chat_id),
        Number(id),
        String(bot.options?.token?.split(':')[0] || ''), // bot user id placeholder
        null,
        'Bot',
        null,
        text.trim(),
        null, null, null,
        result.date,
        1,
        JSON.stringify(result),
      ]
    );

    return NextResponse.json({ ok: true, message_id: result.message_id });
  } catch (e) {
    console.error(`POST /api/clients/${params?.id}/messages error:`, e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
