import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount, calculateClientDiscount } from '@/lib/whopLinks';

// POST /api/renewals/[sr_no]/promote-ponctual
// Makes the ponctual upgrade permanent - keeps the EXISTING product with its current tier
// Clears is_ponctual_upgrade and makes the current upgraded tier the new "original"
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
      return NextResponse.json({ error: 'Can only promote a ponctual upgrade' }, { status: 400 });
    }

    // Get client info
    const client = get('SELECT * FROM clients WHERE id = ?', [current.client_id]);
    const referralPartnerName = client?.referral_partner_name || 'N.A.';

    // The current tier becomes the new permanent tier
    const newOriginalTier = current.tier;
    const newOriginalSetup = current.setup_type;

    // Update the EXISTING renewal to make the upgrade permanent
    run(
      `UPDATE renewals SET
        subscription_fee = ?,
        setup_fee = ?,
        discount = ?,
        is_ponctual_upgrade = 0,
        original_tier = ?,
        original_setup = ?,
        visual_status = 'Active'
       WHERE sr_no = ?`,
      [
        TIER_PRICING[newOriginalTier],
        SETUP_PRICING[newOriginalSetup],
        calculateClientDiscount(referralPartnerName, TIER_PRICING[newOriginalTier], SETUP_PRICING[newOriginalSetup]),
        newOriginalTier,
        newOriginalSetup,
        sr_no
      ]
    );

    // Record the PROMOTION transaction
    run(
      `INSERT INTO payment_transactions (
        renewal_sr_no, client_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sr_no,
        current.client_id,
        'PROMOTION',
        current.original_tier, current.tier,
        current.original_setup, current.setup_type,
        '0.00',
        '0.00',
        new Date().toISOString().split('T')[0],
        current.valid_stopped_date
      ]
    );

    return NextResponse.json({
      ok: true,
      sr_no: sr_no,
      new_tier: newOriginalTier,
      new_setup: newOriginalSetup
    });
  } catch (e) {
    console.error('[POST /api/renewals/[sr_no]/promote-ponctual]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
