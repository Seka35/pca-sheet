import { NextResponse } from 'next/server';
import { restoreBackup } from '@/lib/backup';

export async function POST(req, { params }) {
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
    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/backups/[filename]/restore', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
