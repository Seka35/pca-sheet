import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';
import { getConfig } from '@/lib/botScheduler';

export async function GET() {
  try {
    const cfg = getConfig();
    const running = !!getBot();
    let reason = 'ok';
    if (!cfg) reason = 'no_config';
    else if (!cfg.token && !process.env.TELEGRAM_BOT_TOKEN) reason = 'no_token';
    else if (!cfg.enabled) reason = 'disabled';

    return NextResponse.json({
      enabled: !!(cfg && cfg.enabled),
      polling: running,
      bot_username: cfg?.bot_username || null,
      last_sweep_at: cfg?.last_sweep_at || null,
      sweep_interval_minutes: cfg?.sweep_interval_minutes || 15,
      reason,
    });
  } catch (e) {
    console.error('GET /api/bot/status', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
