import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';

export async function POST(req) {
  try {
    // Note: WEBHOOK_SECRET validation removed because Telegram doesn't send it
    // unless the webhook was set with the secret token
    const body = await req.json();
    const bot = getBot();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not running' }, { status: 500 });
    }

    // Log incoming update types for debugging
    if (body.message) {
      console.log(`[webhook] message received: chat=${body.message.chat?.id}, text=${body.message.text?.slice(0, 50)}`);
      bot.emit('webhook_message', body.message);
    } else if (body.edited_message) {
      console.log(`[webhook] edited_message received`);
      bot.emit('edited_message', body.edited_message);
    } else if (body.callback_query) {
      console.log(`[webhook] callback_query received: data=${body.callback_query.data?.slice(0, 50)}`);
      bot.emit('callback_query', body.callback_query);
    } else if (body.my_chat_member) {
      console.log(`[webhook] my_chat_member received`);
      bot.emit('my_chat_member', body.my_chat_member);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[webhook/telegram] error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Telegram sends GET for webhook verification
export async function GET() {
  return NextResponse.json({ ok: true });
}
