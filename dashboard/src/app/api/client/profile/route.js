import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';
import { run } from '@/lib/db';

export async function PUT(req) {
  const user = getUserFromRequest(req);

  if (!user || user.role !== 'client' || !user.client_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { first_name, last_name, email, address } = await req.json();

    // Validate
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    run(
      'UPDATE clients SET first_name = ?, last_name = ?, email = ?, address = ? WHERE id = ?',
      [first_name || '', last_name || '', email || '', address || '', user.client_id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/client/profile]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}