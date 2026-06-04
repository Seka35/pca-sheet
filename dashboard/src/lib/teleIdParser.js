// Extract the short "Tele NNN" identifier from a Telegram group title
// or a clients.name value (they're the same string in our setup — the
// Google Sheet column B is the group name).
//
// Examples that return the digits as a string:
//   "🟢Geoffrey Dulauroy X Prime circle: Tele 256"  → "256"
//   "David bennett X Prime circle: (Tele 13)"        → "13"
//   "Tele - 202 Art x Tiktok 0%"                     → "202"
//
// Returns null when no "Tele NNN" token is found.
//
// The regex is permissive about separators between "Tele" and the number
// (space, dash, colon, paren, nothing) so the seller can name the group
// however they want, as long as the numeric ID is somewhere in there.

const TELE_RE = /\btele\s*[-:(\s]*\s*(\d{1,4})\b/i;
const TELE_RE_GLOBAL = /\btele\s*[-:(\s]*\s*(\d{1,4})\b/gi;

export function extractTeleId(input) {
  if (!input) return null;
  const m = String(input).match(TELE_RE);
  return m ? m[1] : null;
}

// Like extractTeleId, but returns every "Tele NNN" found in the input,
// in left-to-right order, with duplicates removed. Used by the backfill
// to try secondary patterns when the first one is already taken by another
// client. Example:
//   "Vince ... : Tele 99 (Tele - 184)"  →  ["99", "184"]
//   "Tele 2023 ... - Tele 2023"          →  ["2023"]
export function extractAllTeleIds(input) {
  if (!input) return [];
  const re = new RegExp(TELE_RE_GLOBAL.source, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(String(input))) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}
