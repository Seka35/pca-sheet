const Database = require('better-sqlite3');
const DB_PATH = './src/lib/pca_renew.db';
const db = new Database(DB_PATH);

console.log('=== COMPREHENSIVE INTERNAL TEST ===\n');

// Cleanup
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM payments WHERE client_id = 808');
db.exec('DELETE FROM payment_transactions WHERE client_id = 808');
db.exec('DELETE FROM renewals WHERE client_id = 808');
db.exec('PRAGMA foreign_keys = ON');

console.log('STEP 1: Create TIER 1 product (start: 2026-05-10, valid_until: 2026-08-10)');
db.prepare(`
  INSERT INTO renewals (sr_no, client_id, tier, subscription_fee, start_date, valid_stopped_date, visual_status, ad_spend_limit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(['808.1', 808, 'TIER 1', '199', '2026-05-10', '2026-08-10', 'Active', '2500']);

let r = db.prepare('SELECT sr_no, tier, start_date, valid_stopped_date FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('RESULT:', JSON.stringify(r));
console.log('EXPECTED: start=2026-05-10, valid_until=2026-08-10');
console.log('MATCH:', r.start_date === '2026-05-10' && r.valid_stopped_date === '2026-08-10' ? '✅' : '❌');

console.log('\nSTEP 2: Add MONTHLY payment for May (199$, date: 2026-05-10)');
db.prepare(`
  INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name)
  VALUES (?, ?, ?, ?, ?, ?)
`).run([808, '808.1', '199', '2026-05-10', 'REF-MAY', 'LHV']);

let p = db.prepare('SELECT * FROM payments WHERE renewal_sr_no = ?').all(['808.1']);
console.log('RESULT: Created payment ID', p[0].id);

console.log('\nSTEP 3: Add MONTHLY payment for June (199$, date: 2026-06-10)');
db.prepare(`
  INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name)
  VALUES (?, ?, ?, ?, ?, ?)
`).run([808, '808.1', '199', '2026-06-10', 'REF-JUN', 'LHV']);

console.log('\nSTEP 4: UPGRADE PONCTUAL on 2026-05-15 (TIER 1 -> TIER 2, prorata 85$, until 2026-06-15)');
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
`).run(['808.1', 808, 'UPGRADE', 'TIER 1', 'TIER 2', '85', '85', '2026-05-15', '2026-06-15', 'REF-UPG', 'Crypto']);

r = db.prepare('SELECT sr_no, tier, is_ponctual_upgrade, original_tier, valid_stopped_date FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('RESULT:', JSON.stringify(r));
console.log('EXPECTED: tier=TIER 2, is_ponctual=1, original_tier=TIER 1, valid_until=2026-06-15');
console.log('MATCH:', r.tier === 'TIER 2' && r.is_ponctual_upgrade === 1 && r.original_tier === 'TIER 1' && r.valid_stopped_date === '2026-06-15' ? '✅' : '❌');

console.log('\nSTEP 5: RETURN to original on 2026-06-15 (back to TIER 1, until 2026-07-15)');
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

r = db.prepare('SELECT sr_no, tier, is_ponctual_upgrade, original_tier, valid_stopped_date FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('RESULT:', JSON.stringify(r));
console.log('EXPECTED: tier=TIER 1, is_ponctual=0, original_tier=TIER 1, valid_until=2026-07-15');
console.log('MATCH:', r.tier === 'TIER 1' && r.is_ponctual_upgrade === 0 && r.original_tier === 'TIER 1' && r.valid_stopped_date === '2026-07-15' ? '✅' : '❌');

console.log('\nSTEP 6: Add July payment (199$, date: 2026-07-15)');
db.prepare(`
  INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, reference_no, bank_name)
  VALUES (?, ?, ?, ?, ?, ?)
`).run([808, '808.1', '199', '2026-07-15', 'REF-JUL', 'LHV']);

console.log('\n=== FINAL STATE ===');
r = db.prepare('SELECT sr_no, tier, is_ponctual_upgrade, original_tier, start_date, valid_stopped_date FROM renewals WHERE sr_no = ?').get(['808.1']);
console.log('RENEWAL:', JSON.stringify(r, null, 2));

p = db.prepare('SELECT * FROM payments WHERE renewal_sr_no = ? ORDER BY payment_received_date').all(['808.1']);
console.log('\nPAYMENTS:');
p.forEach(pm => console.log('  ', pm.payment_received_date, '|', pm.amount_received, '$ | ref:', pm.reference_no));

let tx = db.prepare('SELECT * FROM payment_transactions WHERE renewal_sr_no = ? ORDER BY date').all(['808.1']);
console.log('\nTRANSACTIONS:');
tx.forEach(t => console.log('  ', t.date, '|', t.type, '|', t.from_tier, '->', t.to_tier, '|', t.amount, '$'));

console.log('\n=== VERIFICATION SUMMARY ===');
console.log('Product is TIER 1 (not ponctual):', r.tier === 'TIER 1' && r.is_ponctual_upgrade === 0 ? '✅' : '❌');
console.log('Valid until is 2026-07-15 (after RETURN):', r.valid_stopped_date === '2026-07-15' ? '✅' : '❌');
console.log('4 payments (Apr, May, Jun, Jul):', p.length === 4 ? '✅' : '❌');
console.log('2 transactions (UPGRADE, RETURN):', tx.length === 2 ? '✅' : '❌');

db.close();
console.log('\n=== TEST COMPLETE ===');
