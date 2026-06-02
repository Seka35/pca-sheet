const { google } = require('googleapis');
require('dotenv').config();
const creds = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
};

const SHEET_ID = '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY';

async function debugSheet() {
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Analyse des 5 premières lignes du nouveau Sheet...');
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: ['Master sheet!A1:AA5'],
        includeGridData: true,
    });

    const rows = res.data.sheets[0].data[0].rowData;
    
    rows.forEach((row, i) => {
        console.log(`\n--- LIGNE ${i + 1} ---`);
        if (!row.values) return;
        row.values.forEach((cell, j) => {
            const val = cell.formattedValue || '';
            const bg = cell.effectiveFormat?.backgroundColor || {};
            if (val || bg.red || bg.green || bg.blue) {
                console.log(`Col ${String.fromCharCode(65 + j)}: "${val}" | Color: R:${bg.red?.toFixed(2)}, G:${bg.green?.toFixed(2)}, B:${bg.blue?.toFixed(2)}`);
            }
        });
    });
}

debugSheet().catch(console.error);
