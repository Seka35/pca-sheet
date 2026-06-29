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

  // Verify the role in session matches the user's actual role (defense in depth)
  if (session.role !== user.role) {
    // Role was changed after session was created, invalidate
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
      clientId: user.client_id
    }
  });
}