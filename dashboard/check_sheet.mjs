import { google } from 'googleapis';

const creds = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const res = await sheets.spreadsheets.get({
  spreadsheetId: '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY',
  ranges: ['Master sheet!A3:AA'],
  includeGridData: true,
});

const sheet = res.data.sheets[0];
const rowData = sheet.data[0].rowData || [];

// Find any row where the sr_no is missing/0/blank — those are suspicious
console.log(`Total rows: ${rowData.length}`);
console.log();
console.log('=== Last 10 rows ===');
const start = Math.max(0, rowData.length - 10);
for (let i = start; i < rowData.length; i++) {
  const row = rowData[i];
  const cells = row?.values || [];
  const srNo = cells[0]?.formattedValue || '';
  const name = cells[1]?.formattedValue || '';
  const ref = cells[23]?.formattedValue || '';
  const notes = cells[25]?.formattedValue || '';
  const visual = cells[26]?.formattedValue || '';
  console.log(`Row ${i+3}: sr_no=${JSON.stringify(srNo).padEnd(12)} name=${JSON.stringify(name).slice(0,50).padEnd(52)} ref=${ref} notes=${notes.slice(0,30)} visual=${visual}`);
}

// Also check for any client with id=99 that already exists
console.log();
console.log('=== Rows where baseClientId=99 (Thomas) ===');
for (let i = 0; i < rowData.length; i++) {
  const row = rowData[i];
  const cells = row?.values || [];
  const srNo = parseFloat(cells[0]?.formattedValue);
  if (Math.floor(srNo) === 99) {
    const name = cells[1]?.formattedValue || '';
    const ref = cells[23]?.formattedValue || '';
    console.log(`Row ${i+3}: sr_no=${cells[0]?.formattedValue} name=${name.slice(0,50)} ref=${ref}`);
  }
}
