import Papa from 'papaparse';
import { COLUMNS, RENEWAL_COLUMNS } from './sheetSchema';

export const MAPPABLE_FIELDS = [
  {
    group: 'Client Info',
    fields: [
      { key: 'client_name', label: 'Client Name', required: true },
      { key: 'email', label: 'Email' },
      { key: 'telegram_group_id', label: 'Telegram Group ID' },
      { key: 'address', label: 'Address' },
      { key: 'company_name', label: 'Company Name' },
      { key: 'company_number', label: 'Company Number' },
      { key: 'client_owner', label: 'Client Owner' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  {
    group: 'Product',
    fields: [
      { key: 'sr_no', label: 'Sr No (row identifier)' },
      { key: 'month', label: 'Month (e.g. Jun-2026)' },
      { key: 'start_date', label: 'Start Date' },
      { key: 'valid_stopped_date', label: 'Valid / Stopped Date' },
      { key: 'tier', label: 'Tier (TIER 1-6)' },
      { key: 'setup_type', label: 'Setup Type' },
      { key: 'ad_spend_limit', label: 'Ad Spend Limit' },
      { key: 'subscription_fee', label: 'Subscription Fee' },
      { key: 'setup_fee', label: 'Setup Fee' },
      { key: 'discount', label: 'Discount' },
      { key: 'cl_amount', label: 'CL Amount' },
      { key: 'client_ad_id_name', label: 'Client Ad ID Name' },
      { key: 'ad_id_number', label: 'Ad ID Number' },
      { key: 'ad_account_type', label: 'Ad Account Type' },
      { key: 'visual_status', label: 'Visual Status (Active/Inactive)' },
      { key: 'client_status_history', label: 'Client Status (New/Trial/Renewed/Upgraded)' },
    ],
  },
  {
    group: 'Payment',
    fields: [
      { key: 'bank_name', label: 'Bank Name' },
      { key: 'payment_name', label: 'Payment Name (WHOP account)' },
      { key: 'amount_received', label: 'Amount Received' },
      { key: 'payment_received_date', label: 'Payment Received Date' },
      { key: 'payment_received_month', label: 'Payment Received Month' },
      { key: 'reference_no', label: 'Reference No (WHOP payment ID)' },
      { key: 'actual_balance_difference', label: 'Actual Balance Difference' },
    ],
  },
  {
    group: 'Referral',
    fields: [
      { key: 'referral_partner_name', label: 'Referral Partner Name' },
      { key: 'referral_amount', label: 'Referral Amount' },
    ],
  },
  {
    group: 'Status',
    fields: [
      { key: 'trustpilot_reviewed', label: 'Trustpilot Reviewed (true/false)' },
      { key: 'churn_reason', label: 'Churn Reason' },
    ],
  },
];

export const ALL_MAPPABLE_KEYS = MAPPABLE_FIELDS.flatMap((g) => g.fields.map((f) => f.key));

const MAPPING_STORAGE_KEY = 'csv_column_mapping';

export function parseCSV(file, headerRowIndex = 0) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }
        const rows = results.data;
        const headerRow = rows[headerRowIndex];
        if (!headerRow) {
          reject(new Error(`CSV does not have a row ${headerRowIndex + 1} for headers`));
          return;
        }
        resolve({
          headers: headerRow.map((h) => String(h || '').trim()),
          rows: rows.slice(headerRowIndex + 1),
        });
      },
      error: (err) => reject(err),
    });
  });
}

