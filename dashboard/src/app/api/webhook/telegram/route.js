import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req) {
  try {
    // Validate secret token
    if (WEBHOOK_SECRET) {
      const receivedToken = req.headers.get('x-telegram-bot-api-secret-token');
      if (receivedToken !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const bot = getBot();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not running' }, { status: 500 });
    }

    // Handle different update types
    if (body.message) {
      bot.emit('webhook_message', body.message);
    } else if (body.edited_message) {
      bot.emit('edited_message', body.edited_message);
    } else if (body.callback_query) {
      bot.emit('callback_query', body.callback_query);
    } else if (body.my_chat_member) {
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
