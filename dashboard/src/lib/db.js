const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'pca_renew.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Erreur lors de la connexion à SQLite:', err.message);
    } else {
        console.log('Connecté à la base de données SQLite local.');
    }
});

// Helper pour exécuter des requêtes (CREATE, INSERT, UPDATE, etc.) avec Promises
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// Helper pour récupérer toutes les lignes d'une requête SELECT
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Initialisation des tables
async function initDatabase() {
    console.log('Initialisation du schéma de la base de données...');

    // Table clients
    await run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY,
            name TEXT,
            telegram_group_id TEXT,
            status TEXT
        )
    `);

    // Table renewals avec toutes les 26 colonnes
    await run(`
        CREATE TABLE IF NOT EXISTS renewals (
            sr_no TEXT PRIMARY KEY,
            client_id INTEGER,
            client_name TEXT,
            telegram_group_id TEXT,
            status_validation TEXT,
            client_status TEXT,
            month TEXT,
            start_date TEXT,
            client_ad_id_name TEXT,
            ad_id_number TEXT,
            ad_account_type TEXT,
            tier TEXT,
            ad_spend_limit TEXT,
            setup_type TEXT,
            subscription_fee TEXT,
            setup_fee TEXT,
            discount TEXT,
            cl_amount TEXT,
            referral_partner_name TEXT,
            referral_amount TEXT,
            valid_stopped_date TEXT,
            payment_name TEXT,
            bank_name TEXT,
            amount_received TEXT,
            payment_received_date TEXT,
            payment_received_month TEXT,
            reference_no TEXT,
            actual_balance_difference TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id)
        )
    `);

    // Table pending_updates pour les modifications en attente
    await run(`
        CREATE TABLE IF NOT EXISTS pending_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sr_no TEXT,
            client_id INTEGER,
            field_name TEXT,
            old_value TEXT,
            new_value TEXT,
            status TEXT DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Tables créées ou déjà existantes.');
}

module.exports = {
    db,
    run,
    all,
    initDatabase
};
