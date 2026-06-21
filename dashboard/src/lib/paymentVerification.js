/**
 * Payment Verification Service
 * Semi-automated: verifies transaction existence and runs anti-fraud checks.
 * Does NOT auto-approve — human admin makes the final decision.
 */

import { all, get } from './db.js';

// ─── Config & Wallets ────────────────────────────────────────────────────────

// In-memory cache refreshed on first call
let _wallets = null;
let _slashAccounts = null;

async function getWallets() {
  if (_wallets) return _wallets;
  const banks = all('SELECT bank_key, data_json FROM bank_details');
  _wallets = {};
  for (const b of banks) {
    _wallets[b.bank_key] = JSON.parse(b.data_json || '{}');
  }
  // Also load env vars for API keys
  _wallets._env = {
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    whopApiKey: process.env.WHOP_API_KEY,
    whopCompanyId: process.env.WHOP_COMPANY_ID,
    slashApiKey: process.env.SLASH_API_KEY,
    slashLegalEntity1: process.env.SLASH_LEGAL_ENTITY_1,
    slashLegalEntity2: process.env.SLASH_LEGAL_ENTITY_2,
  };
  return _wallets;
}

async function getSlashAccounts() {
  if (_slashAccounts) return _slashAccounts;
  // Load SLASH_ACCOUNT_1, SLASH_ACCOUNT_2 from env
  _slashAccounts = [
    { key: 'SLASH_ACCOUNT_1', entity: process.env.SLASH_LEGAL_ENTITY_1 },
    { key: 'SLASH_ACCOUNT_2', entity: process.env.SLASH_LEGAL_ENTITY_2 },
  ].filter(a => a.entity);
  return _slashAccounts;
}

// ─── Provider Detection ───────────────────────────────────────────────────────

function detectProvider(bankName) {
  if (!bankName) return null;
  const bn = bankName.toLowerCase();
  if (bn.includes('erc20')) return 'etherscan';
  if (bn.includes('trc20')) return 'tronscan';
  if (bn.includes('btc') || bn.includes('bitcoin')) return 'blockstream';
  if (bn.includes('slash')) return 'slash';
  if (bn.includes('whop')) return 'whop';
  if (bn.includes('lhv')) return 'lhv'; // Not implemented yet
  return null;
}

// ─── Anti-Fraud Checks ────────────────────────────────────────────────────────

const FRESHNESS_HOURS = 48;

function runAntiFraudChecks({ txHash, foundAmount, expectedAmount, txDate, toAddress, ourWallet, rawData }) {
  const flags = [];

  // 1. Amount check
  if (foundAmount === null || foundAmount === undefined) {
    flags.push('MONTANT_NON_TROUVE');
  } else {
    const diff = Math.abs(foundAmount - expectedAmount);
    const tolerance = expectedAmount * 0.02; // 2% tolerance for fees
    if (diff > tolerance) {
      flags.push(`MONTANT_INCORRECT: trouvé ${foundAmount}, attendu ${expectedAmount}`);
    }
  }

  // 2. Freshness check
  if (txDate) {
    const txTime = new Date(txDate).getTime();
    const now = Date.now();
    const hoursDiff = (now - txTime) / (1000 * 60 * 60);
    if (hoursDiff > FRESHNESS_HOURS) {
      flags.push(`PAIEMENT_VIEUX: ${Math.round(hoursDiff)}h (max ${FRESHNESS_HOURS}h)`);
    }
  } else {
    flags.push('DATE_NON_TROUVEE');
  }

  // 3. Direction check (already filtered at API level, but double-check)
  if (toAddress && ourWallet && toAddress.toLowerCase() !== ourWallet.toLowerCase()) {
    flags.push(`DIRECTION_INCORRECTE: vers ${toAddress}, attendu ${ourWallet}`);
  }

  // 4. Deduplication — check if txHash already used in payments table
  if (txHash) {
    const existing = get(
      `SELECT sr_no FROM payments WHERE reference_no = ? UNION
       SELECT sr_no FROM renewals WHERE reference_no = ? LIMIT 1`,
      [txHash, txHash]
    );
    if (existing) {
      flags.push(`DEJA_UTILISE: tx ${txHash} déjà sur sr_no ${existing.sr_no}`);
    }
  }

  const isValid = flags.length === 0;
  return { isValid, flags };
}

// ─── Provider APIs ────────────────────────────────────────────────────────────

