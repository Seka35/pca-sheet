import { NextResponse } from 'next/server';
import { run, all } from '@/lib/db';

// Mapping des colonnes Sheet (A-AA) → colonnes SQL de renewals
const SHEET_TO_RENEWAL = {
  A: 'sr_no',
  B: 'client_name',
  C: 'client_status_history',
  D: 'month',
  E: 'start_date',
  F: 'client_ad_id_name',
  G: 'ad_id_number',
  H: 'ad_account_type',
  I: 'tier',
  J: 'ad_spend_limit',
  K: 'setup_type',
  L: 'subscription_fee',
  M: 'setup_fee',
  N: 'discount',
  O: 'cl_amount',
  P: 'referral_partner_name',
  Q: 'referral_amount',
  R: 'valid_stopped_date',
  S: 'payment_name',
  T: 'bank_name',
  U: 'amount_received',
  V: 'payment_received_date',
  W: 'payment_received_month',
  X: 'reference_no',
  Y: 'actual_balance_difference',
  Z: 'notes',
  AA: 'visual_status',
};

const RENEWAL_PARAMS_BY_INDEX = [
  'sr_no', 'client_name', 'client_status_history', 'month', 'start_date',
  'client_ad_id_name', 'ad_id_number', 'ad_account_type', 'tier', 'ad_spend_limit',
  'setup_type', 'subscription_fee', 'setup_fee', 'discount', 'cl_amount',
  'referral_partner_name', 'referral_amount', 'valid_stopped_date',
  'payment_name', 'bank_name', 'amount_received', 'payment_received_date',
  'payment_received_month', 'reference_no', 'actual_balance_difference',
  'notes', 'visual_status',
];

function columnLetterToIndex(letters) {
  let result = 0;
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64);
  }
  return result - 1;
}

function getColumnLetterFromRange(range) {
  if (!range || typeof range !== 'string') return null;
  const match = range.match(/^([A-Z]+)\d+$/);
  return match ? match[1] : null;
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'TON_SECRET_ICI';

export async function POST(req) {
  try {
    const payload = await req.json();

    if (payload.secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sheet, row, range, changedValue, rowData } = payload;

    if (sheet !== 'Master sheet') {
      return NextResponse.json({ message: 'Ignored sheet' }, { status: 200 });
    }

    const keys = Object.keys(rowData || {});
    const srNoKey = keys.find((k) => k.toLowerCase().includes('sr no'));
    const srNo = String(rowData[srNoKey || keys[0]] ?? '').trim();

    if (!srNo || isNaN(parseFloat(srNo))) {
      return NextResponse.json({ message: 'Invalid or missing Sr No.' }, { status: 200 });
    }

    const clientId = Math.floor(parseFloat(srNo));
    const isClientHeader = parseFloat(srNo) % 1 === 0;

    const existingClientRows = await all('SELECT * FROM clients WHERE id = ?', [clientId]);
    const existingRenewalRows = await all('SELECT * FROM renewals WHERE sr_no = ?', [srNo]);

    const existingClient = existingClientRows[0];
    const existingRenewal = existingRenewalRows[0];
    const clientName = rowData[keys[1]] || '';

    // CAS 1 : nouveau client / nouvelle ligne d'abonnement
    if (!existingClient || (!existingRenewal && !isClientHeader)) {
      if (!existingClient) {
        await run(
          'INSERT INTO clients (id, name, telegram_group_id, status) VALUES (?, ?, ?, ?)',
          [clientId, clientName, '', 'inactif']
        );
      }

      if (!existingRenewal && !isClientHeader) {
        const params = [
          srNo, clientId, clientName,
          ...RENEWAL_PARAMS_BY_INDEX.slice(3).map((_, i) => rowData[keys[i + 2]] ?? ''),
        ];

        await run(
          `INSERT INTO renewals (
            sr_no, client_id, client_name, client_status_history, month, start_date,
            client_ad_id_name, ad_id_number, ad_account_type, tier, ad_spend_limit,
            setup_type, subscription_fee, setup_fee, discount, cl_amount,
            referral_partner_name, referral_amount, valid_stopped_date,
            payment_name, bank_name, amount_received, payment_received_date,
            payment_received_month, reference_no, actual_balance_difference,
            notes, visual_status
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          params
        );

        return NextResponse.json(
          { message: 'New renewal row created directly (no approval needed)' },
          { status: 201 }
        );
      }

      return NextResponse.json({ message: 'New client header created' }, { status: 201 });
    }

    // CAS 2 : modification d'une ligne existante
    const columnLetter = getColumnLetterFromRange(range);
    if (!columnLetter || !SHEET_TO_RENEWAL[columnLetter]) {
      return NextResponse.json(
        { message: 'Range not mapped to a known column' },
        { status: 200 }
      );
    }

    const fieldName = SHEET_TO_RENEWAL[columnLetter];
    if (fieldName === 'sr_no') {
      return NextResponse.json(
        { message: 'Sr No changes are not supported via this flow' },
        { status: 200 }
      );
    }

    // Utilise changedValue directement (donné par l'Apps Script via
    // e.range.getValue()). Pas besoin de re-chercher dans rowData par
    // index — les headers du sheet peuvent ne pas être indexés 0..N.
    const newValue = String(changedValue ?? '');

    const oldValue = String(existingRenewal[fieldName] ?? '');

    if (oldValue === newValue) {
      return NextResponse.json({ message: 'No change detected' }, { status: 200 });
    }

    await run(
      `INSERT INTO pending_updates (sr_no, client_id, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [srNo, clientId, fieldName, oldValue, newValue]
    );

    return NextResponse.json({ message: 'Update queued for approval' }, { status: 202 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
