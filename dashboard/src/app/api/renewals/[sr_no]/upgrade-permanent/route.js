import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount, calculateClientDiscount } from '@/lib/whopLinks';

export async function POST(req, { params }) {
  // Await params in case it's a Promise (Next.js 15+)
  const resolvedParams = await params;
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;
    const {
      to_tier, to_setup,
      subscription_fee, setup_fee, discount,
      amount_received, bank_name, whop_product_payments_json,
      valid_stopped_date, payment_received_date, reference_no
    } = await req.json();

    const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get client for discount calculation
    const client = get('SELECT * FROM clients WHERE id = ?', [renewal.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';

    // Determine the final tier and setup
    const finalTier = to_tier || renewal.tier;
    const finalSetup = to_setup || renewal.setup_type;

    // Use provided fees or calculate defaults
    const finalSubFee = subscription_fee || TIER_PRICING[finalTier] || renewal.subscription_fee;
    const finalSetupFee = setup_fee || SETUP_PRICING[finalSetup] || renewal.setup_fee;
    const finalDiscount = discount || calculateClientDiscount(referralPartnerName, finalSubFee, finalSetupFee);

    // Calculate prorata for the transaction record
    const fromTierPrice = parseFloat(TIER_PRICING[renewal.tier] || 0);
    const toTierPrice = parseFloat(TIER_PRICING[finalTier] || 0);
    const fromSetupPrice = parseFloat(SETUP_PRICING[renewal.setup_type] || 0);
    const toSetupPrice = parseFloat(SETUP_PRICING[finalSetup] || 0);
    const discountFactor = 1 - (getPartnerDiscount(referralPartnerName) / 100);
    const prorataAmount = Math.max(0, ((toTierPrice - fromTierPrice) + (toSetupPrice - fromSetupPrice)) * discountFactor);

    // Update the renewal with all fields
    const updates = [];
    const values = [];

    if (to_tier && to_tier !== renewal.tier) {
      updates.push('tier = ?');
      values.push(to_tier);
    }
    if (to_setup && to_setup !== renewal.setup_type) {
      updates.push('setup_type = ?');
      values.push(to_setup);
    }

    // Update fees
    updates.push('subscription_fee = ?', 'setup_fee = ?', 'discount = ?');
    values.push(finalSubFee, finalSetupFee, finalDiscount);

    // Update payment info
    if (amount_received !== undefined && amount_received !== null) {
      updates.push('amount_received = ?');
      values.push(amount_received);
    }
    if (bank_name) {
      updates.push('bank_name = ?');
      values.push(bank_name);
    }
    if (whop_product_payments_json) {
      updates.push('whop_product_payments_json = ?');
      values.push(whop_product_payments_json);
    }
    if (valid_stopped_date) {
      updates.push('valid_stopped_date = ?');
      values.push(valid_stopped_date);
    }
    if (payment_received_date) {
      updates.push('payment_received_date = ?');
      values.push(payment_received_date);
    }
    if (reference_no !== undefined) {
      updates.push('reference_no = ?');
      values.push(reference_no);
    }

    if (updates.length > 0) {
      values.push(sr_no);
      run(`UPDATE renewals SET ${updates.join(', ')} WHERE sr_no = ?`, values);
    }

    return NextResponse.json({
      ok: true,
      tier: finalTier,
      setup: finalSetup,
      prorata: prorataAmount.toFixed(2)
    });
  } catch (e) {
    console.error('[POST /api/renewals/[sr_no]/upgrade-permanent]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
