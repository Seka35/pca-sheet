import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  // Ex: "199 €" -> 199, " 299.5$" -> 299.5
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export async function GET(req) {
  try {
    const query = `
      SELECT r.*, c.status as client_global_status, c.name as c_name 
      FROM renewals r
      JOIN clients c ON c.id = r.client_id
      WHERE c.status = 'Actif'
      ORDER BY r.client_id ASC, r.sr_no DESC
    `;
    
    const allActiveRenewals = await all(query);
    
    // Grouper par client_id ET mois pour gérer les dettes sur plusieurs mois
    const clientMonthlyMap = {}; // { "clientId-Month": { records: [], ... } }
    
    for (let row of allActiveRenewals) {
      const key = `${row.client_id}-${row.month}`;
      if (!clientMonthlyMap[key]) {
        clientMonthlyMap[key] = {
          month: row.month,
          records: [],
          client_id: row.client_id,
          client_name: row.c_name,
          bank_name: row.bank_name,
          valid_stopped_date: row.valid_stopped_date || row.start_date
        };
      }
      clientMonthlyMap[key].records.push(row);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lateRenewals = [];
    const todayRenewals = [];
    const thisWeekRenewals = [];

    // Pour chaque groupe (Client + Mois), on calcule le dû
    Object.values(clientMonthlyMap).forEach(group => {
      let totalAmount = 0;
      group.records.forEach(r => {
        const isPaid = r.reference_no && r.reference_no.trim() !== "";
        if (!isPaid) {
          const sub = parseAmount(r.subscription_fee);
          const setup = parseAmount(r.setup_fee);
          const disc = parseAmount(r.discount);
          const received = parseAmount(r.amount_received);
          
          const due = (sub + setup) - disc - received;
          if (due > 0) {
            totalAmount += due;
          }
        }
      });
      
      // Si tout est payé pour ce mois précis, on ne l'affiche pas
      if (totalAmount <= 0) return;

      const computedRow = {
        ...group.records[0],
        total_due: totalAmount,
        total_products: group.records.length,
        products: group.records.map(r => ({ tier: r.tier, setup_type: r.setup_type, reference_no: r.reference_no })),
        client_name: group.client_name,
        client_id: group.client_id,
        bank_name: group.bank_name,
        valid_stopped_date: group.valid_stopped_date
      };

      if (computedRow.valid_stopped_date) {
        const dueDate = new Date(computedRow.valid_stopped_date);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          lateRenewals.push(computedRow);
        } else if (diffDays === 0) {
          todayRenewals.push(computedRow);
        } else if (diffDays > 0 && diffDays <= 7) {
          thisWeekRenewals.push(computedRow);
        }
      }
    });
    
    return NextResponse.json({
      late: lateRenewals,
      today: todayRenewals,
      thisWeek: thisWeekRenewals,
      allActive: Object.values(clientMonthlyMap) // Juste pour debug si besoin
    });
  } catch (error) {
    console.error('Erreur API /renewals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
