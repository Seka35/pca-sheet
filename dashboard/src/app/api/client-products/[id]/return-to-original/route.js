import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount } from '@/lib/whopLinks';

// POST /api/client-products/[id]/return-to-original
// Returns from a ponctual upgrade back to original tier/setup
export async function POST(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const {
      payment_date, amount_received, bank_name, reference_no
    } = body;

    // Get the product
    const product = get('SELECT * FROM client_products WHERE id = ?', [id]);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.is_ponctual) {
      return NextResponse.json({ error: 'Product is not a ponctual upgrade' }, { status: 400 });
    }

    // Get original tier/setup
    const originalTier = product.original_tier || product.tier;
    const originalSetup = product.original_setup || product.setup_type;

    // Get client info for discount
    const client = get('SELECT * FROM clients WHERE id = ?', [product.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';
    const discount = getPartnerDiscount(referralPartnerName);
    const discountFactor = 1 - (discount / 100);

    // Calculate monthly amount for original tier
    const monthlyAmount = (
      (parseFloat(TIER_PRICING[originalTier] || 0)) +
      (parseFloat(SETUP_PRICING[originalSetup] || 0))
    ) * discountFactor;

    // Set payment date and new expiry
    const paymentDate = payment_date || new Date().toISOString().split('T')[0];
    const newExpiry = (() => {
      const d = new Date(paymentDate);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Update product: restore original tier/setup, set is_ponctual=0
    run(`
      UPDATE client_products SET
        tier = ?,
        setup_type = ?,
        subscription_fee = ?,
        setup_fee = ?,
        ad_spend_limit = ?,
        valid_until = ?,
        is_ponctual = 0,
        original_tier = ?,
        original_setup = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      originalTier,
      originalSetup,
      TIER_PRICING[originalTier] || product.subscription_fee,
      SETUP_PRICING[originalSetup] || product.setup_fee,
      originalTier.replace('TIER ', 'TIER ').startsWith('TIER ') ? TIER_PRICING[originalTier] ? (originalTier) : originalTier : originalTier,
      TIER_PRICING[originalTier] || product.ad_spend_limit,
      newExpiry,
      originalTier,
      originalSetup,
      id
    ]);

    // Get tier number to determine ad_spend_limit
    const tierNum = parseInt(originalTier.replace('TIER ', ''));
    const spendLimits = { 1: '2500', 2: '5000', 3: '10000', 4: '20000', 5: '40000', 6: 'Unlimited' };

    // Update again with correct ad_spend_limit
    run(`
      UPDATE client_products SET
        ad_spend_limit = ?
      WHERE id = ?
    `, [
      spendLimits[tierNum] || product.ad_spend_limit,
      id
    ]);

    // Insert payment_history entry for RETURN
    run(`
      INSERT INTO payment_history (
        client_id, product_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date,
        notes, is_manual_entry
      ) VALUES (?, ?, 'RETURN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.client_id,
      id,
      product.tier, // from tier (upgraded tier)
      originalTier, // to tier (original)
      product.setup_type,
      originalSetup,
      '0', // no prorata on return
      amount_received || monthlyAmount.toFixed(2),
      paymentDate,
      newExpiry,
      `Return from ${product.tier} to ${originalTier}`,
      0
    ]);

    const updated = get('SELECT * FROM client_products WHERE id = ?', [id]);

    return NextResponse.json({
      ok: true,
      product_id: id,
      original_tier: originalTier,
      monthly_amount: monthlyAmount.toFixed(2),
      valid_until: newExpiry
    });
  } catch (e) {
    console.error('[POST /api/client-products/[id]/return-to-original]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