export function parseAmount(val) {
  if (!val || val === '-' || val.toString().trim() === '-') return 0;
  return parseFloat(val.toString().replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

export function formatCurrency(val) {
  return '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function normalizeClientName(name) {
  return (
    (name || '')
      .replace(/^[🟢🔴🟡⚠️📌]+\s*/g, '')
      .replace(/^\[DC\]\s*/gi, '')
      .replace(/\s*:\s*Tele\s+\d+\s*$/g, '')
      .replace(/\s*X\s+Prime\s+circle\s*$/gi, '')
      .replace(/\s*×\s+Prime\s+circle\s*$/gi, '')
      .replace(/x\s+Prime\s+circle\s*:\s*/gi, '')
      .trim()
  );
}

export function buildSimulatedClients(headers, rows, mapping) {
  const clientNameIdx = mapping.client_name;

  const clientGroups = {};
  rows.forEach((row) => {
    const rawName =
      clientNameIdx !== null && clientNameIdx !== undefined
        ? (row[clientNameIdx] || '').toString().trim()
        : '';
    if (!rawName) return;

    const normalizedName = normalizeClientName(rawName);
    if (!normalizedName) return;

    if (!clientGroups[normalizedName]) {
      clientGroups[normalizedName] = { rawName, rows: [] };
    }
    clientGroups[normalizedName].rows.push(row);
  });

  const TIER_PRICING = {
    'TIER 1': '199',
    'TIER 2': '299',
    'TIER 3': '499',
    'TIER 4': '799',
    'TIER 5': '1399',
    'TIER 6': '1999',
  };

  const SETUP_PRICING = {
    'Invincible set up (old)': '299',
    'Invincible set up': '299',
    'Starter': '399',
    'Premium': '499',
    'VIP': '699',
    'Ad Account': '0',
    'Only Pages': '99',
  };

  return Object.entries(clientGroups).map(([normalizedName, group], idx) => {
    const { rawName, rows: clientRows } = group;
    const firstRow = clientRows[0];

    const history = clientRows.map((row, productIdx) => {
      const product = {};
      Object.entries(mapping).forEach(([dbField, csvIdx]) => {
        if (csvIdx !== null && csvIdx !== undefined && dbField !== 'client_name') {
          product[dbField] = (row[csvIdx] || '').toString().trim();
        }
      });

      if (!product.sr_no) {
        product.sr_no = `SIM_${idx + 1}_${productIdx + 1}`;
      }

      if (!product.visual_status && product.client_status_history) {
        const status = product.client_status_history.toLowerCase();
        if (['new', 'renewed', 'upgraded', 'replacement', 'trial'].includes(status)) {
          product.visual_status = 'Active';
        }
      }

      if (!product.subscription_fee && product.tier && TIER_PRICING[product.tier]) {
        product.subscription_fee = TIER_PRICING[product.tier];
      }

      if (!product.setup_fee && product.setup_type && SETUP_PRICING[product.setup_type]) {
        product.setup_fee = SETUP_PRICING[product.setup_type];
      }

      if (product.client_status_history && product.client_status_history.toLowerCase() === 'trial') {
        product.is_trial = 1;
      } else {
        product.is_trial = 0;
      }

      return product;
    });

    const totalCA = history.reduce((sum, p) => sum + parseAmount(p.amount_received), 0);
    const mrr = history.reduce(
      (sum, p) => sum + parseAmount(p.subscription_fee) + parseAmount(p.setup_fee),
      0
    );
    const latestProduct = history[history.length - 1] || {};

    const getField = (field) => {
      const idx = mapping[field];
      return idx !== null && idx !== undefined
        ? (firstRow[idx] || '').toString().trim()
        : '';
    };

    const email = getField('email');
    const telegram_group_id = getField('telegram_group_id');
    const company_name = getField('company_name');
    const notes = getField('notes');

    const hasActiveProduct = history.some((h) => h.visual_status === 'Active');
    const statut = hasActiveProduct ? 'Active' : 'Inactive';

    // DEBUG: log product count to detect fallback usage
    console.warn(`[csvImport.js fallback] Client "${rawName}" has ${history.length} history rows (products)`);

    const produits = history
      .map((h) => h.tier || h.setup_type)
      .filter(Boolean)
      .join(', ') || '—';

    const productDetails = history.map((h) => ({
      tier: h.tier || '',
      setup_type: h.setup_type || '',
      is_trial: h.is_trial || 0,
      current_spend: h.current_spend || '0',
      ad_spend_limit: h.ad_spend_limit || '0',
      subscription_fee: h.subscription_fee || '0',
      setup_fee: h.setup_fee || '0',
    }));

    return {
      id: -(idx + 1),
      pd_id: -(idx + 1) + 1000,
      nom: rawName,
      email: email || 'No contact',
      telegram_group_id: telegram_group_id || null,
      tele_id: null,
      parsed_tele_id: null,
      tele_id_conflict: false,
      produits,
      productDetails,
      mensuel: mrr,
      statut,
      canal: latestProduct.bank_name || '—',
      renouvellement: '—',
      anciennete: 'New',
      client: {
        id: -(idx + 1),
        name: rawName,
        email: email || '',
        telegram_group_id: telegram_group_id || '',
        status: statut === 'Active' ? 'Actif' : 'inactif',
        first_name: '',
        last_name: '',
        address: '',
        company_name,
        notes,
        referral_partner_name: latestProduct.referral_partner_name || '',
      },
      history,
      computed: {
        totalSpend: 0,
        totalCA,
        renewalCount: history.length,
        earliestStartDate: history[0]?.start_date || null,
        nextRenewalDate: latestProduct.valid_stopped_date || null,
        latestTier: latestProduct.tier || null,
        latestSetupType: latestProduct.setup_type || null,
        isInvincible: (latestProduct.setup_type || '').toLowerCase().includes('invincible'),
        isStable: false,
        healthStatus: 'healthy',
      },
    };
  });
}

export function autoDetectMapping(headers) {
  const detected = new Array(headers.length).fill(null);

  headers.forEach((header, idx) => {
    if (!header) return;
    const h = header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const fieldMap = {
      client_name: 'client_name', clientname: 'client_name', name: 'client_name', client: 'client_name',
      email: 'email', e_mail: 'email',
      telegram: 'telegram_group_id', telegram_group_id: 'telegram_group_id', chat_id: 'telegram_group_id',
      tier: 'tier', product_tier: 'tier',
      setup_type: 'setup_type', setup: 'setup_type',
      month: 'month', subscription_month: 'month',
      start_date: 'start_date', startdate: 'start_date', subscription_start: 'start_date',
      valid_stopped_date: 'valid_stopped_date', valid_until: 'valid_stopped_date', validity: 'valid_stopped_date', end_date: 'valid_stopped_date',
      subscription_fee: 'subscription_fee', subscription: 'subscription_fee', fee: 'subscription_fee', price: 'subscription_fee',
      setup_fee: 'setup_fee', setupfee: 'setup_fee',
      discount: 'discount',
      bank_name: 'bank_name', bank: 'bank_name', payment_method: 'bank_name',
      payment_name: 'payment_name', whop_account: 'payment_name',
      amount_received: 'amount_received', amount: 'amount_received', payment_received: 'amount_received',
      reference_no: 'reference_no', reference: 'reference_no', ref_no: 'reference_no',
      ad_spend_limit: 'ad_spend_limit', spend_limit: 'ad_spend_limit', ad_spend: 'ad_spend_limit',
      ad_id_number: 'ad_id_number', ad_id: 'ad_id_number',
      client_ad_id_name: 'client_ad_id_name', ad_name: 'client_ad_id_name',
      ad_account_type: 'ad_account_type', account_type: 'ad_account_type',
      referral_partner_name: 'referral_partner_name', referral_partner: 'referral_partner_name', partner: 'referral_partner_name', referral: 'referral_partner_name',
      referral_amount: 'referral_amount',
      client_status_history: 'client_status_history', client_status: 'client_status_history',
      visual_status: 'visual_status', status_active: 'visual_status', ' _status': 'visual_status', status: 'visual_status',
      notes: 'notes', comments: 'notes',
      company_name: 'company_name',
      company_number: 'company_number',
      cl_amount: 'cl_amount',
      sr_no: 'sr_no',
      address: 'address',
      client_owner: 'client_owner',
      actual_balance_difference: 'actual_balance_difference',
      payment_received_date: 'payment_received_date',
      payment_received_month: 'payment_received_month',
      trustpilot_reviewed: 'trustpilot_reviewed',
      churn_reason: 'churn_reason',
    };

    if (fieldMap[h]) {
      detected[idx] = fieldMap[h];
    }
  });

  return detected;
}

export function saveMapping(mapping) {
  try {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping));
  } catch (e) {
    console.warn('Failed to save column mapping:', e);
  }
}

export function loadMapping() {
  try {
    const stored = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn('Failed to load column mapping:', e);
  }
  return null;
}

export function clearMapping() {
  try {
    localStorage.removeItem(MAPPING_STORAGE_KEY);
  } catch (e) {}
}
