// csvParser.js - NO imports/exports, for use with new Function()

const TIER_PRICING = {
  'TIER 1': '199', 'TIER 2': '299', 'TIER 3': '499',
  'TIER 4': '799', 'TIER 5': '1399', 'TIER 6': '1999',
};

const TIER_SPEND_LIMITS = {
  'TIER 1': '2500',
  'TIER 2': '5000',
  'TIER 3': '10000',
  'TIER 4': '20000',
  'TIER 5': '40000',
  'TIER 6': 'Unlimited',
};

const SETUP_PRICING = {
  'Invincible set up (old)': '299', 'Invincible set up': '299',
  'Starter': '399', 'Premium': '499', 'VIP': '699',
  'Ad Account': '0', 'Only Pages': '99',
};

function parseAmount(val) {
  if (!val || val === '-' || val.toString().trim() === '-') return 0;
  let str = val.toString().trim();
  // Remove currency symbols, spaces, etc. Keep only digits, commas, dots, minus
  let cleaned = str.replace(/[^0-9.,\-]/g, '');
  if (!cleaned) return 0;

  // Handle standard US format: 5,000.00 -> 5000.00 or European format: 5.000,00 -> 5000.00
  // If there are both comma and dot:
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
      // US format: 5,000.00 -> remove commas
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // European format: 5.000,00 -> remove dots, replace comma with dot
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (cleaned.includes(',')) {
    // Only comma present: if followed by 1 or 2 digits at end, assume decimal separator (e.g., 483,16 -> 483.16)
    // otherwise if followed by 3 digits, assume thousands separator (e.g. 5,000 -> 5000)
    if (/,\d{1,2}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  return parseFloat(cleaned) || 0;
}

function normalizeClientName(name) {
  return (name || '')
    .replace(/^[🟢🔴🟡⚠️📌]+\s*/g, '')
    .replace(/^\[DC\]\s*/gi, '')
    .replace(/\s*:\s*Tele\s+\d+\s*$/g, '')
    .replace(/\s*X\s+Prime\s+circle\s*$/gi, '')
    .replace(/\s*×\s*Prime\s+circle\s*$/gi, '')
    .replace(/x\s+Prime\s+circle\s*:\s*/gi, '')
    .trim();
}

function stripAdIdPrefix(val) {
  return (val || '')
    .replace(/^ID\s*:\s*/i, '')
    .replace(/^BM\s*ID\s*:\s*/i, '')
    .replace(/^FB\s*ID\s*:\s*/i, '')
    .replace(/^TikTok\s*ID\s*:\s*/i, '')
    .replace(/^.*[Ii][Dd]\s*:\s*/, '') // catch-all for anything like "ID: 123" or "Ad ID: 123"
    .trim();
}

function buildSimulatedClients(headers, rows, mapping) {
  const clientNameIdx = mapping.client_name;
  const tierIdx = mapping.tier;
  const setupTypeIdx = mapping.setup_type;

  // Build set of header values for fast lookup (to skip separator rows)
  const headerSet = new Set(headers.map(h => (h || '').toString().trim().toUpperCase()));

  // Group rows by client
  const clientGroups = {};
  rows.forEach((row) => {
    // Skip separator/header rows: if most cells match column headers, it's a separator
    let headerMatchCount = 0;
    for (let i = 0; i < row.length; i++) {
      const cell = (row[i] || '').toString().trim().toUpperCase();
      if (cell && headerSet.has(cell)) headerMatchCount++;
    }
    if (row.length > 0 && headerMatchCount > row.length * 0.5) return;

    // Skip rows where tier column matches a header row name or "TIER"
    if (tierIdx !== null && tierIdx !== undefined) {
      const tierVal = (row[tierIdx] || '').toString().trim();
      const tierUpper = tierVal.toUpperCase();
      if (tierUpper === 'TIER' || (tierUpper && headerSet.has(tierUpper) && tierUpper.length > 5)) return;
    }

    const rawName = clientNameIdx !== null && clientNameIdx !== undefined
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

  return Object.entries(clientGroups).map(([normalizedName, group], idx) => {
    const { rawName, rows: clientRows } = group;
    const firstRow = clientRows[0];

    // Collect all payment history entries (one per row/month)
    const paymentHistory = clientRows.map((row, rowIdx) => {
      const entry = { _rowIdx: rowIdx };
      Object.entries(mapping).forEach(([dbField, csvIdx]) => {
        if (csvIdx !== null && csvIdx !== undefined && dbField !== 'client_name') {
          let val = (row[csvIdx] || '').toString().trim();

          // Strip prefixes from ad_id_number
          if (dbField === 'ad_id_number') {
            val = stripAdIdPrefix(val);
          }

          // Normalize tier
          if (dbField === 'tier') {
            val = val.toUpperCase().replace(/\s+/g, ' ').trim();
          }

          // Parse amounts to numbers (ad_spend_limit is kept as string to preserve values like "2500")
          if (dbField === 'amount_received' || dbField === 'subscription_fee' ||
              dbField === 'setup_fee' ||
              dbField === 'referral_amount' || dbField === 'discount' ||
              dbField === 'cl_amount' || dbField === 'actual_balance_difference') {
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

    // Group by product key: group rows into products
    // Detect permanent upgrades (client_status_history = 'upgrade' or 'upgraded')
    const productMap = {};
    paymentHistory.forEach((entry) => {
      const tier = entry.tier || '';
      const rawSetup = (entry.setup_type || '').toString().trim();
      const setupClean = rawSetup.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isTopUpRow = setupClean === 'topup';

      const statusClean = (entry.client_status_history || '').toString().trim().toLowerCase();
      const isUpgradeRow = statusClean === 'upgrade' || statusClean === 'upgraded';

      // Find existing product key
      let key;
      if (isTopUpRow || isUpgradeRow) {
        // For Top-up or Upgrade, attach to an existing product for this client
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
        // Keep the earliest row (for start_date, valid_until) if not topup
        if (!isTopUpRow && !isUpgradeRow && entry.start_date && entry.start_date < productMap[key].firstRow.start_date) {
          productMap[key].firstRow = entry;
        }
      }

      const previousTier = productMap[key].tier;
      // If this row is an upgrade and tier changed (e.g. TIER 1 -> TIER 5), update current tier of the product
      if (isUpgradeRow && tier && tier !== previousTier) {
        productMap[key].tier = tier;
      }

      // Calculate expected fee for this row (subscription + setup from CSV row or pricing tables)
      const currentTier = tier || previousTier;
      const csvSubFee = entry.subscription_fee > 0 ? entry.subscription_fee : (currentTier && TIER_PRICING[currentTier] ? parseFloat(TIER_PRICING[currentTier]) : 0);
      const csvSetupFee = entry.setup_fee > 0 ? entry.setup_fee : (entry.setup_type && SETUP_PRICING[entry.setup_type] ? parseFloat(SETUP_PRICING[entry.setup_type]) : 0);
      const totalExpectedFee = csvSubFee + csvSetupFee;

      let amount = entry.amount_received || 0;
      // Fee tolerance adjustment: if amount is slightly below expected fee (>=90% or <=$25 gap), normalize amount to full expected fee
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

      // Track latest values (use most recent non-empty)
      if (entry.client_status_history) {
        productMap[key].latestStatus = entry.client_status_history;
      }
      if (entry.ad_id_number) {
        productMap[key].latestAdId = entry.ad_id_number;
      }
      if (entry.client_ad_id_name) {
        productMap[key].latestAdIdName = entry.client_ad_id_name;
      }
      if (entry.visual_status) {
        productMap[key].latestVisualStatus = entry.visual_status;
      }

      // Trial flag
      if (entry.client_status_history && entry.client_status_history.toLowerCase() === 'trial') {
        productMap[key].is_trial = 1;
      }
    });

    // Build products array
    const products = Object.values(productMap).map((p, productIdx) => {
      const firstRow = p.firstRow;
      const isTrial = p.is_trial === 1;

      // subscription_fee: TIER_PRICING if not trial, otherwise 0
      let subscription_fee = 0;
      if (!isTrial && p.tier && TIER_PRICING[p.tier]) {
        subscription_fee = parseFloat(TIER_PRICING[p.tier]);
      }
      // If CSV has non-zero value and not trial, use it
      if (!isTrial && firstRow.subscription_fee > 0) {
        subscription_fee = firstRow.subscription_fee;
      }

      // setup_fee from pricing or CSV
      let setup_fee = p.setup_type && SETUP_PRICING[p.setup_type] ? parseFloat(SETUP_PRICING[p.setup_type]) : 0;
      if (firstRow.setup_fee > 0) setup_fee = firstRow.setup_fee;

      // Use visual_status directly from CSV if available (Active/Stopped), otherwise fall back to deriving from client_status_history
      const rawVisualStatus = (p.latestVisualStatus || '').toLowerCase();
      console.log('[DEBUG] rawVisualStatus:', rawVisualStatus, 'latestStatus:', p.latestStatus);
      let visual_status = 'Inactive';
      if (rawVisualStatus === 'active') {
        visual_status = 'Active';
      } else if (rawVisualStatus === 'stopped') {
        visual_status = 'Inactive';
      } else {
        // Fall back to deriving from client_status_history
        visual_status = ['new', 'renewed', 'upgraded', 'replacement', 'trial'].includes((p.latestStatus || '').toLowerCase())
          ? 'Active' : 'Inactive';
      }

      // Check if ad_account_type is CL (Credit Line)
      const adAccountTypeClean = (firstRow.ad_account_type || '').toString().trim().toUpperCase();
      const isCL = adAccountTypeClean.includes('CL') || adAccountTypeClean.includes('CREDIT');

      // Calculate total topup sum and surplus payment over expected fee for CL accounts
      let surplusSum = 0;
      const topupSum = p.history.reduce((sum, h) => {
        const st = (h.setup_type || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (st === 'topup') {
          return sum + (h.amount_received || 0);
        }
        // For non-topup payments on CL accounts, if amount_received > subscription_fee + setup_fee, add difference to CL
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

      return {
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
        // Extra fields from first row
        month: p.history[0]?.month || '',
        start_date: firstRow.start_date || '',
        valid_stopped_date: firstRow.valid_stopped_date || '',
        // Ad spend limit: prioritize DB limit for the tier (e.g. TIER 6 -> Unlimited), fallback to CSV value
        ad_spend_limit: TIER_SPEND_LIMITS[p.tier] || firstRow.ad_spend_limit || '',
        referral_partner_name: firstRow.referral_partner_name || '',
        discount: firstRow.discount || '',
        cl_amount: finalClAmount,
        ad_account_type: firstRow.ad_account_type || '',
      };
    });

    // Sort products: tier products first, then setup
    products.sort((a, b) => {
      const aIsTier = a.tier.startsWith('TIER');
      const bIsTier = b.tier.startsWith('TIER');
      if (aIsTier && !bIsTier) return -1;
      if (!aIsTier && bIsTier) return 1;
      return 0;
    });

    // Client-level fields from first row
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

    const latestProduct = products[0] || {};
    const hasActiveProduct = products.some(p => p.visual_status === 'Active');
    const statut = hasActiveProduct ? 'Active' : 'Inactive';

    const produits = products.map(p => p.tier || p.setup_type).filter(Boolean).join(', ') || '—';

    const totalCA = products.reduce((sum, p) => sum + parseAmount(p.amount_received), 0);
    const mrr = products.reduce((sum, p) => sum + parseAmount(p.subscription_fee) + parseAmount(p.setup_fee), 0);

    // Detect parsing issues & anomalies for human validation
    const parsingIssues = [];

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
      p.history.forEach((h, hIdx) => {
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
      productDetails: products.map(p => ({
        tier: p.tier || '',
        setup_type: p.setup_type || '',
        is_trial: p.is_trial || 0,
        current_spend: p.history.reduce((s, h) => s + h.amount_received, 0).toString(),
        ad_spend_limit: p.ad_spend_limit || '0',
        subscription_fee: p.subscription_fee || '0',
        setup_fee: p.setup_fee || '0',
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
        nextRenewalDate: products[0]?.valid_stopped_date || null,
        latestTier: latestProduct.tier || null,
        latestSetupType: latestProduct.setup_type || null,
        isInvincible: products.some(p => (p.setup_type || '').toLowerCase().includes('invincible')),
        isStable: false,
        healthStatus: 'healthy',
      },
    };
  });
}
