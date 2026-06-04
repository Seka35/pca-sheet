import { NextResponse } from 'next/server';
import { getConfig, upsertConfig, getBot } from '@/lib/telegramBot';
import { startSweepTimer, stopSweepTimer } from '@/lib/botScheduler';

export async function GET() {
  try {
    const cfg = getConfig();
    if (!cfg) return NextResponse.json({ error: 'no_config' }, { status: 404 });
    // Never leak the full token to the client. Show a masked preview (first 8 + last 4 chars).
    const { token, ...safe } = cfg;
    let token_preview = null;
    if (token && token.length > 12) {
      token_preview = `${token.slice(0, 8)}…${token.slice(-4)}`;
    } else if (token) {
      token_preview = '•'.repeat(token.length);
    }
    return NextResponse.json({
      ...safe,
      has_token: !!token,
      token_preview,
      bot_running: !!getBot(),
    });
  } catch (e) {
    console.error('GET /api/bot/config', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const patch = {};

    if (typeof body.token === 'string') patch.token = body.token.trim() || null;
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (Array.isArray(body.reminder_days)) patch.reminder_days = body.reminder_days.map(Number);
    if (body.templates && typeof body.templates === 'object') patch.templates = body.templates;
    if (Number.isFinite(Number(body.sweep_interval_minutes))) {
      patch.sweep_interval_minutes = Math.max(1, Number(body.sweep_interval_minutes));
    }
    if (typeof body.quiet_hours_start === 'string') patch.quiet_hours_start = body.quiet_hours_start || null;
    if (typeof body.quiet_hours_end === 'string') patch.quiet_hours_end = body.quiet_hours_end || null;
    if (typeof body.timezone === 'string') patch.timezone = body.timezone.trim() || 'UTC';

    const updated = upsertConfig(patch);

    // Reschedule sweep timer if interval changed.
    if (getBot()) {
      stopSweepTimer();
      startSweepTimer(() => getBot());
    }

    const { token, ...safe } = updated;
    let token_preview = null;
    if (token && token.length > 12) {
      token_preview = `${token.slice(0, 8)}…${token.slice(-4)}`;
    } else if (token) {
      token_preview = '•'.repeat(token.length);
    }
    return NextResponse.json({ ...safe, has_token: !!token, token_preview });
  } catch (e) {
    console.error('PUT /api/bot/config', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
