const Database = require('better-sqlite3');
const DB_PATH = './src/lib/pca_renew.db';
const db = new Database(DB_PATH);

console.log('=== DEBUG RETURN UPDATE ===');

// Cleanup
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM payments WHERE client_id = 808');
db.exec('DELETE FROM payment_transactions WHERE client_id = 808');
db.exec('DELETE FROM renewals WHERE client_id = 808');
db.exec('PRAGMA foreign_keys = ON');

// Create renewal
console.log('\n1. Creating renewal...');
db.prepare(`INSERT INTO renewals (sr_no, client_id, tier, subscription_fee, start_date, valid_stopped_date, visual_status, ad_spend_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(['808.1', 808, 'TIER 1', '199', '2026-05-10', '2026-08-10', 'Active', '2500']);

// Add payment
console.log('2. Adding payment...');
db.prepare(`INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name) VALUES (?, ?, ?, ?, ?, ?)`).run([808, '808.1', '199', '2026-05-10', 'REF-MAY', 'LHV']);

// Check state before RETURN
console.log('\n3. State before RETURN:');
const before = db.prepare("SELECT sr_no, tier, is_ponctual_upgrade, original_tier, valid_stopped_date FROM renewals WHERE sr_no = ?").get(['808.1']);
console.log(JSON.stringify(before, null, 2));

// Simulate RETURN - update valid_stopped_date to 2026-07-15
console.log('\n4. Executing RETURN UPDATE...');
const updateResult = db.prepare(`UPDATE renewals SET tier = ?, valid_stopped_date = ?, is_ponctual_upgrade = ? WHERE sr_no = ?`).run(['TIER 1', '2026-07-15', 0, '808.1']);
console.log('Update result - changes:', updateResult.changes);

// Check state after RETURN
console.log('\n5. State after RETURN:');
const after = db.prepare("SELECT sr_no, tier, is_ponctual_upgrade, original_tier, valid_stopped_date FROM renewals WHERE sr_no = ?").get(['808.1']);
console.log(JSON.stringify(after, null, 2));

db.close();
console.log('\n=== DONE ===');
