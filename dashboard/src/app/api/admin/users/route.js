import { NextResponse } from 'next/server';
import { getAllUsers, createUser, hasPermission, getUserById } from '@/lib/auth';
import { logActivity } from '@/lib/db';
import { verifySessionToken } from '@/lib/session';

function checkManageUsers(req) {
  const session = verifySessionToken(req.cookies.get('pca_session')?.value);
  if (!session?.userId) return { ok: false, status: 401 };
  const user = getUserById(session.userId);
  if (!user) return { ok: false, status: 401 };
  // Verify role matches session (defense in depth)
  if (session.role !== user.role) return { ok: false, status: 401 };
  // super_admin bypasses all permission checks
  if (user.role === 'super_admin') return { ok: true, user };
  if (!hasPermission(user, 'read_users')) return { ok: false, status: 403 };
  return { ok: true, user };
}

// GET /api/admin/users - List all users (excludes clients)
export async function GET(req) {
  const auth = checkManageUsers(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const users = getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('[GET /api/admin/users]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/users - Create new user
export async function POST(req) {
  const auth = checkManageUsers(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const { username, password, role, permissions } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (username.trim().length < 2) {
      return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const validRoles = ['super_admin', 'admin', 'read_only', 'invoice_only', 'custom'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Only super_admin can create super_admin
    if (role === 'super_admin' && auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can create super admin users' }, { status: 403 });
    }

    const result = createUser(username.trim(), password, role, permissions || []);

    logActivity(auth.user.id, auth.user.username, 'CREATE', 'users', result?.id, username.trim(), { role, permissions: permissions || [] });

    return NextResponse.json({ ok: true, id: result?.id });
  } catch (error) {
    console.error('[POST /api/admin/users]', error);
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}