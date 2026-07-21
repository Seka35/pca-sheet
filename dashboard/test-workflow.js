const Database = require('better-sqlite3');
const DB_PATH = './src/lib/pca_renew.db';
const db = new Database(DB_PATH);

console.log('=== CLEANUP ===');
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM payments WHERE client_id = 808');
db.exec('DELETE FROM payment_transactions WHERE client_id = 808');
db.exec('DELETE FROM renewals WHERE client_id = 808');
db.exec('PRAGMA foreign_keys = ON');
console.log('Cleaned');

console.log('\n=== TEST: EXEMPLE 1 COMPLET ===');
console.log('Client: TIER 1 start 10 mai, upgrade ponctual 15 mai, return 15 juin');

// 1. Create TIER 1 product
console.log('\n1. CREATE TIER 1 product...');
db.prepare(`
  INSERT INTO renewals (sr_no, client_id, client_name, tier, subscription_fee, start_date, valid_stopped_date, visual_status, ad_spend_limit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(['808.1', 808, 'Tele 9003', 'TIER 1', '199', '2026-05-10', '2026-08-10', 'Active', '2500']);
console.log('Created: TIER 1, start 2026-05-10, valid_until 2026-08-10');

// 2. Add MONTHLY payments for April, May
console.log('\n2. Add MONTHLY payments...');
db.prepare(`INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name) VALUES (?, ?, ?, ?, ?, ?)`).run([808, '808.1', '199', '2026-04-10', 'REF-APR', 'LHV']);
console.log('Added: APR-2026 payment 199$, ref REF-APR');
db.prepare(`INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name) VALUES (?, ?, ?, ?, ?, ?)`).run([808, '808.1', '199', '2026-05-10', 'REF-MAY', 'LHV']);
console.log('Added: MAY-2026 payment 199$, ref REF-MAY');

// 3. UPGRADE PONCTUAL on 15 May (TIER 1 -> TIER 2)
console.log('\n3. UPGRADE PONCTUAL on 15 May (TIER 1 -> TIER 2)...');
db.prepare(`
  UPDATE renewals SET
    tier = 'TIER 2',
    subscription_fee = '299',
    ad_spend_limit = '5000',
    is_ponctual_upgrade = 1,
    original_tier = 'TIER 1',
    valid_stopped_date = '2026-06-15'
  WHERE sr_no = '808.1'
`);
db.prepare(`
  INSERT INTO payment_transactions (renewal_sr_no, client_id, type, from_tier, to_tier, prorata_amount, amount, date, until_date, reference_no, bank_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(['808.1', 808, 'UPGRADE', 'TIER 1', 'TIER 2', '85', '85', '2026-05-15', '2026-06-15', 'REF-UPG1', 'Crypto']);
console.log('Upgrade recorded: prorata 85$, until 2026-06-15');

// 4. June payment (for RETURN)
console.log('\n4. June payment...');
db.prepare(`INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name) VALUES (?, ?, ?, ?, ?, ?)`).run([808, '808.1', '199', '2026-06-15', 'REF-JUN', 'LHV']);

// 5. RETURN to original on 15 June
console.log('\n5. RETURN to original on 15 June...');
db.prepare(`
  UPDATE renewals SET
    tier = 'TIER 1',
    subscription_fee = '199',
    ad_spend_limit = '2500',
    is_ponctual_upgrade = 0,
    original_tier = 'TIER 1',
    valid_stopped_date = '2026-07-15'
  WHERE sr_no = '808.1'
`);
db.prepare(`
  INSERT INTO payment_transactions (renewal_sr_no, client_id, type, from_tier, to_tier, prorata_amount, amount, date, until_date, reference_no, bank_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(['808.1', 808, 'RETURN', 'TIER 2', 'TIER 1', '0', '199', '2026-06-15', '2026-07-15', 'REF-RET', 'LHV']);
console.log('Return recorded: amount 199$, until 2026-07-15');

// 6. July payment
console.log('\n6. July payment...');
db.prepare(`INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name) VALUES (?, ?, ?, ?, ?, ?)`).run([808, '808.1', '199', '2026-07-15', 'REF-JUL', 'LHV']);

// Final state
console.log('\n=== FINAL STATE ===');
const renewal = db.prepare('SELECT * FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('Product:', renewal.tier, '-', renewal.is_ponctual_upgrade ? 'PONCTUAL' : 'STANDARD');
console.log('  original_tier:', renewal.original_tier);
console.log('  start_date:', renewal.start_date);
console.log('  valid_until:', renewal.valid_stopped_date);

console.log('\nPayments:');
const payments = db.prepare('SELECT * FROM payments WHERE renewal_sr_no = ? ORDER BY payment_received_date').all(['808.1']);
payments.forEach(p => console.log('  ', p.payment_received_date, '|', p.amount_received, '$ | ref:', p.reference_no));

console.log('\nTransactions:');
const tx = db.prepare('SELECT * FROM payment_transactions WHERE renewal_sr_no = ? ORDER BY date').all(['808.1']);
tx.forEach(t => console.log('  ', t.date, '|', t.type, '|', t.from_tier, '->', t.to_tier, '|', t.amount, '$'));

db.close();
console.log('\n=== TEST COMPLETE ===');
