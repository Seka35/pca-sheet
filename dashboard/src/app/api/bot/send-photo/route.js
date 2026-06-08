import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';

export async function POST(req) {
  try {
    const body = await req.json();
    const chatId = String(body.chat_id || '').trim();
    const photoUrl = String(body.photo_url || '').trim();
    const caption = String(body.caption || '').slice(0, 4000);

    if (!chatId || !photoUrl) {
      return NextResponse.json({ error: 'chat_id and photo_url required' }, { status: 400 });
    }

    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot is not running. Save the token and enable the bot in settings.' }, { status: 503 });
    }

    try {
      const result = await bot.sendPhoto(chatId, photoUrl, {
        caption: caption,
        parse_mode: 'HTML',
      });
      return NextResponse.json({ ok: true, message_id: result?.message_id, chat_id: chatId });
    } catch (e) {
      const detail = e?.response?.body?.description || e?.message || String(e);
      return NextResponse.json({ error: 'Telegram send failed', detail }, { status: 502 });
    }
  } catch (e) {
    console.error('POST /api/bot/send-photo', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}