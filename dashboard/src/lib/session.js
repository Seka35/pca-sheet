// Session management with HMAC-signed tokens
// Uses Web Crypto API for Edge runtime compatibility
// Token format: base64(payload).base64(signature)

const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-in-production!!';
const COOKIE_NAME = 'pca_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Create a signed session token (server-side only, uses Node crypto)
export function createSessionToken(userId, role, clientId = null) {
  // Use dynamic import to avoid Edge runtime issues
  const { createHmac, randomBytes } = require('crypto');

  const payload = {
    userId,
    role,
    clientId,
    iat: Date.now(),
    nonce: randomBytes(8).toString('hex')
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  const token = `${payloadStr}.${signature}`;

  return token;
}

// Verify a session token and return the payload (server-side only)
export function verifySessionToken(token) {
  if (!token) return null;

  try {
    const { createHmac } = require('crypto');

    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    // Verify signature
    const expectedSig = createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
    if (signature !== expectedSig) {
      console.warn('[session] Invalid signature');
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    // Check expiration
    if (Date.now() - payload.iat > TOKEN_MAX_AGE_MS) {
      console.warn('[session] Token expired');
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
      clientId: payload.clientId
    };
  } catch (e) {
    console.error('[session] Verify error:', e.message);
    return null;
  }
}

// Get cookie options for setting session cookie
export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE
  };
}

// Get cookie options for clearing session cookie
export function getClearSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0)
  };
}