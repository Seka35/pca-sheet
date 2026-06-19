import { NextResponse } from 'next/server';
import { all } from '@/lib/db';
import { extractTeleId } from '@/lib/teleIdParser';

function parseAmount(val) {
  if (!val) return 0;
  // Ex: "199 €" -> 199, " 299.5$" -> 299.5
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export async function GET(req) {
  try {
    const query = `
      SELECT r.*, c.status as client_global_status, c.name as c_name, c.tele_id as c_tele_id
      FROM renewals r
      JOIN clients c ON c.id = r.client_id
      WHERE c.status = 'Actif'
      ORDER BY r.client_id ASC, r.sr_no DESC
    `;

    const allActiveRenewals = await all(query);

    // Pre-compute the parsed value for every active client so we can surface
    // conflicts (parsed value differs from the assigned tele_id, usually
    // because a duplicate ID was NULLed during the backfill).
    const parsedCache = new Map();
    for (const r of allActiveRenewals) {
      if (!parsedCache.has(r.client_id)) {
        parsedCache.set(r.client_id, extractTeleId(r.c_name));
      }
    }

    // Lookup linked Telegram groups per client (one row per linked group).
    const groupRows = await all(
      `SELECT chat_id, chat_title, client_id FROM bot_group_links WHERE status = 'linked'`
    );
    const groupsByClient = {};
    for (const g of groupRows) {
      if (!groupsByClient[g.client_id]) groupsByClient[g.client_id] = [];
      groupsByClient[g.client_id].push({ chat_id: g.chat_id, chat_title: g.chat_title });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Aggregate unpaid amounts per client (for display totals, not categorization)
    const clientUnpaidMap = {};
    for (const row of allActiveRenewals) {
      const isPaid = row.reference_no && row.reference_no.trim() !== "";
      if (!isPaid) {
        const sub = parseAmount(row.subscription_fee);
        const setup = parseAmount(row.setup_fee);
        const disc = parseAmount(row.discount);
        const received = parseAmount(row.amount_received);
        const due = (sub + setup) - disc - received;
        if (due > 0) {
          if (!clientUnpaidMap[row.client_id]) {
            clientUnpaidMap[row.client_id] = {
              total_due: 0,
              total_products: 0,
            };
          }
          clientUnpaidMap[row.client_id].total_due += due;
          clientUnpaidMap[row.client_id].total_products++;
        }
      }
    }

    const lateRenewals = [];
    const todayRenewals = [];
    const thisWeekRenewals = [];
    const thisMonthRenewals = [];
    const upcomingRenewals = []; // Products renewing in more than 7 days

    // --- TRAITEMENT DE CHAQUE PRODUIT INDIVIDUELLEMENT (pas de grouping) ---
    for (const row of allActiveRenewals) {
      const isPaid = row.reference_no && row.reference_no.trim() !== "";
      if (isPaid) continue; // Skip paid products

      const sub = parseAmount(row.subscription_fee);
      const setup = parseAmount(row.setup_fee);
      const disc = parseAmount(row.discount);
      const received = parseAmount(row.amount_received);
      const due = (sub + setup) - disc - received;
      // Don't skip if due <= 0 - product might still be unpaid (discount covers amount)
      // We only skip if due < 0 (negative doesn't make sense for amount due)
      if (due < 0) continue;

      const assignedTele = row.c_tele_id || null;
      const parsedTele = parsedCache.get(row.client_id) || null;
      const groups = groupsByClient[row.client_id] || [];

      // Use the product's own valid_stopped_date (not a group date)
      const productDate = row.valid_stopped_date || row.start_date;

      // If no date at all, we still include the product but with diff_days = 999
      // so it appears at the end of the list but doesn't get filtered out
      let diffDays = 999;
      if (productDate) {
        const dueDate = new Date(productDate);
        dueDate.setHours(0, 0, 0, 0);
        diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      const computedRow = {
        ...row,
        total_due: due,
        total_products: 1,
        diff_days: diffDays,
        products: [{ tier: row.tier, setup_type: row.setup_type, reference_no: row.reference_no, is_trial: row.is_trial }],
        client_name: row.c_name,
        bank_name: row.bank_name,
        telegram_chats: groups,
        telegram_chat_id: groups[0]?.chat_id || null,
        tele_id: assignedTele,
        parsed_tele_id: parsedTele,
        tele_id_conflict: !assignedTele && !!parsedTele,
      };

      // Categorize based on the product's own diff_days
      if (diffDays < 0) {
        lateRenewals.push(computedRow);
      } else if (diffDays === 0) {
        todayRenewals.push(computedRow);
      } else if (diffDays > 0 && diffDays <= 7) {
        thisWeekRenewals.push(computedRow);
      } else if (diffDays > 7) {
        // Products renewing in more than 7 days - show in Upcoming
        upcomingRenewals.push(computedRow);
      }

      // thisMonth: any product with due date in current month (even if > 7 days away)
      // Only check if productDate existed
      if (productDate) {
        const dueDate = new Date(productDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear()) {
          thisMonthRenewals.push(computedRow);
        }
      }
    }

    // Sort each category by diff_days (closest first for overdue/today, farthest first for future)
    const sortByDue = (a, b) => a.diff_days - b.diff_days;
    lateRenewals.sort(sortByDue);     // Most overdue first
    todayRenewals.sort(sortByDue);    // Today stays together
    thisWeekRenewals.sort(sortByDue); // Soonest first
    thisMonthRenewals.sort(sortByDue);
    upcomingRenewals.sort(sortByDue); // Soonest upcoming first
    // Deduplicate thisMonth (a product in This Week is also in This Month)
    const seenThisMonth = new Set();
    const dedupedThisMonth = thisMonthRenewals.filter(r => {
      if (seenThisMonth.has(r.sr_no)) return false;
      seenThisMonth.add(r.sr_no);
      return true;
    });

    return NextResponse.json({
      late: lateRenewals,
      today: todayRenewals,
      thisWeek: thisWeekRenewals,
      thisMonth: dedupedThisMonth,
      upcoming: upcomingRenewals
    });
  } catch (error) {
    console.error('Erreur API /renewals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
