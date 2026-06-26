import { NextResponse } from 'next/server';

export function middleware(request) {
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

  const userId = request.cookies.get('pca_user_id')?.value;
  const userRole = request.cookies.get('pca_user_role')?.value;

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

    if (userRole === 'client') {
      // Clients should go to client dashboard, not admin pages
      if (isAdminLoginPage) {
        return NextResponse.redirect(new URL('/client/dashboard', request.nextUrl));
      }
      // If already on client login, stay there
      if (isClientLoginPage) {
        return NextResponse.next();
      }
    } else {
      // Admins should go to admin dashboard, not client portal
      if (isClientLoginPage) {
        return NextResponse.redirect(new URL('/', request.nextUrl));
      }
      // If already on admin login, stay there
      if (isAdminLoginPage) {
        return NextResponse.redirect(new URL('/', request.nextUrl));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhook (webhooks don't need auth session)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/webhook|_next/static|_next/image|favicon.ico).*)',
  ],
};
