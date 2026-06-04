import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';

export async function POST(req) {
  try {
    const body = await req.json();
    const chatId = String(body.chat_id || '').trim();
    const message = String(body.message || '').slice(0, 4000);
    if (!chatId || !message) {
      return NextResponse.json({ error: 'chat_id and message required' }, { status: 400 });
    }
    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot is not running. Save the token and enable the bot in settings.' }, { status: 503 });
    }
    try {
      const result = await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return NextResponse.json({ ok: true, message_id: result?.message_id, chat_id: chatId });
    } catch (e) {
      const detail = e?.response?.body?.description || e?.message || String(e);
      return NextResponse.json({ error: 'Telegram send failed', detail }, { status: 502 });
    }
  } catch (e) {
    console.error('POST /api/bot/test', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
