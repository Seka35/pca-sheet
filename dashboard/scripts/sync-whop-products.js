const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const jsonPath = path.join(__dirname, '..', 'whop_products_clean.json');
const dbPath = path.join(__dirname, '..', 'src', 'lib', 'pca_renew.db');

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const db = new Database(dbPath);

const insertOrUpdate = db.prepare(`
  INSERT INTO whop_products (product_id, name, price, payment_url, created_at, deleted)
  VALUES (?, ?, ?, ?, ?, 0)
  ON CONFLICT(product_id) DO UPDATE SET
    name = excluded.name,
    price = excluded.price,
    payment_url = excluded.payment_url,
    created_at = excluded.created_at,
    deleted = 0
`);

let imported = 0;
const sync = db.transaction((products) => {
  for (const p of products) {
    insertOrUpdate.run(p.product_id, p.name, p.price || '', p.payment_url, p.created_at);
    imported++;
  }
});
sync(data.products);
console.log('Synced:', imported, 'products');
db.close();
