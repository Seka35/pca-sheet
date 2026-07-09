import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

// GET - List upgrade requests
export async function GET(req) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'custom')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('client_id');

    let query = `SELECT ur.*, c.name as client_name, r.tier as current_tier, r.setup_type as current_setup, r.subscription_fee as current_subscription_fee, r.setup_fee as current_setup_fee, r.discount as current_discount
                 FROM upgrade_requests ur
                 LEFT JOIN clients c ON ur.client_id = c.id
                 LEFT JOIN renewals r ON ur.renewal_sr_no = r.sr_no
                 WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND ur.status = ?`;
      params.push(status);
    }

    if (clientId) {
      query += ` AND ur.client_id = ?`;
      params.push(clientId);
    }

    // Clients can only see their own upgrade requests
    if (user.role === 'client' && user.client_id) {
      query += ` AND ur.client_id = ?`;
      params.push(user.client_id);
    }

    query += ` ORDER BY ur.created_at DESC`;

    const rows = all(query, params);
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/upgrade-requests', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Create a new upgrade request (client initiates upgrade)
export async function POST(req) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== 'client' || !user.client_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { renewal_sr_no, component_type, to_tier, to_setup } = await req.json();

    if (!renewal_sr_no || !component_type) {
      return NextResponse.json({ error: 'renewal_sr_no and component_type are required' }, { status: 400 });
    }

    // Get the current product
    const renewal = get('SELECT * FROM renewals WHERE sr_no = ? AND client_id = ?', [renewal_sr_no, user.client_id]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get client info to check referral partner
    const client = get('SELECT * FROM clients WHERE id = ?', [user.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';

    // Calculate prorata amount
    const { TIER_PRICING, SETUP_PRICING, getPartnerDiscount } = await import('@/lib/whopLinks');

    let prorataAmount = 0;
    let fromTier = null;
    let fromSetup = null;

    if (component_type === 'tier') {
      fromTier = renewal.tier;
      const currentPrice = parseFloat(TIER_PRICING[fromTier] || 0);
      const newPrice = parseFloat(TIER_PRICING[to_tier] || 0);
      const discount = getPartnerDiscount(referralPartnerName);
      const currentWithDiscount = currentPrice * (1 - discount / 100);
      const newWithDiscount = newPrice * (1 - discount / 100);
      prorataAmount = Math.max(0, newWithDiscount - currentWithDiscount);
    } else if (component_type === 'setup') {
      fromSetup = renewal.setup_type;
      const currentPrice = parseFloat(SETUP_PRICING[fromSetup] || 0);
      const newPrice = parseFloat(SETUP_PRICING[to_setup] || 0);
      const discount = getPartnerDiscount(referralPartnerName);
      const currentWithDiscount = currentPrice * (1 - discount / 100);
      const newWithDiscount = newPrice * (1 - discount / 100);
      prorataAmount = Math.max(0, newWithDiscount - currentWithDiscount);
    }

    // Create the upgrade request
    const result = run(
      `INSERT INTO upgrade_requests (client_id, renewal_sr_no, component_type, from_tier, to_tier, from_setup, to_setup, prorata_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT')`,
      [user.client_id, renewal_sr_no, component_type, fromTier, to_tier || null, fromSetup, to_setup || null, prorataAmount.toFixed(2)]
    );

    // Update the renewal to show upgrade pending
    run('UPDATE renewals SET upgrade_status = ? WHERE sr_no = ?', ['PENDING_PAYMENT', renewal_sr_no]);

    // Notify admins via Telegram
    try {
      const { getBot } = await import('@/lib/telegramBot');
      const { get: getConfig } = await import('@/lib/db');
      const botConfig = getConfig('SELECT team_notification_chat_id FROM bot_config WHERE id = 1');
      const bot = getBot();

      if (bot && botConfig?.team_notification_chat_id) {
        const upgradeType = component_type === 'tier' ? `${fromTier} → ${to_tier}` : `${fromSetup} → ${to_setup}`;
        const message = `🔄 <b>New Upgrade Request</b>\n\n<b>${client.name}</b> requested an upgrade:\nProduct: ${renewal_sr_no}\nType: ${component_type.toUpperCase()}\nUpgrade: ${upgradeType}\nAmount: $${prorataAmount.toFixed(2)}\n\nWaiting for payment.`;
        await bot.sendMessage(botConfig.team_notification_chat_id, message, { parse_mode: 'HTML' });
      }
    } catch (notifyError) {
      console.error('[upgrade-requests] Failed to send admin notification:', notifyError.message);
    }

    const newRequest = get('SELECT * FROM upgrade_requests WHERE id = ?', [result.lastInsertRowid]);
    return NextResponse.json(newRequest);
  } catch (e) {
    console.error('POST /api/upgrade-requests', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
