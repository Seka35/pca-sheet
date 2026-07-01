import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

// GET /api/admin/whop-products/options — tiers, setups, referral partners
export async function GET() {
  try {
    const tiers = all(`SELECT DISTINCT tier as value FROM renewals WHERE tier IS NOT NULL AND tier != '' ORDER BY tier`);
    const setups = all(`SELECT DISTINCT setup_type as value FROM renewals WHERE setup_type IS NOT NULL AND setup_type != '' ORDER BY setup_type`);
    const refs = all(`SELECT DISTINCT referral_partner_name as value FROM renewals WHERE referral_partner_name IS NOT NULL AND referral_partner_name != '' ORDER BY referral_partner_name`);

    return NextResponse.json({
      tiers: tiers.map(r => r.value),
      setups: setups.map(r => r.value),
      referralPartners: refs.map(r => r.value),
    });
  } catch (err) {
    console.error('[whop-products/options GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
