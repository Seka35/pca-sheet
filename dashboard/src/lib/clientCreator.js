// Shared "create a client" engine — the only code path that inserts a new
// client block in BOTH the local SQLite DB AND the Google Sheet "Master sheet".
// Called by:
//   - POST /api/clients (dashboard "Add Client" modal)
//   - src/lib/telegramBot.js (bot auto-create on /start, with header-only)
//
// Sheet-first ordering is intentional: the Sheet is the source of truth, so a
// successful Sheet write will survive a subsequent /api/sync even if the DB
// write fails. The reverse is not true.
//
// `products` may be `[]` — in that case the new client block is a single blue
// header row in the Sheet and a single row in `clients` with status='inactif'.
// The bot uses this for auto-create on /start (human adds products later).

import { run } from './db.js';
import { extractTeleId } from './teleIdParser.js';
import { createBackup } from './backup.js';
import {
  getSheetsClient,
  findNextClientId,
  appendClientBlock,
} from './googleSheets.js';

// Reused INSERT statement, same shape as src/app/api/sync/route.js:213-221
// and src/app/api/webhook/sheets/route.js:83-127. 29 columns (sr_no + 28 RENEWAL_COLUMNS).
const INSERT_RENEWAL_SQL = `INSERT OR REPLACE INTO renewals (
  sr_no, client_id, client_name, client_status_history, month, start_date,
  client_ad_id_name, ad_id_number, ad_account_type, tier, ad_spend_limit,
  setup_type, subscription_fee, setup_fee, discount, cl_amount,
  referral_partner_name, referral_amount, valid_stopped_date,
  payment_name, bank_name, amount_received, payment_received_date,
  payment_received_month, reference_no, actual_balance_difference,
  notes, visual_status, is_trial
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

/**
 * Create a new client in the Sheet and the DB.
 *
 * @param {object}  opts
 * @param {string}  opts.name             - client name (Sheet column B). Required.
 * @param {string} [opts.telegramGroupId] - chat id of the linked group, if any. Optional.
 * @param {Array}  [opts.products]        - product objects. May be `[]` (header-only).
 * @param {string} [opts.source]          - provenance label for the backup file
 *                                          and the log. e.g. 'dashboard-add' or
 *                                          'bot-auto-create'.
 *
 * @returns {Promise<
 *   { ok: true, client_id: number, sr_nos: string[], backup: string|null }
 *   | { ok: false, code: 'SHEETS_FAIL' | 'SHEETS_OK_DB_FAIL' | 'INVALID',
 *       error: string, client_id?: number, sr_nos?: string[], backup?: string|null }
 * >}
 */
export async function createClient({
  name,
  telegramGroupId = '',
  products = [],
  source = 'dashboard',
}) {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, code: 'INVALID', error: 'Client name is required' };
  }
  if (!Array.isArray(products)) {
    return { ok: false, code: 'INVALID', error: 'products must be an array' };
  }

  const cleanName = name.trim();
  const cleanTg = typeof telegramGroupId === 'string' ? telegramGroupId.trim() : '';
  let clientId = null;
  let sr_nos = [];
  let backupFilename = null;

  try {
    // 1. Best-effort backup. The backup file is named with `pre-<source>` so the
    //    operator can find it in the backups list.
    try {
      const meta = await createBackup({ source: `pre-${source}` });
      backupFilename = meta.filename;
      console.log(`[clientCreator] backup created: ${backupFilename} (source=${source})`);
    } catch (e) {
      console.warn(`[clientCreator] backup failed (continuing): ${e.message}`);
    }

    // 2. Pick the next client id from the Sheet (source of truth).
    const sheets = await getSheetsClient();
    clientId = await findNextClientId(sheets);
    console.log(`[clientCreator] next client id from Sheet: ${clientId} (source=${source})`);

    // 3. Write to the Sheet first. If this fails, we abort before touching the DB.
    const sheetResult = await appendClientBlock({
      name: cleanName,
      telegram_group_id: cleanTg,
      products,
      baseSrNo: clientId,
    });
    if (!sheetResult.ok) {
      console.error('[clientCreator] Sheet write failed:', sheetResult.error);
      return {
        ok: false,
        code: 'SHEETS_FAIL',
        error: sheetResult.error || 'Failed to write to Google Sheet',
        backup: backupFilename,
      };
    }
    sr_nos = sheetResult.sr_nos;
    console.log(`[clientCreator] Sheet written: sr_nos=${sr_nos.join(',')} (source=${source})`);

    // 4. Write to the DB in a transaction. status defaults to 'inactif' for
    //    header-only clients (no products).
    const tele_id = extractTeleId(cleanName);
    const hasActive = products.some((p) => p && p.active !== false);
    const status = hasActive ? 'Actif' : 'inactif';

    run('BEGIN');
    try {
      run(
        'INSERT OR REPLACE INTO clients (id, name, telegram_group_id, status, tele_id) VALUES (?, ?, ?, ?, ?)',
        [clientId, cleanName, cleanTg || '', status, tele_id || null]
      );

      for (let i = 0; i < products.length; i++) {
        const p = products[i] || {};
        const sr_no = `${clientId}.${i + 1}`;
        run(INSERT_RENEWAL_SQL, [
          sr_no,
          clientId,
          cleanName,
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

    console.log(
      `[clientCreator] DB written: client ${clientId}, ${products.length} product(s) (source=${source})`
    );

    return {
      ok: true,
      client_id: clientId,
      sr_nos,
      backup: backupFilename,
    };
  } catch (error) {
    console.error('[clientCreator] error:', error);
    return {
      ok: false,
      code: sr_nos.length > 0 ? 'SHEETS_OK_DB_FAIL' : 'INTERNAL',
      error: error.message || String(error),
      client_id: clientId,
      sr_nos,
      backup: backupFilename,
    };
  }
}
