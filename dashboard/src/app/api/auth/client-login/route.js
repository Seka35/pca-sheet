import { NextResponse } from 'next/server';
import { getUserByUsername, verifyPassword } from '@/lib/auth';
import { logActivity } from '@/lib/db';
import { createSessionToken, getSessionCookieOptions } from '@/lib/session';

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = getUserByUsername(username.trim());

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify this is a client user
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Log successful login
    logActivity(user.id, username, 'LOGIN', 'auth', user.id, 'Client logged in');

    // Create HMAC-signed session token with client_id
    const token = createSessionToken(user.id, user.role, user.client_id);

    const response = NextResponse.json({ ok: true, userId: user.id, username: user.username });
    response.cookies.set({
      ...getSessionCookieOptions(),
      value: token
    });

    return response;
  } catch (error) {
    console.error('[POST /api/auth/client-login]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}