import { NextResponse } from 'next/server';
import { listBackups, createBackup, pruneOldBackups, getCronState, setCronHour } from '@/lib/backup';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

export async function GET() {
  try {
    const [backups, cron] = await Promise.all([listBackups(), Promise.resolve(getCronState())]);
    return NextResponse.json({ backups, cron });
  } catch (e) {
    console.error('GET /api/backups', e);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.hour === 'number') {
      const auth = requirePermission(req, 'update_backup');
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      const h = setCronHour(body.hour);
      logActivity(auth.user?.id, auth.user?.username || 'system', 'UPDATE', 'backup', 1, 'backup_schedule', { hour: body.hour });
      return NextResponse.json({ hour: h });
    }
    const auth = requirePermission(req, 'create_backup');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const meta = await createBackup({ source: 'manual' });
    const removed = await pruneOldBackups();
    logActivity(auth.user?.id, auth.user?.username || 'system', 'CREATE', 'backup', null, meta.filename, null);
    return NextResponse.json({ backup: meta, pruned: removed });
  } catch (e) {
    console.error('POST /api/backups', e);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}
