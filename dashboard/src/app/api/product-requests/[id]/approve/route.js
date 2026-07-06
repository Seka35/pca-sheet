import { NextResponse } from 'next/server';
import { get, run, all } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';

const TIER_PRICING = {
  'TIER 1': { subscription_fee: '199', ad_spend_limit: '2500' },
  'TIER 2': { subscription_fee: '299', ad_spend_limit: '5000' },
  'TIER 3': { subscription_fee: '499', ad_spend_limit: '10000' },
  'TIER 4': { subscription_fee: '799', ad_spend_limit: '20000' },
  'TIER 5': { subscription_fee: '1399', ad_spend_limit: '40000' },
  'TIER 6': { subscription_fee: '1999', ad_spend_limit: 'Unlimited' },
};

const SETUP_PRICING = {
  'Starter': { setup_fee: '399' },
  'Premium': { setup_fee: '499' },
  'VIP': { setup_fee: '699' },
};

function generateSrNo(clientId) {
  const existingSrNos = all(
    "SELECT sr_no FROM renewals WHERE client_id = ? ORDER BY sr_no DESC LIMIT 1",
    [clientId]
  );
  let nextSeq = 1;
  if (existingSrNos.length > 0) {
    const lastSrNo = existingSrNos[0].sr_no;
    const parts = lastSrNo.split('.');
    if (parts.length === 2) {
      nextSeq = parseInt(parts[1], 10) + 1;
    }
  }
  return `${clientId}.${String(nextSeq).padStart(2, '0')}`;
}

export async function POST(req) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2];

  try {
    const reviewed_by = 'admin';

    const request = get('SELECT * FROM product_requests WHERE id = ?', [id]);

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    const products = JSON.parse(request.products_json || '[]');
    const client = get('SELECT * FROM clients WHERE id = ?', [request.client_id]);

    const createdSrNos = [];

    for (const product of products) {
      const srNo = generateSrNo(request.client_id);
      const startDate = new Date().toISOString().split('T')[0];
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);
      const validUntilStr = validUntil.toISOString().split('T')[0];
      const monthLabel = validUntil.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      let tier = null;
      let setupType = null;
      let subscriptionFee = '';
      let setupFee = '';
      let adSpendLimit = '';

      if (product.type === 'tier' && product.name) {
        tier = product.name;
        const tierInfo = TIER_PRICING[product.name];
        if (tierInfo) {
          subscriptionFee = tierInfo.subscription_fee;
          adSpendLimit = tierInfo.ad_spend_limit;
        }
      } else if (product.type === 'setup' && product.name) {
        setupType = product.name;
        const setupInfo = SETUP_PRICING[product.name];
        if (setupInfo) {
          setupFee = setupInfo.setup_fee;
        }
      } else if (product.type === 'extra') {
        // Extra products (profile, page, BM) - these might be one-time or monthly
        // Store as setup with name
        setupType = product.name;
        setupFee = '0'; // Price to be determined by admin or communicated separately
      }

      run(`
        INSERT INTO renewals (
          sr_no, client_id, client_name, month,
          start_date, valid_stopped_date,
          tier, setup_type, subscription_fee, setup_fee, ad_spend_limit,
          visual_status, client_status_history
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Pending Payment')
      `, [
        srNo,
        request.client_id,
        request.client_name || client?.name || '',
        monthLabel,
        startDate,
        validUntilStr,
        tier,
        setupType,
        subscriptionFee,
        setupFee,
        adSpendLimit
      ]);

      createdSrNos.push(srNo);
    }

    // Update request status
    run(
      `UPDATE product_requests SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?`,
      [reviewed_by, id]
    );

    // Send Telegram notification to client
    try {
      const link = get(`SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`, [request.client_id]);
      const bot = getBot();

      if (link && bot) {
        const productNames = products.map(p => `- ${p.name}`).join('\n');
        const message = `✅ <b>Product Request Approved!</b>\n\n<b>${request.client_name}</b>, your request for the following has been approved:\n\n${productNames}\n\nYou will receive payment instructions shortly. Use /status to view your products.`;
        await bot.sendMessage(link.chat_id, message, { parse_mode: 'HTML' });
      }
    } catch (notifyError) {
      console.error('[product-requests/approve] Failed to send Telegram notification:', notifyError.message);
    }

    return NextResponse.json({ ok: true, created_sr_nos: createdSrNos });
  } catch (error) {
    console.error('[POST /api/product-requests/[id]/approve]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
