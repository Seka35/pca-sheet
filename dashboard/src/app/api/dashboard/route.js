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

    const totalClients = clients.length;
    const activeClientsCount = clients.filter(c => c.status === 'Actif').length;
    
    // Group history by client AND month
    const clientMonthlyPayments = {}; // { clientId: { 'May-2026': totalAmount } }
    const clientLatestRecord = {};

    history.forEach(row => {
      // 1. Accumulate payments by Month
      const pMonth = row.payment_received_month;
      if (pMonth && pMonth !== "") {
        if (!clientMonthlyPayments[row.client_id]) clientMonthlyPayments[row.client_id] = {};
        if (!clientMonthlyPayments[row.client_id][pMonth]) clientMonthlyPayments[row.client_id][pMonth] = 0;
        clientMonthlyPayments[row.client_id][pMonth] += parseAmount(row.amount_received);
      }

      // 2. Track latest record for general info
      clientLatestRecord[row.client_id] = row;
    });

    // Compute Metrics
    let currentMRR = 0;
    let totalDue = 0;
    
    // MRR calculation (Active clients)
    clients.filter(c => c.status === 'Actif').forEach(c => {
      const latest = clientLatestRecord[c.id];
      if (latest) {
        const expected = parseAmount(latest.subscription_fee) + parseAmount(latest.setup_fee);
        currentMRR += expected;
      }
    });

    // Total Due calculation (from unpaid renewals of ACTIVE clients only)
    const activeClientIds = new Set(clients.filter(c => c.status === 'Actif').map(c => c.id));
    
    history.forEach(row => {
      if (!activeClientIds.has(row.client_id)) return;

      const isPaid = row.reference_no && row.reference_no.trim() !== "";
      if (!isPaid) {
        const sub = parseAmount(row.subscription_fee);
        const setup = parseAmount(row.setup_fee);
        const disc = parseAmount(row.discount);
        const received = parseAmount(row.amount_received);
        const due = (sub + setup) - disc - received;
        if (due > 0) {
          totalDue += due;
        }
      }
    });

    // Compute Churn & History
    const monthlyStats = {};
    history.forEach(row => {
      if (!row.month) return;
      if (!monthlyStats[row.month]) monthlyStats[row.month] = { brut: 0, clients: new Set() };
      monthlyStats[row.month].brut += parseAmount(row.amount_received);
      monthlyStats[row.month].clients.add(row.client_id);
    });

    const sortedMonths = Object.keys(monthlyStats).sort((a, b) => {
      const pa = parseMonthString(a);
      const pb = parseMonthString(b);
      return (pa.year !== pb.year) ? pa.year - pb.year : pa.month - pb.month;
    });

    const churnHistory = [];
    let prevClients = new Set();
    sortedMonths.forEach((m, idx) => {
      const curr = monthlyStats[m].clients;
      let churned = 0;
      if (idx > 0) prevClients.forEach(id => { if (!curr.has(id)) churned++; });
      const rate = idx === 0 ? 0 : (churned / prevClients.size) * 100;
      churnHistory.push({ month: m, presents: prevClients.size || curr.size, actifs: curr.size, churned, rate });
      prevClients = curr;
    });

    // Top 10
    const top10 = clients.map(c => {
      const h = history.filter(r => r.client_id === c.id);
      const total = h.reduce((sum, r) => sum + parseAmount(r.amount_received), 0);
      return { id: c.id, name: c.name, status: c.status, total_spent: total, tags: [], email: "" };
    }).sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);

    const reversedChurnHistory = [...churnHistory].reverse();
    const latestChurn = reversedChurnHistory[0] || { churned: 0, rate: 0 };

    return NextResponse.json({
      summary: { 
        totalClients, 
        activeClients: activeClientsCount, 
        churned: latestChurn.churned,
        churnRate: latestChurn.rate || 0, 
        mrr: currentMRR, 
        totalDue, 
        averageBasket: activeClientsCount > 0 ? currentMRR/activeClientsCount : 0 
      },
      churnHistory: reversedChurnHistory,
      revenueHistory: sortedMonths.map(m => ({ month: m, brut: monthlyStats[m].brut, frais: 0, net: monthlyStats[m].brut })).reverse(),
      topClients: top10
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
