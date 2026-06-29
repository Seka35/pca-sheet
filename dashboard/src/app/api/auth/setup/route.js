import { NextResponse } from 'next/server';
import { hasUsers, createUser } from '@/lib/auth';
import { createSessionToken, getSessionCookieOptions } from '@/lib/session';

export async function POST(req) {
  try {
    // Check if users already exist
    if (hasUsers()) {
      return NextResponse.json({ error: 'Setup already completed' }, { status: 403 });
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (username.trim().length < 2) {
      return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const result = createUser(username.trim(), password, 'super_admin', []);

    if (!result) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create HMAC-signed session token
    const token = createSessionToken(result.id, 'super_admin', null);

    const response = NextResponse.json({ ok: true, userId: result.id });
    response.cookies.set({
      ...getSessionCookieOptions(),
      value: token
    });

    return response;
  } catch (error) {
    console.error('[POST /api/auth/setup]', error);
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Check if setup is needed
export async function GET() {
  const needsSetup = !hasUsers();
  return NextResponse.json({ needsSetup });
}