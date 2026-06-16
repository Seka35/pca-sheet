import { NextResponse } from 'next/server';
import { all, run, get } from '@/lib/db';
import { extractTeleId } from '@/lib/teleIdParser';
import { getSheetsClient, overwriteClientBlock } from '@/lib/googleSheets';
import { validateUpdateClientPayload } from '@/lib/clientValidation';
import { createBackup } from '@/lib/backup';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

// --- GET: full client detail (existing handler, unchanged) -----------------

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    const clientRes = await all('SELECT * FROM clients WHERE id = ?', [id]);
    if (clientRes.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clientRes[0];

    const history = await all('SELECT * FROM renewals WHERE client_id = ? ORDER BY sr_no DESC', [id]);

    return NextResponse.json({ client, history });
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

    // 4. Write to the Sheet first. If this fails, the DB stays untouched.
    try {
      const sheets = await getSheetsClient();
      sheetResult = await overwriteClientBlock({
        clientId,
        name,
        products,
        removed_sr_nos,
      });
    } catch (e) {
      console.error(`[PUT /api/clients/${clientId}] Sheets client init failed:`, e);
      return NextResponse.json(
        { error: 'Failed to reach Google Sheets', details: e.message, code: 'SHEETS_FAIL' },
        { status: 500 }
      );
    }
    if (!sheetResult.ok) {
      console.error(`[PUT /api/clients/${clientId}] Sheet write failed:`, sheetResult.error);
      return NextResponse.json(
        { error: 'Failed to write to Google Sheet', details: sheetResult.error, code: 'SHEETS_FAIL' },
        { status: 500 }
      );
    }
    console.log(
      `[PUT /api/clients/${clientId}] Sheet written: added=${sheetResult.added.length}, ` +
      `updated=${sheetResult.updated.length}, removed=${sheetResult.removed.length}`
    );

    // 5. Write to the DB in a transaction.
    const tele_id = extractTeleId(name);
    const computedStatus = newStatus || (
      products.some((p) => p.active !== false) ? 'Actif' : 'inactif'
    );

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
      // Update the client header.
      run(
        `UPDATE clients SET name = ?, first_name = ?, last_name = ?, email = ?, address = ?, telegram_group_id = ?, status = ?, tele_id = ? WHERE id = ?`,
        [name, body.first_name || '', body.last_name || '', body.email || '', body.address || '', telegram_group_id || '', computedStatus, tele_id || null, clientId]
      );

      // Remove the products the user deleted.
      if (removed_sr_nos && removed_sr_nos.length > 0) {
        const placeholders = removed_sr_nos.map(() => '?').join(',');
        run(
          `DELETE FROM renewals WHERE client_id = ? AND sr_no IN (${placeholders})`,
          [clientId, ...removed_sr_nos]
        );
      }

      // Upsert each product. Existing products (with sr_no) are updated
      // in place; new products (no sr_no) are inserted with sr_nos
      // assigned from `sheetResult.added` in order.
      const addedSrNos = sheetResult.added || [];
      let addedIdx = 0;
      for (const p of products) {
        let sr_no = p.sr_no;
        if (!sr_no) {
          if (addedIdx >= addedSrNos.length) {
            // Shouldn't happen — Sheet didn't allocate a slot. Skip.
            console.warn(`[PUT /api/clients/${clientId}] missing sr_no for new product, skipping`);
            continue;
          }
          sr_no = addedSrNos[addedIdx++];
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
