/**
 * Seed script to populate current_spend on existing renewals for testing
 * Run with: node src/scripts/seed-spend.js
 *
 * This script sets mock spend values to simulate real ad spend data:
 * - Some products at 30% (green)
 * - Some at 65% (orange)
 * - Some at 85% (red)
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'pca_renew.db');
const db = new Database(DB_PATH);

console.log('Connected to database:', DB_PATH);

// Get all renewals with an ad_spend_limit
const renewals = db.prepare(`
  SELECT sr_no, client_id, ad_spend_limit, current_spend
  FROM renewals
  WHERE ad_spend_limit IS NOT NULL AND ad_spend_limit != '' AND ad_spend_limit != '0'
`).all();

console.log(`Found ${renewals.length} renewals with ad_spend_limit`);

// Mock spend values based on limit percentage
const spendPercentages = [0.25, 0.30, 0.35, 0.50, 0.65, 0.70, 0.75, 0.85, 0.90, 0.95];

const update = db.prepare('UPDATE renewals SET current_spend = ? WHERE sr_no = ?');

let updated = 0;
for (const renewal of renewals) {
  const limit = parseFloat(String(renewal.ad_spend_limit).replace(/[^0-9.-]+/g, '')) || 0;
  if (limit > 0) {
    // Pick a random percentage
    const pct = spendPercentages[Math.floor(Math.random() * spendPercentages.length)];
    const spend = Math.round(limit * pct);
    update.run(spend.toString(), renewal.sr_no);
    updated++;
    console.log(`  ${renewal.sr_no}: $${spend.toLocaleString()} / $${limit.toLocaleString()} (${Math.round(pct * 100)}%)`);
  }
}

console.log(`\nUpdated ${updated} renewals with mock spend data`);

// Also print a few examples
console.log('\nSample data:');
const samples = db.prepare(`
  SELECT sr_no, tier, ad_spend_limit, current_spend
  FROM renewals
  WHERE current_spend IS NOT NULL AND current_spend != '0'
  LIMIT 5
`).all();
samples.forEach(r => {
  const limit = parseFloat(String(r.ad_spend_limit).replace(/[^0-9.-]+/g, '')) || 0;
  const spend = parseFloat(String(r.current_spend).replace(/[^0-9.-]+/g, '')) || 0;
  const pct = limit > 0 ? Math.round((spend / limit) * 100) : 0;
  console.log(`  ${r.sr_no} (${r.tier}): $${spend.toLocaleString()} / $${limit.toLocaleString()} = ${pct}%`);
});

db.close();
console.log('\nDone!');
