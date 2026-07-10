import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount, calculateClientDiscount } from '@/lib/whopLinks';

// POST /api/renewals/[sr_no]/renewal-ponctual
// Extends the ponctual upgrade by 1 month - updates the EXISTING renewal's expiry
export async function POST(req, { params }) {
  // Await params in Next.js 15+
  const resolvedParams = await params;
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;

    // Get the current ponctual upgrade
    const current = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!current.is_ponctual_upgrade) {
      return NextResponse.json({ error: 'Can only renew a ponctual upgrade' }, { status: 400 });
    }

    // Get original product for pricing reference
    const originalTier = current.original_tier || current.tier;
    const originalSetup = current.original_setup || current.setup_type;

    // Get client info for discount
    const client = get('SELECT * FROM clients WHERE id = ?', [current.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';
    const discount = getPartnerDiscount(referralPartnerName);
    const discountFactor = 1 - (discount / 100);

    // Prorata = current tier price - original tier price (the upgrade premium for this month)
    let prorataAmount = 0;

    // Tier difference
    const currentTierPrice = parseFloat(TIER_PRICING[current.tier] || 0);
    const originalTierPrice = parseFloat(TIER_PRICING[originalTier] || 0);
    prorataAmount += Math.max(0, currentTierPrice * discountFactor - originalTierPrice * discountFactor);

    // Setup difference (if setup was also upgraded)
    if (current.setup_type !== originalSetup) {
      const currentSetupPrice = parseFloat(SETUP_PRICING[current.setup_type] || 0);
      const originalSetupPrice = parseFloat(SETUP_PRICING[originalSetup] || 0);
      prorataAmount += Math.max(0, currentSetupPrice * discountFactor - originalSetupPrice * discountFactor);
    }

    // New expiry = current expiry + 1 month
    const currentExpiry = new Date(current.valid_stopped_date || new Date());
    currentExpiry.setMonth(currentExpiry.getMonth() + 1);
    const newExpiry = currentExpiry.toISOString().split('T')[0];

    // Extend the current ponctual renewal's expiry
    run(
      'UPDATE renewals SET valid_stopped_date = ? WHERE sr_no = ?',
      [newExpiry, sr_no]
    );

    // Record the RENEWAL_PONCTUAL transaction
    run(
      `INSERT INTO payment_transactions (
        renewal_sr_no, client_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, date, until_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sr_no,
        current.client_id,
        'RENEWAL_PONCTUAL',
        originalTier, current.tier,
        originalSetup, current.setup_type,
        prorataAmount.toFixed(2),
        new Date().toISOString().split('T')[0],
        newExpiry
      ]
    );

    return NextResponse.json({
      ok: true,
      sr_no: sr_no,
      prorata_amount: prorataAmount.toFixed(2),
      new_expiry: newExpiry
    });
  } catch (e) {
    console.error('[POST /api/renewals/[sr_no]/renewal-ponctual]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
