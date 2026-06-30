import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const auth = requirePermission(req, 'read_clients');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const client = get(`SELECT internal_notes FROM clients WHERE id = ?`, [Number(id)]);

    return NextResponse.json({ notes: client?.internal_notes || '' });
  } catch (e) {
    console.error(`GET /api/clients/${params?.id}/notes error:`, e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = requirePermission(req, 'update_clients');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { notes } = await req.json();

    run(`UPDATE clients SET internal_notes = ? WHERE id = ?`, [notes ?? '', Number(id)]);
    logActivity(
      auth.user?.id,
      auth.user?.username || 'system',
      'UPDATE',
      'clients',
      Number(id),
      null,
      { internal_notes_length: (notes ?? '').length }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`PUT /api/clients/${params?.id}/notes error:`, e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
