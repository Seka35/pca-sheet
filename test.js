const { google } = require('googleapis');
require('dotenv').config();
const creds = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
};

const SHEET_ID = '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY'; // dans l'URL du Sheet

async function test() {
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Lire le formatage et les valeurs de tout le tableau (sans limite de ligne fixe)
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: ['Master sheet!A3:E'],
        includeGridData: true,
    });

    const sheet = res.data.sheets[0];
    const gridData = sheet.data[0];
    const rowData = gridData.rowData || [];
    const totalRows = rowData.length;

    console.log(`Nombre total de lignes à traiter: ${totalRows}`);

    const sheetId = 1756535124; // ID de la feuille 'Master sheet'
    const statusValues = [];

    for (let r = 0; r < totalRows; r++) {
        const row = rowData[r];
        if (!row || !row.values) {
            statusValues.push(['']);
            continue;
        }

        const srNoCell = row.values[0];
        const clientNameCell = row.values[1];

        const srNo = srNoCell ? (srNoCell.formattedValue || '') : '';
        const clientName = clientNameCell ? (clientNameCell.formattedValue || '') : '';

        // Récupérer la couleur de fond de la cellule Client Name (index 1)
        let bg = null;
        if (clientNameCell && clientNameCell.effectiveFormat && clientNameCell.effectiveFormat.backgroundColor) {
            bg = clientNameCell.effectiveFormat.backgroundColor;
        }

        const red = bg ? (bg.red || 0) : 0;
        const green = bg ? (bg.green || 0) : 0;
        const blue = bg ? (bg.blue || 0) : 0;

        // Détection
        if (!srNo) {
            statusValues.push(['']); // Ligne vide
        } else if (srNo.endsWith('.00') || (red > 0.09 && red < 0.12 && green > 0.44 && green < 0.46 && blue > 0.90 && blue < 0.92)) {
            // Ligne de titre/séparation (Bleu) -> On ne met rien ou vide
            statusValues.push(['']);
        } else if (red === 0 && green === 1 && blue === 0) {
            // Cellule verte -> Actif
            statusValues.push(['Actif']);
        } else {
            // Autres (comme beige, jaune, etc.) -> inactif
            statusValues.push(['inactif']);
        }
    }

    console.log(`\nMise à jour de la validation de données (checkboxes Actif/inactif sur ${totalRows} lignes)...`);
    // 2. Configurer les cases à cocher (validation BOOLEAN personnalisée)
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
            requests: [
                {
                    setDataValidation: {
                        range: {
                            sheetId: sheetId,
                            startRowIndex: 2, // Ligne 3 (0-indexed)
                            endRowIndex: 2 + totalRows,
                            startColumnIndex: 3, // Colonne D (index 3)
                            endColumnIndex: 4,
                        },
                        rule: {
                            condition: {
                                type: 'BOOLEAN',
                                values: [
                                    { userEnteredValue: 'Actif' },
                                    { userEnteredValue: 'inactif' }
                                ]
                            },
                            showCustomUi: true,
                            strict: true
                        }
                    }
                }
            ]
        }
    });

    console.log(`Envoi des valeurs dans la colonne D...`);
    // 3. Envoyer les valeurs dans la colonne D
    await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Master sheet!D3:D${2 + totalRows}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: statusValues,
        }
    });

    console.log('Mise à jour de tout le tableau terminée avec succès !');
}

test().catch(console.error);
