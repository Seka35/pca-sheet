import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function GET(req) {
  const user = getUserFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = `SELECT * FROM product_requests WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    // Clients can only see their own requests
    if (user.role === 'client' && user.client_id) {
      query += ` AND client_id = ?`;
      params.push(user.client_id);
    } else if (user.role === 'custom' || user.role === 'admin') {
      // Admins can filter by client_id if provided
      const clientId = searchParams.get('client_id');
      if (clientId) {
        query += ` AND client_id = ?`;
        params.push(clientId);
      }
    }

    query += ` ORDER BY created_at DESC`;

    const rows = all(query, params);

    // Parse products_json for each row
    const enriched = rows.map(row => ({
      ...row,
      products: JSON.parse(row.products_json || '[]')
    }));

    return NextResponse.json(enriched);
  } catch (e) {
    console.error('GET /api/product-requests', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  const user = getUserFromRequest(req);

  if (!user || user.role !== 'client' || !user.client_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { products } = await req.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Products array is required' }, { status: 400 });
    }

    // Get client info
    const client = get('SELECT * FROM clients WHERE id = ?', [user.client_id]);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get chat_id from bot_group_links
    const groupLink = get('SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = "linked" LIMIT 1', [user.client_id]);

    const productsJson = JSON.stringify(products);

    run(
      `INSERT INTO product_requests (client_id, client_name, tele_id, chat_id, products_json, status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [
        user.client_id,
        client.name || '',
        user.tele_id || '',
        groupLink?.chat_id || '',
        productsJson
      ]
    );

    // Notify admins via Telegram (send to team notification chat if configured)
    try {
      const { getBot } = await import('@/lib/telegramBot');
      const { get: getConfig } = await import('@/lib/db');
      const botConfig = getConfig('SELECT team_notification_chat_id FROM bot_config WHERE id = 1');
      const bot = getBot();

      if (bot && botConfig?.team_notification_chat_id) {
        const productNames = products.map(p => `- ${p.name}`).join('\n');
        const message = `📦 <b>New Product Request</b>\n\n<b>${client.name}</b> requested:\n${productNames}\n\nClient ID: ${user.client_id}`;
        await bot.sendMessage(botConfig.team_notification_chat_id, message, { parse_mode: 'HTML' });
      }
    } catch (notifyError) {
      console.error('[product-requests] Failed to send admin notification:', notifyError.message);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/product-requests]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
