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
  'old setup': '199', 'Invincible set up (old)': '299', 'Invincible set up': '299',
  'Starter': '399', 'Premium': '499', 'VIP': '699',
  'Ad Account': '0', 'Only Pages': '99',
};

function parseAmount(val) {
  if (!val || val === '-' || val.toString().trim() === '-') return 0;
  let str = val.toString().trim();
  let cleaned = str.replace(/[^0-9.,\-]/g, '');
  if (!cleaned) return 0;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (cleaned.includes(',')) {
    if (/,\d{1,2}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  return parseFloat(cleaned) || 0;
}

function normalizeSrNo(srNo) {
  if (!srNo) return '';
  let cleaned = srNo.toString().trim();
  cleaned = cleaned.replace(/,/g, '.');
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx !== -1) {
    const mainPart = cleaned.substring(0, dotIdx).trim();
    const suffix = cleaned.substring(dotIdx + 1);
    const suffixMatch = suffix.match(/(-[A-Z0-9]+)$/i);
    return mainPart + (suffixMatch ? suffixMatch[1] : '');
  }
  return cleaned;
}

function normalizeClientName(name) {
  return (name || '')
    .replace(/^[🟢🔴🟡⚠️📌👑🥇]+\s*/g, '')
    .replace(/^\[(DC|ENT-\d+)\]\s*/gi, '')
    .replace(/\s*:\s*Tele\s*[-:\s]*\d+[A-Z]?\s*$/gi, '')
    .replace(/\s*\(Tele\s*[-:\s]*\d+[A-Z]?\)\s*$/gi, '')
    .replace(/\s*X\s+Prime\s+circle\s*$/gi, '')
    .replace(/\s*×\s*Prime\s+circle\s*$/gi, '')
    .replace(/x\s+Prime\s+circle\s*:\s*/gi, '')
    .toLowerCase()
    .trim();
}

function stripAdIdPrefix(val) {
  return (val || '')
    .replace(/^ID\s*:\s*/i, '')
    .replace(/^BM\s*ID\s*:\s*/i, '')
    .replace(/^FB\s*ID\s*:\s*/i, '')
    .replace(/^TikTok\s*ID\s*:\s*/i, '')
    .replace(/^.*[Ii][Dd]\s*:\s*/, '')
    .trim();
}

function buildSimulatedClients(headers, rows, mapping) {
  const clientNameIdx = mapping.client_name;
  const tierIdx = mapping.tier;
  const setupTypeIdx = mapping.setup_type;

  const headerSet = new Set(headers.map(h => (h || '').toString().trim().toUpperCase()));

  const clientGroups = {};
  const mappedIndices = Object.values(mapping).filter(v => v !== null && v !== undefined);
  const totalMapped = mappedIndices.length || headers.length;

  rows.forEach((row) => {
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

    const rawName = clientNameIdx !== null && clientNameIdx !== undefined
      ? (row[clientNameIdx] || '').toString().trim()
      : '';

    const srNoIdx = mapping.sr_no;
    const rawSrNo = srNoIdx !== null && srNoIdx !== undefined ? (row[srNoIdx] || '').toString().trim() : '';

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

  return Object.entries(clientGroups).map(([normalizedName, group], idx) => {
    const { rawName, rows: clientRows } = group;

    const paymentHistory = clientRows.map((row, rowIdx) => {
      const entry = { _rowIdx: rowIdx };
      Object.entries(mapping).forEach(([dbField, csvIdx]) => {
        if (csvIdx !== null && csvIdx !== undefined && dbField !== 'client_name') {
          let val = (row[csvIdx] || '').toString().trim();

          if (dbField === 'ad_id_number') {
            val = stripAdIdPrefix(val);
          }

          if (dbField === 'tier') {
            val = val.toUpperCase().replace(/\s+/g, ' ').trim();
            if (val.includes('INVINCIBLE') || val.includes('SETUP') || val.includes('SET UP')) {
              val = '';
            }
          }

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

      let resolvedSetup = (entry.setup_type || '').toString().trim();
      const feeNum = Math.round(entry.setup_fee || 0);
      const setupLower = resolvedSetup.toLowerCase();

      const isGenericOrOld = !resolvedSetup || 
                             setupLower === 'setup' || 
                             setupLower === 'set up' || 
                             setupLower.includes('account') || 
                             setupLower.includes('invincible');

      if (feeNum === 199 && isGenericOrOld) {
        resolvedSetup = 'old setup';
      } else if (feeNum === 299 && isGenericOrOld) {
        resolvedSetup = 'Invincible set up (old)';
      } else if (isGenericOrOld) {
        if (feeNum === 399) resolvedSetup = 'Starter';
        else if (feeNum === 499) resolvedSetup = 'Premium';
        else if (feeNum === 699) resolvedSetup = 'VIP';
        else if (feeNum === 99) resolvedSetup = 'Only Pages';
        else if (feeNum === 0) resolvedSetup = '';
      }
      entry.setup_type = resolvedSetup;

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
          key = tier ? `TIER_${tier}` : (rawSetup ? `SETUP_${rawSetup}` : 'MainProduct');
        }
      } else {
        if (tier) {
          key = `TIER_${tier}`;
        } else if (rawSetup) {
          key = `SETUP_${rawSetup}`;
        } else {
          key = Object.keys(productMap)[0] || 'MainProduct';
        }
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
        if (!productMap[key].setup_type && rawSetup && !isTopUpRow) {
          productMap[key].setup_type = rawSetup;
        }
        if (!isTopUpRow && !isUpgradeRow && (entry.setup_fee > 0 && (!productMap[key].firstRow.setup_fee || productMap[key].firstRow.setup_fee === 0))) {
          productMap[key].firstRow = entry;
        } else if (!isTopUpRow && !isUpgradeRow && entry.start_date && entry.start_date < productMap[key].firstRow.start_date) {
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
      const historySetupFee = p.history.find(h => h.setup_fee > 0)?.setup_fee || 0;
      if (firstRow.setup_fee > 0) setup_fee = firstRow.setup_fee;
      else if (historySetupFee > 0) setup_fee = historySetupFee;

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

      if (p.tier && p.setup_type) {
        const tierHistory = p.history
          .map(h => ({
            ...h,
            tier: p.tier,
            setup_type: '',
            amount_received: h.amount_received >= (subscription_fee + setup_fee) 
              ? subscription_fee 
              : Math.min(h.amount_received, subscription_fee),
          }))
          .filter(h => h.amount_received > 0);

        const setupHistory = p.history
          .map(h => ({
            ...h,
            tier: '',
            setup_type: p.setup_type,
            amount_received: h.amount_received >= (subscription_fee + setup_fee) 
              ? setup_fee 
              : Math.max(0, h.amount_received - subscription_fee),
          }))
          .filter(h => h.amount_received > 0);

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
          amount_received: tierHistory.reduce((s, h) => s + h.amount_received, 0),
          is_trial: p.is_trial,
          history: tierHistory,
          month: p.history[0]?.month || '',
          start_date: firstRow.start_date || '',
          valid_stopped_date: firstRow.valid_stopped_date || '',
          ad_spend_limit: TIER_SPEND_LIMITS[p.tier] || firstRow.ad_spend_limit || '',
          referral_partner_name: firstRow.referral_partner_name || '',
          discount: firstRow.discount || '',
          cl_amount: finalClAmount,
          ad_account_type: firstRow.ad_account_type || '',
        });

        products.push({
          sr_no: `SIM_${idx + 1}_${productIdx + 1}_SETUP`,
          tier: '',
          setup_type: p.setup_type,
          visual_status,
          client_status_history: p.latestStatus || 'New',
          subscription_fee: '0',
          setup_fee: setup_fee.toString(),
          ad_id_number: p.latestAdId || '',
          client_ad_id_name: p.latestAdIdName || '',
          amount_received: setupHistory.reduce((s, h) => s + h.amount_received, 0),
          is_trial: 0,
          history: setupHistory,
          month: p.history[0]?.month || '',
          start_date: firstRow.start_date || '',
          valid_stopped_date: firstRow.valid_stopped_date || '',
          ad_spend_limit: '',
          referral_partner_name: firstRow.referral_partner_name || '',
          discount: '',
          cl_amount: '0',
          ad_account_type: firstRow.ad_account_type || '',
        });
      } else {
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

    const filteredProducts = products.filter((p, i, arr) => {
      const subFee = parseFloat(p.subscription_fee || '0');
      const setupFee = parseFloat(p.setup_fee || '0');

      if (Boolean(p.setup_type) && !p.tier && setupFee === 0 && subFee === 0) {
        if (arr.length > 1) return false;
      }

      if (p.sr_no && p.sr_no.endsWith('_SETUP') && setupFee === 0) {
        return false;
      }

      return true;
    });

    const totalCA = filteredProducts.reduce((sum, p) => sum + p.amount_received, 0);
    const mrr = filteredProducts.reduce((sum, p) => sum + parseFloat(p.subscription_fee || 0) + parseFloat(p.setup_fee || 0), 0);
    const latestProduct = filteredProducts[filteredProducts.length - 1] || {};

    const firstRow = clientRows[0];
    const getField = (field) => {
      const idx = mapping[field];
      return idx !== null && idx !== undefined ? (firstRow[idx] || '').toString().trim() : '';
    };

    const email = getField('email');
    const telegram_group_id = getField('telegram_group_id');
    const company_name = getField('company_name');
    const notes = getField('notes');

    const hasActiveProduct = filteredProducts.some((h) => h.visual_status === 'Active');
    const statut = hasActiveProduct ? 'Active' : 'Inactive';

    const produits = filteredProducts.map((h) => h.tier || h.setup_type).filter(Boolean).join(', ') || '—';

    const parsingIssues = [];
    if (group.isUnparseable) {
      parsingIssues.push({ type: 'CRITICAL', field: 'Ligne CSV', message: 'Ligne ignorée : référence SrNo et Nom de client introuvables' });
    }
    if (!rawName || rawName === 'unnamed' || rawName === '—') {
      parsingIssues.push({ type: 'CRITICAL', field: 'Client Name', message: 'Nom de client manquant ou invalide' });
    }
    if (filteredProducts.length === 0) {
      parsingIssues.push({ type: 'CRITICAL', field: 'Products', message: 'Aucun produit ni TIER associé à ce client' });
    }
    filteredProducts.forEach((p, pIdx) => {
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
      productDetails: filteredProducts.map((h) => ({
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
      history: filteredProducts,
      computed: {
        totalSpend: 0,
        totalCA,
        renewalCount: filteredProducts.length,
        earliestStartDate: filteredProducts[0]?.start_date || null,
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
