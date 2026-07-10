import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount, calculateClientDiscount } from '@/lib/whopLinks';

// POST /api/renewals/[sr_no]/sub-upgrade
// Creates a sub-upgrade on top of an existing ponctual upgrade (same month, chain upgrade)
// Updates the EXISTING product with the new upgraded tier/setup
export async function POST(req, { params }) {
  // Await params in Next.js 15+
  const resolvedParams = await params;
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;
    const { to_tier, to_setup } = await req.json();

    if (!to_tier && !to_setup) {
      return NextResponse.json({ error: 'to_tier or to_setup is required' }, { status: 400 });
    }

    // Get the current ponctual upgrade
    const current = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!current.is_ponctual_upgrade) {
      return NextResponse.json({ error: 'Can only sub-upgrade a ponctual upgrade' }, { status: 400 });
    }

    // The from is the current ponctual's tier/setup
    const fromTier = current.tier;
    const fromSetup = current.setup_type;
    const targetTier = to_tier || fromTier;
    const targetSetup = to_setup || fromSetup;

    // Get client info for discount
    const client = get('SELECT * FROM clients WHERE id = ?', [current.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';
    const discount = getPartnerDiscount(referralPartnerName);
    const discountFactor = 1 - (discount / 100);

    // Calculate prorata from PREVIOUS level (not original)
    let prorataAmount = 0;

    if (to_tier && to_tier !== fromTier) {
      const fromPrice = parseFloat(TIER_PRICING[fromTier] || 0);
      const toPrice = parseFloat(TIER_PRICING[to_tier] || 0);
      prorataAmount += Math.max(0, toPrice * discountFactor - fromPrice * discountFactor);
    }

    if (to_setup && to_setup !== fromSetup) {
      const fromPrice = parseFloat(SETUP_PRICING[fromSetup] || 0);
      const toPrice = parseFloat(SETUP_PRICING[to_setup] || 0);
      prorataAmount += Math.max(0, toPrice * discountFactor - fromPrice * discountFactor);
    }

    // Extend expiry by 1 month from now
    const expiresDate = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Append to upgrade chain
    const upgradeChain = JSON.parse(current.upgrade_chain_json || '[]');
    upgradeChain.push({
      from_tier: fromTier,
      from_setup: fromSetup,
      to_tier: targetTier,
      to_setup: targetSetup,
      date: new Date().toISOString().split('T')[0],
      prorata: prorataAmount.toFixed(2)
    });

    // Update the EXISTING renewal with the new sub-upgraded tier/setup
    run(
      `UPDATE renewals SET
        tier = ?,
        setup_type = ?,
        subscription_fee = ?,
        setup_fee = ?,
        discount = ?,
        valid_stopped_date = ?,
        upgrade_chain_json = ?
       WHERE sr_no = ?`,
      [
        targetTier,
        targetSetup,
        TIER_PRICING[targetTier] || current.subscription_fee,
        SETUP_PRICING[targetSetup] || current.setup_fee,
        calculateClientDiscount(referralPartnerName, TIER_PRICING[targetTier] || current.subscription_fee, SETUP_PRICING[targetSetup] || current.setup_fee),
        expiresDate,
        JSON.stringify(upgradeChain),
        sr_no
      ]
    );

    // Record the SUB_UPGRADE transaction
    run(
      `INSERT INTO payment_transactions (
        renewal_sr_no, client_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, date, until_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sr_no,
        current.client_id,
        'SUB_UPGRADE',
        fromTier, targetTier,
        fromSetup, targetSetup,
        prorataAmount.toFixed(2),
        new Date().toISOString().split('T')[0],
        expiresDate
      ]
    );

    return NextResponse.json({
      ok: true,
      sr_no: sr_no,
      from_tier: fromTier,
      to_tier: targetTier,
      prorata_amount: prorataAmount.toFixed(2),
      expires_at: expiresDate
    });
  } catch (e) {
    console.error('[POST /api/renewals/[sr_no]/sub-upgrade]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
