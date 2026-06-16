// Wrapper DB simple avec better-sqlite3 (synchrone, pas de fork, pas de worker).
// better-sqlite3 se charge in-process sans les problèmes musl/threads
// qu'on avait avec sqlite3.

import Database from 'better-sqlite3';
import path from 'path';
import { extractTeleId, extractAllTeleIds } from './teleIdParser.js';

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'pca_renew.db');

let dbInstance = new Database(DB_PATH);
console.log('Connecté à la base de données SQLite (better-sqlite3).');

function all(sql, params = []) {
  return dbInstance.prepare(sql).all(...params);
}

function get(sql, params = []) {
  return dbInstance.prepare(sql).get(...params);
}

function run(sql, params = []) {
  return dbInstance.prepare(sql).run(...params);
}

// Live proxy: `db` always points to the current connection, even after
// closeDb() + reopenDb(). Backwards-compatible with code that imports `db`.
const db = new Proxy({}, {
  get(_t, prop) { return dbInstance[prop]; },
  has(_t, prop) { return prop in dbInstance; },
});

// Close + reopen the database. Used by the restore flow — the file on disk
// is replaced, then the connection is dropped so the next call sees the new file.
function closeDb() {
  if (dbInstance) {
    try { dbInstance.close(); } catch (e) { /* already closed */ }
    dbInstance = null;
  }
}

function reopenDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
  }
  return dbInstance;
}

