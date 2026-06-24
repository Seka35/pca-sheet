import { NextResponse } from 'next/server';
import { getUserByUsername, verifyPassword } from '@/lib/auth';
import { logActivity } from '@/lib/db';

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

    // Log successful login
    logActivity(user.id, username, 'LOGIN', 'auth', user.id, 'User logged in');

    const response = NextResponse.json({ ok: true, userId: user.id, username: user.username });

    // Set HTTP-only cookie with user ID
    response.cookies.set({
      name: 'pca_user_id',
      value: String(user.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return response;
  } catch (error) {
    console.error('[POST /api/auth/login]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
