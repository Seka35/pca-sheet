import { NextResponse } from 'next/server';
import { getUserById, parseUserPermissions } from '@/lib/auth';

export async function GET(req) {
  const userId = req.cookies.get('pca_user_id')?.value;

  if (!userId) {
    return NextResponse.json({ authenticated: false });
  }

  const user = getUserById(parseInt(userId, 10));

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const permissions = parseUserPermissions(user);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions,
    }
  });
}
