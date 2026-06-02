import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export async function GET(req) {
  try {
    const clients = await all("SELECT * FROM clients ORDER BY CASE WHEN status = 'Actif' THEN 0 ELSE 1 END, id DESC");
    const history = await all('SELECT * FROM renewals ORDER BY sr_no ASC');

    const clientHistory = {};
    history.forEach(row => {
      if (!clientHistory[row.client_id]) clientHistory[row.client_id] = [];
      clientHistory[row.client_id].push(row);
    });

    const now = new Date();

    const formattedClients = clients.map(client => {
      const h = clientHistory[client.id] || [];
      
      let earliestDate = null;
      let latestMonth = null;
      let activeProducts = [];
      
      h.forEach(row => {
        // Find earliest start date
        if (row.start_date) {
          const d = new Date(row.start_date);
          if (!earliestDate || d < earliestDate) earliestDate = d;
        }
        latestMonth = row.month; // Since history is ordered by sr_no, this naturally gets the last month
      });

      if (latestMonth) {
        activeProducts = h.filter(r => r.month === latestMonth);
      }

      // Calculate MRR (Mensuel)
      let mrr = 0;
      let produits = [];
      let canal = null;
      let renewalDay = null;

      activeProducts.forEach(p => {
        mrr += parseAmount(p.subscription_fee) + parseAmount(p.setup_fee);
        
        let pName = p.setup_type && p.setup_type.trim() !== '' ? p.setup_type : p.tier;
        if (pName && !produits.includes(pName)) {
            produits.push(pName);
        }

        if (!canal && p.bank_name) canal = p.bank_name;
        
        if (!renewalDay && p.start_date) {
          const d = new Date(p.start_date);
          if (!isNaN(d.getTime())) {
            renewalDay = `J${d.getDate()}`;
          }
        }
      });

      // Calculate Ancienneté
      let anciennete = '—';
      if (earliestDate) {
        let months = (now.getFullYear() - earliestDate.getFullYear()) * 12;
        months -= earliestDate.getMonth();
        months += now.getMonth();
        
        if (months <= 0) {
          anciennete = 'New';
        } else {
          const years = Math.floor(months / 12);
          const remainingMonths = months % 12;
          if (years > 0) {
            anciennete = `${years}y ${remainingMonths > 0 ? remainingMonths + 'm' : ''}`.trim();
          } else {
            anciennete = `${months}m`;
          }
        }
      }

      return {
        id: client.id,
        pd_id: client.id + 1000, // Fake a Pipedrive ID by adding 1000
        nom: client.name,
        email: client.telegram_group_id || 'No contact',
        produits: produits.length > 0 ? produits.join(', ') : '—',
        mensuel: mrr,
        statut: client.status === 'Actif' ? 'Active' : 'Inactive',
        canal: canal || '—',
        renouvellement: renewalDay || '—',
        anciennete: anciennete
      };
    });
    
    return NextResponse.json(formattedClients);
  } catch (error) {
    console.error('Erreur API /clients:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
