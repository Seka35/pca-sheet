import { NextResponse } from 'next/server';
import { all, run, get } from '@/lib/db';
import { extractTeleId } from '@/lib/teleIdParser';
// Google Sheets integration removed - using DB only
import { validateUpdateClientPayload } from '@/lib/clientValidation';
import { createBackup } from '@/lib/backup';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

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

function computeHealthStatus(client, history) {
  if (!history || history.length === 0) return 'critical';

  // Tenure: months since first renewal
  const earliest = history[history.length - 1]; // sorted DESC
  const latest = history[0];
  const tenureMonths = history.length;

  // Renewal count
  const renewalCount = history.length;

  // Payment streak: consecutive months with payment
  let paymentStreak = 0;
  for (const r of history) {
    if (r.reference_no && r.reference_no.trim() !== '') {
      paymentStreak++;
    } else {
      break;
    }
  }

  // Months since last payment
  let monthsSincePayment = 0;
  for (let i = 0; i < history.length; i++) {
    if (history[i].reference_no && history[i].reference_no.trim() !== '') {
      monthsSincePayment = i;
      break;
    }
  }
  if (monthsSincePayment === 0 && history[0] && history[0].reference_no && history[0].reference_no.trim() !== '') {
    monthsSincePayment = 0;
  } else {
    monthsSincePayment = Math.min(monthsSincePayment, 12);
  }

  const score = (tenureMonths * 10) + (renewalCount * 5) + (paymentStreak * 3) - (monthsSincePayment * 2);

  if (score >= 50) return 'healthy';
  if (score >= 25) return 'at_risk';
  return 'critical';
}

