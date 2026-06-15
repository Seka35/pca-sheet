import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;

  // Public paths that don't need authentication
  const isPublicPath =
    path === '/login' ||
    path === '/login/setup' ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/invoice') ||
    path === '/PCA.png' ||
    path.startsWith('/_next') ||
    path === '/favicon.ico';

  const userId = request.cookies.get('pca_user_id')?.value;

  if (!isPublicPath && !userId) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  if (isPublicPath && userId && (path === '/login' || path === '/login/setup')) {
    return NextResponse.redirect(new URL('/', request.nextUrl));
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
