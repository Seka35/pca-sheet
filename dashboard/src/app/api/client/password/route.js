import { NextResponse } from 'next/server';
import { getUserById, hashPassword, verifyPassword } from '@/lib/auth';
import { run } from '@/lib/db';

export async function PUT(req) {
  const userId = req.cookies.get('pca_user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserById(parseInt(userId, 10));

  if (!user || user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    if (!verifyPassword(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = hashPassword(newPassword);
    run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, user.id]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/client/password]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
