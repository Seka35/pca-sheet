// Single source of truth for the Google Sheet "Master sheet" column layout
// and the formatting constants used by both the read path (sync) and the new
// write path (Add/Edit Client). Mirror of src/app/api/sync/route.js:50-79.

export const SHEET_ID = '140xAk8mQz1MRbG-X7THPTsVNorw14SnbMVbP2FXhhFY';
export const SHEET_TAB_NAME = 'Master sheet';
// Numeric id of the "Master sheet" tab — required for batchUpdate requests
// (e.g. insertDimension, repeatCell) that take a `sheetId`. Discovered via
// the one-off script at /test.js:32.
export const SHEET_TAB_ID = 1756535124;

// Sheet data starts at row 3 (row 1 = title, row 2 = column headers).
// Header detection in the sync uses `parseFloat(sr_no) % 1 === 0`.
export const DATA_START_ROW = 3; // 1-based; 0-based equivalent is 2.

// 27 columns A through AA, in order. Mirrors the keys in
// src/app/api/sync/route.js:50-79 and src/app/api/webhook/sheets/route.js:5-33.
export const COLUMNS = [
  'sr_no',                          // A
  'client_name',                    // B
  'client_status_history',          // C
  'month',                          // D
  'start_date',                     // E
  'client_ad_id_name',              // F
  'ad_id_number',                   // G
  'setup_id_number',                // H
  'ad_account_type',                // I
  'tier',                           // I
  'ad_spend_limit',                 // J
  'setup_type',                     // K
  'subscription_fee',               // L
  'setup_fee',                      // M
  'discount',                       // N
  'cl_amount',                      // O
  'referral_partner_name',          // P
  'referral_amount',                // Q
  'valid_stopped_date',             // R
  'payment_name',                   // S
  'bank_name',                      // T
  'amount_received',                // U
  'payment_received_date',          // V
  'payment_received_month',         // W
  'reference_no',                   // X
  'actual_balance_difference',      // Y
  'notes',                          // Z
  'visual_status',                  // AA
];

export const COL_COUNT = COLUMNS.length; // 28
export const LAST_COL_INDEX = COL_COUNT - 1; // 27 → column AB

// Background color constants. RGB normalized to [0, 1] as expected by the
// Sheets API. Values matched against the existing sheet:
//   - BLUE: test.js:61 detection thresholds
//     `red > 0.09 && red < 0.12 && green > 0.44 && green < 0.46 && blue > 0.90 && blue < 0.92`
//   - GREEN: src/app/api/sync/route.js:14-15 isGreen() thresholds
//     `green > red && green > blue && green > 0.7`
//   - BEIGE: best-guess light yellow/beige for inactive products. The existing
//     sheet uses several inactive palettes; we pick one that won't be
//     mis-detected as Active by isGreen() AND won't be mis-detected as the
//     blue header. Override at runtime via getInactiveColor() to read the
//     real RGB from a sample inactive row.
export const BLUE_BG  = { red: 0.10, green: 0.45, blue: 0.91 };
export const GREEN_BG = { red: 0.00, green: 1.00, blue: 0.00 };
export const BEIGE_BG = { red: 0.96, green: 0.87, blue: 0.70 };

// 1-based column letter (A, B, ..., Z, AA). `idx` is 0-based column index.
export function columnLetter(idx) {
  if (idx < 0 || idx >= COL_COUNT) {
    throw new Error(`columnLetter: index ${idx} out of range (0..${COL_COUNT - 1})`);
  }
  let letter = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// 1-based A1 range covering the data block, e.g. "Master sheet!A3:AA5000".
export function dataRange(endRow /* 1-based inclusive */) {
  return `${SHEET_TAB_NAME}!A${DATA_START_ROW}:${columnLetter(LAST_COL_INDEX)}${endRow}`;
}

// 1-based A1 range for just column A.
export function columnARange(endRow /* 1-based inclusive */) {
  return `${SHEET_TAB_NAME}!A${DATA_START_ROW}:A${endRow}`;
}

// 1-based A1 range for a single row across all data columns.
export function rowRange(row /* 1-based */) {
  return `${SHEET_TAB_NAME}!A${row}:${columnLetter(LAST_COL_INDEX)}${row}`;
}

// Returns a 27-cell array of empty strings.
export function emptyRow() {
  return new Array(COL_COUNT).fill('');
}

// Build a client header row. Only sr_no + client_name are meaningful;
// every other column is blank — the row visually identifies the client
// and the product rows below carry the data.
export function buildHeaderRow(srNo, name) {
  const row = emptyRow();
  row[0] = String(srNo);     // A: sr_no
  row[1] = String(name);     // B: client_name
  // C..AA stay empty.
  return row;
}

// Build a product row. The visual_status cell (AA) is set to "Active" or empty
// based on the `active` flag. Numeric fields are coerced to strings (the Sheet
// stores them as text per the existing convention).
export function buildProductRow(srNo, name, product) {
  const row = emptyRow();
  row[0] = String(srNo);     // A: sr_no
  row[1] = String(name);     // B: client_name
  row[2] = product.client_status_history || '';  // C
  row[3] = product.month || '';                  // D
  row[4] = product.start_date || '';             // E
  row[5] = product.client_ad_id_name || '';      // F
  row[6] = product.ad_id_number || '';           // G
  row[7] = product.setup_id_number || '';        // H
  row[8] = product.ad_account_type || '';        // I
  row[9] = product.tier || '';                   // J
  row[10] = product.ad_spend_limit || '';         // K
  row[11] = product.setup_type || '';            // L
  row[12] = stringifyNumber(product.subscription_fee);  // M
  row[13] = stringifyNumber(product.setup_fee);         // N
  row[14] = stringifyNumber(product.discount);          // O
  row[15] = stringifyNumber(product.cl_amount);         // P
  row[16] = product.referral_partner_name || '';   // Q
  row[17] = stringifyNumber(product.referral_amount);   // R
  row[18] = product.valid_stopped_date || '';     // S
  row[19] = product.payment_name || '';           // T
  row[20] = product.bank_name || '';              // U
  row[21] = stringifyNumber(product.amount_received);  // V
  row[22] = product.payment_received_date || '';  // W
  row[23] = product.payment_received_month || ''; // X
  row[24] = product.reference_no || '';           // Y
  row[25] = stringifyNumber(product.actual_balance_difference);  // Z
  row[26] = product.notes || '';                  // AA
  row[27] = product.active === false ? '' : 'Active';  // AB
  return row;
}

function stringifyNumber(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (Number.isFinite(n)) return String(n);
  return String(v);
}

// Default "MMM-YYYY" string for the current month (e.g. "Jun-2026"), used
// to pre-fill the Month field in the Add Client form.
export function defaultMonthLabel() {
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month}-${d.getFullYear()}`;
}

// Read `dataValidation` whitelist for RENEWAL_COLUMNS — same set used by
// src/app/api/approvals/route.js:5-13. Useful for safe field-name handling
// in the Edit Client path.
export const RENEWAL_COLUMNS = [
  'sr_no', 'client_name', 'client_status_history', 'month', 'start_date',
  'client_ad_id_name', 'ad_id_number', 'setup_id_number', 'ad_account_type', 'tier', 'ad_spend_limit',
  'setup_type', 'subscription_fee', 'setup_fee', 'discount', 'cl_amount',
  'referral_partner_name', 'referral_amount', 'valid_stopped_date',
  'payment_name', 'bank_name', 'amount_received', 'payment_received_date',
  'payment_received_month', 'reference_no', 'actual_balance_difference',
  'notes', 'visual_status',
];
