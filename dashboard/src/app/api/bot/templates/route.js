import { NextResponse } from 'next/server';
import { getConfig, upsertConfig } from '@/lib/telegramBot';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

export async function GET() {
  try {
    const cfg = getConfig();
    if (!cfg) return NextResponse.json({ templates: {} });
    return NextResponse.json({ templates: cfg.templates || {} });
  } catch (e) {
    console.error('GET /api/bot/templates', e);
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
    if (!body || typeof body !== 'object' || !body.templates) {
      return NextResponse.json({ error: 'templates object required' }, { status: 400 });
    }
    const clean = {};
    for (const [k, v] of Object.entries(body.templates)) {
      const offset = Number(k);
      if (!Number.isFinite(offset)) continue;
      clean[String(offset)] = {
        label: String(v?.label || '').slice(0, 80),
        message: String(v?.message || '').slice(0, 4000),
        enabled: v?.enabled === false ? false : true,
      };
    }
    const updated = upsertConfig({ templates: clean });

    logActivity(auth.user?.id, auth.user?.username || 'system', 'UPDATE', 'bot', 1, 'bot_templates', { offsets: Object.keys(clean) });

    return NextResponse.json({ templates: updated.templates });
  } catch (e) {
    console.error('PUT /api/bot/templates', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
