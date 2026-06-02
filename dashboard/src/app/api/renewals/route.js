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
    
    // Grouper par client_id et isoler le "mois courant"
    const clientsMap = {};
    for (let row of allActiveRenewals) {
      if (!clientsMap[row.client_id]) {
        clientsMap[row.client_id] = {
          latestMonth: row.month,
          records: [],
          client_id: row.client_id,
          client_name: row.c_name,
          bank_name: row.bank_name,
          valid_stopped_date: row.valid_stopped_date || row.start_date
        };
      }
      
      // On prend tous les enregistrements du même mois que le plus récent
      if (row.month === clientsMap[row.client_id].latestMonth) {
        clientsMap[row.client_id].records.push(row);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lateRenewals = [];
    const todayRenewals = [];
    const thisWeekRenewals = [];

    // Pour chaque client, on calcule le total dû et on vérifie la date
    Object.values(clientsMap).forEach(clientObj => {
      let totalAmount = 0;
      clientObj.records.forEach(r => {
        totalAmount += parseAmount(r.subscription_fee);
        totalAmount += parseAmount(r.setup_fee);
      });
      
      // Créer un objet fusionné pour le front
      const computedRow = {
        ...clientObj.records[0], // On prend les infos de base du premier
        total_due: totalAmount,
        total_products: clientObj.records.length,
        products: clientObj.records.map(r => ({ tier: r.tier, setup_type: r.setup_type })),
        client_name: clientObj.client_name,
        client_id: clientObj.client_id,
        bank_name: clientObj.bank_name,
        valid_stopped_date: clientObj.valid_stopped_date
      };

      if (computedRow.valid_stopped_date) {
        const dueDate = new Date(computedRow.valid_stopped_date);
        dueDate.setHours(0, 0, 0, 0);

        // Différence en jours
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          // Retard
          lateRenewals.push(computedRow);
        } else if (diffDays === 0) {
          // Aujourd'hui
          todayRenewals.push(computedRow);
        } else if (diffDays > 0 && diffDays <= 7) {
          // Dans les 7 prochains jours
          thisWeekRenewals.push(computedRow);
        }
      }
    });
    
    return NextResponse.json({
      late: lateRenewals,
      today: todayRenewals,
      thisWeek: thisWeekRenewals,
      allActive: Object.values(clientsMap) // Juste pour debug si besoin
    });
  } catch (error) {
    console.error('Erreur API /renewals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
