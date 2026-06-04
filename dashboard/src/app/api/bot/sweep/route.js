import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';
import { runReminderSweepOnce } from '@/lib/botScheduler';

export async function POST() {
  try {
    const bot = getBot();
    const result = await runReminderSweepOnce(bot);
    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/bot/sweep', e);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}
