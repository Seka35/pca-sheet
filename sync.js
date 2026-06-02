const { google } = require('googleapis');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const creds = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
};
const { run, initDatabase, db } = require('./db');

const SHEET_ID = '1kSna0gl6-Epmd3RpiqRBoAaheZnioXtvOt5A0mtFKlQ';

function getVal(cell) {
    return cell ? (cell.formattedValue || '') : '';
}

async function sync() {
    console.log('Début de la synchronisation...');
    
    // 1. Initialiser la base de données
    await initDatabase();

    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Lire le formatage et les valeurs de tout le tableau (A3:AA)
    console.log('Lecture des données du Google Sheet...');
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: ['Master sheet!A3:AA'],
        includeGridData: true,
    });

    const sheet = res.data.sheets[0];
    const gridData = sheet.data[0];
    const rowData = gridData.rowData || [];
    const totalRows = rowData.length;

    console.log(`Nombre total de lignes récupérées: ${totalRows}`);

    const sqlStatements = [];
    const clientsToInsert = new Map(); // Pour éviter les doublons de clients dans la transaction

    for (let r = 0; r < totalRows; r++) {
        const row = rowData[r];
        if (!row || !row.values || row.values.length === 0) continue;

        const cells = row.values;
        const srNo = getVal(cells[0]);

        // Ignorer les lignes sans numéro de série valide
        if (!srNo || isNaN(parseFloat(srNo))) continue;

        const clientName = getVal(cells[1]);
        const telegramGroupId = getVal(cells[2]);
        const statusValidation = getVal(cells[3]); // Colonne D (Actif/inactif)
        const clientStatus = getVal(cells[4]); // Colonne E (Client Status historique)
        const month = getVal(cells[5]); // Colonne F
        const startDate = getVal(cells[6]); // Colonne G
        const clientAdIdName = getVal(cells[7]); // Colonne H
        const adIdNumber = getVal(cells[8]); // Colonne I
        const adAccountType = getVal(cells[9]); // Colonne J
        const tier = getVal(cells[10]); // Colonne K
        const adSpendLimit = getVal(cells[11]); // Colonne L
        const setupType = getVal(cells[12]); // Colonne M
        const subscriptionFee = getVal(cells[13]); // Colonne N
        const setupFee = getVal(cells[14]); // Colonne O
        const discount = getVal(cells[15]); // Colonne P
        const clAmount = getVal(cells[16]); // Colonne Q
        const referralPartnerName = getVal(cells[17]); // Colonne R
        const referralAmount = getVal(cells[18]); // Colonne S
        const validStoppedDate = getVal(cells[19]); // Colonne T
        const paymentName = getVal(cells[20]); // Colonne U
        const bankName = getVal(cells[21]); // Colonne V
        const amountReceived = getVal(cells[22]); // Colonne W
        const paymentReceivedDate = getVal(cells[23]); // Colonne X
        const paymentReceivedMonth = getVal(cells[24]); // Colonne Y
        const referenceNo = getVal(cells[25]); // Colonne Z
        const actualBalanceDifference = getVal(cells[26]); // Colonne AA

        const baseClientId = Math.floor(parseFloat(srNo));

        // Détecter s'il s'agit d'une ligne de titre client (.00) ou d'une ligne d'abonnement (.01, .02...)
        const isClientHeader = parseFloat(srNo) % 1 === 0;

        if (isClientHeader) {
            // Ligne de titre client
            clientsToInsert.set(baseClientId, {
                id: baseClientId,
                name: clientName,
                telegram_group_id: telegramGroupId,
                status: 'inactif' // Par défaut, mis à jour par les lignes d'abonnement
            });
        } else {
            // S'assurer que le client existe (cas où la ligne .00 serait absente)
            if (!clientsToInsert.has(baseClientId)) {
                clientsToInsert.set(baseClientId, {
                    id: baseClientId,
                    name: clientName,
                    telegram_group_id: telegramGroupId,
                    status: 'inactif'
                });
            }

            // Si un des enregistrements est 'Actif', le client global devient 'Actif'
            if (statusValidation === 'Actif') {
                clientsToInsert.get(baseClientId).status = 'Actif';
            }

            // Ajouter l'enregistrement de renouvellement
            sqlStatements.push({
                sql: `
                    INSERT OR REPLACE INTO renewals (
                        sr_no, client_id, client_name, telegram_group_id, status_validation, client_status,
                        month, start_date, client_ad_id_name, ad_id_number, ad_account_type,
                        tier, ad_spend_limit, setup_type, subscription_fee, setup_fee,
                        discount, cl_amount, referral_partner_name, referral_amount,
                        valid_stopped_date, payment_name, bank_name, amount_received,
                        payment_received_date, payment_received_month, reference_no, actual_balance_difference
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?
                    )
                `,
                params: [
                    srNo, baseClientId, clientName, telegramGroupId, statusValidation, clientStatus,
                    month, startDate, clientAdIdName, adIdNumber, adAccountType,
                    tier, adSpendLimit, setupType, subscriptionFee, setupFee,
                    discount, clAmount, referralPartnerName, referralAmount,
                    validStoppedDate, paymentName, bankName, amountReceived,
                    paymentReceivedDate, paymentReceivedMonth, referenceNo, actualBalanceDifference
                ]
            });
        }
    }

    // Préparer l'insertion des clients
    const clientsList = Array.from(clientsToInsert.values());
    const clientSqlStatements = clientsList.map(c => ({
        sql: `INSERT OR REPLACE INTO clients (id, name, telegram_group_id, status) VALUES (?, ?, ?, ?)`,
        params: [c.id, c.name, c.telegram_group_id, c.status]
    }));

    // 3. Exécuter toutes les requêtes SQL dans une seule transaction SQLite pour la vitesse
    console.log(`Début de la transaction SQL : insertion de ${clientSqlStatements.length} clients et ${sqlStatements.length} renouvellements...`);
    
    await run("BEGIN TRANSACTION");
    try {
        // Supprimer toutes les anciennes données (sécurisé grâce à la transaction)
        await run("DELETE FROM renewals");
        await run("DELETE FROM clients");

        // Insérer les clients
        for (const stmt of clientSqlStatements) {
            await run(stmt.sql, stmt.params);
        }
        // Insérer les renouvellements
        for (const stmt of sqlStatements) {
            await run(stmt.sql, stmt.params);
        }
        await run("COMMIT");
        console.log('Transaction validée (COMMIT). Synchronisation réussie !');
    } catch (e) {
        console.error('Erreur durant la transaction, ROLLBACK.', e);
        await run("ROLLBACK");
        throw e;
    } finally {
        // Fermer la connexion à la base
        db.close(() => {
            console.log('Connexion à SQLite fermée.');
        });
    }
}

sync().catch(console.error);
