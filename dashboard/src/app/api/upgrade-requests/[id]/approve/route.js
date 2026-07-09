import { NextResponse } from 'next/server';
import { get, run, all } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';
import { TIER_PRICING, SETUP_PRICING } from '@/lib/whopLinks';

export async function POST(req) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2];

  try {
    const reviewed_by = 'admin';
    const request = get('SELECT * FROM upgrade_requests WHERE id = ?', [id]);

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (request.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Already completed' }, { status: 400 });
    }

    if (request.status === 'PENDING_PAYMENT') {
      // First approval: payment approved, move to UPGRADE_PENDING
      run(
        `UPDATE upgrade_requests SET status = 'PAYMENT_APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?`,
        [reviewed_by, id]
      );

      // Update renewal to show payment approved
      run('UPDATE renewals SET upgrade_status = ? WHERE sr_no = ?', ['PAYMENT_APPROVED', request.renewal_sr_no]);

      // Notify client
      try {
        const link = get('SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = \'linked\' LIMIT 1', [request.client_id]);
        const bot = getBot();
        const client = get('SELECT name FROM clients WHERE id = ?', [request.client_id]);

        if (link && bot) {
          const message = `✅ <b>Upgrade Payment Approved!</b>\n\nYour upgrade payment of <b>$${request.prorata_amount}</b> has been approved. The upgrade will be processed shortly.\n\nProduct: ${request.renewal_sr_no}`;
          await bot.sendMessage(link.chat_id, message, { parse_mode: 'HTML' });
        }
      } catch (notifyError) {
        console.error('[upgrade-requests/approve] Failed to send notification:', notifyError.message);
      }

      return NextResponse.json({ ok: true, message: 'Payment approved. Waiting for final upgrade approval.' });
    }

    if (request.status === 'PAYMENT_APPROVED') {
      // Final approval: apply the upgrade to the product
      const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [request.renewal_sr_no]);
      if (!renewal) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      let newTier = renewal.tier;
      let newSetupType = renewal.setup_type;
      let newSubscriptionFee = renewal.subscription_fee;
      let newSetupFee = renewal.setup_fee;
      let newAdSpendLimit = renewal.ad_spend_limit;

      // Apply the upgrade
      if (request.component_type === 'tier' && request.to_tier) {
        newTier = request.to_tier;
        newSubscriptionFee = TIER_PRICING[newTier] || renewal.subscription_fee;
        newAdSpendLimit = newTier === 'TIER 6' ? 'Unlimited' : String(parseInt(TIER_PRICING[newTier]?.replace(/[^0-9]/g, '') || '0') * 10);
      } else if (request.component_type === 'setup' && request.to_setup) {
        newSetupType = request.to_setup;
        newSetupFee = SETUP_PRICING[newSetupType] || renewal.setup_fee;
      }

      // Recalculate discount based on client's referral partner
      const client = get('SELECT referral_partner_name FROM clients WHERE id = ?', [request.client_id]);
      let newDiscount = '0';
      if (client?.referral_partner_name) {
        const { calculateClientDiscount } = await import('@/lib/whopLinks');
        newDiscount = String(calculateClientDiscount(client.referral_partner_name, newSubscriptionFee, newSetupFee));
      }

      // Update the renewal with new values
      run(
        `UPDATE renewals SET tier = ?, setup_type = ?, subscription_fee = ?, setup_fee = ?, ad_spend_limit = ?, discount = ?, upgrade_status = NULL WHERE sr_no = ?`,
        [newTier, newSetupType, newSubscriptionFee, newSetupFee, newAdSpendLimit, newDiscount, request.renewal_sr_no]
      );

      // Mark upgrade request as completed
      run(
        `UPDATE upgrade_requests SET status = 'COMPLETED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?`,
        [reviewed_by, id]
      );

      // Notify client
      try {
        const link = get('SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = \'linked\' LIMIT 1', [request.client_id]);
        const bot = getBot();
        const client = get('SELECT name FROM clients WHERE id = ?', [request.client_id]);

        if (link && bot) {
          const message = `🎉 <b>Upgrade Completed!</b>\n\nYour product has been successfully upgraded.\n\nProduct: ${request.renewal_sr_no}\nNew Tier: ${newTier || 'N/A'}\nNew Setup: ${newSetupType || 'N/A'}\nNew Monthly Fee: $${newSubscriptionFee || '0'}\n\nThank you for your business!`;
          await bot.sendMessage(link.chat_id, message, { parse_mode: 'HTML' });
        }
      } catch (notifyError) {
        console.error('[upgrade-requests/approve] Failed to send notification:', notifyError.message);
      }

      return NextResponse.json({ ok: true, message: 'Upgrade completed successfully.' });
    }

    return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
  } catch (e) {
    console.error('[POST /api/upgrade-requests/[id]/approve]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