function getDb() {
  return dbInstance;
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY,
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      address TEXT,
      telegram_group_id TEXT,
      status TEXT,
      tele_id TEXT
    )
  `);

  // Add new columns if they don't exist (for existing databases)
  try { db.exec(`ALTER TABLE clients ADD COLUMN first_name TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }
  try { db.exec(`ALTER TABLE clients ADD COLUMN last_name TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }
  try { db.exec(`ALTER TABLE clients ADD COLUMN email TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }
  try { db.exec(`ALTER TABLE clients ADD COLUMN address TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }

  db.exec(`
    CREATE TABLE IF NOT EXISTS renewals (
      sr_no TEXT PRIMARY KEY,
      client_id INTEGER,
      client_name TEXT,
      client_status_history TEXT,
      month TEXT,
      start_date TEXT,
      client_ad_id_name TEXT,
      ad_id_number TEXT,
      ad_account_type TEXT,
      tier TEXT,
      ad_spend_limit TEXT,
      setup_type TEXT,
      subscription_fee TEXT,
      setup_fee TEXT,
      discount TEXT,
      cl_amount TEXT,
      referral_partner_name TEXT,
      referral_amount TEXT,
      valid_stopped_date TEXT,
      payment_name TEXT,
      bank_name TEXT,
      amount_received TEXT,
      payment_received_date TEXT,
      payment_received_month TEXT,
      reference_no TEXT,
      actual_balance_difference TEXT,
      notes TEXT,
      visual_status TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr_no TEXT,
      client_id INTEGER,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Bot Telegram ---

  // Single-row config (id always = 1).
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      token TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      reminder_days TEXT NOT NULL DEFAULT '[-7,-2,0,1]',
      templates_json TEXT NOT NULL DEFAULT '{}',
      sweep_interval_minutes INTEGER NOT NULL DEFAULT 15,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      bot_username TEXT,
      last_sweep_at DATETIME,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default config + default English templates if empty.
  const existingCfg = db.prepare('SELECT id FROM bot_config WHERE id = 1').get();
  if (!existingCfg) {
    const defaultTemplates = {
      '-7': {
        label: '7 days before',
        message: '⚠️ <b>{{client_name}}</b> — your <b>{{product}}</b> of <b>{{amount}}</b> expires in <b>{{days_until}} days</b> (on {{due_date_long}}).'
      },
      '-2': {
        label: '48 hours before',
        message: '⏰ <b>{{client_name}}</b> — your <b>{{product}}</b> of <b>{{amount}}</b> expires in <b>{{days_until}} days</b>. Please renew before {{due_date_long}}.'
      },
      '0': {
        label: 'Day of expiration',
        message: '🚨 <b>{{client_name}}</b> — your <b>{{product}}</b> of <b>{{amount}}</b> expires <b>today</b>. Renew to avoid interruption.'
      },
      '+1': {
        label: '1 day after expiration',
        message: '❌ <b>{{client_name}}</b> — your <b>{{product}}</b> of <b>{{amount}}</b> expired {{days_absolute}} day ago. Service may be suspended; please renew immediately.'
      }
    };
    db.prepare(`
      INSERT INTO bot_config (id, token, enabled, reminder_days, templates_json)
      VALUES (1, NULL, 0, '[-7,-2,0,1]', ?)
    `).run(JSON.stringify(defaultTemplates));
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_group_links (
      chat_id      TEXT PRIMARY KEY,
      chat_title   TEXT NOT NULL,
      client_id    INTEGER,
      status       TEXT NOT NULL DEFAULT 'pending',
      linked_at    DATETIME,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bot_group_links_client ON bot_group_links(client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bot_group_links_status ON bot_group_links(status)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id             TEXT NOT NULL,
      client_id           INTEGER NOT NULL,
      renewal_sr_no       TEXT NOT NULL,
      reminder_type       TEXT NOT NULL,
      message             TEXT NOT NULL,
      status              TEXT NOT NULL,
      error               TEXT,
      telegram_message_id TEXT,
      sent_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(renewal_sr_no, reminder_type, chat_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reminder_logs_client ON reminder_logs(client_id, sent_at DESC)`);

  // Cache colonne sur renewals — peut être wipe par le sync Google Sheets,
  // reminder_logs reste la source de vérité.
  try {
    db.exec(`ALTER TABLE renewals ADD COLUMN reminders_sent_json TEXT DEFAULT '[]'`);
  } catch (e) {
    if (!/duplicate column/.test(e.message)) throw e;
  }

  // --- Tele ID parsing ---
  // Column was added in a later release — keep the migration idempotent so
  // existing DBs get it on the next boot, and new DBs include it in CREATE TABLE.
  try {
    db.exec(`ALTER TABLE clients ADD COLUMN tele_id TEXT`);
  } catch (e) {
    if (!/duplicate column/.test(e.message)) throw e;
  }
  // UNIQUE index on tele_id — REMOVED: multiple clients can share the same tele_id
  // if they belong to the same Telegram group. Clients with the same tele_id
  // will ALL receive reminders sent to that group.
  try { db.exec('DROP INDEX IF EXISTS idx_clients_tele_id'); } catch (e) {}
  // db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_tele_id ON clients(tele_id) WHERE tele_id IS NOT NULL`);

  // --- Bot auto-create proposal state ---
  // When a seller /start in a group and no client matches, the bot stores a
  // proposal in this row (pending_create_name + pending_create_tele_id).
  // The seller clicks the inline button to confirm; the bot then calls
  // clientCreator.createClient and clears these columns. NULL in both
  // columns means "no pending proposal".
  try {
    db.exec(`ALTER TABLE bot_group_links ADD COLUMN pending_create_name TEXT`);
  } catch (e) {
    if (!/duplicate column/.test(e.message)) throw e;
  }
  try {
    db.exec(`ALTER TABLE bot_group_links ADD COLUMN pending_create_tele_id TEXT`);
  } catch (e) {
    if (!/duplicate column/.test(e.message)) throw e;
  }

  // Backfill: parse Tele ID from every existing client's name.
  // Idempotent — re-running just overwrites with the same value.
  try {
    backfillTeleIds();
  } catch (e) {
    console.error('[tele_id backfill] FAILED:', e.message);
    // Don't throw - let other tables be created
  }

  // --- Bank Details ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_details (
      id INTEGER PRIMARY KEY,
      bank_key TEXT UNIQUE NOT NULL,
      bank_name TEXT NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Payment Proofs (client payment submissions) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr_no TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      transaction_id TEXT,
      proof_image_url TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      reviewed_by TEXT,
      reject_reason TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id),
      UNIQUE(sr_no, client_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status)`);

  // --- Approvals Sync (dashboard review queue) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proof_id INTEGER NOT NULL,
      sr_no TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      client_name TEXT,
      tele_id TEXT,
      product_type TEXT,
      amount_due TEXT,
      due_date TEXT,
      bank_name TEXT,
      transaction_id TEXT,
      proof_image_url TEXT,
      submitted_at DATETIME,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_at DATETIME,
      reviewed_by TEXT,
      reject_reason TEXT,
      FOREIGN KEY(proof_id) REFERENCES payment_proofs(id),
      FOREIGN KEY(client_id) REFERENCES clients(id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status)`);

  // --- Payment Selections (client chose a payment method from the group) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr_no TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      method TEXT NOT NULL,
      address TEXT,
      selected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sr_no, chat_id)
    )
  `);

  // --- Pending Payments (in-progress payment submissions) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr_no TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      tele_id TEXT,
      chat_id TEXT NOT NULL,
      step TEXT NOT NULL DEFAULT 'AWAIT_TX',
      transaction_id TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sr_no, chat_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pending_payments_step ON pending_payments(step)`);

  // Add payment columns to renewals if not exist
  try { db.exec(`ALTER TABLE renewals ADD COLUMN transaction_id TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }
  try { db.exec(`ALTER TABLE renewals ADD COLUMN payment_proof_url TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }
  try { db.exec(`ALTER TABLE renewals ADD COLUMN paid_at TEXT`); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }

  // --- Invoice Settings ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data_json TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Users (admin accounts) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'custom',
      permissions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // --- Activity Logs (audit trail) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category)`);

  // Seed default bank data if empty
  const existingBanks = db.prepare('SELECT COUNT(*) as cnt FROM bank_details').get();
  if (!existingBanks || existingBanks.cnt === 0) {
    const defaultBanks = [
      {
        bank_key: 'crypto',
        bank_name: 'Crypto',
        data_json: JSON.stringify({
          usdt_trc20: 'TUcZNfx81JEdoNjG6orJxGPMrEpqX5gSuW',
          usdt_erc20: '0x49B4Dde3249D8Cc0Fb083247007E3C46a0135B09',
          btc: 'bc1quc4c6rm055guetjmnqt9rvvrzs3qpuu293rj8z',
          fee_note: 'There will be a transaction fee of 2% on the amount transferred'
        })
      },
      {
        bank_key: 'lhv',
        bank_name: 'AS LHV Pank (Sokin)',
        data_json: JSON.stringify({
          account_title: 'WCATFM LLC',
          bank_country: 'EE',
          account_type: 'IBAN',
          bic_swift: 'LHVBEE22',
          iban: 'EE157777000160817218',
          bank_address: 'Tartu mnt 2, 10145, Tallinn'
        })
      },
      {
        bank_key: 'slash',
        bank_name: 'Slash Bank',
        data_json: JSON.stringify({
          account_name: 'WCATFM LLC',
          account_number: '994768939333484',
          routing: '121145307',
          swift_bic: 'CLNOUS66XXX',
          address_entity: '1507 Lampman Ct, Cheyenne, WY 82007-3341, US'
        })
      },
      {
        bank_key: 'whop',
        bank_name: 'WHOP',
        data_json: JSON.stringify({
          tier1: 'https://whop.com/checkout/plan_vsgVy32aS6wEE',
          tier2: 'https://whop.com/checkout/plan_acFXSJ5bVnNzs',
          tier3: 'https://whop.com/checkout/plan_rOEka7oXYmOMU',
          tier4: 'https://whop.com/checkout/plan_4eQs8tCjLIQR9',
          tier5: 'https://whop.com/checkout/plan_jIUlPyX1f4FjR',
          tier6: 'https://whop.com/checkout/plan_wP93g0lz9nETb',
          tier1_7d_free: 'https://whop.com/checkout/plan_vZLv2nfs9FULn',
          tier2_7d_free: 'https://whop.com/checkout/plan_2MvSTl0715cWS',
          tier3_7d_free: 'https://whop.com/checkout/plan_g5Cm67QgfGXrN',
          tier4_7d_free: 'https://whop.com/checkout/plan_0uqz2MuD6Y27J',
          tier5_7d_free: 'https://whop.com/checkout/plan_wJjXJ9qhCqtv5',
          tier6_7d_free: 'https://whop.com/checkout/plan_opAeK2mpPo6oL',
          tier1_50_off: 'https://whop.com/checkout/plan_zFaL6KSREVUKQ',
          tier2_50_off: 'https://whop.com/checkout/plan_hzG20DO2ZJm70',
          tier3_50_off: 'https://whop.com/checkout/plan_6rXVn26Djhv16',
          tier4_50_off: 'https://whop.com/checkout/plan_VuhNYrdI2qT0y',
          tier5_50_off: 'https://whop.com/checkout/plan_L6bCf7daNhotp',
          tier7d_free_15pct_meta: 'https://whop.com/checkout/plan_RqN7WiGvROWFw',
          meta_setup: 'https://whop.com/checkout/plan_HMwsNS8d77DFh',
          extra_fb_profile: 'https://whop.com/checkout/plan_UtvSvr7rpgiHe',
          extra_fb_page: 'https://whop.com/checkout/plan_ydwVtGCa9SDdB',
          extra_bm: 'https://whop.com/checkout/plan_B3eWNdQcc7XE5',
          upgrade_t1_to_t2: 'https://whop.com/wcaftm-llc/pca-tier-1-to-tier-2-upgrade-42',
          upgrade_t1_to_t3: 'https://whop.com/wcaftm-llc/pca-tier-1-to-tier-3-upgrade-ec',
          upgrade_t1_to_t4: 'https://whop.com/wcaftm-llc/pca-tier-1-to-tier-4-upgrade',
          upgrade_t1_to_t5: 'https://whop.com/wcaftm-llc/pca-tier-1-to-tier-5-upgrade',
          upgrade_t1_to_t6: 'https://whop.com/wcaftm-llc/pca-tier-1-to-tier-6-upgrade-9b',
          upgrade_t2_to_t3: 'https://whop.com/wcaftm-llc/pca-tier-2-to-tier-3-upgrade-6e',
          upgrade_t2_to_t4: 'https://whop.com/wcaftm-llc/pca-tier-2-to-tier-4-upgrade-66',
          upgrade_t2_to_t5: 'https://whop.com/wcaftm-llc/pca-tier-2-to-tier-5-upgrade',
          upgrade_t2_to_t6: 'https://whop.com/wcaftm-llc/pca-tier-2-to-tier-6-upgrade',
          upgrade_t3_to_t4: 'https://whop.com/wcaftm-llc/pca-tier-3-to-tier-4-upgrade-ff',
          upgrade_t3_to_t5: 'https://whop.com/wcaftm-llc/pca-tier-3-to-tier-5-upgrade',
          upgrade_t3_to_t6: 'https://whop.com/wcaftm-llc/pca-tier-3-to-tier-6-upgrade-20',
          upgrade_t4_to_t5: 'https://whop.com/wcaftm-llc/pca-tier-4-to-tier-5-upgrade-c1',
          upgrade_t4_to_t6: 'https://whop.com/wcaftm-llc/pca-tier-4-to-tier-6-upgrade-91',
          upgrade_t5_to_t6: 'https://whop.com/wcaftm-llc/pca-tier-5-to-tier-6-upgrade-0f'
        })
      }
    ];
    const insertBank = db.prepare('INSERT OR REPLACE INTO bank_details (bank_key, bank_name, data_json) VALUES (?, ?, ?)');
    for (const bank of defaultBanks) {
      insertBank.run(bank.bank_key, bank.bank_name, bank.data_json);
    }
  }
}

// Walk all clients and (re)compute tele_id from name. Safe to call repeatedly.
// Multiple clients can share the same tele_id — this is allowed because they
// may belong to the same Telegram group and should ALL receive reminders.
function backfillTeleIds() {
  // Ensure the old UNIQUE index is dropped (may exist from before the change)
  try { db.exec('DROP INDEX IF EXISTS idx_clients_tele_id'); } catch (e) {}

  const rows = db.prepare('SELECT id, name FROM clients ORDER BY id ASC').all();
  const update = db.prepare('UPDATE clients SET tele_id = ? WHERE id = ?');

  let assigned = 0;
  for (const r of rows) {
    const teleId = extractTeleId(r.name);
    if (teleId) {
      update.run(teleId, r.id);
      assigned++;
    }
  }
  console.log(`[tele_id backfill] assigned tele_id to ${assigned} client(s)`);
}

// Log a user action to the activity_logs table
function logActivity(userId, username, action, category, entityId, entityName, details) {
  run(
    `INSERT INTO activity_logs (user_id, username, action, category, entity_id, entity_name, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, action, category, entityId, entityName, details ? JSON.stringify(details) : null]
  );
}

export {
  DB_PATH,
  db,
  all,
  get,
  run,
  closeDb,
  reopenDb,
  getDb,
  initDatabase,
  backfillTeleIds,
  logActivity,
};
