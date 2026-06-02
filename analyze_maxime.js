const { google } = require('googleapis');
require('dotenv').config();
const creds = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
};

const SHEET_ID = '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY';

async function analyzeClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Analyse spécifique pour Maxime Golgolab (Tele 66)...');
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: ['Master sheet!A3:AA1400'],
        includeGridData: true,
    });

    const rows = res.data.sheets[0].data[0].rowData;
    
    rows.forEach((row, i) => {
        if (!row.values || row.values.length < 2) return;
        const srNo = row.values[0].formattedValue || '';
        const name = row.values[1].formattedValue || '';
        
        // Chercher Maxime ou Tele 66
        if (name.toLowerCase().includes('maxime') || name.toLowerCase().includes('golgolab') || srNo.startsWith('66.')) {
            console.log(`\nLigne ${i + 3} [SR: ${srNo}]: ${name}`);
            row.values.forEach((cell, j) => {
                const val = cell.formattedValue || '';
                const bg = cell.effectiveFormat?.backgroundColor || {};
                const colorStr = bg.green > 0.8 ? 'VERT' : (bg.red > 0.8 && bg.green > 0.8 ? 'JAUNE/ORANGE' : 'AUTRE');
                if (val) {
                    console.log(`  Col ${String.fromCharCode(65 + j)}: "${val}" (Color: ${colorStr})`);
                }
            });
        }
    });
}

analyzeClient().catch(console.error);
