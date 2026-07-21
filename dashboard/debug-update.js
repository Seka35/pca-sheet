const Database = require('better-sqlite3');
const DB_PATH = './src/lib/pca_renew.db';
const db = new Database(DB_PATH);

console.log('=== DEBUG UPDATE ISSUE ===\n');

// Cleanup
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM renewals WHERE client_id = 808');
db.exec('PRAGMA foreign_keys = ON');

// Create a simple renewal
console.log('1. Creating renewal...');
let result = db.prepare(`
  INSERT INTO renewals (sr_no, client_id, tier, subscription_fee, start_date, valid_stopped_date, visual_status, ad_spend_limit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(['808.1', 808, 'TIER 1', '199', '2026-05-10', '2026-08-10', 'Active', '2500']);
console.log('Insert result - changes:', result.changes, 'lastInsertRowid:', result.lastInsertRowid);

// Check it was created
let r = db.prepare('SELECT * FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('Created renewal:', r ? 'YES' : 'NO');
console.log('  tier:', r.tier, 'valid_until:', r.valid_stopped_date);

// Now try UPDATE with explicit parameters
console.log('\n2. Attempting UPDATE...');
console.log('Query: UPDATE renewals SET tier = ?, valid_stopped_date = ? WHERE sr_no = ?');
console.log('Params: ["TIER 2", "2026-06-15", "808.1"]');

result = db.prepare('UPDATE renewals SET tier = ?, valid_stopped_date = ? WHERE sr_no = ?').run(['TIER 2', '2026-06-15', '808.1']);
console.log('Update result - changes:', result.changes);

// Check after UPDATE
r = db.prepare('SELECT tier, valid_stopped_date FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('After UPDATE - tier:', r.tier, 'valid_until:', r.valid_stopped_date);

// Try with different syntax
console.log('\n3. Try UPDATE with string interpolation...');
db.exec("UPDATE renewals SET tier = 'TIER 3', valid_stopped_date = '2026-07-15' WHERE sr_no = '808.1'");
r = db.prepare('SELECT tier, valid_stopped_date FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('After string UPDATE - tier:', r.tier, 'valid_until:', r.valid_stopped_date);

db.close();
console.log('\n=== DONE ===');
