import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export async function GET() {
  try {
    const clients = await all('SELECT id, name, status FROM clients');
    const history = await all('SELECT * FROM renewals ORDER BY sr_no ASC');

    // Count renewals per client
    const renewalCount = {};
    const totalCA = {}; // sum of amount_received
    const totalSpend = {}; // sum of cl_amount
    const clientTier = {}; // latest tier
    const clientSetupType = {}; // latest setup_type

    history.forEach(row => {
      if (!row.client_id) return;
      if (!renewalCount[row.client_id]) renewalCount[row.client_id] = 0;
      renewalCount[row.client_id]++;

      if (!totalCA[row.client_id]) totalCA[row.client_id] = 0;
      totalCA[row.client_id] += parseAmount(row.amount_received);

      if (!totalSpend[row.client_id]) totalSpend[row.client_id] = 0;
      totalSpend[row.client_id] += parseAmount(row.cl_amount);

      // Keep latest tier and setup_type
      clientTier[row.client_id] = row.tier || clientTier[row.client_id];
      clientSetupType[row.client_id] = row.setup_type || clientSetupType[row.client_id];
    });

    // A. Classement par nombre de renewals
    const byRenewalCount = clients
      .filter(c => renewalCount[c.id])
      .map(c => ({
        client_id: c.id,
        name: c.name,
        tier: clientTier[c.id] || 'N/A',
        renewal_count: renewalCount[c.id] || 0,
        total_ca: parseFloat((totalCA[c.id] || 0).toFixed(2))
      }))
      .sort((a, b) => b.renewal_count - a.renewal_count);

    // B. Classement par Spend/CA (amount_received)
    const bySpend = clients
      .filter(c => totalCA[c.id])
      .map(c => ({
        client_id: c.id,
        name: c.name,
        tier: clientTier[c.id] || 'N/A',
        total_spend: parseFloat((totalCA[c.id] || 0).toFixed(2))
      }))
      .sort((a, b) => b.total_spend - a.total_spend);

    // C. Classement par Tier
    const byTier = {};
    clients.forEach(c => {
      const tier = clientTier[c.id];
      if (!tier) return;
      if (!byTier[tier]) byTier[tier] = 0;
      byTier[tier]++;
    });

    // D. Count invincible setup
    let invincibleCount = 0;
    clients.forEach(c => {
      const st = clientSetupType[c.id];
      if (st && st.toLowerCase().includes('invincible')) invincibleCount++;
    });

    // Tier self-ranking
    const tierSelfRanking = Object.entries(byTier).map(([tier, count]) => ({ tier, count }));

    return NextResponse.json({
      byRenewalCount,
      bySpend,
      byTier,
      invincibleCount,
      tierSelfRanking
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
