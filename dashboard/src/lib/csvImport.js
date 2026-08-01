import Papa from 'papaparse';
import { COLUMNS, RENEWAL_COLUMNS } from './sheetSchema';
import { TIER_PRICING, SETUP_PRICING, TIER_SPEND_LIMITS } from './whopLinks';

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
      skipEmptyLines: 'greedy',
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

export function normalizeSrNo(srNo) {
  if (!srNo) return '';
  let cleaned = srNo.toString().trim();
  cleaned = cleaned.replace(/,/g, '');
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx !== -1) {
    const mainPart = cleaned.substring(0, dotIdx);
    const suffix = cleaned.substring(dotIdx + 1);
    const suffixMatch = suffix.match(/(-[A-Z0-9]+)$/i);
    return mainPart + (suffixMatch ? suffixMatch[1] : '');
  }
  return cleaned;
}

export function normalizeClientName(name) {
  return (
    (name || '')
      .replace(/^[🟢🔴🟡⚠️📌👑🥇]+\s*/g, '')
      .replace(/^\[(DC|ENT-\d+)\]\s*/gi, '')
      .replace(/\s*:\s*Tele\s*[-:\s]*\d+[A-Z]?\s*$/gi, '')
      .replace(/\s*\(Tele\s*[-:\s]*\d+[A-Z]?\)\s*$/gi, '')
      .replace(/\s*X\s+Prime\s+circle\s*$/gi, '')
      .replace(/\s*×\s+Prime\s+circle\s*$/gi, '')
      .replace(/x\s+Prime\s+circle\s*:\s*/gi, '')
      .toLowerCase()
      .trim()
  );
}

