// Server-side API authorization helpers
import { getUserById, hasPermission } from './auth';
import { verifySessionToken } from './session';

/**
 * Get the current user from a Next.js request (via signed session cookie).
 * Returns null if not authenticated or session is invalid/tampered.
 */
export function getUserFromRequest(req) {
  const session = verifySessionToken(req.cookies?.get('pca_session')?.value);
  if (!session?.userId) return null;
  const user = getUserById(session.userId);
  if (!user) return null;
  // Defense in depth: verify role matches session
  if (session.role !== user.role) return null;
  return user;
}

/**
 * Require a specific permission for the request.
 * Returns { ok: false, status, error } if unauthorized, { ok: true, user } if authorized.
 */
export function requirePermission(req, permission) {
  const user = getUserFromRequest(req);
  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!hasPermission(user, permission)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, user };
}

/**
 * Require any of the given permissions (OR logic).
 */
export function requireAnyPermission(req, permissions) {
  const user = getUserFromRequest(req);
  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const hasAny = permissions.some(p => hasPermission(user, p));
  if (!hasAny) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, user };
}