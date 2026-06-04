// Template engine for Telegram reminder messages.
// Variables are written as {{variable_name}} in the template string.
// All output is HTML-escaped (Telegram parse_mode: 'HTML').

const availableVars = [
  { key: 'client_name', desc: 'Client name (from renewals.client_name)' },
  { key: 'product', desc: 'Product label (setup_type if set, else tier)' },
  { key: 'tier', desc: 'Product tier' },
  { key: 'amount', desc: 'Computed amount due (sub + setup - discount - received)' },
  { key: 'amount_raw', desc: 'Raw subscription_fee string' },
  { key: 'currency_amount', desc: 'Computed amount due, no $ symbol' },
  { key: 'days_until', desc: 'Days remaining (positive if before due, 0 on the day, abs after)' },
  { key: 'days_absolute', desc: '|days| always positive' },
  { key: 'due_date', desc: 'YYYY-MM-DD' },
  { key: 'due_date_long', desc: 'Long English format (June 15, 2026)' },
  { key: 'sr_no', desc: 'Renewal sr_no' },
  { key: 'bank', desc: 'Bank name' },
];

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderTemplate(tpl, vars) {
  if (!tpl) return '';
  return String(tpl).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    if (v == null) return '';
    return htmlEscape(v);
  });
}

// Parse a date string (YYYY-MM-DD or whatever) into a local Date at midnight.
function parseDate(s) {
  if (!s) return null;
  // Accept YYYY-MM-DD, with optional time, and YYYY/MM/DD.
  const m = String(s).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLong(d) {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateISO(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseAmount(val) {
  if (val == null || val === '') return 0;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function buildVars(renewal, diffDays) {
  const sub = parseAmount(renewal.subscription_fee);
  const setup = parseAmount(renewal.setup_fee);
  const disc = parseAmount(renewal.discount);
  const received = parseAmount(renewal.amount_received);
  const due = Math.max(0, sub + setup - disc - received);
  const product = (renewal.setup_type && String(renewal.setup_type).trim() !== '')
    ? renewal.setup_type
    : (renewal.tier || 'subscription');

  const dueDate = parseDate(renewal.valid_stopped_date);
  // days_until: positive if still in the future, 0 on the day, abs(diff) after.
  const daysUntil = diffDays > 0 ? diffDays : 0;
  const daysAbsolute = Math.abs(diffDays);

  return {
    client_name: renewal.client_name || '',
    product,
    tier: renewal.tier || '',
    amount: '$' + due.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    amount_raw: renewal.subscription_fee || '',
    currency_amount: String(due),
    days_until: String(daysUntil),
    days_absolute: String(daysAbsolute),
    due_date: formatDateISO(dueDate),
    due_date_long: formatDateLong(dueDate),
    sr_no: renewal.sr_no || '',
    bank: renewal.bank_name || '',
  };
}

export {
  availableVars,
  htmlEscape,
  renderTemplate,
  parseDate,
  parseAmount,
  buildVars,
  formatDateISO,
  formatDateLong,
};
