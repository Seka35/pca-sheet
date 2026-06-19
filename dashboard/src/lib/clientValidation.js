// Server-side validation for the Add Client and Edit Client endpoints.
// Keep this strict — we are the second line of defense after the UI.

// Valid tier values (TIER 1-6)
const VALID_TIERS = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];

// Valid setup_type values (the 5 products)
const VALID_SETUP_TYPES = ['Top-up', 'Invincible set up (old)', 'Starter', 'Premium', 'VIP'];

const PRODUCT_FIELDS = [
  'tier', 'setup_type', 'subscription_fee', 'setup_fee', 'discount', 'cl_amount',
  'month', 'start_date', 'valid_stopped_date',
  'client_ad_id_name', 'ad_id_number', 'ad_account_type', 'ad_spend_limit',
  'referral_partner_name', 'referral_amount',
  'payment_name', 'bank_name', 'amount_received',
  'payment_received_date', 'payment_received_month',
  'reference_no', 'actual_balance_difference',
  'client_status_history', 'notes',
  'sr_no', // only used by Edit Client
  'active', // UI-only flag, controls green vs beige background
  'is_trial', // trial flag for 7 days trial period
];

function trimOrEmpty(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function asString(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function isValidDate(s) {
  if (!s) return true; // optional
  // Accept YYYY-MM-DD or M/D/YYYY (the Sheet's loose date format).
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s);
    return !isNaN(d.getTime());
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const d = new Date(s);
    return !isNaN(d.getTime());
  }
  return false;
}

function normalizeProduct(p, { allowSrNo = false } = {}) {
  if (!p || typeof p !== 'object') return null;
  const out = {};
  for (const f of PRODUCT_FIELDS) {
    if (f === 'sr_no' && !allowSrNo) continue;
    if (f === 'active') {
      out.active = p.active === false ? false : true; // default true
    } else if (f === 'is_trial') {
      out.is_trial = p.is_trial === true ? true : false; // preserve boolean
    } else if (f === 'setup_type') {
      // Sanitize: only keep valid setup_type values, otherwise clear
      const val = trimOrEmpty(p[f]);
      out[f] = VALID_SETUP_TYPES.includes(val) ? val : '';
    } else if (f === 'tier') {
      // Sanitize: only keep valid tier values, otherwise clear
      const val = trimOrEmpty(p[f]);
      out[f] = VALID_TIERS.includes(val) ? val : '';
    } else {
      out[f] = trimOrEmpty(p[f]);
    }
  }
  return out;
}

// Validates the POST /api/clients payload (Add Client).
// Returns { ok: true, cleaned: { name, telegram_group_id, products } }
// or     { ok: false, error: 'message' }.
export function validateAddClientPayload(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }

  const name = trimOrEmpty(body.name);
  if (!name) return { ok: false, error: 'Client name is required' };
  if (name.length > 200) return { ok: false, error: 'Client name is too long (max 200 chars)' };

  const telegram_group_id = trimOrEmpty(body.telegram_group_id);
  if (telegram_group_id && !/^-?\d{1,20}$/.test(telegram_group_id)) {
    return { ok: false, error: 'Telegram group ID must be a numeric chat id (e.g. -1001234567890)' };
  }

  if (!Array.isArray(body.products) || body.products.length === 0) {
    return { ok: false, error: 'At least one product is required' };
  }
  if (body.products.length > 50) {
    return { ok: false, error: 'Too many products (max 50)' };
  }

  const products = [];
  for (let i = 0; i < body.products.length; i++) {
    const p = normalizeProduct(body.products[i]);
    if (!p) return { ok: false, error: `Product #${i + 1}: invalid` };
    if (!p.tier && !p.setup_type) {
      return { ok: false, error: `Product #${i + 1}: tier or setup_type is required` };
    }
    if (p.tier && !VALID_TIERS.includes(p.tier)) {
      return { ok: false, error: `Product #${i + 1}: invalid tier value "${p.tier}"` };
    }
    if (p.setup_type && !VALID_SETUP_TYPES.includes(p.setup_type)) {
      return { ok: false, error: `Product #${i + 1}: invalid setup_type value "${p.setup_type}"` };
    }
    for (const dateField of ['start_date', 'valid_stopped_date', 'payment_received_date']) {
      if (p[dateField] && !isValidDate(p[dateField])) {
        return { ok: false, error: `Product #${i + 1}: ${dateField} is not a valid date` };
      }
    }
    products.push(p);
  }

  return { ok: true, cleaned: { name, telegram_group_id, products } };
}

// Validates the PUT /api/clients/[id] payload (Edit Client).
// `products` is the full desired state (with sr_no for existing products,
// without sr_no for new products). `removed_sr_nos` lists products to remove.
export function validateUpdateClientPayload(body, clientIdNum) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }

  const name = trimOrEmpty(body.name);
  if (!name) return { ok: false, error: 'Client name is required' };
  if (name.length > 200) return { ok: false, error: 'Client name is too long (max 200 chars)' };

  const telegram_group_id = trimOrEmpty(body.telegram_group_id);
  if (telegram_group_id && !/^-?\d{1,20}$/.test(telegram_group_id)) {
    return { ok: false, error: 'Telegram group ID must be a numeric chat id' };
  }

  const status = trimOrEmpty(body.status);
  if (status && !['Actif', 'inactif', 'Active', 'Inactive', 'Paused'].includes(status)) {
    return { ok: false, error: 'Invalid status value' };
  }

  if (!Array.isArray(body.products)) {
    return { ok: false, error: 'products must be an array' };
  }
  if (body.products.length > 100) {
    return { ok: false, error: 'Too many products (max 100)' };
  }

  const removed_sr_nos = Array.isArray(body.removed_sr_nos)
    ? body.removed_sr_nos.map((s) => asString(s).trim()).filter(Boolean)
    : [];

  const products = [];
  for (let i = 0; i < body.products.length; i++) {
    const p = normalizeProduct(body.products[i], { allowSrNo: true });
    if (!p) return { ok: false, error: `Product #${i + 1}: invalid` };

    if (p.sr_no) {
      // Existing product — verify the sr_no belongs to this client.
      const f = parseFloat(p.sr_no);
      if (!Number.isFinite(f) || Math.floor(f) !== clientIdNum) {
        return {
          ok: false,
          error: `Product #${i + 1}: sr_no "${p.sr_no}" does not belong to client ${clientIdNum}`,
        };
      }
    }
    // For new products, tier or setup_type is required.
    if (!p.sr_no && !p.tier && !p.setup_type) {
      return { ok: false, error: `New product #${i + 1}: tier or setup_type is required` };
    }
    if (p.tier && !VALID_TIERS.includes(p.tier)) {
      return { ok: false, error: `Product #${i + 1}: invalid tier value "${p.tier}"` };
    }
    if (p.setup_type && !VALID_SETUP_TYPES.includes(p.setup_type)) {
      return { ok: false, error: `Product #${i + 1}: invalid setup_type value "${p.setup_type}"` };
    }
    for (const dateField of ['start_date', 'valid_stopped_date', 'payment_received_date']) {
      if (p[dateField] && !isValidDate(p[dateField])) {
        return { ok: false, error: `Product #${i + 1}: ${dateField} is not a valid date` };
      }
    }
    products.push(p);
  }

  return {
    ok: true,
    cleaned: {
      name,
      telegram_group_id,
      status: status || null,
      products,
      removed_sr_nos,
    },
  };
}
