import { NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser, hasPermission } from '@/lib/auth';
import { logActivity } from '@/lib/db';
import { verifySessionToken } from '@/lib/session';

function checkManageUsers(req) {
  const session = verifySessionToken(req.cookies.get('pca_session')?.value);
  if (!session?.userId) return { ok: false, status: 401 };
  const user = getUserById(session.userId);
  if (!user) return { ok: false, status: 401 };
  // Note: session.role check intentionally omitted — if admin changes a user's role,
  // the user's existing session stays valid. Permissions are re-evaluated on each request.
  // super_admin bypasses all permission checks
  if (user.role === 'super_admin') return { ok: true, user };
  if (!hasPermission(user, 'read_users')) return { ok: false, status: 403 };
  return { ok: true, user };
}

// PUT /api/admin/users/[id] - Update user
export async function PUT(req, { params }) {
  const auth = checkManageUsers(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);
    const { username, password, role, permissions } = await req.json();

    // Check if user exists
    const existingUser = getUserById(numericId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates = {};

    if (username && username.trim() !== existingUser.username) {
      updates.username = username.trim();
    }

    if (password) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
      }
      updates.password = password;
    }

    if (role && role !== existingUser.role) {
      const validRoles = ['super_admin', 'admin', 'read_only', 'invoice_only', 'custom'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      // Only super_admin can promote to super_admin
      if (role === 'super_admin' && auth.user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Only super admin can assign super admin role' }, { status: 403 });
      }

      updates.role = role;
    }

    if (permissions !== undefined) {
      updates.permissions = permissions;
    }

    if (Object.keys(updates).length > 0) {
      updateUser(numericId, updates);
      logActivity(auth.user.id, auth.user.username, 'UPDATE', 'users', numericId, existingUser.username, updates);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/admin/users/[id]]', error);
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(req, { params }) {
  const auth = checkManageUsers(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    // Prevent self-deletion
    if (numericId === auth.user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const existingUser = getUserById(numericId);
    const result = deleteUser(numericId);
    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    logActivity(auth.user.id, auth.user.username, 'DELETE', 'users', numericId, existingUser?.username, null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/admin/users/[id]]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}