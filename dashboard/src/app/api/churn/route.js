import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

const monthOrder = {
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
};

function parseMonthString(mStr) {
  if (!mStr) return { year: 0, month: 0 };
  const parts = mStr.toLowerCase().split('-');
  if (parts.length === 2) {
    const m = monthOrder[parts[0]] || 0;
    const y = parseInt(parts[1], 10) || 0;
    return { year: y, month: m };
  }
  return { year: 0, month: 0 };
}

export async function GET() {
  try {
    const clients = await all('SELECT id, name, status, churn_reason FROM clients');
    const history = await all('SELECT * FROM renewals ORDER BY sr_no ASC');

    // Monthly stats to compute churn by month
    const monthlyStats = {};
    history.forEach(row => {
      if (!row.month) return;
      if (!monthlyStats[row.month]) monthlyStats[row.month] = { clients: new Set() };
      monthlyStats[row.month].clients.add(row.client_id);
    });

    const sortedMonths = Object.keys(monthlyStats).sort((a, b) => {
      const pa = parseMonthString(a);
      const pb = parseMonthString(b);
      return (pa.year !== pb.year) ? pa.year - pb.year : pa.month - pb.month;
    });

    // Churn by month
    const churnByMonth = [];
    let prevClients = new Set();
    sortedMonths.forEach((m, idx) => {
      const curr = monthlyStats[m].clients;
      let churned = 0;
      if (idx > 0) prevClients.forEach(id => { if (!curr.has(id)) churned++; });
      const rate = idx === 0 ? 0 : (churned / prevClients.size) * 100;
      churnByMonth.push({ month: m, churned, rate: parseFloat(rate.toFixed(2)), presents: prevClients.size || curr.size });
      prevClients = curr;
    });

    // Total churned (currently inactive clients)
    const churnedClients = clients.filter(c => c.status !== 'Actif');
    const totalChurned = churnedClients.length;

    // Churn by tier — last known tier of churned clients
    const byTier = { 'TIER 1': 0, 'TIER 2': 0, 'TIER 3': 0, 'TIER 4': 0, 'TIER 5': 0, 'TIER 6': 0 };
    const clientLastTier = {};
    history.forEach(row => {
      if (row.tier) clientLastTier[row.client_id] = row.tier;
    });
    churnedClients.forEach(c => {
      const tier = clientLastTier[c.id];
      if (tier && byTier.hasOwnProperty(tier)) byTier[tier]++;
    });

    // Churn by category (churn_reason)
    const byCategory = {};
    churnedClients.forEach(c => {
      const cat = c.churn_reason || 'unknown';
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat]++;
    });

    // Details: find the month each churned client churned
    const churnedClientIds = new Set(churnedClients.map(c => c.id));
    const clientFirstAbsentMonth = {};
    sortedMonths.forEach((m, idx) => {
      const curr = monthlyStats[m].clients;
      if (idx > 0) {
        const prev = monthlyStats[sortedMonths[idx - 1]].clients;
        prev.forEach(cid => {
          if (!curr.has(cid) && churnedClientIds.has(cid) && !clientFirstAbsentMonth[cid]) {
            clientFirstAbsentMonth[cid] = m;
          }
        });
      }
    });

    const details = churnedClients.map(c => ({
      client_id: c.id,
      name: c.name,
      tier: clientLastTier[c.id] || 'N/A',
      churn_reason: c.churn_reason || null,
      churn_month: clientFirstAbsentMonth[c.id] || null
    }));

    return NextResponse.json({
      totalChurned,
      byMonth: [...churnByMonth].reverse(),
      byTier: Object.entries(byTier).map(([tier, count]) => ({ tier, churned_count: count })),
      byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
      details
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
