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

    const { id, file_id } = await params;

    // Verify this client has a linked group with the file
    const link = get(
      `SELECT bgl.chat_id FROM bot_group_links bgl
       JOIN telegram_messages tm ON tm.chat_id = bgl.chat_id
       WHERE bgl.client_id = ? AND bgl.status = 'linked' AND tm.file_id = ?
       LIMIT 1`,
      [Number(id), file_id]
    );

    if (!link) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
    }

    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot not running' }, { status: 500 });
    }

    // Get file path from Telegram
    let file;
    try {
      file = await bot.getFile(file_id);
    } catch {
      return NextResponse.json({ error: 'File not found in Telegram' }, { status: 404 });
    }

    if (!file || !file.file_path) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Construct the file URL and fetch it
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    const fileRes = await fetch(fileUrl);

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch file from Telegram' }, { status: 502 });
    }

    const buffer = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${file_id}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (e) {
    console.error(`GET /api/clients/${params?.id}/files/${params?.file_id} error:`, e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
