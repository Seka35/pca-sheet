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
    // 1. Fetch all clients and history
    const clients = await all('SELECT id, name, status, telegram_group_id FROM clients');
    const history = await all('SELECT * FROM renewals ORDER BY sr_no ASC');

    const totalClients = clients.length;
    const activeClientsCount = clients.filter(c => c.status === 'Actif').length;
    const churnedCount = totalClients - activeClientsCount;

    // Group history by client
    const clientHistory = {};
    history.forEach(row => {
      if (!clientHistory[row.client_id]) clientHistory[row.client_id] = [];
      clientHistory[row.client_id].push(row);
    });

    // 2. Compute Top-level metrics
    let currentMRR = 0;
    let totalDue = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeClientsList = clients.filter(c => c.status === 'Actif');
    
    activeClientsList.forEach(c => {
      const h = clientHistory[c.id];
      if (h && h.length > 0) {
        // find latest month for this client
        const latestRow = h[h.length - 1];
        const latestMonth = latestRow.month;
        const currentProducts = h.filter(r => r.month === latestMonth);
        
        let clientMRR = 0;
        currentProducts.forEach(p => {
          clientMRR += parseAmount(p.subscription_fee);
          clientMRR += parseAmount(p.setup_fee);
        });
        currentMRR += clientMRR;

        // Calculate if this client has unpaid renewals (valid_stopped_date <= today)
        const targetDate = latestRow.valid_stopped_date || latestRow.start_date;
        if (targetDate) {
          const dueDate = new Date(targetDate);
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 0) {
            totalDue += clientMRR;
          }
        }
      }
    });

    const averageBasket = activeClientsCount > 0 ? (currentMRR / activeClientsCount) : 0;

    // 3. Compute Monthly Data
    const monthlyStats = {}; // { 'Oct-2025': { brut: 0, clients: Set(), churned: Set() } }
    
    // Revenue & Present Clients calculation
    history.forEach(row => {
      if (!row.month) return;
      if (!monthlyStats[row.month]) {
        monthlyStats[row.month] = { brut: 0, clients: new Set(), lastMonthClients: new Set(), churnedThisMonth: 0 };
      }
      
      // Revenue
      monthlyStats[row.month].brut += parseAmount(row.amount_received);
      
      // Active client in this month
      monthlyStats[row.month].clients.add(row.client_id);
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyStats).sort((a, b) => {
      const pa = parseMonthString(a);
      const pb = parseMonthString(b);
      if (pa.year !== pb.year) return pa.year - pb.year;
      return pa.month - pb.month;
    });

    const churnHistory = [];
    const revenueHistory = [];
    
    let previousMonthClients = new Set();
    
    sortedMonths.forEach((month, index) => {
      const stats = monthlyStats[month];
      const currentClients = stats.clients;
      
      // Churn calculation
      let churnedCount = 0;
      if (index > 0) {
        previousMonthClients.forEach(cid => {
          if (!currentClients.has(cid)) {
            churnedCount++;
          }
        });
      }
      
      const presents = index === 0 ? currentClients.size : previousMonthClients.size;
      const rate = presents > 0 ? (churnedCount / presents) * 100 : 0;
      
      churnHistory.push({
        month,
        presents,
        actifs: currentClients.size,
        churned: churnedCount,
        rate: rate,
        statut: rate < 10 ? 'Bon' : 'Danger'
      });
      
      revenueHistory.push({
        month,
        brut: stats.brut,
        frais: 0,
        net: stats.brut
      });
      
      previousMonthClients = currentClients;
    });

    // Current Month Churn (last item in history)
    const currentMonthChurnRate = churnHistory.length > 0 ? churnHistory[churnHistory.length - 1].rate : 0;

    // 4. Compute Top 10 Lifetime Clients
    const lifetimeClients = [];
    
    clients.forEach(c => {
      const h = clientHistory[c.id] || [];
      let totalSpent = 0;
      let monthsActive = new Set();
      let hasHighTier = false;
      let hasMultipleSetups = false;
      let setupCount = 0;
      let lastBank = 'N/A';
      
      h.forEach(row => {
        totalSpent += parseAmount(row.amount_received);
        if (row.month) monthsActive.add(row.month);
        
        const tier = (row.tier || '').toLowerCase();
        if (tier.includes('tier 3') || tier.includes('tier 4') || tier.includes('tier 5')) {
          hasHighTier = true;
        }
        
        if ((row.setup_type || '').toLowerCase().includes('setup') || (row.tier || '').toLowerCase().includes('setup')) {
          setupCount++;
        }
        
        if (row.bank_name) lastBank = row.bank_name;
      });

      if (setupCount > 1) hasMultipleSetups = true;

      // Automatic Tags
      const tags = [];
      if (monthsActive.size >= 12) tags.push('+1 an');
      if (totalSpent > 5000) tags.push('High spender');
      if (hasHighTier) tags.push('Premium Tier');
      if (hasMultipleSetups) tags.push('Multi-setup');

      lifetimeClients.push({
        id: c.id,
        name: c.name,
        email: c.telegram_group_id || 'N/A', // Using telegram ID as subtext if no email
        status: c.status,
        canal: lastBank,
        tags: tags,
        total_spent: totalSpent
      });
    });

    // Sort top 10
    lifetimeClients.sort((a, b) => b.total_spent - a.total_spent);
    const top10 = lifetimeClients.slice(0, 10);

    return NextResponse.json({
      summary: {
        totalClients,
        activeClients: activeClientsCount,
        churned: churnedCount,
        churnRate: currentMonthChurnRate,
        mrr: currentMRR,
        averageBasket,
        totalDue
      },
      churnHistory: churnHistory.reverse(), // Show newest first like screenshot
      revenueHistory: revenueHistory.reverse(),
      topClients: top10
    });
  } catch (error) {
    console.error('Erreur API /dashboard:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
