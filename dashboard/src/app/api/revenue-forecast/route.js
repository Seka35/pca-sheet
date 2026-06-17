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
    const clients = await all('SELECT id, name, status FROM clients');
    const history = await all('SELECT * FROM renewals ORDER BY sr_no ASC');

    const activeClients = clients.filter(c => c.status === 'Actif');
    const activeClientIds = new Set(activeClients.map(c => c.id));

    // Count renewals per client
    const renewalCount = {};
    history.forEach(row => {
      if (!row.client_id) return;
      if (!renewalCount[row.client_id]) renewalCount[row.client_id] = 0;
      renewalCount[row.client_id]++;
    });

    // Stable clients: active clients with 2+ renewals
    const stableClients = activeClients.filter(c => (renewalCount[c.id] || 0) >= 2);
    const stableClientIds = new Set(stableClients.map(c => c.id));

    // MRR of stable clients
    const clientLatestRecord = {};
    history.forEach(row => {
      if (stableClientIds.has(row.client_id)) {
        clientLatestRecord[row.client_id] = row;
      }
    });

    let mrrStabilized = 0;
    stableClients.forEach(c => {
      const latest = clientLatestRecord[c.id];
      if (latest) {
        mrrStabilized += parseAmount(latest.subscription_fee) + parseAmount(latest.setup_fee);
      }
    });

    // Monthly stats for churn calculation
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

    // Average churn rate over last 6 months
    const last6 = sortedMonths.slice(-6);
    const churnRates = [];
    let prevClients = new Set();
    last6.forEach((m, idx) => {
      const curr = monthlyStats[m].clients;
      if (idx > 0) {
        let churned = 0;
        prevClients.forEach(id => { if (!curr.has(id)) churned++; });
        const rate = churned / prevClients.size;
        churnRates.push(rate);
      }
      prevClients = curr;
    });

    const avgChurnRate = churnRates.length > 0
      ? churnRates.reduce((a, b) => a + b, 0) / churnRates.length
      : 0;

    // Revenue forecast
    // Projected CA = stable MRR * (1 - churnRate)
    const estimatedMRR = mrrStabilized * (1 - avgChurnRate);

    // Projected new revenue from stable clients (based on avg ticket)
    const avgTicket = stableClients.length > 0 ? mrrStabilized / stableClients.length : 0;
    const projectedNewRevenue = avgTicket * stableClients.length * avgChurnRate;

    // Confidence level based on data availability
    let confidenceLevel = 'low';
    if (stableClients.length >= 10 && churnRates.length >= 6) confidenceLevel = 'high';
    else if (stableClients.length >= 5 && churnRates.length >= 3) confidenceLevel = 'medium';

    return NextResponse.json({
      estimatedMRR: parseFloat(estimatedMRR.toFixed(2)),
      churnRate: parseFloat((avgChurnRate * 100).toFixed(2)),
      stableClientsCount: stableClients.length,
      projectedNewRevenue: parseFloat(projectedNewRevenue.toFixed(2)),
      confidenceLevel
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
