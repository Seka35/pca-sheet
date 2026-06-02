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
    
    // 1. Grouper les données existantes par client et par mois
    const clientMonthlyMap = {}; 
    const clientLastKnownRecord = {}; // Pour stocker les infos de base par client

    for (let row of allActiveRenewals) {
      const key = `${row.client_id}-${row.month}`;
      if (!clientMonthlyMap[key]) {
        clientMonthlyMap[key] = {
          month: row.month,
          records: [],
          client_id: row.client_id,
          client_name: row.c_name,
          bank_name: row.bank_name,
          valid_stopped_date: row.valid_stopped_date || row.start_date,
          start_date: row.start_date
        };
      }
      clientMonthlyMap[key].records.push(row);
      
      // On garde l'enregistrement le plus récent pour les prédictions
      if (!clientLastKnownRecord[row.client_id]) {
        clientLastKnownRecord[row.client_id] = row;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lateRenewals = [];
    const todayRenewals = [];
    const thisWeekRenewals = [];
    const thisMonthRenewals = [];

    // --- LOGIQUE 1 : TRAITEMENT DES DETTES EXISTANTES (Lignes dans le sheet) ---
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
          if (due > 0) totalAmount += due;
        }
      });
      
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
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        computedRow.diff_days = diffDays;

        if (diffDays < 0) lateRenewals.push(computedRow);
        else if (diffDays === 0) todayRenewals.push(computedRow);
        else if (diffDays > 0 && diffDays <= 7) thisWeekRenewals.push(computedRow);

        if (dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear()) {
          thisMonthRenewals.push(computedRow);
        }
      }
    });

    // --- LOGIQUE 2 : PRÉDICTION DES RENOUVELLEMENTS À VENIR (Basé sur Start Date) ---
    // Pour chaque client actif, on regarde si son jour anniversaire de paiement approche
    Object.values(clientLastKnownRecord).forEach(lastRecord => {
      if (!lastRecord.start_date) return;

      const startDate = new Date(lastRecord.start_date);
      const dayOfMonth = startDate.getDate();
      
      // On calcule la date de renouvellement théorique pour le mois en cours
      let predictedDue = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
      predictedDue.setHours(0, 0, 0, 0);

      // Si le jour est déjà passé ce mois-ci, on regarde le mois prochain
      if (predictedDue < today) {
        predictedDue.setMonth(predictedDue.getMonth() + 1);
      }

      const diffDays = Math.ceil((predictedDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const monthStr = predictedDue.toLocaleString('en-US', { month: 'short' }) + '-' + predictedDue.getFullYear();

      // On ne l'ajoute que s'il n'y a STRICTEMENT AUCUNE ligne pour ce mois dans le sheet
      // (Si une ligne existe, qu'elle soit payée ou non, on laisse la LOGIQUE 1 gérer)
      const hasExistingRow = allActiveRenewals.some(r => r.client_id === lastRecord.client_id && r.month === monthStr);

      if (!hasExistingRow) {
        const predictedRow = {
          ...lastRecord,
          total_due: parseAmount(lastRecord.subscription_fee), // On anticipe le prix habituel
          total_products: 1,
          is_predicted: true,
          diff_days: diffDays,
          valid_stopped_date: predictedDue.toISOString().split('T')[0],
          month: monthStr
        };

        if (diffDays === 0) todayRenewals.push(predictedRow);
        else if (diffDays > 0 && diffDays <= 7) thisWeekRenewals.push(predictedRow);

        if (predictedDue.getMonth() === today.getMonth() && predictedDue.getFullYear() === today.getFullYear()) {
          thisMonthRenewals.push(predictedRow);
        }
      }
    });

    // Trier les listes par proximité de date
    const sortByDue = (a, b) => a.diff_days - b.diff_days;
    todayRenewals.sort(sortByDue);
    thisWeekRenewals.sort(sortByDue);
    thisMonthRenewals.sort(sortByDue);
    lateRenewals.sort(sortByDue);

    return NextResponse.json({
      late: lateRenewals,
      today: todayRenewals,
      thisWeek: thisWeekRenewals,
      thisMonth: thisMonthRenewals
    });
  } catch (error) {
    console.error('Erreur API /renewals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