export function buildSimulatedClients(headers, rows, mapping) {
  const clientNameIdx = mapping.client_name;
  const tierIdx = mapping.tier;

  const headerSet = new Set(headers.map(h => (h || '').toString().trim().toUpperCase()));

  const clientGroups = {};
  const mappedIndices = Object.values(mapping).filter(v => v !== null && v !== undefined);
  const totalMapped = mappedIndices.length || headers.length;

  rows.forEach((row) => {
    // 1. Skip rows where less than 30% of mapped columns are filled (false positive rows / empty noise)
    let filledCount = 0;
    mappedIndices.forEach(idx => {
      if (row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
        filledCount++;
      }
    });
    if (totalMapped > 0 && (filledCount / totalMapped) < 0.30) {
      return;
    }

    let headerMatchCount = 0;
    for (let i = 0; i < row.length; i++) {
      const cell = (row[i] || '').toString().trim().toUpperCase();
      if (cell && headerSet.has(cell)) headerMatchCount++;
    }
    if (row.length > 0 && headerMatchCount > row.length * 0.5) return;

    if (tierIdx !== null && tierIdx !== undefined) {
      const tierVal = (row[tierIdx] || '').toString().trim();
      if (tierVal.toUpperCase() === 'TIER') return;
    }

    const srNoIdx = mapping.sr_no;
    const rawSrNo = srNoIdx !== null && srNoIdx !== undefined ? (row[srNoIdx] || '').toString().trim() : '';

    const rawName = clientNameIdx !== null && clientNameIdx !== undefined
      ? (row[clientNameIdx] || '').toString().trim()
      : '';

    let groupKey = '';
    const normSrNo = normalizeSrNo(rawSrNo);
    if (normSrNo) {
      groupKey = `SR_${normSrNo}`;
    } else if (rawName) {
      const normalizedName = normalizeClientName(rawName);
      if (normalizedName) {
        groupKey = `NAME_${normalizedName}`;
      }
    }

    if (!groupKey) {
      groupKey = `UNPARSED_ROW_${Math.random().toString(36).slice(2)}`;
    }

    if (!clientGroups[groupKey]) {
      clientGroups[groupKey] = { rawName: rawName || (rawSrNo ? `Client ${rawSrNo}` : 'Ligne CSV non identifiée'), rows: [], isUnparseable: !normSrNo && !rawName };
    }
    if (rawName && (!clientGroups[groupKey].rawName || clientGroups[groupKey].rawName.startsWith('Client ') || clientGroups[groupKey].rawName.startsWith('Ligne '))) {
      clientGroups[groupKey].rawName = rawName;
    }
    clientGroups[groupKey].rows.push(row);
  });

  const TIER_PRICING = {
    'TIER 1': '199', 'TIER 2': '299', 'TIER 3': '499',
    'TIER 4': '799', 'TIER 5': '1399', 'TIER 6': '1999',
  };

  const SETUP_PRICING = {
    'Invincible set up (old)': '299', 'Invincible set up': '299',
    'Starter': '399', 'Premium': '499', 'VIP': '699',
    'Ad Account': '0', 'Only Pages': '99',
  };

  return Object.entries(clientGroups).map(([normalizedName, group], idx) => {
    const { rawName, rows: clientRows } = group;

    const paymentHistory = clientRows.map((row, rowIdx) => {
      const entry = { _rowIdx: rowIdx };
      Object.entries(mapping).forEach(([dbField, csvIdx]) => {
        if (csvIdx !== null && csvIdx !== undefined && dbField !== 'client_name') {
          let val = (row[csvIdx] || '').toString().trim();
          if (dbField === 'tier') {
            val = val.toUpperCase().replace(/\s+/g, ' ').trim();
          }
          if (dbField === 'amount_received' || dbField === 'subscription_fee' ||
              dbField === 'setup_fee' || dbField === 'referral_amount' ||
              dbField === 'discount' || dbField === 'cl_amount' || dbField === 'actual_balance_difference') {
            entry[dbField] = parseAmount(val);
          } else {
            entry[dbField] = val;
          }
        }
      });

      // EXCEPTION: If setup_type is Top-up, override client_status_history to Top-up
      const setupClean = (entry.setup_type || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (setupClean === 'topup') {
        entry.client_status_history = 'Top-up';
      }

      return entry;
    });

    const productMap = {};
    paymentHistory.forEach((entry) => {
      const tier = entry.tier || '';
      const rawSetup = (entry.setup_type || '').toString().trim();
      const setupClean = rawSetup.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isTopUpRow = setupClean === 'topup';

      const statusClean = (entry.client_status_history || '').toString().trim().toLowerCase();
      const isUpgradeRow = statusClean === 'upgrade' || statusClean === 'upgraded';

      let key;
      if (isTopUpRow || isUpgradeRow) {
        const existingKey = Object.keys(productMap)[0];
        if (existingKey) {
          key = existingKey;
        } else {
          key = tier ? (tier + '|' + (isTopUpRow ? '' : rawSetup)) : 'MainProduct';
        }
      } else {
        key = tier ? (tier + '|' + rawSetup) : (rawSetup || 'MainProduct');
      }

      if (!productMap[key]) {
        productMap[key] = {
          tier: tier || '',
          setup_type: isTopUpRow ? '' : rawSetup,
          history: [],
          latestStatus: '',
          latestAdId: '',
          latestAdIdName: '',
          latestVisualStatus: '',
          is_trial: 0,
          firstRow: entry,
        };
      } else {
        if (!isTopUpRow && !isUpgradeRow && entry.start_date && entry.start_date < productMap[key].firstRow.start_date) {
          productMap[key].firstRow = entry;
        }
      }

      const previousTier = productMap[key].tier;
      if (isUpgradeRow && tier && tier !== previousTier) {
        productMap[key].tier = tier;
      }

      const currentTier = tier || previousTier;
      const csvSubFee = entry.subscription_fee > 0 ? entry.subscription_fee : (currentTier && TIER_PRICING[currentTier] ? parseFloat(TIER_PRICING[currentTier]) : 0);
      const csvSetupFee = entry.setup_fee > 0 ? entry.setup_fee : (entry.setup_type && SETUP_PRICING[entry.setup_type] ? parseFloat(SETUP_PRICING[entry.setup_type]) : 0);
      const totalExpectedFee = csvSubFee + csvSetupFee;

      let amount = entry.amount_received || 0;
      if (totalExpectedFee > 0 && amount < totalExpectedFee && !isTopUpRow) {
        if (amount >= totalExpectedFee * 0.90 || (totalExpectedFee - amount) <= 25) {
          amount = totalExpectedFee;
        }
      }

      productMap[key].history.push({
        month: entry.month || '',
        payment_date: entry.payment_received_date || '',
        amount_received: amount,
        reference_no: entry.reference_no || '',
        bank_name: entry.bank_name || '',
        payment_name: entry.payment_name || '',
        actual_balance_difference: entry.actual_balance_difference || 0,
        client_status_history: entry.client_status_history || '',
        setup_type: entry.setup_type || '',
        tier: currentTier,
        from_tier: isUpgradeRow ? (previousTier || tier) : undefined,
        to_tier: isUpgradeRow ? tier : undefined,
        is_upgrade: isUpgradeRow,
      });

      if (entry.client_status_history) productMap[key].latestStatus = entry.client_status_history;
      if (entry.ad_id_number) productMap[key].latestAdId = entry.ad_id_number;
      if (entry.client_ad_id_name) productMap[key].latestAdIdName = entry.client_ad_id_name;
      if (entry.visual_status) productMap[key].latestVisualStatus = entry.visual_status;
      if (entry.client_status_history && entry.client_status_history.toLowerCase() === 'trial') productMap[key].is_trial = 1;
    });

    const products = [];
    Object.values(productMap).forEach((p, productIdx) => {
      const firstRow = p.firstRow;
      const isTrial = p.is_trial === 1;

      let subscription_fee = 0;
      if (!isTrial && p.tier && TIER_PRICING[p.tier]) subscription_fee = parseFloat(TIER_PRICING[p.tier]);
      if (!isTrial && firstRow.subscription_fee > 0) subscription_fee = firstRow.subscription_fee;

      let setup_fee = p.setup_type && SETUP_PRICING[p.setup_type] ? parseFloat(SETUP_PRICING[p.setup_type]) : 0;
      if (firstRow.setup_fee > 0) setup_fee = firstRow.setup_fee;

      const rawVisualStatus = (p.latestVisualStatus || '').toLowerCase();
      let visual_status = 'Inactive';
      if (rawVisualStatus === 'active') visual_status = 'Active';
      else if (rawVisualStatus === 'stopped') visual_status = 'Inactive';
      else visual_status = ['new', 'renewed', 'upgraded', 'replacement', 'trial'].includes((p.latestStatus || '').toLowerCase()) ? 'Active' : 'Inactive';

      const adAccountTypeClean = (firstRow.ad_account_type || '').toString().trim().toUpperCase();
      const isCL = adAccountTypeClean.includes('CL') || adAccountTypeClean.includes('CREDIT');

      let surplusSum = 0;
      const topupSum = p.history.reduce((sum, h) => {
        const st = (h.setup_type || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (st === 'topup') return sum + (h.amount_received || 0);

        if (isCL) {
          const rowTierPrice = TIER_PRICING[h.tier || p.tier] ? parseFloat(TIER_PRICING[h.tier || p.tier]) : subscription_fee;
          const rowSetupPrice = h.setup_type && SETUP_PRICING[h.setup_type] ? parseFloat(SETUP_PRICING[h.setup_type]) : 0;
          const expectedFee = rowTierPrice + rowSetupPrice;
          const amt = h.amount_received || 0;
          if (amt > expectedFee && expectedFee > 0) {
            surplusSum += (amt - expectedFee);
          }
        }
        return sum;
      }, 0);

      const csvClAmount = parseFloat(firstRow.cl_amount || '0') || 0;
      const finalClAmount = (csvClAmount + topupSum + surplusSum).toString();

      // If row has BOTH a tier AND a setup_type, split into 2 separate products
      if (p.tier && p.setup_type) {
        // 1. Tier Product
        products.push({
          sr_no: `SIM_${idx + 1}_${productIdx + 1}_TIER`,
          tier: p.tier,
          setup_type: '',
          visual_status,
          client_status_history: p.latestStatus,
          subscription_fee: subscription_fee.toString(),
          setup_fee: '0',
          ad_id_number: p.latestAdId,
          client_ad_id_name: p.latestAdIdName || '',
          amount_received: p.history.reduce((s, h) => s + h.amount_received, 0),
          is_trial: p.is_trial,
          history: p.history,
          month: p.history[0]?.month || '',
          start_date: firstRow.start_date || '',
          valid_stopped_date: firstRow.valid_stopped_date || '',
          ad_spend_limit: TIER_SPEND_LIMITS[p.tier] || firstRow.ad_spend_limit || '',
          referral_partner_name: firstRow.referral_partner_name || '',
          discount: firstRow.discount || '',
          cl_amount: finalClAmount,
          ad_account_type: firstRow.ad_account_type || '',
        });

        // 2. Setup Product
        products.push({
          sr_no: `SIM_${idx + 1}_${productIdx + 1}_SETUP`,
          tier: '',
          setup_type: p.setup_type,
          visual_status: 'Active',
          client_status_history: 'New',
          subscription_fee: '0',
          setup_fee: setup_fee.toString(),
          ad_id_number: '',
          client_ad_id_name: '',
          amount_received: setup_fee,
          is_trial: 0,
          history: [],
          month: p.history[0]?.month || '',
          start_date: firstRow.start_date || '',
          valid_stopped_date: '',
          ad_spend_limit: '',
          referral_partner_name: firstRow.referral_partner_name || '',
          discount: '',
          cl_amount: '0',
          ad_account_type: '',
        });
      } else {
        // Single product (either Tier only or Setup only)
        products.push({
          sr_no: `SIM_${idx + 1}_${productIdx + 1}`,
          tier: p.tier,
          setup_type: p.setup_type,
          visual_status,
          client_status_history: p.latestStatus,
          subscription_fee: subscription_fee.toString(),
          setup_fee: setup_fee.toString(),
          ad_id_number: p.latestAdId,
          client_ad_id_name: p.latestAdIdName || '',
          amount_received: p.history.reduce((s, h) => s + h.amount_received, 0),
          is_trial: p.is_trial,
          history: p.history,
          month: p.history[0]?.month || '',
          start_date: firstRow.start_date || '',
          valid_stopped_date: firstRow.valid_stopped_date || '',
          ad_spend_limit: TIER_SPEND_LIMITS[p.tier] || firstRow.ad_spend_limit || '',
          referral_partner_name: firstRow.referral_partner_name || '',
          discount: firstRow.discount || '',
          cl_amount: finalClAmount,
          ad_account_type: firstRow.ad_account_type || '',
        });
      }
    });

    const totalCA = products.reduce((sum, p) => sum + p.amount_received, 0);
    const mrr = products.reduce((sum, p) => sum + parseFloat(p.subscription_fee || 0) + parseFloat(p.setup_fee || 0), 0);
    const latestProduct = products[products.length - 1] || {};

    const firstRow = clientRows[0];
    const getField = (field) => {
      const idx = mapping[field];
      return idx !== null && idx !== undefined ? (firstRow[idx] || '').toString().trim() : '';
    };

    const email = getField('email');
    const telegram_group_id = getField('telegram_group_id');
    const company_name = getField('company_name');
    const notes = getField('notes');

    const hasActiveProduct = products.some((h) => h.visual_status === 'Active');
    const statut = hasActiveProduct ? 'Active' : 'Inactive';

    const produits = products.map((h) => h.tier || h.setup_type).filter(Boolean).join(', ') || '—';

    const parsingIssues = [];
    if (group.isUnparseable) {
      parsingIssues.push({ type: 'CRITICAL', field: 'Ligne CSV', message: 'Ligne ignorée : référence SrNo et Nom de client introuvables' });
    }
    if (!rawName || rawName === 'unnamed' || rawName === '—') {
      parsingIssues.push({ type: 'CRITICAL', field: 'Client Name', message: 'Nom de client manquant ou invalide' });
    }
    if (products.length === 0) {
      parsingIssues.push({ type: 'CRITICAL', field: 'Products', message: 'Aucun produit ni TIER associé à ce client' });
    }
    products.forEach((p, pIdx) => {
      const pName = p.tier || p.setup_type || `Produit ${pIdx + 1}`;
      if (!p.tier && !p.setup_type) {
        parsingIssues.push({ type: 'WARNING', field: 'Product', message: `Produit ${pIdx + 1}: TIER ou Setup Type non spécifié` });
      }
      (p.history || []).forEach((h, hIdx) => {
        const rawDate = (h.payment_date || '').toString().trim();
        const hasPlaceholder = !rawDate || rawDate === '-' || rawDate === '—' || rawDate === 'N/A';
        if (hasPlaceholder && !h.month) {
          parsingIssues.push({ type: 'WARNING', field: 'Date', message: `${pName}: Date ou mois manquant pour la ligne de paiement ${hIdx + 1}` });
        } else if (!hasPlaceholder && isNaN(new Date(rawDate).getTime())) {
          parsingIssues.push({ type: 'WARNING', field: 'Date', message: `${pName}: Format de date invalide ("${rawDate}")` });
        }
        if (h.amount_received === undefined || h.amount_received === null) {
          parsingIssues.push({ type: 'WARNING', field: 'Amount', message: `${pName}: Montant reçu manquant à la ligne ${hIdx + 1}` });
        }
      });
    });

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
      parsingIssues,
      hasIssues: parsingIssues.length > 0,
      productDetails: products.map((h) => ({
        tier: h.tier || '',
        setup_type: h.setup_type || '',
        is_trial: h.is_trial || 0,
        current_spend: '0',
        ad_spend_limit: h.ad_spend_limit || '0',
        subscription_fee: h.subscription_fee || '0',
        setup_fee: h.setup_fee || '0',
      })),
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
      history: products,
      computed: {
        totalSpend: 0,
        totalCA,
        renewalCount: products.length,
        earliestStartDate: products[0]?.start_date || null,
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
      sr_no: 'sr_no', srno: 'sr_no', sr_no_: 'sr_no', sr: 'sr_no', s_no: 'sr_no', sl_no: 'sr_no',
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
