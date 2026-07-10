import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, TIER_SPEND_LIMITS, getPartnerDiscount, calculateClientDiscount } from '@/lib/whopLinks';

// POST /api/renewals/[sr_no]/upgrade-ponctual
// Upgrades the existing product temporarily (no new renewal created)
// The product keeps its sr_no but gets is_ponctual_upgrade=1 and displays the upgraded tier as a badge
export async function POST(req, { params }) {
  // Await params in Next.js 15+
  const resolvedParams = await params;
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;
    const { to_tier, to_setup, expires_at, amount_received } = await req.json();

    if (!to_tier && !to_setup) {
      return NextResponse.json({ error: 'to_tier or to_setup is required' }, { status: 400 });
    }

    // Get the current product
    const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // If already a ponctual upgrade, we can still upgrade again (sub-upgrade)
    const fromTier = renewal.original_tier || renewal.tier;
    const fromSetup = renewal.original_setup || renewal.setup_type;

    // Get client info for discount
    const client = get('SELECT * FROM clients WHERE id = ?', [renewal.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';
    const discount = getPartnerDiscount(referralPartnerName);
    const discountFactor = 1 - (discount / 100);

    // Target tier/setup
    const targetTier = to_tier || fromTier;
    const targetSetup = to_setup || fromSetup;

    // Calculate prorata amount (upgrade price - current price, with discount applied)
    let prorataAmount = 0;

    // Price difference for tier
    if (targetTier !== fromTier) {
      const fromPrice = parseFloat(TIER_PRICING[fromTier] || 0);
      const toPrice = parseFloat(TIER_PRICING[targetTier] || 0);
      prorataAmount += Math.max(0, (toPrice - fromPrice) * discountFactor);
    }

    // Price difference for setup
    if (targetSetup !== fromSetup) {
      const fromPrice = parseFloat(SETUP_PRICING[fromSetup] || 0);
      const toPrice = parseFloat(SETUP_PRICING[targetSetup] || 0);
      prorataAmount += Math.max(0, (toPrice - fromPrice) * discountFactor);
    }

    // Set expires_at to 1 month from now if not provided
    const expiresDate = expires_at || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Build upgrade chain
    const upgradeChain = JSON.parse(renewal.upgrade_chain_json || '[]');
    upgradeChain.push({
      from_tier: fromTier,
      from_setup: fromSetup,
      to_tier: targetTier,
      to_setup: targetSetup,
      date: new Date().toISOString().split('T')[0],
      prorata: prorataAmount.toFixed(2)
    });

    // Update the EXISTING renewal - no new product created
    // Store the original tier/setup if not already stored
    const originalTierToStore = renewal.original_tier || renewal.tier;
    const originalSetupToStore = renewal.original_setup || renewal.setup_type;

    // Calculate cumulative amount received: sum of payments + sum of UPGRADE transaction amounts
    const existingPaymentsSum = get(`SELECT COALESCE(SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)), 0) as total FROM payments WHERE renewal_sr_no = ?`, [sr_no]);
    const existingTxSum = get(`SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total FROM payment_transactions WHERE renewal_sr_no = ? AND type IN ('UPGRADE', 'SUB_UPGRADE')`, [sr_no]);
    const cumulativeAmount = (existingPaymentsSum?.total || 0) + (existingTxSum?.total || 0) + (parseFloat(amount_received) || prorataAmount);

    run(
      `UPDATE renewals SET
        tier = ?,
        setup_type = ?,
        subscription_fee = ?,
        setup_fee = ?,
        discount = ?,
        ad_spend_limit = ?,
        valid_stopped_date = ?,
        is_ponctual_upgrade = 1,
        upgrade_chain_json = ?,
        original_tier = ?,
        original_setup = ?,
        amount_received = ?,
        visual_status = 'Active'
       WHERE sr_no = ?`,
      [
        targetTier,
        targetSetup,
        TIER_PRICING[targetTier] || renewal.subscription_fee,
        SETUP_PRICING[targetSetup] || renewal.setup_fee,
        calculateClientDiscount(referralPartnerName, TIER_PRICING[targetTier] || renewal.subscription_fee, SETUP_PRICING[targetSetup] || renewal.setup_fee),
        TIER_SPEND_LIMITS[targetTier] || renewal.ad_spend_limit,
        expiresDate,
        JSON.stringify(upgradeChain),
        originalTierToStore,
        originalSetupToStore,
        cumulativeAmount.toFixed(2),
        sr_no
      ]
    );

    // Record the UPGRADE transaction
    run(
      `INSERT INTO payment_transactions (
        renewal_sr_no, client_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sr_no,
        renewal.client_id,
        'UPGRADE',
        fromTier, targetTier,
        fromSetup, targetSetup,
        prorataAmount.toFixed(2),
        amount_received || prorataAmount.toFixed(2),
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
    console.error('[POST /api/renewals/[sr_no]/upgrade-ponctual]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
