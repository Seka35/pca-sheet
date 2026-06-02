const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'pca_renew.db');

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
        process.exit(1);
    }
});

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function verify() {
    try {
        console.log('=== VÉRIFICATION DE LA BASE DE DONNÉES ===\n');

        // 1. Nombre total de clients
        const clientsCount = await all('SELECT COUNT(*) as count FROM clients');
        console.log(`Nombre total de clients en DB: ${clientsCount[0].count}`);

        // 2. Nombre total de renouvellements
        const renewalsCount = await all('SELECT COUNT(*) as count FROM renewals');
        console.log(`Nombre total de renouvellements en DB: ${renewalsCount[0].count}`);

        // 3. Nombre de clients actifs vs inactifs
        const statusCounts = await all('SELECT status, COUNT(*) as count FROM clients GROUP BY status');
        console.log('\nRépartition des statuts clients:');
        statusCounts.forEach(row => {
            console.log(`  - Status: ${row.status || 'Non spécifié'} | Count: ${row.count}`);
        });

        // 4. Afficher 5 clients actifs avec leurs informations
        console.log('\nExemple de 5 clients ACTIFS en DB :');
        const activeClients = await all('SELECT * FROM clients WHERE status = "Actif" LIMIT 5');
        for (const client of activeClients) {
            console.log(`\nClient [${client.id}] : ${client.name}`);
            
            // Récupérer leurs enregistrements
            const records = await all('SELECT sr_no, month, start_date, valid_stopped_date, amount_received FROM renewals WHERE client_id = ? ORDER BY sr_no ASC', [client.id]);
            console.log(`  Enregistrements de facturation (${records.length}) :`);
            records.forEach(rec => {
                console.log(`    - [${rec.sr_no}] Month: ${rec.month} | Start: ${rec.start_date} | Valid Until: ${rec.valid_stopped_date} | Received: ${rec.amount_received}`);
            });
        }

    } catch (e) {
        console.error('Erreur lors de la vérification:', e);
    } finally {
        db.close();
    }
}

verify();
