import { NextResponse } from 'next/server';
import { listBackups, createBackup, pruneOldBackups, getCronState, setCronHour } from '@/lib/backup';

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
      const h = setCronHour(body.hour);
      return NextResponse.json({ hour: h });
    }
    const meta = await createBackup({ source: 'manual' });
    const removed = await pruneOldBackups();
    return NextResponse.json({ backup: meta, pruned: removed });
  } catch (e) {
    console.error('POST /api/backups', e);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}
