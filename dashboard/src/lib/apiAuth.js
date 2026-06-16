// Server-side API authorization helpers
import { getUserById } from './auth';
import { hasPermission } from './auth';

/**
 * Get the current user from a Next.js request (via cookie).
 * Returns null if not authenticated.
 */
export function getUserFromRequest(req) {
  const userId = req.cookies?.get?.('pca_user_id')?.value;
  if (!userId) return null;
  return getUserById(parseInt(userId, 10));
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
