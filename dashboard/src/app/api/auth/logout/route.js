import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: 'pca_user_id',
    value: '',
    httpOnly: true,
    expires: new Date(0),
    path: '/'
  });

  response.cookies.set({
    name: 'pca_user_role',
    value: '',
    httpOnly: false,
    expires: new Date(0),
    path: '/'
  });

  return response;
}
