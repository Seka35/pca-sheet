// Google Sheets write engine — the only code path that writes back to the
// "Master sheet" from the dashboard. Auth setup is mirrored from
// src/app/api/sync/route.js:21-32 (the existing read path).
//
// All public functions return { ok: true, ... } or { ok: false, error }.
// Callers should treat the Sheet as the source of truth: a successful Sheet
// write will be picked up by the next /api/sync, but a failed Sheet write
// cannot be recovered from the dashboard side.

import { google } from 'googleapis';
import {
  SHEET_ID,
  SHEET_TAB_NAME,
  SHEET_TAB_ID,
  DATA_START_ROW,
  COL_COUNT,
  LAST_COL_INDEX,
  BLUE_BG,
  GREEN_BG,
  BEIGE_BG,
  columnLetter,
  dataRange,
  rowRange,
  buildHeaderRow,
  buildProductRow,
} from './sheetSchema.js';

const ROW_BUFFER = 200; // how many extra rows past the last data row to read

// --- Auth -------------------------------------------------------------------

let cachedSheets = null;

export async function getSheetsClient() {
  if (cachedSheets) return cachedSheets;

  const creds = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // The .env stores the key with literal "\n" — convert to real newlines.
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };

  if (!creds.client_email || !creds.private_key) {
    throw new Error(
      'Google Sheets auth missing: GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY are not set'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  cachedSheets = google.sheets({ version: 'v4', auth });
  return cachedSheets;
}

// --- Read helpers -----------------------------------------------------------

// Walks column A from DATA_START_ROW to (DATA_START_ROW + maxRows). Returns
// an array of { srNo, rowIndex0 } for every non-empty cell. `rowIndex0` is
// the 0-based index in the Sheet (so 0 = row 1).
async function readColumnATail(sheets, { maxRows = 5000 } = {}) {
  const endRow = DATA_START_ROW + maxRows - 1;
  const range = `Master sheet!A${DATA_START_ROW}:A${endRow}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  const values = res.data.values || [];
  const out = [];
  values.forEach((row, i) => {
    const v = (row[0] || '').toString().trim();
    if (!v) return;
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return;
    out.push({ srNo: v, rowIndex0: i, numeric: n });
  });
  return out;
}

// Returns the next client id: max(integer sr_no) + 1, or 1 if the sheet is empty.
export async function findNextClientId(sheets) {
  const entries = await readColumnATail(sheets);
  let max = 0;
  for (const e of entries) {
    if (Number.isInteger(e.numeric) && e.numeric > max) max = e.numeric;
  }
  return max + 1;
}

// Returns the 0-based row index where the next new client block should be
// inserted (i.e. one past the last occupied row in column A).
export async function findNextInsertIndex0(sheets) {
  const entries = await readColumnATail(sheets);
  if (entries.length === 0) return 0;
  const last = entries[entries.length - 1];
  // entries[i].rowIndex0 is 0-based at the start of the data range.
  // Convert back to 0-based Sheet index: dataStartRow(0-based) + rowIndex0.
  return DATA_START_ROW - 1 + last.rowIndex0 + 1;
}

// Returns the 0-based row index where a new product for an existing client
// should be inserted (immediately after the last product of that client).
// If the client has no products, returns null (caller should append to end).
export async function findInsertIndexForNewProduct0(sheets, clientId) {
  const entries = await readColumnATail(sheets);
  // Walk bottom-up. Find the last row whose floor(sr_no) === clientId.
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (Math.floor(e.numeric) === clientId) {
      return DATA_START_ROW - 1 + e.rowIndex0 + 1;
    }
  }
  return null;
}

// Reads the column-A tail + the full row data for every sr_no that shares
// the given clientId. Returns an array of { srNo, rowIndex0, values } where
// `values` is the 27-cell A-AA array. Used by Edit Client.
export async function readClientBlock(sheets, clientId) {
  const entries = await readColumnATail(sheets);
  const block = entries.filter((e) => Math.floor(e.numeric) === clientId);
  if (block.length === 0) return [];

  const first = block[0];
  const last = block[block.length - 1];
  const startRow = DATA_START_ROW + first.rowIndex0;
  const endRow = DATA_START_ROW + last.rowIndex0;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB_NAME}!A${startRow}:${columnLetter(LAST_COL_INDEX)}${endRow}`,
  });

  const rows = res.data.values || [];
  return block.map((e, i) => ({
    srNo: e.srNo,
    numeric: e.numeric,
    rowIndex0: e.rowIndex0,
    rowIndex1: DATA_START_ROW + e.rowIndex0,
    values: (rows[i] || []).concat(new Array(Math.max(0, COL_COUNT - (rows[i] || []).length)).fill('')),
  }));
}

