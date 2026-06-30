import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(req, { params }) {
  try {
    const auth = requirePermission(req, 'read_clients');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Verify the client has a linked group
    const link = get(
      `SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`,
      [Number(id)]
    );
    if (!link) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot not running' }, { status: 500 });
    }

    // Get user profile photos from Telegram
    let photos;
    try {
      photos = await bot.getUserProfilePhotos(Number(userId), { limit: 1 });
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!photos || !photos.photos || photos.photos.length === 0) {
      return NextResponse.json({ error: 'No photo' }, { status: 404 });
    }

    // Get the smallest photo (first in array = smallest)
    const photo = photos.photos[0][0];
    if (!photo?.file_id) {
      return NextResponse.json({ error: 'No photo' }, { status: 404 });
    }

    // Get file path and fetch the image
    let file;
    try {
      file = await bot.getFile(photo.file_id);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    const fileRes = await fetch(fileUrl);

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch avatar' }, { status: 502 });
    }

    const buffer = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error(`GET /api/clients/${params?.id}/avatar error:`, e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
