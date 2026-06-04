import { all } from './src/lib/db.js';

const clients = all('SELECT id, name, tele_id FROM clients WHERE tele_id IS NOT NULL ORDER BY id');
console.log(`Total clients with tele_id: ${clients.length}`);

// Group by tele_id to find duplicates
const groups = new Map();
for (const c of clients) {
  if (!groups.has(c.tele_id)) groups.set(c.tele_id, []);
  groups.get(c.tele_id).push(c);
}

const dupes = [...groups.entries()].filter(([_, arr]) => arr.length > 1);
console.log(`\nDuplicate tele_ids: ${dupes.length}`);
for (const [tele, arr] of dupes) {
  console.log(`  Tele ${tele}:`);
  for (const c of arr) {
    console.log(`    id=${c.id} name="${c.name}"`);
  }
}
