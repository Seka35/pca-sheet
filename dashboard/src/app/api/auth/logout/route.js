import { NextResponse } from 'next/server';
import { getClearSessionCookieOptions } from '@/lib/session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(getClearSessionCookieOptions());
  return response;
}