import { NextResponse } from 'next/server';
import { getConfig, upsertConfig, getBot, startBot, stopBot } from '@/lib/telegramBot';
import { startSweepTimer, stopSweepTimer } from '@/lib/botScheduler';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

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
  const auth = requirePermission(req, 'update_bot');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

    // Capture the previous enabled state BEFORE we save the new one, so we
    // can decide whether to start or stop the live bot instance.
    const prevCfg = getConfig();
    const wasEnabled = !!prevCfg?.enabled;
    const willBeEnabled = typeof body.enabled === 'boolean' ? body.enabled : wasEnabled;

    const updated = upsertConfig(patch);

    // Start or stop the live bot instance to match the new enabled state.
    // Without this, toggling the checkbox in the UI would persist the flag
    // but leave the polling loop in its previous state.
    if (willBeEnabled && !getBot()) {
      const res = await startBot();
      console.log('[bot/config] startBot after enable:', res);
    } else if (!willBeEnabled && getBot()) {
      await stopBot();
      console.log('[bot/config] stopBot after disable');
    } else if (getBot()) {
      // Already running — just reschedule the sweep timer (interval may have changed).
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

    logActivity(auth.user?.id, auth.user?.username || 'system', 'UPDATE', 'bot', 1, 'bot_config', patch);

    return NextResponse.json({ ...safe, has_token: !!token, token_preview });
  } catch (e) {
    console.error('PUT /api/bot/config', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