// --- Color helpers ----------------------------------------------------------

let cachedInactiveColor = null;

// Reads a sample inactive product row from the Sheet to discover the exact
// RGB used for the "beige/yellow" inactive background. We pick the first
// non-green, non-blue row we can find. Cached per-process. Falls back to
// BEIGE_BG if we can't find a sample.
export async function getInactiveColor(sheets) {
  if (cachedInactiveColor) return cachedInactiveColor;

  const endRow = DATA_START_ROW + ROW_BUFFER - 1;
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    ranges: [`Master sheet!A${DATA_START_ROW}:${columnLetter(LAST_COL_INDEX)}${endRow}`],
    includeGridData: true,
  });

  const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData || [];
  for (const row of rowData) {
    if (!row || !row.values || row.values.length === 0) continue;
    const first = row.values[0];
    const bg = first?.effectiveFormat?.backgroundColor;
    if (!bg) continue;
    const r = bg.red || 0, g = bg.green || 0, b = bg.blue || 0;
    // Skip the blue header color and the green active color.
    const isBlue = r > 0.09 && r < 0.12 && g > 0.44 && g < 0.46 && b > 0.90 && b < 0.92;
    const isGreen = g > r && g > b && g > 0.7;
    if (isBlue || isGreen) continue;
    // Skip white / no-color.
    if (r > 0.98 && g > 0.98 && b > 0.98) continue;
    cachedInactiveColor = { red: r, green: g, blue: b };
    return cachedInactiveColor;
  }

  cachedInactiveColor = BEIGE_BG;
  return cachedInactiveColor;
}

// --- Write helpers ----------------------------------------------------------

// Builds a repeatCell request that paints a single row (or a range of rows)
// with the given background color across the A-AA range.
function paintRows(rowIndex0 /* 0-based, sheet-wide */, count, color) {
  return {
    repeatCell: {
      range: {
        sheetId: SHEET_TAB_ID,
        startRowIndex: rowIndex0,
        endRowIndex: rowIndex0 + count,
        startColumnIndex: 0,
        endColumnIndex: COL_COUNT,
      },
      cell: { userEnteredFormat: { backgroundColor: color } },
      fields: 'userEnteredFormat.backgroundColor',
    },
  };
}

// Builds an updateCells request that writes a 2D array of values into the
// Sheet starting at (rowIndex0, colIndex0). The values are written as
// userEnteredValue (so dates/numbers get parsed by the Sheet).
function writeCells(rowIndex0, colIndex0, rows2d) {
  return {
    updateCells: {
      start: { sheetId: SHEET_TAB_ID, rowIndex: rowIndex0, columnIndex: colIndex0 },
      rows: rows2d.map((r) => ({
        values: r.map((v) => ({ userEnteredValue: { stringValue: String(v ?? '') } })),
      })),
      fields: 'userEnteredValue',
    },
  };
}

// --- Public: appendClientBlock ---------------------------------------------