/**
 * Fetch with timeout and error handling
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (e) {
    clearTimeout(id);
    if (e.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
    throw e;
  }
}

/**
 * Etherscan — USDT ERC20
 * Endpoint: GET https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&contractaddress={CONTRACT}&address={WALLET}&apikey={KEY}
 * USDT contract: 0xdAC17F958D2ee523a2206206994597C13D831ec7
 * Montant: value / 1_000_000
 */
async function verifyEtherscan(txHash, wallet, expectedAmount, env) {
  const CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&contractaddress=${CONTRACT}&address=${wallet}&apikey=${env.etherscanApiKey}`;

  const data = await fetchWithTimeout(url);
  if (data.status !== '1' || !Array.isArray(data.result)) {
    return { status: 'ERROR', error: data.message || 'Etherscan API error' };
  }

  const tx = data.result.find(t => t.hash.toLowerCase() === txHash.toLowerCase());
  if (!tx) {
    return { status: 'NOT_FOUND' };
  }

  // Direction check: must be "to" our wallet
  if (tx.to.toLowerCase() !== wallet.toLowerCase()) {
    return {
      status: 'INVALID',
      foundAmount: parseInt(tx.value) / 1_000_000,
      txDate: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      txHash: tx.hash,
      toAddress: tx.to,
      fraudFlags: ['DIRECTION_INCORRECTE'],
    };
  }

  const foundAmount = parseInt(tx.value) / 1_000_000;
  const txDate = new Date(parseInt(tx.timeStamp) * 1000).toISOString();
  const result = runAntiFraudChecks({
    txHash: tx.hash,
    foundAmount,
    expectedAmount,
    txDate,
    toAddress: tx.to,
    ourWallet: wallet,
    rawData: tx,
  });

  return {
    status: result.isValid ? 'FOUND' : 'INVALID',
    foundAmount,
    txDate,
    txHash: tx.hash,
    toAddress: tx.to,
    fromAddress: tx.from,
    blockNumber: tx.blockNumber,
    fraudFlags: result.flags,
    rawData: tx,
  };
}

/**
 * Tronscan — USDT TRC20
 * Endpoint: GET https://apilist.tronscanapi.com/api/transfer/trc20?address={WALLET}&trc20Id={CONTRACT}&direction=0
 * USDT TRC20 contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
 * Montant: amount / 1_000_000
 * CRITICAL: direction=0 filters only INCOMING transactions
 */
async function verifyTronscan(txHash, wallet, expectedAmount, env) {
  const CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  // direction=0 = only incoming (to our wallet)
  const url = `https://apilist.tronscanapi.com/api/transfer/trc20?address=${wallet}&trc20Id=${CONTRACT}&direction=0&limit=100`;

  const data = await fetchWithTimeout(url);
  if (data.code !== 200 || !Array.isArray(data.data)) {
    return { status: 'ERROR', error: 'Tronscan API error' };
  }

  const tx = data.data.find(t => t.hash.toLowerCase() === txHash.toLowerCase());
  if (!tx) {
    return { status: 'NOT_FOUND' };
  }

  const foundAmount = parseInt(tx.amount) / 1_000_000;
  const txDate = new Date(tx.block_timestamp).toISOString();
  const result = runAntiFraudChecks({
    txHash: tx.hash,
    foundAmount,
    expectedAmount,
    txDate,
    toAddress: tx.to,
    ourWallet: wallet,
    rawData: tx,
  });

  return {
    status: result.isValid ? 'FOUND' : 'INVALID',
    foundAmount,
    txDate,
    txHash: tx.hash,
    toAddress: tx.to,
    fromAddress: tx.from,
    blockNumber: tx.block,
    fraudFlags: result.flags,
    rawData: tx,
  };
}

/**
 * Blockstream — Bitcoin
 * Endpoint: GET https://blockstream.info/api/tx/{tx_hash}
 * (we verify the tx exists and check outputs for our wallet)
 * Montant: value / 100_000_000 (satoshis -> BTC)
 */
