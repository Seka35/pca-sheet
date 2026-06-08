import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;

  // Protect all paths except login, api/auth, and invoice APIs (for PDF generation)
  const isPublicPath = path === '/login' || path.startsWith('/api/auth') || path.startsWith('/api/invoice') || path === '/PCA.png' || path.startsWith('/_next') || path === '/favicon.ico';
  
  const token = request.cookies.get('pca_auth_session')?.value || '';

  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  if (isPublicPath && token && path === '/login') {
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
