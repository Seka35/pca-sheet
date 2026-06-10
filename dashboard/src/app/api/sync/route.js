import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { run, all, initDatabase, backfillTeleIds } from '@/lib/db';
import { extractTeleId } from '@/lib/teleIdParser';

const SHEET_ID = '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY';

function getVal(cell) {
  return cell ? (cell.formattedValue || '') : '';
}

function isGreen(cell) {
  if (!cell || !cell.effectiveFormat || !cell.effectiveFormat.backgroundColor) return false;
  const bg = cell.effectiveFormat.backgroundColor;
  return bg.green > bg.red && bg.green > bg.blue && bg.green > 0.7;
}

async function performSync() {
  initDatabase();

  const creds = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // Le .env stocke la clé avec des \n littéraux — on les convertit en vrais retours à la ligne.
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    ranges: ['Master sheet!A3:AA'],
    includeGridData: true,
  });

  const sheet = res.data.sheets[0];
  const gridData = sheet.data[0];
  const rowData = gridData.rowData || [];

  const clientsToInsert = new Map();
  const renewalRows = [];

  for (const row of rowData) {
    if (!row || !row.values || row.values.length === 0) continue;
    const cells = row.values;
    const srNo = getVal(cells[0]);
    if (!srNo || isNaN(parseFloat(srNo))) continue;

    // Mapping A-AA (cf. webhook route)
    const clientName = getVal(cells[1]);
    const clientStatusHistory = getVal(cells[2]);
    const month = getVal(cells[3]);
    const startDate = getVal(cells[4]);
    const clientAdIdName = getVal(cells[5]);
    const adIdNumber = getVal(cells[6]);
    const adAccountType = getVal(cells[7]);
    const tier = getVal(cells[8]);
    const adSpendLimit = getVal(cells[9]);
    const setupType = getVal(cells[10]);
    const subscriptionFee = getVal(cells[11]);
    const setupFee = getVal(cells[12]);
    const discount = getVal(cells[13]);
    const clAmount = getVal(cells[14]);
    const referralPartnerName = getVal(cells[15]);
    const referralAmount = getVal(cells[16]);
    const validStoppedDate = getVal(cells[17]);
    const paymentName = getVal(cells[18]);
    const bankName = getVal(cells[19]);
    const amountReceived = getVal(cells[20]);
    const paymentReceivedDate = getVal(cells[21]);
    const paymentReceivedMonth = getVal(cells[22]);
    const referenceNo = getVal(cells[23]);
    const actualBalanceDifference = getVal(cells[24]);
    const notes = getVal(cells[25]);
    const visualStatusRaw = getVal(cells[26]);

    const statusCell = cells[26];
    const isActive = isGreen(statusCell) || visualStatusRaw.toLowerCase().includes('active');
    const visualStatus = isActive ? 'Active' : visualStatusRaw;
    const statusValidation = isActive ? 'Actif' : 'inactif';

    const baseClientId = Math.floor(parseFloat(srNo));
    const isClientHeader = parseFloat(srNo) % 1 === 0;

    if (isClientHeader) {
      clientsToInsert.set(baseClientId, { id: baseClientId, name: clientName, status: 'inactif', tele_id: extractTeleId(clientName) });
    } else {
      if (!clientsToInsert.has(baseClientId)) {
        clientsToInsert.set(baseClientId, { id: baseClientId, name: clientName, status: 'inactif', tele_id: extractTeleId(clientName) });
      }
      if (isActive) {
        clientsToInsert.get(baseClientId).status = 'Actif';
      }
      renewalRows.push({
        sr_no: srNo,
        client_id: baseClientId,
        client_name: clientName,
        client_status_history: clientStatusHistory,
        month,
        start_date: startDate,
        client_ad_id_name: clientAdIdName,
        ad_id_number: adIdNumber,
        ad_account_type: adAccountType,
        tier,
        ad_spend_limit: adSpendLimit,
        setup_type: setupType,
        subscription_fee: subscriptionFee,
        setup_fee: setupFee,
        discount,
        cl_amount: clAmount,
        referral_partner_name: referralPartnerName,
        referral_amount: referralAmount,
        valid_stopped_date: validStoppedDate,
        payment_name: paymentName,
        bank_name: bankName,
        amount_received: amountReceived,
        payment_received_date: paymentReceivedDate,
        payment_received_month: paymentReceivedMonth,
        reference_no: referenceNo,
        actual_balance_difference: actualBalanceDifference,
        notes,
        visual_status: visualStatus,
      });
    }
  }

  // Transaction unique : DELETE + INSERT en better-sqlite3 (synchrone, plus de musl/SIGSEGV).
  // better-sqlite3 n'a pas de mode serialize, on wrap simplement dans BEGIN/COMMIT.
  // On n'utilise pas les `run`/`all` exportés de db.js car ils passent par prepare/run
  // qui n'exposent pas explicitement le contrôle de transaction; on utilise directement
  // l'instance `db` via ces helpers existants.
  run('BEGIN');
  try {
    run('DELETE FROM renewals');
    run('DELETE FROM clients');

    // Simply extract tele_id from each client's name. Multiple clients
    // can share the same tele_id — this is allowed since they may belong
    // to the same Telegram group and should ALL receive reminders.
    for (const [id, c] of clientsToInsert) {
      const teleId = extractTeleId(c.name);
      c.tele_id = teleId;
    }

    let clientInserts = 0;
    for (const client of clientsToInsert.values()) {
      const result = run(
        'INSERT INTO clients (id, name, status, tele_id) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status, tele_id=excluded.tele_id',
        [client.id, client.name, client.status, client.tele_id]
      );
      clientInserts++;
    }
    console.log(`[sync] inserted ${clientInserts} clients`);

    const insertRenewal = `INSERT OR REPLACE INTO renewals (
      sr_no, client_id, client_name, client_status_history, month, start_date,
      client_ad_id_name, ad_id_number, ad_account_type, tier, ad_spend_limit,
      setup_type, subscription_fee, setup_fee, discount, cl_amount,
      referral_partner_name, referral_amount, valid_stopped_date,
      payment_name, bank_name, amount_received, payment_received_date,
      payment_received_month, reference_no, actual_balance_difference,
      notes, visual_status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    for (const r of renewalRows) {
      run(insertRenewal, [
        r.sr_no, r.client_id, r.client_name, r.client_status_history, r.month, r.start_date,
        r.client_ad_id_name, r.ad_id_number, r.ad_account_type, r.tier, r.ad_spend_limit,
        r.setup_type, r.subscription_fee, r.setup_fee, r.discount, r.cl_amount,
        r.referral_partner_name, r.referral_amount, r.valid_stopped_date,
        r.payment_name, r.bank_name, r.amount_received, r.payment_received_date,
        r.payment_received_month, r.reference_no, r.actual_balance_difference,
        r.notes, r.visual_status,
      ]);
    }

    run('COMMIT');
  } catch (e) {
    run('ROLLBACK');
    throw e;
  }

  // Resolve tele_id conflicts properly (backfillTeleIds uses "lower id wins" logic)
  try {
    backfillTeleIds();
  } catch (e) {
    console.error('[sync] backfillTeleIds failed:', e.message);
    // Non-fatal: sync is already committed
  }

  return {
    clients: clientsToInsert.size,
    renewals: renewalRows.length,
  };
}

// Route Handlers: POST déclenche un sync complet Sheet → DB.
export async function POST() {
  try {
    const result = await performSync();
    return NextResponse.json({ success: true, ...result, message: 'Sync complete' });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}