async function verifyBlockstream(txHash, wallet, expectedAmount, env) {
  // First verify the tx exists
  const url = `https://blockstream.info/api/tx/${txHash}`;
  let tx;
  try {
    tx = await fetchWithTimeout(url);
  } catch (e) {
    if (e.message.includes('404') || e.message.includes('not found')) {
      return { status: 'NOT_FOUND' };
    }
    return { status: 'ERROR', error: e.message };
  }

  // Find the output that goes to our wallet
  const relevantOut = tx.vout?.find(v => v.scriptpubkey_address?.toLowerCase() === wallet.toLowerCase());
  if (!relevantOut) {
    return {
      status: 'INVALID',
      txDate: new Date(tx.status.block_time * 1000).toISOString(),
      txHash: tx.txid,
      fraudFlags: ['DIRECTION_INCORRECTE: aucune sortie vers notre wallet'],
      rawData: tx,
    };
  }

  const foundAmount = relevantOut.value / 100_000_000; // satoshis -> BTC
  const txDate = new Date(tx.status.block_time * 1000).toISOString();
  const result = runAntiFraudChecks({
    txHash: tx.txid,
    foundAmount,
    expectedAmount,
    txDate,
    toAddress: relevantOut.scriptpubkey_address,
    ourWallet: wallet,
    rawData: tx,
  });

  return {
    status: result.isValid ? 'FOUND' : 'INVALID',
    foundAmount,
    txDate,
    txHash: tx.txid,
    toAddress: relevantOut.scriptpubkey_address,
    fromAddress: tx.vin?.[0]?.prevout?.scriptpubkey_address || null,
    blockNumber: tx.status.block_height,
    fraudFlags: result.flags,
    rawData: tx,
  };
}

/**
 * Slash Bank
 * Endpoint: GET https://api.joinslash.com/transaction
 * Headers: X-API-Key, x-legal-entity
 * Montant: amountCents / 100
 * Status must be: settled (not pending)
 */
async function verifySlash(txHash, expectedAmount, env) {
  // Try both legal entities
  const entities = [env.slashLegalEntity1, env.slashLegalEntity2].filter(Boolean);

  for (const legalEntity of entities) {
    const url = 'https://api.joinslash.com/transaction';
    try {
      const data = await fetchWithTimeout(url, {
        headers: {
          'X-API-Key': env.slashApiKey,
          'x-legal-entity': legalEntity,
        },
      });

      if (!data.items) continue;

      const tx = data.items.find(t => t.id === txHash);
      if (!tx) continue;

      // Check it's a settled incoming payment (positive amount)
      if (tx.amountCents <= 0) {
        return {
          status: 'INVALID',
          foundAmount: tx.amountCents / 100,
          txDate: tx.date,
          txHash: tx.id,
          fraudFlags: ['MONTANT_NEGATIF_OU_ZERO'],
          rawData: tx,
        };
      }

      if (tx.detailedStatus !== 'settled') {
        return {
          status: 'INVALID',
          foundAmount: tx.amountCents / 100,
          txDate: tx.date,
          txHash: tx.id,
          fraudFlags: [`STATUT_NON_SETTLED: ${tx.detailedStatus}`],
          rawData: tx,
        };
      }

      const foundAmount = tx.amountCents / 100;
      const txDate = tx.date;
      const result = runAntiFraudChecks({
        txHash: tx.id,
        foundAmount,
        expectedAmount,
        txDate,
        toAddress: null, // Slash doesn't expose counterparty wallet
        ourWallet: null,
        rawData: tx,
      });

      return {
        status: result.isValid ? 'FOUND' : 'INVALID',
        foundAmount,
        txDate,
        txHash: tx.id,
        memo: tx.memo,
        fraudFlags: result.flags,
        rawData: tx,
      };
    } catch (e) {
      console.error(`[verifySlash] entity ${legalEntity} failed:`, e.message);
    }
  }

  return { status: 'NOT_FOUND' };
}

/**
 * WHOP
 * Endpoint: GET https://api.whop.com/api/v1/payments?company_id={ID}
 * Headers: Authorization: Bearer {KEY}
 * Status must be: "paid"
 */
async function verifyWhop(txHash, expectedAmount, env) {
  const url = `https://api.whop.com/api/v1/payments?company_id=${env.whopCompanyId}`;
  const data = await fetchWithTimeout(url, {
    headers: {
      'Authorization': `Bearer ${env.whopApiKey}`,
    },
  });

  if (!data.data || !Array.isArray(data.data)) {
    return { status: 'ERROR', error: 'WHOP API error' };
  }

  const tx = data.data.find(p => p.id === txHash);
  if (!tx) {
    return { status: 'NOT_FOUND' };
  }

  if (tx.status !== 'paid') {
    return {
      status: 'INVALID',
      foundAmount: tx.total ? tx.total / 100 : null,
      txDate: tx.paid_at,
      txHash: tx.id,
      fraudFlags: [`STATUT_NON_PAID: ${tx.status}`],
      rawData: tx,
    };
  }

  const foundAmount = tx.total ? tx.total / 100 : null;
  const txDate = tx.paid_at;
  const result = runAntiFraudChecks({
    txHash: tx.id,
    foundAmount,
    expectedAmount,
    txDate,
    toAddress: null,
    ourWallet: null,
    rawData: tx,
  });

  return {
    status: result.isValid ? 'FOUND' : 'INVALID',
    foundAmount,
    txDate,
    txHash: tx.id,
    user: tx.user,
    fraudFlags: result.flags,
    rawData: tx,
  };
}

