const Database = require('better-sqlite3');
const DB_PATH = './src/lib/pca_renew.db';
const db = new Database(DB_PATH);

console.log('=== SIMPLE DIRECT DATABASE TEST ===\n');

// Cleanup
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM payments WHERE client_id = 808');
db.exec('DELETE FROM payment_transactions WHERE client_id = 808');
db.exec('DELETE FROM renewals WHERE client_id = 808');
db.exec('PRAGMA foreign_keys = ON');

console.log('1. CREATE renewal');
db.prepare(`
  INSERT INTO renewals (sr_no, client_id, tier, subscription_fee, start_date, valid_stopped_date, visual_status, ad_spend_limit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(['808.1', 808, 'TIER 1', '199', '2026-05-10', '2026-08-10', 'Active', '2500']);

let r = db.prepare('SELECT * FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('After CREATE:', r.tier, '| valid_until:', r.valid_stopped_date, '| is_ponctual:', r.is_ponctual_upgrade);

console.log('\n2. ADD payment');
db.prepare(`INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name) VALUES (?, ?, ?, ?, ?, ?)`).run([808, '808.1', '199', '2026-05-10', 'REF1', 'LHV']);

console.log('\n3. UPGRADE (change tier to TIER 2, valid_until to 2026-06-15)');
db.prepare(`UPDATE renewals SET tier = ?, subscription_fee = ?, ad_spend_limit = ?, is_ponctual_upgrade = ?, original_tier = ?, valid_stopped_date = ? WHERE sr_no = ?`).run(['TIER 2', '299', '5000', 1, 'TIER 1', '2026-06-15', '808.1']);

r = db.prepare('SELECT * FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('After UPGRADE:', r.tier, '| valid_until:', r.valid_stopped_date, '| is_ponctual:', r.is_ponctual_upgrade, '| original:', r.original_tier);

console.log('\n4. RETURN (change tier back to TIER 1, valid_until to 2026-07-15)');
db.prepare(`UPDATE renewals SET tier = ?, subscription_fee = ?, ad_spend_limit = ?, is_ponctual_upgrade = ?, valid_stopped_date = ? WHERE sr_no = ?`).run(['TIER 1', '199', '2500', 0, '2026-07-15', '808.1']);

r = db.prepare('SELECT * FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('After RETURN:', r.tier, '| valid_until:', r.valid_stopped_date, '| is_ponctual:', r.is_ponctual_upgrade);

console.log('\n=== FINAL CHECK ===');
r = db.prepare('SELECT * FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('FINAL STATE:');
console.log('  tier:', r.tier);
console.log('  is_ponctual:', r.is_ponctual_upgrade);
console.log('  valid_until:', r.valid_stopped_date);
console.log('  original_tier:', r.original_tier);

let payments = db.prepare('SELECT * FROM payments WHERE client_id = ?').all([808]);
console.log('  payments:', payments.length);

let transactions = db.prepare('SELECT * FROM payment_transactions WHERE client_id = ?').all([808]);
console.log('  transactions:', transactions.length);

db.close();
console.log('\n=== TEST COMPLETE ===');
