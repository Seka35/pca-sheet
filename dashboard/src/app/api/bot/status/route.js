import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/botScheduler';
import https from 'https';

function checkTelegramBot(token) {
  return new Promise((resolve) => {
    https.get('https://api.telegram.org/bot' + token + '/getMe', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.ok ? { ok: true, username: parsed.result?.username } : { ok: false });
        } catch (e) {
          resolve({ ok: false });
        }
      });
    }).on('error', () => resolve({ ok: false }));
  });
}

export async function GET() {
  try {
    const cfg = getConfig();
    let reason = 'ok';
    let polling = false;

    if (!cfg) reason = 'no_config';
    else if (!cfg.token && !process.env.TELEGRAM_BOT_TOKEN) reason = 'no_token';
    else if (!cfg.enabled) reason = 'disabled';
    else {
      // Verify bot is actually reachable via Telegram API
      const botCheck = await checkTelegramBot(cfg.token);
      polling = botCheck.ok;
      if (!polling) reason = 'bot_unreachable';
    }

    return NextResponse.json({
      enabled: !!(cfg && cfg.enabled),
      polling,
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
