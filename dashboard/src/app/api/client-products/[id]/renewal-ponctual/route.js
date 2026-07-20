import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount } from '@/lib/whopLinks';

// POST /api/client-products/[id]/renewal-ponctual
// Extends the current ponctual upgrade by another month
export async function POST(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Get the product
    const product = get('SELECT * FROM client_products WHERE id = ?', [id]);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.is_ponctual) {
      return NextResponse.json({ error: 'Product is not a ponctual upgrade' }, { status: 400 });
    }

    // Get client info for discount
    const client = get('SELECT * FROM clients WHERE id = ?', [product.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';
    const discount = getPartnerDiscount(referralPartnerName);
    const discountFactor = 1 - (discount / 100);

    // Calculate prorata for renewal (difference between current tier and original)
    const currentTier = product.tier;
    const currentSetup = product.setup_type;
    const originalTier = product.original_tier || currentTier;
    const originalSetup = product.original_setup || currentSetup;

    let prorataAmount = 0;
    if (currentTier !== originalTier) {
      const fromPrice = parseFloat(TIER_PRICING[originalTier] || 0);
      const toPrice = parseFloat(TIER_PRICING[currentTier] || 0);
      prorataAmount += Math.max(0, (toPrice - fromPrice) * discountFactor);
    }
    if (currentSetup !== originalSetup) {
      const fromPrice = parseFloat(SETUP_PRICING[originalSetup] || 0);
      const toPrice = parseFloat(SETUP_PRICING[currentSetup] || 0);
      prorataAmount += Math.max(0, (toPrice - fromPrice) * discountFactor);
    }

    // Calculate new expiry (current expiry + 1 month)
    const currentExpiry = product.valid_until ? new Date(product.valid_until) : new Date();
    currentExpiry.setMonth(currentExpiry.getMonth() + 1);
    const newExpiry = currentExpiry.toISOString().split('T')[0];

    // Update product valid_until
    run(`
      UPDATE client_products SET
        valid_until = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newExpiry, id]);

    // Insert payment_history entry for RENEWAL_PONCTUAL
    run(`
      INSERT INTO payment_history (
        client_id, product_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date,
        notes, is_manual_entry
      ) VALUES (?, ?, 'RENEWAL_PONCTUAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.client_id,
      id,
      currentTier,
      currentTier,
      currentSetup,
      currentSetup,
      prorataAmount.toFixed(2),
      prorataAmount.toFixed(2),
      new Date().toISOString().split('T')[0],
      newExpiry,
      `Renewal of ponctual upgrade ${currentTier}`,
      0
    ]);

    const updated = get('SELECT * FROM client_products WHERE id = ?', [id]);

    return NextResponse.json({
      ok: true,
      product_id: id,
      prorata_amount: prorataAmount.toFixed(2),
      new_expiry: newExpiry
    });
  } catch (e) {
    console.error('[POST /api/client-products/[id]/renewal-ponctual]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
