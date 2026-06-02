const { google } = require('googleapis');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const creds = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
};
const { run, initDatabase, db } = require('./db');

const SHEET_ID = '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY';

function getVal(cell) {
    return cell ? (cell.formattedValue || '') : '';
}

function isGreen(cell) {
    if (!cell || !cell.effectiveFormat || !cell.effectiveFormat.backgroundColor) return false;
    const bg = cell.effectiveFormat.backgroundColor;
    return (bg.green > bg.red && bg.green > bg.blue && bg.green > 0.7);
}

async function sync() {
    console.log('Début de la synchronisation FIABLE (A-AA)...');
    
    await initDatabase();

    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

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
    const clientsToInsert = new Map();

    for (let r = 0; r < totalRows; r++) {
        const row = rowData[r];
        if (!row || !row.values || row.values.length === 0) continue;

        const cells = row.values;
        const srNo = getVal(cells[0]);

        if (!srNo || isNaN(parseFloat(srNo))) continue;

        const clientName = getVal(cells[1]);
        
        // --- MAPPING EXACT A-AA ---
        // A: 0 (srNo)
        // B: 1 (clientName)
        const clientStatusHistory = getVal(cells[2]); // C
        const month = getVal(cells[3]);               // D
        const startDate = getVal(cells[4]);           // E
        const clientAdIdName = getVal(cells[5]);      // F
        const adIdNumber = getVal(cells[6]);          // G
        const adAccountType = getVal(cells[7]);       // H
        const tier = getVal(cells[8]);                // I
        const adSpendLimit = getVal(cells[9]);        // J
        const setupType = getVal(cells[10]);          // K
        const subscriptionFee = getVal(cells[11]);    // L
        const setupFee = getVal(cells[12]);           // M
        const discount = getVal(cells[13]);           // N
        const clAmount = getVal(cells[14]);           // O
        const referralPartnerName = getVal(cells[15]);// P
        const referralAmount = getVal(cells[16]);     // Q
        const validStoppedDate = getVal(cells[17]);   // R
        const paymentName = getVal(cells[18]);        // S
        const bankName = getVal(cells[19]);           // T
        const amountReceived = getVal(cells[20]);     // U
        const paymentReceivedDate = getVal(cells[21]);// V
        const paymentReceivedMonth = getVal(cells[22]);// W
        const referenceNo = getVal(cells[23]);        // X
        const actualBalanceDifference = getVal(cells[24]); // Y
        const notes = getVal(cells[25]);              // Z
        const visualStatusRaw = getVal(cells[26]);       // AA

        // Détection du statut global
        const statusCell = cells[26];
        const isActive = isGreen(statusCell) || visualStatusRaw.toLowerCase().includes('active');
        const visualStatus = isActive ? 'Active' : visualStatusRaw;
        const statusValidation = isActive ? 'Actif' : 'inactif';

        const baseClientId = Math.floor(parseFloat(srNo));
        const isClientHeader = parseFloat(srNo) % 1 === 0;

        if (isClientHeader) {
            clientsToInsert.set(baseClientId, { id: baseClientId, name: clientName, status: 'inactif' });
        } else {
            if (!clientsToInsert.has(baseClientId)) {
                clientsToInsert.set(baseClientId, { id: baseClientId, name: clientName, status: 'inactif' });
            }
            if (isActive) {
                clientsToInsert.get(baseClientId).status = 'Actif';
            }

            sqlStatements.push({
                sql: `INSERT OR REPLACE INTO renewals (
                    sr_no, client_id, client_name, client_status_history, month, start_date,
                    client_ad_id_name, ad_id_number, ad_account_type, tier, ad_spend_limit,
                    setup_type, subscription_fee, setup_fee, discount, cl_amount,
                    referral_partner_name, referral_amount, valid_stopped_date,
                    payment_name, bank_name, amount_received, payment_received_date,
                    payment_received_month, reference_no, actual_balance_difference,
                    notes, visual_status
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                params: [
                    srNo, baseClientId, clientName, clientStatusHistory, month, startDate,
                    clientAdIdName, adIdNumber, adAccountType, tier, adSpendLimit,
                    setupType, subscriptionFee, setupFee, discount, clAmount,
                    referralPartnerName, referralAmount, validStoppedDate,
                    paymentName, bankName, amountReceived, paymentReceivedDate,
                    paymentReceivedMonth, referenceNo, actualBalanceDifference,
                    notes, visualStatus
                ]
            });
        }
    }

    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                await run("BEGIN TRANSACTION");
                await run("DELETE FROM renewals");
                await run("DELETE FROM clients");

                for (const client of clientsToInsert.values()) {
                    await run(`INSERT OR REPLACE INTO clients (id, name, status) VALUES (?, ?, ?)`, 
                        [client.id, client.name, client.status]);
                }

                for (const stmt of sqlStatements) {
                    await run(stmt.sql, stmt.params);
                }

                await run("COMMIT");
                console.log('Synchronisation réussie !');
                resolve();
            } catch (e) {
                console.error('Erreur SQL:', e);
                db.run("ROLLBACK");
                reject(e);
            }
        });
    });
}

sync().catch(err => { console.error(err); process.exit(1); });
