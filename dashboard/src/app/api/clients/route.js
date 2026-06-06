import { NextResponse } from 'next/server';
import { all, run } from '@/lib/db';
import { extractTeleId } from '@/lib/teleIdParser';
import { getSheetsClient, findNextClientId, appendClientBlock } from '@/lib/googleSheets';
import { validateAddClientPayload } from '@/lib/clientValidation';
import { createBackup } from '@/lib/backup';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// --- GET: list all clients (existing handler, unchanged) --------------------

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
        if (row.start_date) {
          const d = new Date(row.start_date);
          if (!earliestDate || d < earliestDate) earliestDate = d;
        }
        latestMonth = row.month;
      });

      if (latestMonth) {
        activeProducts = h.filter(r => r.month === latestMonth);
      }

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

      const parsedTeleId = extractTeleId(client.name);
      const teleIdConflict = !client.tele_id && !!parsedTeleId;

      return {
        id: client.id,
        pd_id: client.id + 1000,
        nom: client.name,
        email: client.telegram_group_id || 'No contact',
        telegram_group_id: client.telegram_group_id || null,
        tele_id: client.tele_id || null,
        parsed_tele_id: parsedTeleId,
        tele_id_conflict: teleIdConflict,
        produits: produits.length > 0 ? produits.join(', ') : '—',
        mensuel: mrr,
        statut: client.status === 'Actif' ? 'Active' : 'Inactive',
        canal: canal || '—',
        renouvellement: renewalDay || '—',
        anciennete: anciennete,
      };
    });

    return NextResponse.json(formattedClients);
  } catch (error) {
    console.error('Erreur API /clients:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- POST: create a new client (writes to Sheet first, then DB) ------------

export async function POST(req) {
  let clientId = null;
  let sr_nos = [];
  let backupFilename = null;

  try {
    // 1. Parse + validate.
    const body = await req.json().catch(() => ({}));
    const validation = validateAddClientPayload(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { name, telegram_group_id, products } = validation.cleaned;

    // 2. Pre-write backup (best-effort — don't block the operation if it fails).
    try {
      const meta = await createBackup({ source: 'pre-add-client' });
      backupFilename = meta.filename;
      console.log(`[POST /api/clients] backup created: ${backupFilename}`);
    } catch (e) {
      console.warn('[POST /api/clients] backup failed (continuing):', e.message);
    }

    // 3. Pick the next client id from the Sheet (source of truth).
    const sheets = await getSheetsClient();
    clientId = await findNextClientId(sheets);
    console.log(`[POST /api/clients] next client id from Sheet: ${clientId}`);

    // 4. Write to the Sheet first. If this fails, we abort before touching the DB.
    const sheetResult = await appendClientBlock({
      name,
      telegram_group_id,
      products,
      baseSrNo: clientId,
    });
    if (!sheetResult.ok) {
      console.error('[POST /api/clients] Sheet write failed:', sheetResult.error);
      return NextResponse.json(
        { error: 'Failed to write to Google Sheet', details: sheetResult.error, code: 'SHEETS_FAIL' },
        { status: 500 }
      );
    }
    sr_nos = sheetResult.sr_nos;
    console.log(`[POST /api/clients] Sheet written: sr_nos=${sr_nos.join(',')}`);

    // 5. Write to the DB in a transaction.
    const tele_id = extractTeleId(name);
    const hasActive = products.some((p) => p.active !== false);
    const status = hasActive ? 'Actif' : 'inactif';

    // Reused INSERT statement from src/app/api/sync/route.js:213-221.
    const insertRenewal = `INSERT OR REPLACE INTO renewals (
      sr_no, client_id, client_name, client_status_history, month, start_date,
      client_ad_id_name, ad_id_number, ad_account_type, tier, ad_spend_limit,
      setup_type, subscription_fee, setup_fee, discount, cl_amount,
      referral_partner_name, referral_amount, valid_stopped_date,
      payment_name, bank_name, amount_received, payment_received_date,
      payment_received_month, reference_no, actual_balance_difference,
      notes, visual_status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    run('BEGIN');
    try {
      run(
        'INSERT OR REPLACE INTO clients (id, name, telegram_group_id, status, tele_id) VALUES (?, ?, ?, ?, ?)',
        [clientId, name, telegram_group_id || '', status, tele_id || null]
      );

      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const sr_no = `${clientId}.${i + 1}`;
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
        ]);
      }
      run('COMMIT');
    } catch (e) {
      run('ROLLBACK');
      throw e;
    }

    console.log(`[POST /api/clients] DB written: client ${clientId}, ${products.length} product(s)`);

    return NextResponse.json({
      ok: true,
      client_id: clientId,
      sr_nos,
      backup: backupFilename,
    });
  } catch (error) {
    console.error('[POST /api/clients] error:', error);

    // If we wrote to the Sheet but the DB write failed, surface a specific
    // code so the client can run /api/sync to reconcile.
    const code = sr_nos.length > 0 ? 'SHEETS_OK_DB_FAIL' : 'INTERNAL';
    return NextResponse.json(
      {
        error: error.message || 'Internal Server Error',
        code,
        client_id: clientId,
        sr_nos,
        backup: backupFilename,
      },
      { status: 500 }
    );
  }
}
