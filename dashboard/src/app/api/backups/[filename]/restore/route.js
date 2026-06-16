import { NextResponse } from 'next/server';
import { restoreBackup } from '@/lib/backup';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

export async function POST(req, { params }) {
  const auth = requirePermission(req, 'restore_backup');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { filename } = await params;
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirm": true } to proceed.' },
        { status: 400 }
      );
    }
    const result = await restoreBackup(filename);

    logActivity(auth.user?.id, auth.user?.username || 'system', 'RESTORE', 'backup', null, filename, null);

    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/backups/[filename]/restore', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