// Appends a new client block (1 blue header + N product rows) at the end
// of the Sheet. Returns { ok, sr_nos, insertAt0 } on success.
//
// `name`              — client name (column B on every row)
// `telegram_group_id` — unused for the Sheet (no dedicated column); kept in
//                       the signature for API symmetry, ignored in the write
// `products`          — array of product objects (see buildProductRow)
// `baseSrNo`          — client id (e.g. 5); the header gets "5" and the
//                       products get "5.1", "5.2", ...
export async function appendClientBlock({ name, telegram_group_id, products, baseSrNo }) {
  if (!Number.isInteger(baseSrNo) || baseSrNo < 1) {
    return { ok: false, error: `Invalid baseSrNo: ${baseSrNo}` };
  }
  if (!Array.isArray(products)) {
    return { ok: false, error: 'products must be an array' };
  }
  // products may be `[]` (header-only client) — the bot uses this path for
  // auto-create on /start. The Sheet still gets a single blue header row;
  // the human adds products from the dashboard later.

  try {
    const sheets = await getSheetsClient();
    const insertAt0 = await findNextInsertIndex0(sheets); // 0-based Sheet index
    const totalRows = 1 + products.length;

    const inactiveColor = await getInactiveColor(sheets);

    const headerRow = buildHeaderRow(String(baseSrNo), name);
    const productRows = products.map((p, i) =>
      buildProductRow(`${baseSrNo}.${i + 1}`, name, p)
    );
    const allRows2d = [headerRow, ...productRows];

    const requests = [
      // 1. Open up `totalRows` new rows at the insertion point.
      {
        insertDimension: {
          range: {
            sheetId: SHEET_TAB_ID,
            dimension: 'ROWS',
            startIndex: insertAt0,
            endIndex: insertAt0 + totalRows,
          },
          inheritFromBefore: false,
        },
      },
      // 2. Write the values (header + products) into those rows.
      writeCells(insertAt0, 0, allRows2d),
      // 3. Paint the header row blue.
      paintRows(insertAt0, 1, BLUE_BG),
    ];

    // 4. Paint each product row. Same color for all if they're all active or
    //    all inactive; otherwise emit one repeatCell per row to keep the
    //    request small.
    const colors = productRows.map(() => null);
    let allActive = true, allInactive = true;
    for (let i = 0; i < products.length; i++) {
      const isActive = products[i].active !== false;
      colors[i] = isActive ? GREEN_BG : inactiveColor;
      if (!isActive) allActive = false;
      else allInactive = false;
    }

    if (products.length > 0) {
      if (allActive) {
        requests.push(paintRows(insertAt0 + 1, products.length, GREEN_BG));
      } else if (allInactive) {
        requests.push(paintRows(insertAt0 + 1, products.length, inactiveColor));
      } else {
        // Mixed: one repeatCell per row.
        for (let i = 0; i < products.length; i++) {
          requests.push(paintRows(insertAt0 + 1 + i, 1, colors[i]));
        }
      }
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });

    const sr_nos = [String(baseSrNo), ...productRows.map((_, i) => `${baseSrNo}.${i + 1}`)];
    return { ok: true, sr_nos, insertAt0 };
  } catch (e) {
    console.error('[googleSheets.appendClientBlock] error:', e);
    return { ok: false, error: e.message || String(e) };
  }
}

// --- Public: overwriteClientBlock (Edit Client) -----------------------------

