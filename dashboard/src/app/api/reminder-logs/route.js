import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await all('SELECT COUNT(*) as total FROM reminder_logs');
    const total = countResult[0]?.total || 0;

    // Get paginated reminder logs with client name and chat title
    const logs = await all(`
      SELECT
        rl.id,
        rl.chat_id,
        rl.client_id,
        rl.renewal_sr_no,
        rl.reminder_type,
        rl.message,
        rl.status,
        rl.error,
        rl.telegram_message_id,
        rl.sent_at,
        c.name as client_name,
        bgl.chat_title
      FROM reminder_logs rl
      LEFT JOIN clients c ON c.id = rl.client_id
      LEFT JOIN bot_group_links bgl ON bgl.chat_id = rl.chat_id AND bgl.status = 'linked'
      ORDER BY rl.sent_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur API /reminder-logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}