// --- GET: full client detail (enhanced) --------------------------------------

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    const clientRes = await all('SELECT * FROM clients WHERE id = ?', [id]);
    if (clientRes.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clientRes[0];

    const history = await all('SELECT * FROM renewals WHERE client_id = ? ORDER BY sr_no DESC', [id]);

    // Compute totalSpend (CL = sum of cl_amount)
    const totalSpend = history.reduce((sum, r) => sum + parseAmount(r.cl_amount), 0);

    // Compute totalCA (fees received = sum of amount_received)
    const totalCA = history.reduce((sum, r) => sum + parseAmount(r.amount_received), 0);

    // Renewal count
    const renewalCount = history.length;

    // Earliest start date (from oldest renewal)
    const earliestStartDate = history.length > 0 ? history[history.length - 1].start_date : null;

    // Next renewal date: the valid_stopped_date of the product expiring soonest (earliest valid_until date)
    const activeProducts = history.filter(r => r.visual_status === 'Active' || r.active !== false);
    let nextRenewalDate = null;
    if (activeProducts.length > 0) {
      const sortedByValidUntil = [...activeProducts].sort((a, b) => {
        if (!a.valid_stopped_date) return 1;
        if (!b.valid_stopped_date) return -1;
        return new Date(a.valid_stopped_date) - new Date(b.valid_stopped_date);
      });
      nextRenewalDate = sortedByValidUntil[0].valid_stopped_date;
    }

    // Latest tier & setup_type
    const latestTier = history.length > 0 ? history[0].tier : null;
    const latestSetupType = history.length > 0 ? history[0].setup_type : null;

    // Is invincible setup?
    const isInvincible = latestSetupType && latestSetupType.toLowerCase().includes('invincible');

    // Health status
    const healthStatus = computeHealthStatus(client, history);

    // Client is considered stable if 2+ renewals
    const isStable = renewalCount >= 2;

    return NextResponse.json({
      client,
      history,
      computed: {
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        totalCA: parseFloat(totalCA.toFixed(2)),
        renewalCount,
        earliestStartDate,
        nextRenewalDate,
        latestTier,
        latestSetupType,
        isInvincible,
        isStable,
        healthStatus
      }
    });
  } catch (error) {
    console.error(`Erreur API /clients/${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- PUT: update an existing client (writes to Sheet first, then DB) -------

export async function PUT(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let backupFilename = null;
  let sheetResult = null;

  try {
    const { id } = await params;
    const clientId = parseInt(id, 10);
    if (!Number.isInteger(clientId) || clientId < 1) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    // 1. Parse + validate.
    const body = await req.json().catch(() => ({}));
    const validation = validateUpdateClientPayload(body, clientId);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { name, telegram_group_id, status: newStatus, products, removed_sr_nos } = validation.cleaned;

    // 2. Verify the client exists.
    const existing = get('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!existing) {
      return NextResponse.json({ error: `Client ${clientId} not found` }, { status: 404 });
    }

    // 3. Pre-write backup (best-effort).
    try {
      const meta = await createBackup({ source: 'pre-edit-client' });
      backupFilename = meta.filename;
      console.log(`[PUT /api/clients/${clientId}] backup created: ${backupFilename}`);
    } catch (e) {
      console.warn(`[PUT /api/clients/${clientId}] backup failed (continuing):`, e.message);
    }

    // 4. Google Sheets integration disabled - DB-only mode
    // Mock sheetResult for code that depends on it
    sheetResult = { ok: true, added: [], updated: [], removed: [] };
    console.log(`[PUT /api/clients/${clientId}] DB-only mode (Sheet sync disabled)`);

    // 5. Write to the DB in a transaction.
    const tele_id = extractTeleId(name);
    const computedStatus = newStatus || (
      products.some((p) => p.active !== false) ? 'Actif' : 'inactif'
    );

    // Handle new fields
    const trustpilot_reviewed = body.trustpilot_reviewed ? 1 : 0;
    const churn_reason = body.churn_reason || null;
    const contract_file_path = body.contract_file_path || null;

    const insertRenewal = `INSERT OR REPLACE INTO renewals (
      sr_no, client_id, client_name, client_status_history, month, start_date,
      client_ad_id_name, ad_id_number, ad_account_type, tier, ad_spend_limit,
      setup_type, subscription_fee, setup_fee, discount, cl_amount,
      referral_partner_name, referral_amount, valid_stopped_date,
      payment_name, bank_name, amount_received, payment_received_date,
      payment_received_month, reference_no, actual_balance_difference,
      notes, visual_status, is_trial
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    run('BEGIN');
    try {
      // Update the client header.
      run(
        `UPDATE clients SET name = ?, first_name = ?, last_name = ?, email = ?, address = ?, telegram_group_id = ?, status = ?, tele_id = ?, trustpilot_reviewed = ?, churn_reason = ?, contract_file_path = ? WHERE id = ?`,
        [name, body.first_name || '', body.last_name || '', body.email || '', body.address || '', telegram_group_id || '', computedStatus, tele_id || null, trustpilot_reviewed, churn_reason, contract_file_path, clientId]
      );

      // Remove the products the user deleted.
      if (removed_sr_nos && removed_sr_nos.length > 0) {
        const placeholders = removed_sr_nos.map(() => '?').join(',');
        run(
          `DELETE FROM renewals WHERE client_id = ? AND sr_no IN (${placeholders})`,
          [clientId, ...removed_sr_nos]
        );
      }

      // Upsert each product. Existing products (with sr_no) are updated in place.
      // New products (no sr_no) get an auto-generated sr_no (DB-only mode).
      const addedSrNos = sheetResult.added || [];
      let addedIdx = 0;
      // Pre-compute next available sr_no suffix for new products
      const existingSrNos = products.map(p => p.sr_no).filter(Boolean);
      let nextSuffix = 1;
      for (const p of products) {
        let sr_no = p.sr_no;
        if (!sr_no) {
          // Auto-generate sr_no in DB-only mode
          if (addedIdx < addedSrNos.length) {
            sr_no = addedSrNos[addedIdx++];
          } else {
            // Find a unique sr_no: clientId followed by .1, .2, etc.
            let candidate = `${clientId}.${nextSuffix}`;
            while (existingSrNos.includes(candidate)) {
              nextSuffix++;
              candidate = `${clientId}.${nextSuffix}`;
            }
            sr_no = candidate;
            existingSrNos.push(sr_no);
            nextSuffix++;
          }
        }
        run(insertRenewal, [
          sr_no,
          clientId,
          name,
          p.client_status_history || '',
          p.month || '',
          p.start_date || '',
          p.client_ad_id_name || '',
          p.ad_id_number || '',
          p.ad_account_type || '',
          p.tier || '',
          p.ad_spend_limit || '',
          p.setup_type || '',
          p.subscription_fee || '',
          p.setup_fee || '',
          p.discount || '',
          p.cl_amount || '',
          p.referral_partner_name || '',
          p.referral_amount || '',
          p.valid_stopped_date || '',
          p.payment_name || '',
          p.bank_name || '',
          p.amount_received || '',
          p.payment_received_date || '',
          p.payment_received_month || '',
          p.reference_no || '',
          p.actual_balance_difference || '',
          p.notes || '',
          p.active === false ? '' : 'Active',
          p.is_trial ? 1 : 0,
        ]);
      }
      run('COMMIT');
    } catch (e) {
      run('ROLLBACK');
      throw e;
    }

    console.log(`[PUT /api/clients/${clientId}] DB written`);

    logActivity(auth.user?.id, auth.user?.username || 'system', 'UPDATE', 'clients', clientId, name, { added: sheetResult.added, updated: sheetResult.updated, removed: sheetResult.removed });

    return NextResponse.json({
      ok: true,
      client_id: clientId,
      added: sheetResult.added,
      updated: sheetResult.updated,
      removed: sheetResult.removed,
      backup: backupFilename,
    });
  } catch (error) {
    console.error('[PUT /api/clients/[id]] error:', error);
    const code = sheetResult && sheetResult.ok ? 'SHEETS_OK_DB_FAIL' : 'INTERNAL';
    return NextResponse.json(
      {
        error: error.message || 'Internal Server Error',
        code,
        backup: backupFilename,
      },
      { status: 500 }
    );
  }
}