// ─── Main Verify Function ────────────────────────────────────────────────────

/**
 * Verify a transaction for a given payment.
 *
 * @param {string} txHash - Transaction hash / ID submitted by client
 * @param {string} bankName - Bank/payment method name (e.g. "Crypto - USDT ERC20")
 * @param {number} expectedAmount - Expected payment amount in USD
 * @param {string} clientId - Client ID for deduplication check
 * @returns {Promise<object>} Verification result
 */
export async function verifyTransaction(txHash, bankName, expectedAmount, clientId) {
  if (!txHash || !bankName) {
    return { status: 'ERROR', error: 'Missing txHash or bankName' };
  }

  const wallets = await getWallets();
  const env = wallets._env;
  const provider = detectProvider(bankName);

  if (!provider) {
    return { status: 'ERROR', error: `Unknown provider for bank: ${bankName}` };
  }

  // LHV not implemented
  if (provider === 'lhv') {
    return { status: 'ERROR', error: 'LHV verification not yet implemented (IMAP/Gmail parsing TBD)' };
  }

  let result;
  let ourWallet = null;

  try {
    switch (provider) {
      case 'etherscan':
        ourWallet = wallets.crypto?.usdt_erc20;
        if (!ourWallet) return { status: 'ERROR', error: 'Wallet USDT ERC20 not configured' };
        result = await verifyEtherscan(txHash, ourWallet, expectedAmount, env);
        break;

      case 'tronscan':
        ourWallet = wallets.crypto?.usdt_trc20;
        if (!ourWallet) return { status: 'ERROR', error: 'Wallet USDT TRC20 not configured' };
        result = await verifyTronscan(txHash, ourWallet, expectedAmount, env);
        break;

      case 'blockstream':
        ourWallet = wallets.crypto?.btc;
        if (!ourWallet) return { status: 'ERROR', error: 'Wallet BTC not configured' };
        result = await verifyBlockstream(txHash, ourWallet, expectedAmount, env);
        break;

      case 'slash':
        result = await verifySlash(txHash, expectedAmount, env);
        break;

      case 'whop':
        result = await verifyWhop(txHash, expectedAmount, env);
        break;

      default:
        return { status: 'ERROR', error: `Provider ${provider} not implemented` };
    }
  } catch (e) {
    console.error(`[verifyTransaction] ${provider} error:`, e);
    return { status: 'ERROR', error: e.message };
  }

  return {
    provider,
    txHash,
    bankName,
    expectedAmount,
    checkedAt: new Date().toISOString(),
    ...result,
  };
}

/**
 * Format a verification result for dashboard display.
 */
export function formatVerificationDisplay(result) {
  if (!result || result.status === 'ERROR') {
    return { badge: '⚪', text: `Erreur: ${result?.error || 'Inconnu'}`, color: 'gray' };
  }

  if (result.status === 'NOT_FOUND') {
    return { badge: '🟠', text: `Transaction non trouvée sur le réseau`, color: 'orange' };
  }

  if (result.status === 'INVALID' || result.fraudFlags?.length > 0) {
    const flagText = result.fraudFlags.join(' | ');
    return {
      badge: '🔴',
      text: `Invalide: ${flagText}${result.foundAmount ? ` (trouvé: ${result.foundAmount})` : ''}`,
      color: 'red',
      foundAmount: result.foundAmount,
      txDate: result.txDate,
    };
  }

  // FOUND + no flags = valid
  const dateStr = result.txDate
    ? new Date(result.txDate).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
    : 'date inconnue';
  return {
    badge: '🟢',
    text: `Vérifié: ${result.foundAmount} USD${result.provider === 'blockstream' ? ' BTC' : result.provider === 'etherscan' || result.provider === 'tronscan' ? ' USDT' : ''} — ${dateStr}`,
    color: 'green',
    foundAmount: result.foundAmount,
    txDate: result.txDate,
  };
}
