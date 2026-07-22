import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount } from '@/lib/whopLinks';

// POST /api/client-products/[id]/promote-ponctual
// Converts a ponctual upgrade to permanent - the upgraded tier becomes the new baseline
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

    // Current tier/setup becomes the new permanent baseline
    const newTier = product.tier;
    const newSetup = product.setup_type;

    // Calculate new monthly amount
    const monthlyAmount = (
      parseFloat(TIER_PRICING[newTier] || 0) +
      parseFloat(SETUP_PRICING[newSetup] || 0)
    ) * discountFactor;

    // Keep the existing valid_until (anchored to billing cycle) - do NOT shift it
    const newExpiry = product.valid_until; // Preserve original billing cycle anchor

    // Update product: set is_ponctual=0, clear original_*, update fees
    run(`
      UPDATE client_products SET
        subscription_fee = ?,
        setup_fee = ?,
        valid_until = ?,
        is_ponctual = 0,
        original_tier = ?,
        original_setup = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      TIER_PRICING[newTier] || product.subscription_fee,
      SETUP_PRICING[newSetup] || product.setup_fee,
      newExpiry,
      newTier, // original becomes current tier
      newSetup,
      id
    ]);

    // Insert payment_history entry for PROMOTION
    run(`
      INSERT INTO payment_history (
        client_id, product_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date,
        notes, is_manual_entry
      ) VALUES (?, ?, 'PROMOTION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.client_id,
      id,
      newTier, // from (same as to for promotion)
      newTier,
      newSetup,
      newSetup,
      '0',
      '0',
      new Date().toISOString().split('T')[0],
      newExpiry,
      `Promoted ${newTier} to permanent`,
      0
    ]);

    const updated = get('SELECT * FROM client_products WHERE id = ?', [id]);

    return NextResponse.json({
      ok: true,
      product_id: id,
      new_tier: newTier,
      new_setup: newSetup,
      valid_until: newExpiry
    });
  } catch (e) {
    console.error('[POST /api/client-products/[id]/promote-ponctual]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
