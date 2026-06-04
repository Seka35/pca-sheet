// Wrapper DB simple avec better-sqlite3 (synchrone, pas de fork, pas de worker).
// better-sqlite3 se charge in-process sans les problèmes musl/threads
// qu'on avait avec sqlite3.

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'pca_renew.db');

const db = new Database(DB_PATH);
console.log('Connecté à la base de données SQLite (better-sqlite3).');

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY,
      name TEXT,
      telegram_group_id TEXT,
      status TEXT
    )
  `);

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
}

export { db, all, get, run, initDatabase };
