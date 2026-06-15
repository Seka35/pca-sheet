// Authentication and authorization helpers (server-only)
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';
import { get, all } from './db.js';
import { PERMISSIONS, ROLE_PERMISSIONS } from './permissions.js';

export { PERMISSIONS, ROLE_PERMISSIONS };

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

// Hash password using PBKDF2
export function hashPassword(password) {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

// Verify password against hash
export function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return derived === hash;
}

// Get user by username
export function getUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

// Get user by ID
export function getUserById(id) {
  return get('SELECT id, username, role, permissions, created_at FROM users WHERE id = ?', [id]);
}

// Create a new user
export function createUser(username, password, role = 'custom', permissions = []) {
  const passwordHash = hashPassword(password);
  const result = get(
    'INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?) RETURNING id',
    [username, passwordHash, role, JSON.stringify(permissions)]
  );
  return result;
}

// Update user
export function updateUser(id, updates) {
  const { password, role, permissions } = updates;
  const fields = [];
  const values = [];

  if (password) {
    fields.push('password_hash = ?');
    values.push(hashPassword(password));
  }
  if (role) {
    fields.push('role = ?');
    values.push(role);
  }
  if (permissions !== undefined) {
    fields.push('permissions = ?');
    values.push(JSON.stringify(permissions));
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  return get(`UPDATE users SET ${fields.join(', ')} WHERE id = ? RETURNING id`, values);
}

// Delete user
export function deleteUser(id) {
  return get('DELETE FROM users WHERE id = ? RETURNING id', [id]);
}

// Get all users (without passwords)
export function getAllUsers() {
  return all('SELECT id, username, role, permissions, created_at, updated_at FROM users ORDER BY id');
}

// Check if any users exist (for setup check)
export function hasUsers() {
  const result = get('SELECT COUNT(*) as cnt FROM users');
  return result && result.cnt > 0;
}

// Get effective permissions for a user
export function getUserPermissions(user) {
  if (!user) return [];

  // Super admin has all permissions
  if (user.role === 'super_admin') {
    return Object.values(PERMISSIONS);
  }

  // Get role permissions
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];

  // For custom role, merge with explicit permissions
  if (user.role === 'custom' && user.permissions) {
    const explicitPerms = typeof user.permissions === 'string'
      ? JSON.parse(user.permissions)
      : user.permissions || [];
    return [...new Set([...rolePerms, ...explicitPerms])];
  }

  return rolePerms;
}

// Check if user has a specific permission
export function hasPermission(user, permission) {
  if (!user) return false;
  const perms = getUserPermissions(user);
  return perms.includes(permission);
}

// Parse permissions from user object
export function parseUserPermissions(user) {
  if (!user) return [];
  if (user.role === 'super_admin') {
    return Object.values(PERMISSIONS);
  }
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  if (user.role === 'custom') {
    try {
      const explicit = typeof user.permissions === 'string'
        ? JSON.parse(user.permissions)
        : (user.permissions || []);
      return [...new Set([...rolePerms, ...explicit])];
    } catch {
      return rolePerms;
    }
  }
  return rolePerms;
}
