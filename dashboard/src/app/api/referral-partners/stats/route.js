import { NextResponse } from 'next/server';
import { all, get } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function GET(req) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'custom' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all clients grouped by referral partner
    const clients = all(`
      SELECT referral_partner_name, COUNT(*) as client_count
      FROM clients
      WHERE referral_partner_name IS NOT NULL
        AND referral_partner_name != ''
        AND referral_partner_name != 'N.A.'
      GROUP BY referral_partner_name
    `);

    // Get total commission per partner (sum of referral_amount from renewals)
    // Use r.referral_partner_name directly from renewals table (not joined clients table)
    const commissions = all(`
      SELECT r.referral_partner_name, SUM(CAST(r.referral_amount AS REAL)) as total_commission
      FROM renewals r
      WHERE r.referral_partner_name IS NOT NULL
        AND r.referral_partner_name != ''
        AND r.referral_partner_name != 'N.A.'
        AND r.referral_amount IS NOT NULL
        AND r.referral_amount != ''
        AND r.referral_amount != '0'
        AND r.referral_amount != '0.00'
        AND r.referral_amount != '$0.00'
      GROUP BY r.referral_partner_name
    `);

    // Build stats object
    const stats = {};
    for (const c of clients) {
      stats[c.referral_partner_name] = {
        client_count: c.client_count,
        total_commission: 0
      };
    }
    for (const c of commissions) {
      if (stats[c.referral_partner_name]) {
        stats[c.referral_partner_name].total_commission = c.total_commission || 0;
      }
    }

    return NextResponse.json(stats);
  } catch (e) {
    console.error('GET /api/referral-partners/stats', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
