/**
 * Migration Script: Move referral_partner_name from renewals to clients
 *
 * This script migrates existing clients who have a referral_partner set on their products
 * to have the referral_partner linked directly on their client record.
 *
 * Logic:
 * - For each client, find the most commonly used referral_partner_name across their renewals
 * - If a client has multiple different referral partners, we use the most frequent one
 * - If no referral partner is found, we set it to 'N.A.'
 *
 * Usage: node src/scripts/migrateReferralPartner.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'src', 'lib', 'pca_renew.db');

const db = new Database(DB_PATH);

console.log('Starting referral_partner migration...');
console.log(`Database path: ${DB_PATH}`);

// Get all clients
const clients = db.prepare('SELECT id, name, referral_partner_name FROM clients').all();
console.log(`Found ${clients.length} clients`);

let migrated = 0;
let skipped = 0;

for (const client of clients) {
  // Check if client already has a referral_partner_name set at client level
  if (client.referral_partner_name && client.referral_partner_name.trim() !== '') {
    console.log(`Client ${client.id} (${client.name}) already has referral_partner: ${client.referral_partner_name} - skipping`);
    skipped++;
    continue;
  }

  // Get all renewals for this client and find the most common referral_partner
  const renewals = db.prepare(`
    SELECT referral_partner_name
    FROM renewals
    WHERE client_id = ? AND referral_partner_name IS NOT NULL AND referral_partner_name != ''
  `).all(client.id);

  if (renewals.length === 0) {
    // No referral partner found, set to N.A.
    db.prepare('UPDATE clients SET referral_partner_name = ? WHERE id = ?').run('N.A.', client.id);
    console.log(`Client ${client.id} (${client.name}) - no referral found, set to N.A.`);
    migrated++;
    continue;
  }

  // Count frequency of each referral partner
  const counts = {};
  for (const r of renewals) {
    const partner = r.referral_partner_name;
    counts[partner] = (counts[partner] || 0) + 1;
  }

  // Find the most common one
  let mostCommon = null;
  let maxCount = 0;
  for (const [partner, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = partner;
    }
  }

  // Update the client
  db.prepare('UPDATE clients SET referral_partner_name = ? WHERE id = ?').run(mostCommon, client.id);
  console.log(`Client ${client.id} (${client.name}) - migrated to: ${mostCommon} (from ${maxCount}/${renewals.length} products)`);
  migrated++;
}

console.log('\nMigration complete!');
console.log(`Migrated: ${migrated}`);
console.log(`Skipped: ${skipped}`);

// Verify the migration
const clientsWithReferral = db.prepare("SELECT COUNT(*) as cnt FROM clients WHERE referral_partner_name IS NOT NULL AND referral_partner_name != '' AND referral_partner_name != 'N.A.'").get();
const clientsWithoutReferral = db.prepare("SELECT COUNT(*) as cnt FROM clients WHERE referral_partner_name IS NULL OR referral_partner_name = '' OR referral_partner_name = 'N.A.'").get();

console.log(`\nVerification:`);
console.log(`Clients with referral partner: ${clientsWithReferral.cnt}`);
console.log(`Clients without/basic referral: ${clientsWithoutReferral.cnt}`);

db.close();
