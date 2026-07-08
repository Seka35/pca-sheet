import { NextResponse } from 'next/server';
import { getUserById, parseUserPermissions } from '@/lib/auth';
import { verifySessionToken } from '@/lib/session';

export async function GET(req) {
  const session = verifySessionToken(req.cookies.get('pca_session')?.value);

  if (!session?.userId) {
    return NextResponse.json({ authenticated: false });
  }

  const user = getUserById(session.userId);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  // Note: we intentionally don't check session.role !== user.role here.
  // If an admin changes a user's role, the user's existing session stays valid —
  // permissions are re-evaluated on each /api/auth/me call via parseUserPermissions.

  const permissions = parseUserPermissions(user);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions,
      clientId: user.client_id
    }
  });
}