import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, TIER_SPEND_LIMITS, getPartnerDiscount, calculateClientDiscount } from '@/lib/whopLinks';

// POST /api/renewals/[sr_no]/return-to-original
// Ends the ponctual upgrade and returns the EXISTING product to its original tier
// Does NOT create a new renewal - just restores the existing one
export async function POST(req, { params }) {
  // Await params in Next.js 15+
  const resolvedParams = await params;
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;
    const { amount_received, bank_name, payment_received_date, reference_no } = await req.json();

    // Get the current ponctual upgrade
    const current = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!current.is_ponctual_upgrade) {
      return NextResponse.json({ error: 'Can only return from a ponctual upgrade' }, { status: 400 });
    }

    // Get the original tier/setup
    const originalTier = current.original_tier || current.tier;
    const originalSetup = current.original_setup || current.setup_type;

    // Get client info
    const client = get('SELECT * FROM clients WHERE id = ?', [current.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';

    // The client pays the original monthly price (not prorata, they're returning)
    const monthlyAmount = parseFloat(TIER_PRICING[originalTier] || 0) +
                          parseFloat(SETUP_PRICING[originalSetup] || 0);

    // Use provided payment date or default to today
    const payDate = payment_received_date || new Date().toISOString().split('T')[0];

    const newExpiry = (() => {
      const d = new Date(payDate);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Record the RETURN transaction
    run(
      `INSERT INTO payment_transactions (
        renewal_sr_no, client_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sr_no,
        current.client_id,
        'RETURN',
        current.tier, originalTier,
        current.setup_type, originalSetup,
        '0.00',
        amount_received || monthlyAmount.toFixed(2),
        payDate,
        newExpiry
      ]
    );

    // Restore the EXISTING renewal to its original tier/setup
    // 12 placeholders: tier, setup_type, subscription_fee, setup_fee, discount, valid_stopped_date, is_ponctual_upgrade, upgrade_chain_json, visual_status, amount_received, bank_name, payment_received_date, reference_no, WHERE sr_no
    run(
      `UPDATE renewals SET
        tier = ?,
        setup_type = ?,
        subscription_fee = ?,
        setup_fee = ?,
        discount = ?,
        ad_spend_limit = ?,
        valid_stopped_date = ?,
        is_ponctual_upgrade = 0,
        upgrade_chain_json = NULL,
        visual_status = 'Active',
        amount_received = ?,
        bank_name = ?,
        payment_received_date = ?,
        reference_no = ?
       WHERE sr_no = ?`,
      [
        originalTier,
        originalSetup,
        TIER_PRICING[originalTier],
        SETUP_PRICING[originalSetup],
        calculateClientDiscount(referralPartnerName, TIER_PRICING[originalTier], SETUP_PRICING[originalSetup]),
        TIER_SPEND_LIMITS[originalTier] || renewal.ad_spend_limit,
        newExpiry,
        amount_received || null,
        bank_name || null,
        payDate,
        reference_no || null,
        sr_no
      ]
    );

    return NextResponse.json({
      ok: true,
      sr_no: sr_no,
      original_tier: originalTier,
      monthly_amount: (amount_received || monthlyAmount).toFixed(2),
      valid_until: newExpiry
    });
  } catch (e) {
    console.error('[POST /api/renewals/[sr_no]/return-to-original]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