// Updates an existing client block in-place. Three sub-operations:
//
//   1. removed_sr_nos: clear the row values and reset its background to default.
//   2. updated products: use values.update on the row range to push new values.
//   3. added products: use insertDimension + updateCells + repeatCell, same as append.
//
// Returns { ok, added, updated, removed, inserted_sr_nos } on success.
export async function overwriteClientBlock({ clientId, name, products, removed_sr_nos = [] }) {
  if (!Number.isInteger(clientId) || clientId < 1) {
    return { ok: false, error: `Invalid clientId: ${clientId}` };
  }
  if (!Array.isArray(products)) {
    return { ok: false, error: 'products must be an array' };
  }

  try {
    const sheets = await getSheetsClient();
    const block = await readClientBlock(sheets, clientId);
    if (block.length === 0) {
      return { ok: false, error: `No Sheet block found for client ${clientId}` };
    }

    const removedSet = new Set(removed_sr_nos.map((s) => String(s)));
    const keptRows = block.filter((r) => !removedSet.has(r.srNo));

    // Strategy: do the insertDimension FIRST, then everything else. The
    // insert shifts every row at-or-below the insertion point down by
    // newProducts.length — so the existing rows we want to update need to
    // be addressed at their NEW positions.

    // ---- Step 1: figure out the new products and where they go ----
    const newProducts = products.filter((p) => !p.sr_no);
    let insertAt0 = null;        // 0-based Sheet index for the new rows
    let decimalsForNew = [];     // assigned decimals for the new products
    let inserted_sr_nos = [];    // the new sr_nos we minted

    if (newProducts.length > 0) {
      insertAt0 = await findInsertIndexForNewProduct0(sheets, clientId);
      if (insertAt0 === null) {
        return { ok: false, error: `Cannot find insertion point for client ${clientId}` };
      }

      const usedDecimals = new Set(
        keptRows
          .map((r) => r.numeric)
          .filter((n) => Math.floor(n) === clientId && !Number.isInteger(n))
          .map((n) => Math.round((n - Math.floor(n)) * 10)) // "5.3" → 3
      );
      let nextDecimal = 1;
      decimalsForNew = newProducts.map(() => {
        while (usedDecimals.has(nextDecimal)) nextDecimal++;
        usedDecimals.add(nextDecimal);
        return nextDecimal;
      });
      inserted_sr_nos = decimalsForNew.map((d) => `${clientId}.${d}`);
    }

    // ---- Step 2: insert the new rows + paint their backgrounds + write values ----
    // One single batchUpdate so it's atomic from the Sheet's perspective.
    if (newProducts.length > 0) {
      const inactiveColor = await getInactiveColor(sheets);
      const newRows2d = newProducts.map((p, i) =>
        buildProductRow(inserted_sr_nos[i], name, p)
      );
      const requests = [
        // First: physically delete the removed rows (highest index first so
        // positions don't shift). This frees their sr_no slots and prevents
        // the new products from colliding with cleared-but-still-present rows.
        ...removed_sr_nos
          .map((sr) => block.find((r) => r.srNo === sr))
          .filter(Boolean)
          .sort((a, b) => b.rowIndex0 - a.rowIndex0)
          .map((r) => ({
            deleteDimension: {
              range: {
                sheetId: SHEET_TAB_ID,
                dimension: 'ROWS',
                startIndex: r.rowIndex0,
                endIndex: r.rowIndex0 + 1,
              },
            },
          })),
        // Then: open up newProducts.length rows at the insertion point.
        {
          insertDimension: {
            range: {
              sheetId: SHEET_TAB_ID,
              dimension: 'ROWS',
              startIndex: insertAt0,
              endIndex: insertAt0 + newProducts.length,
            },
            inheritFromBefore: false,
          },
        },
        // Then: write the new values into the inserted rows.
        writeCells(insertAt0, 0, newRows2d),
      ];
      for (let i = 0; i < newProducts.length; i++) {
        const isActive = newProducts[i].active !== false;
        const color = isActive ? GREEN_BG : inactiveColor;
        requests.push(paintRows(insertAt0 + i, 1, color));
      }
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests },
      });
    }

    // ---- Step 3: re-compute the final positions of keptRows after deletes + insert ----
    // Each kept row that was at original rowIndex0 moves:
    //   1) UP by the number of removed rows that were at positions < rowIndex0
    //   2) DOWN by newProducts.length IF its post-delete position is at or
    //      after the post-delete insertAt0
    const removedRowIndices = removed_sr_nos
      .map((sr) => block.find((r) => r.srNo === sr))
      .filter(Boolean)
      .map((r) => r.rowIndex0);
    const removedAbove = (idx) => removedRowIndices.filter((i) => i < idx).length;
    const insertAt0AfterDeletes = insertAt0 !== null
      ? insertAt0 - removedAbove(insertAt0)
      : null;
    const shiftBy = newProducts.length;

    const shiftedKeptRows = keptRows.map((r) => {
      const r0 = r.rowIndex0;
      const rAfterDeletes = r0 - removedAbove(r0);
      const rAfterAll = (insertAt0AfterDeletes !== null && rAfterDeletes >= insertAt0AfterDeletes)
        ? rAfterDeletes + shiftBy
        : rAfterDeletes;
      return { ...r, rowIndex1: rAfterAll + 1 };
    });

    // ---- Step 5: update the values of existing products (use shifted positions) ----
    const updated = [];
    for (const p of products) {
      if (!p.sr_no) continue; // skip new products
      const target = shiftedKeptRows.find((r) => r.srNo === String(p.sr_no));
      if (!target) continue;
      const row = buildProductRow(target.srNo, name, p);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: rowRange(target.rowIndex1),
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });
      updated.push(target.srNo);
    }

    // removed list for the API response — just echo what was requested.
    const removed = [...removed_sr_nos];

    // ---- Step 6: update the header row's name (column B) if it changed ----
    const headerRow = shiftedKeptRows.find((r) => Number.isInteger(parseFloat(r.srNo)));
    if (headerRow && name && headerRow.values[1] !== name) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB_NAME}!B${headerRow.rowIndex1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name]] },
      });
    }

    return { ok: true, added: inserted_sr_nos, updated, removed };
  } catch (e) {
    console.error('[googleSheets.overwriteClientBlock] error:', e);
    return { ok: false, error: e.message || String(e) };
  }
}
