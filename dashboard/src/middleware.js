import { NextResponse } from 'next/server';

const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-in-production!!';
const COOKIE_NAME = 'pca_session';

// Decode base64url string to bytes
function base64UrlDecode(str) {
  // Replace base64url characters with standard base64
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (str.length % 4) {
    str += '=';
  }
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// Verify HMAC signature using Web Crypto API (Edge compatible)
async function verifyToken(token) {
  if (!token) return null;

  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(payloadStr)
    );

    if (!isValid) {
      console.warn('[middleware] Invalid signature');
      return null;
    }

    // Decode payload
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadStr)));

    // Check expiration (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.iat > maxAge) {
      console.warn('[middleware] Token expired');
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
      clientId: payload.clientId
    };
  } catch (e) {
    console.error('[middleware] Verify error:', e.message);
    return null;
  }
}

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  // Public paths that don't need authentication
  const isPublicPath =
    path === '/login' ||
    path === '/login/setup' ||
    path === '/login/client' ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/invoice') ||
    path === '/PCA.png' ||
    path === '/PCA-white.png' ||
    path === '/favicon.ico' ||
    path.startsWith('/_next');

  // Verify the signed session token
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await verifyToken(token);
  const userId = session?.userId;
  const isClientUser = session?.role === 'client';

  if (!isPublicPath && !userId) {
    // For API routes, return JSON 401 instead of redirecting to HTML
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // If user is logged in and visits a login page, redirect based on role
  if (isPublicPath && userId) {
    const isClientLoginPage = path === '/login/client';
    const isAdminLoginPage = path === '/login' || path === '/login/setup';

    if (isClientUser) {
      // Clients should go to client dashboard, not admin pages
      if (isAdminLoginPage) {
        return NextResponse.redirect(new URL('/client/dashboard', request.nextUrl));
      }
    } else {
      // Admins should go to admin dashboard, not client portal
      if (isClientLoginPage) {
        return NextResponse.redirect(new URL('/', request.nextUrl));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/webhook|_next/static|_next/image|favicon.ico).*)',
  ],
};