import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, TIER_SPEND_LIMITS, getPartnerDiscount } from '@/lib/whopLinks';

// POST /api/client-products/[id]/upgrade-ponctual
// Creates an ponctual upgrade - adds a payment_history entry and updates product state
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
      to_tier, to_setup, expires_at, payment_date,
      amount_received, bank_name, reference_no, prorata_amount
    } = body;

    if (!to_tier && !to_setup) {
      return NextResponse.json({ error: 'to_tier or to_setup is required' }, { status: 400 });
    }

    // Get the product
    const product = get('SELECT * FROM client_products WHERE id = ?', [id]);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Determine the from tier/setup (use original_* if this is already a ponctual)
    const fromTier = product.original_tier || product.tier;
    const fromSetup = product.original_setup || product.setup_type;

    // Get client info for discount
    const client = get('SELECT * FROM clients WHERE id = ?', [product.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';
    const discount = getPartnerDiscount(referralPartnerName);
    const discountFactor = 1 - (discount / 100);

    // Target tier/setup
    const targetTier = to_tier || fromTier;
    const targetSetup = to_setup || fromSetup;

    // Calculate prorata amount if not provided
    let calculatedProrata = prorata_amount;
    if (!calculatedProrata && calculatedProrata !== 0) {
      calculatedProrata = 0;
      if (targetTier !== fromTier) {
        const fromPrice = parseFloat(TIER_PRICING[fromTier] || 0);
        const toPrice = parseFloat(TIER_PRICING[targetTier] || 0);
        calculatedProrata += Math.max(0, (toPrice - fromPrice) * discountFactor);
      }
      if (targetSetup !== fromSetup) {
        const fromPrice = parseFloat(SETUP_PRICING[fromSetup] || 0);
        const toPrice = parseFloat(SETUP_PRICING[targetSetup] || 0);
        calculatedProrata += Math.max(0, (toPrice - fromPrice) * discountFactor);
      }
    }

    // Set expires_at to 1 month from payment_date if not provided
    const paymentDate = payment_date || new Date().toISOString().split('T')[0];
    const expiresDate = expires_at || (() => {
      const d = new Date(paymentDate);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })();

    // First time ponctual: store current tier/setup as original
    const originalTierToStore = product.original_tier || product.tier;
    const originalSetupToStore = product.original_setup || product.setup_type;

    // Update product: set is_ponctual=1, store original_*, update tier/setup/valid_until
    run(`
      UPDATE client_products SET
        tier = ?,
        setup_type = ?,
        subscription_fee = ?,
        setup_fee = ?,
        ad_spend_limit = ?,
        valid_until = ?,
        is_ponctual = 1,
        original_tier = ?,
        original_setup = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      targetTier,
      targetSetup,
      TIER_PRICING[targetTier] || product.subscription_fee,
      SETUP_PRICING[targetSetup] || product.setup_fee,
      TIER_SPEND_LIMITS[targetTier] || product.ad_spend_limit,
      expiresDate,
      originalTierToStore,
      originalSetupToStore,
      id
    ]);

    // Insert payment_history entry
    const amount = amount_received || calculatedProrata.toFixed(2);
    run(`
      INSERT INTO payment_history (
        client_id, product_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date,
        notes, is_manual_entry
      ) VALUES (?, ?, 'UPGRADE_PONCTUAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.client_id,
      id,
      fromTier,
      targetTier,
      fromSetup,
      targetSetup,
      calculatedProrata.toFixed(2),
      amount,
      paymentDate,
      expiresDate,
      `Upgrade from ${fromTier} to ${targetTier} (ponctual)`,
      0 // is_manual_entry
    ]);

    const updated = get('SELECT * FROM client_products WHERE id = ?', [id]);

    return NextResponse.json({
      ok: true,
      product_id: id,
      from_tier: fromTier,
      to_tier: targetTier,
      prorata_amount: calculatedProrata.toFixed(2),
      amount: amount,
      expires_at: expiresDate
    });
  } catch (e) {
    console.error('[POST /api/client-products/[id]/upgrade-ponctual]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
