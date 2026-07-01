// Simple script to add current_spend column to renewals table
// Run with: node src/scripts/add-column.js

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'pca_renew.db');
const db = new Database(DB_PATH);

console.log('Connected to database:', DB_PATH);

try {
  db.exec(`ALTER TABLE renewals ADD COLUMN current_spend TEXT DEFAULT '0'`);
  console.log('Successfully added current_spend column to renewals table');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('Column current_spend already exists');
  } else {
    console.error('Error:', e.message);
  }
}

db.close();
