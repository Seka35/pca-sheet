// Telegram bot singleton — long-polling inside the Next.js Node process.
// Imported by src/instrumentation.js (boot) and by API routes (test send).

import 'server-only';
import { all, get, run } from './db.js';
import { startSweepTimer, stopSweepTimer, getConfig, upsertConfig } from './botScheduler.js';
import { extractTeleId } from './teleIdParser.js';
import { buildCreateClientKeyboard, buildPaymentReminderKeyboard, buildPaymentMethodKeyboard, buildPaymentDetailsKeyboard, buildTopupProductKeyboard, buildTopupAmountKeyboard, parseCallbackData } from './telegramInlineButtons.js';
import { createClient } from './clientCreator.js';

let bot = null;
let isShuttingDown = false;

export function getBot() {
  return bot || globalThis.__pcaBot || null;
}

export function isBotRunning() {
  return !!bot;
}

// Re-export scheduler helpers so API routes can import everything from a single entrypoint.
export { getConfig, upsertConfig, startSweepTimer, stopSweepTimer };

function normName(s) {
  return String(s || '').trim().toLowerCase();
}

// Store a Telegram group message to the database for the admin chat UI.
function storeTelegramMessage(msg) {
  try {
    const chatId = String(msg.chat?.id || '');
    if (!chatId) return;

    const link = get(
      `SELECT client_id FROM bot_group_links WHERE chat_id = ? AND status = 'linked' LIMIT 1`,
      [chatId]
    );
    const from = msg.from || {};
    const photo = msg.photo?.[msg.photo.length - 1];
    const doc = msg.document;

    let fileType = null, fileId = null;
    if (photo) {
      fileType = 'photo';
      fileId = photo.file_id;
    } else if (doc) {
      fileType = 'document';
      fileId = doc.file_id;
    }

    run(
      `INSERT OR IGNORE INTO telegram_messages
        (message_id, chat_id, client_id, user_id, username, first_name, last_name,
         text, file_id, file_type, file_caption, date, is_bot, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.message_id,
        chatId,
        link?.client_id || null,
        String(from.id || ''),
        from.username || null,
        from.first_name || null,
        from.last_name || null,
        msg.text || null,
        fileId,
        fileType,
        msg.caption || null,
        msg.date,
        from.is_bot ? 1 : 0,
        JSON.stringify(msg),
      ]
    );
  } catch (e) {
    console.error('[storeTelegramMessage] error:', e.message);
  }
}

// Linking logic — called by /start (auto-match by group title) and /link
// (explicit name match). The Tele ID, when present in the group title, takes
// priority over the full-name match because it's much more reliable
// (emojis, "X Prime circle:" prefixes, "(...)" suffixes, casing variations
// all break exact-name matching).
async function linkGroupByTitle(chatId, chatTitle) {
  const title = String(chatTitle || '').trim();
  // Upsert the row.
  run(
    `INSERT INTO bot_group_links (chat_id, chat_title, status, last_seen_at)
     VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT(chat_id) DO UPDATE SET
       chat_title = excluded.chat_title,
       last_seen_at = CURRENT_TIMESTAMP`,
    [chatId, title]
  );

  // 1) Tele ID match — primary path.
  const teleId = extractTeleId(title);
  if (teleId) {
    const teleMatches = all(
      `SELECT id, name, telegram_group_id FROM clients
        WHERE tele_id = ? AND status = 'Actif'`,
      [teleId]
    );
    if (teleMatches.length > 0) {
      // Link the group to ALL clients with this tele_id (they share the same group)
      for (const m of teleMatches) {
        finalizeLink(chatId, m);
      }
      return; // All clients linked
    }
    // Tele ID found in title but no client in DB has it. The seller has
    // explicitly tagged the group, so auto-create silently (header-only —
    // they add products from the dashboard later).
    return await silentAutoCreate(chatId, title, teleId);
  }

  // 2) Fallback: exact case-insensitive match on the full name.
  const matches = all(
    `SELECT id, name, telegram_group_id FROM clients
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
        AND status = 'Actif'`,
    [title]
  );

  if (matches.length === 1) return finalizeLink(chatId, matches[0]);
  if (matches.length === 0) {
    // No client at all matches the group name — auto-create silently
    // with tele_id=null (the human can add "Tele NNN" via the dashboard).
    return await silentAutoCreate(chatId, title, null);
  }
  // Multiple matches: ambiguous, fall back to /link for explicit disambiguation.
  // In this case we don't auto-create — just return (no message sent).
  return;
}

// Persist a pending auto-create proposal in bot_group_links.
// (The interactive proposal UI is deprecated — auto-create is now silent.)
function proposeAutoCreate(chatId, title, teleId) {
  console.error('[DEBUG] proposeAutoCreate called! This should NOT happen! chatId=', chatId);
  const safeTitle = String(title || '').trim() || '(unnamed group)';
  const safeTele = teleId ? String(teleId) : null;

  run(
    `INSERT INTO bot_group_links (chat_id, chat_title, status, last_seen_at,
                                  pending_create_name, pending_create_tele_id)
     VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET
       chat_title = excluded.chat_title,
       last_seen_at = CURRENT_TIMESTAMP,
       pending_create_name = excluded.pending_create_name,
       pending_create_tele_id = excluded.pending_create_tele_id`,
    [chatId, safeTitle, safeTitle, safeTele]
  );
}

// Silently auto-create a client without sending any message to the group.
// Called when /start is issued and no matching client exists.
async function silentAutoCreate(chatId, title, teleId) {
  const safeTitle = String(title || '').trim() || '(unnamed group)';
  try {
    const result = await createClient({
      name: safeTitle,
      telegramGroupId: String(chatId),
      products: [],
      source: 'bot-auto-create',
    });
    if (result.ok && result.client_id) {
      finalizeLink(chatId, { id: result.client_id, name: safeTitle });
    } else {
      console.warn('[bot] silentAutoCreate failed:', result.error);
    }
  } catch (e) {
    console.error('[bot] silentAutoCreate exception:', e.message);
  }
}

// Link by explicit Tele ID — used by /link <number> when the seller
// already knows the number (e.g. they just renamed the group).
function linkGroupByTeleId(chatId, teleId) {
  // Same upsert as linkGroupByTitle so /link refreshes last_seen_at.
  run(
    `INSERT INTO bot_group_links (chat_id, chat_title, status, last_seen_at)
     VALUES (?, '', 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT(chat_id) DO UPDATE SET
       last_seen_at = CURRENT_TIMESTAMP`,
    [chatId]
  );

  const match = get(
    `SELECT id, name, telegram_group_id FROM clients
      WHERE tele_id = ? AND status = 'Actif' LIMIT 1`,
    [teleId]
  );
  if (!match) {
    return {
      reply:
        `❓ No client in the dashboard has Tele ID <code>${escapeHtml(teleId)}</code>.\n\n` +
        `Check the Clients page — the Tele ID is parsed from each client's group name in the Sheet. ` +
        `If a client is missing the ID, the group title in the Sheet probably doesn't contain "Tele NNN".`,
    };
  }
  return finalizeLink(chatId, match);
}

function linkGroupExplicit(chatId, name) {
  const matches = all(
    `SELECT id, name, telegram_group_id FROM clients
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
        AND status = 'Actif'`,
    [name]
  );
  if (matches.length === 0) {
    const suggestions = all(
      `SELECT name FROM clients
        WHERE status = 'Actif' AND LOWER(name) LIKE ? LIMIT 5`,
      ['%' + name.toLowerCase() + '%']
    );
    return {
      reply:
        `❓ No client named "<b>${escapeHtml(name)}</b>".\n\n` +
        (suggestions.length > 0
          ? `Did you mean:\n${suggestions.map((s) => '  • ' + s.name).join('\n')}\n`
          : ''),
    };
  }
  if (matches.length > 1) {
    return {
      reply:
        `⚠️ Multiple clients match "<b>${escapeHtml(name)}</b>":\n` +
        matches.map((c) => '  • ' + c.name).join('\n') +
        `\nPlease be more specific.`,
    };
  }
  return finalizeLink(chatId, matches[0]);
}

function finalizeLink(chatId, client) {
  run(
    `UPDATE bot_group_links
        SET client_id = ?, status = 'linked', linked_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`,
    [client.id, chatId]
  );
  // Update the legacy column if it's still empty (first link wins).
  run(
    `UPDATE clients SET telegram_group_id = ?
      WHERE id = ? AND (telegram_group_id IS NULL OR telegram_group_id = '')`,
    [chatId, client.id]
  );
  return {
    reply: '',
  };
}

function unlinkGroup(chatId) {
  const row = get('SELECT client_id FROM bot_group_links WHERE chat_id = ?', [chatId]);
  run(
    `UPDATE bot_group_links SET status = 'archived' WHERE chat_id = ?`,
    [chatId]
  );
  // If no other linked group exists for this client, null the legacy column.
  if (row && row.client_id) {
    const remaining = get(
      `SELECT 1 AS hit FROM bot_group_links
        WHERE client_id = ? AND status = 'linked' AND chat_id <> ?`,
      [row.client_id, chatId]
    );
    if (!remaining) {
      run('UPDATE clients SET telegram_group_id = NULL WHERE id = ?', [row.client_id]);
    }
  }
  return { reply: '' };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Handle inline-keyboard button clicks.
//   pay_now → show payment method selection
//   select_payment → show payment details with Already Paid button
//   cancel_payment → cancel and acknowledge
//   already_paid → initiate DM flow for TX ID
//   remind_later → snooze
//   create_client / cancel_create → client creation flow
async function handleCallbackQuery(query, TelegramBotInstance) {
  const parsed = parseCallbackData(query.data || '');
  if (!parsed.action) {
    await TelegramBotInstance.answerCallbackQuery(query.id);
    return;
  }

  // ── Helper: get renewal + bank info ────────────────────────────────────────
  async function sendDM(userId, renewal, msg) {
    try {
      await TelegramBotInstance.sendMessage(userId, msg, { parse_mode: 'HTML' });
      await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'DM sent! Check your private messages.', show_alert: false });
    } catch (e) {
      const errMsg = e?.response?.body?.description || e?.message || '';
      if (errMsg.includes('bot was blocked') || errMsg.includes('user not found')) {
        await TelegramBotInstance.answerCallbackQuery(query.id, { text: '⚠️ Please start the bot first: find @hugoprime_bot and send /start', show_alert: true });
      } else {
        await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'DM sent! Check your private messages.', show_alert: false });
      }
    }
  }

  // ── Payment buttons ────────────────────────────────────────────────────────
  if (parsed.action === 'pay_now') {
    const { srNo, chatId } = parsed;
    const renewal = get('SELECT r.*, c.tele_id FROM renewals r JOIN clients c ON c.id = r.client_id WHERE r.sr_no = ?', [srNo]);
    if (!renewal) {
      await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Renewal not found.', show_alert: true });
      return;
    }

    const bankKey = (renewal.bank_name || '').toLowerCase().replace(/\s+/g, '_');
    const bankNames = { crypto: 'Crypto', lhv: 'AS LHV Pank', slash: 'Slash Bank', whop: 'WHOP' };
    const bankLabel = bankNames[bankKey] || renewal.bank_name || 'Payment';

    // Calculate total due: subscription + setup - discount
    const subAmt = parseFloat(String(renewal.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
    const setupAmt = parseFloat(String(renewal.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
    const discAmt = parseFloat(String(renewal.discount || '0').replace(/[^0-9.]/g, '')) || 0;
    const totalDue = (subAmt + setupAmt - discAmt).toFixed(2);

    const msg =
      `💳 <b>${escapeHtml(renewal.client_name)}</b> — choose your payment method\n\n` +
      `Amount: <b>$${totalDue}</b>\n` +
      `Bank: <b>${escapeHtml(bankLabel)}</b>\n\n` +
      `Select how you want to pay:`;

    const keyboard = buildPaymentMethodKeyboard(srNo, chatId, bankKey);
    // Send a new message instead of editing (more reliable for document messages)
    await TelegramBotInstance.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: JSON.stringify(keyboard.reply_markup),
    });
    await TelegramBotInstance.answerCallbackQuery(query.id);
    return;
  }

  if (parsed.action === 'select_payment') {
    const { srNo, chatId, method } = parsed;
    console.error('[bot] select_payment, srNo=', srNo, 'chatId=', chatId, 'method=', method);
    const renewal = get('SELECT r.*, c.tele_id FROM renewals r JOIN clients c ON c.id = r.client_id WHERE r.sr_no = ?', [srNo]);
    if (!renewal) {
      await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Renewal not found.', show_alert: true });
      return;
    }

    // Get bank details from DB - use the SELECTED method to find the right bank
    const banks = all('SELECT bank_key, bank_name, data_json FROM bank_details');
    // Map method to bank_key: crypto methods -> 'crypto', lhv -> 'lhv', slash -> 'slash', whop -> 'whop'
    const methodToBankKey = {
      usdt_trc20: 'crypto',
      usdt_erc20: 'crypto',
      btc: 'crypto',
      lhv: 'lhv',
      slash: 'slash',
      whop: 'whop',
    };
    const bankKeyToUse = methodToBankKey[method] || 'crypto';
    const bank = banks.find(b => b.bank_key === bankKeyToUse);
    const bankData = bank ? JSON.parse(bank.data_json || '{}') : {};

    // Store the selection
    let address = '';
    if (method === 'usdt_trc20') address = bankData.usdt_trc20 || '';
    else if (method === 'usdt_erc20') address = bankData.usdt_erc20 || '';
    else if (method === 'btc') address = bankData.btc || '';
    else if (method === 'lhv') address = `IBAN: ${bankData.iban || ''}\nBIC: ${bankData.bic_swift || ''}\nAccount: ${bankData.account_title || ''}`;
    else if (method === 'slash') address = `Account: ${bankData.account_number || ''}\nRouting: ${bankData.routing || ''}\nSWIFT: ${bankData.swift_bic || ''}`;
    else if (method === 'whop') {
      // Get WHOP links using the referral partner from renewal
      const { getWhopLink } = await import('./whopLinks.js');
      const referralPartner = renewal.referral_partner_name || 'N.A.';
      const tier = renewal.tier || 'TIER 1';
      const setupType = renewal.setup_type || '';

      // Get tier payment link
      const tierLink = getWhopLink({ referralPartner, tier, linkType: 'tier' }) || 'https://whop.com/wcaftm-llc/';

      // Get setup link if setup_type exists
      let setupLink = '';
      if (setupType) {
        const setupLinks = {
          'Starter': 'https://whop.com/wcaftm-llc/pca-set-up-starter',
          'Premium': 'https://whop.com/wcaftm-llc/pca-set-up-premium',
          'VIP': 'https://whop.com/wcaftm-llc/pca-set-up-premium-4a',
        };
        setupLink = setupLinks[setupType] || '';
      }

      address = `🌐 WHOP Payment:\n\n` +
        `Tier (${tier}):\n${tierLink}`;
      if (setupLink) {
        address += `\n\nSetup (${setupType}):\n${setupLink}`;
      }
    }

    // Save selection
    run(
      `INSERT INTO payment_selections (sr_no, chat_id, method, address)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sr_no, chat_id) DO UPDATE SET method = excluded.method, address = excluded.address, selected_at = CURRENT_TIMESTAMP`,
      [srNo, chatId, method, address]
    );

    // Also update bank_name on the renewal to reflect the chosen method
    const bankNameMap = {
      usdt_trc20: 'Crypto - USDT TRC20',
      usdt_erc20: 'Crypto - USDT ERC20',
      btc: 'Crypto - BTC',
      lhv: 'LHV - SEPA',
      slash: 'Slash - US Wire',
      whop: 'WHOP'
    };
    const bankNameForRenewal = bankNameMap[method] || method;
    run(`UPDATE renewals SET bank_name = ? WHERE sr_no = ?`, [bankNameForRenewal, srNo]);

    const methodLabels = {
      usdt_trc20: '🟡 USDT (TRC20)',
      usdt_erc20: '🔵 USDT (ERC20)',
      btc: '🟠 Bitcoin (BTC)',
      lhv: '🏦 Bank Transfer (SEPA/IBAN)',
      slash: '🏦 Bank Transfer (US)',
      whop: '🌐 WHOP Subscription',
    };
    const methodLabel = methodLabels[method] || method;

    // Build QR code for crypto addresses
    let qrLine = '';
    if (['usdt_trc20', 'usdt_erc20', 'btc'].includes(method) && address) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(address)}`;
      qrLine = `\n\n📱 <a href="${qrUrl}">QR Code</a>`;
    }

    const feeNote = bankKeyToUse === 'crypto' && bankData.fee_note ? `\n\n⚠️ ${bankData.fee_note}` : '';

    // Check if this is a topup flow — use stored topup_amount if available
    const pendingTopup = get(
      `SELECT topup_amount FROM pending_payments
       WHERE sr_no = ? AND chat_id = ? AND step = 'AWAIT_TOPUP_AMOUNT'`,
      [srNo, chatId]
    );
    let totalDue;
    if (pendingTopup && pendingTopup.topup_amount) {
      totalDue = pendingTopup.topup_amount;
    } else {
      // Calculate total due from renewal fees
      const subAmt = parseFloat(String(renewal.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
      const setupAmt = parseFloat(String(renewal.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
      const discAmt = parseFloat(String(renewal.discount || '0').replace(/[^0-9.]/g, '')) || 0;
      totalDue = (subAmt + setupAmt - discAmt).toFixed(2);
    }

    const msg =
      `💳 <b>Payment Details</b>\n\n` +
      `Method: <b>${methodLabel}</b>\n` +
      `Amount: <b>$${totalDue}</b>\n\n` +
      `<pre>${escapeHtml(address)}</pre>${qrLine}${feeNote}`;

    const keyboard = buildPaymentDetailsKeyboard(srNo, chatId);
    // Send as a new message (more reliable than editing document messages)
    await TelegramBotInstance.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: JSON.stringify(keyboard.reply_markup),
    });
    await TelegramBotInstance.answerCallbackQuery(query.id);
    return;
  }

  if (parsed.action === 'cancel_payment') {
    const { srNo, chatId } = parsed;
    const renewal = get('SELECT r.* FROM renewals r WHERE r.sr_no = ?', [srNo]);
    await TelegramBotInstance.editMessageText(
      `❌ <b>Payment cancelled.</b>\n\n` +
      `<b>${escapeHtml(renewal?.client_name || '')}</b> — you can pay whenever you're ready. Use /status to check your balance.`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML' }
    );
    await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Cancelled.', show_alert: false });
    return;
  }

  if (parsed.action === 'already_paid') {
    const { srNo, chatId } = parsed;
    const fromId = String(query.from.id);
    const renewal = get('SELECT r.*, c.tele_id FROM renewals r JOIN clients c ON c.id = r.client_id WHERE r.sr_no = ?', [srNo]);
    if (!renewal) {
      await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Renewal not found.', show_alert: true });
      return;
    }

    // Clean up old entries if resubmitting after a rejection
    run(`DELETE FROM approval_queue WHERE sr_no = ?`, [srNo]);
    run(`DELETE FROM payment_proofs WHERE sr_no = ?`, [srNo]);

    // Store pending payment state — will be resolved when user replies with TX ID
    // Check if this is a topup flow (preserve topup_amount if it exists)
    const existingTopup = get(
      `SELECT topup_amount FROM pending_payments WHERE sr_no = ? AND chat_id = ? AND step = 'AWAIT_TOPUP_AMOUNT'`,
      [srNo, chatId]
    );
    run(
      `INSERT INTO pending_payments (sr_no, client_id, tele_id, chat_id, step, transaction_id, topup_amount)
       VALUES (?, ?, ?, ?, 'AWAIT_TX', NULL, ?)
       ON CONFLICT(sr_no, chat_id) DO UPDATE SET
         step = 'AWAIT_TX',
         tele_id = excluded.tele_id,
         topup_amount = COALESCE(excluded.topup_amount, topup_amount),
         submitted_at = CURRENT_TIMESTAMP`,
      [srNo, renewal.client_id, fromId, chatId, existingTopup?.topup_amount || null]
    );

    // Edit the original message to show instructions
    await TelegramBotInstance.editMessageText(
      `💳 <b>${escapeHtml(renewal.client_name)}</b> — submit your Transaction ID!\n\n` +
      `📌 <b>Right-click this message</b> and choose <b>"Reply"</b>, then send your <b>Transaction ID</b> (TX hash).\n\n` +
      `Your account will be renewed once approved.`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify({
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `cancel_payment:${srNo}:${chatId}` },
          ]],
        }),
      }
    );
    await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Right-click and reply with your TX ID!', show_alert: false });
    return;
  }

  if (parsed.action === 'remind_later') {
    const { srNo, chatId } = parsed;
    const renewal = get('SELECT r.* FROM renewals r WHERE r.sr_no = ?', [srNo]);
    await TelegramBotInstance.editMessageText(
      `🔔 <b>${escapeHtml(renewal?.client_name || '')}</b> — I'll remind you again soon.`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML' }
    );
    await TelegramBotInstance.answerCallbackQuery(query.id, { text: '🔔 Okay, I\'ll remind you later.', show_alert: false });
    return;
  }

  // ── Topup flow ───────────────────────────────────────────────────────────────
  if (parsed.action === 'topup_product') {
    const { srNo, chatId } = parsed;
    const fromId = String(query.from.id);

    const renewal = get(
      `SELECT r.*, c.tele_id FROM renewals r
       JOIN clients c ON c.id = r.client_id
       WHERE r.sr_no = ?`,
      [srNo]
    );
    if (!renewal) {
      await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Product not found.', show_alert: true });
      return;
    }

    // Store topup intent in pending_payments with AWAIT_TOPUP_AMOUNT step
    run(
      `INSERT INTO pending_payments (sr_no, client_id, tele_id, chat_id, step, topup_amount)
       VALUES (?, ?, ?, ?, 'AWAIT_TOPUP_AMOUNT', NULL)
       ON CONFLICT(sr_no, chat_id) DO UPDATE SET
         step = 'AWAIT_TOPUP_AMOUNT',
         tele_id = excluded.tele_id,
         topup_amount = NULL,
         submitted_at = CURRENT_TIMESTAMP`,
      [srNo, renewal.client_id, fromId, chatId]
    );

    // Edit message to ask for amount
    await TelegramBotInstance.editMessageText(
      `💰 <b>Top-Up</b> — ${escapeHtml(renewal.tier || 'Product')}\n\n` +
      `📌 <b>Right-click this message</b> and choose <b>"Reply"</b>, then send the top-up amount in USD.\n\n` +
      `Example: 50.00`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify({
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `cancel_topup:${srNo}:${chatId}` },
          ]],
        }),
      }
    );
    await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Enter amount as a reply!', show_alert: false });
    return;
  }

  if (parsed.action === 'cancel_topup') {
    const { srNo, chatId } = parsed;
    run(`DELETE FROM pending_payments WHERE sr_no = ? AND chat_id = ? AND step = 'AWAIT_TOPUP_AMOUNT'`, [srNo, chatId]);
    await TelegramBotInstance.editMessageText(
      `❌ <b>Top-up cancelled.</b>`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML' }
    );
    await TelegramBotInstance.answerCallbackQuery(query.id);
    return;
  }

  // ── Client creation buttons ─────────────────────────────────────────────────
  const chatId = parsed.chatId;

  const link = get(
    `SELECT chat_id, pending_create_name, pending_create_tele_id
       FROM bot_group_links WHERE chat_id = ?`,
    [chatId]
  );
  // No pending proposal (already resolved, or never existed). The button is
  // likely a stale click after the proposal was processed or cancelled.
  if (!link || !link.pending_create_name) {
    await TelegramBotInstance.answerCallbackQuery(query.id, {
      text: 'No pending proposal — nothing to do.',
      show_alert: false,
    });
    return;
  }

  if (parsed.action === 'cancel') {
    run(
      `UPDATE bot_group_links
          SET pending_create_name = NULL, pending_create_tele_id = NULL
        WHERE chat_id = ?`,
      [chatId]
    );
    await TelegramBotInstance.editMessageText(
      '❌ Cancelled. No client was created.',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    );
    await TelegramBotInstance.answerCallbackQuery(query.id);
    return;
  }

  // action === 'create'
  const result = await createClient({
    name: link.pending_create_name,
    telegramGroupId: chatId,
    products: [],
    source: 'bot-auto-create',
  });

  if (!result.ok) {
    const errMsg =
      result.code === 'SHEETS_OK_DB_FAIL'
        ? `⚠️ Created in the Sheet (client ${result.client_id}) but the local DB write failed. A sync will reconcile.`
        : `❌ Failed to create client: ${escapeHtml(result.error || 'unknown error')}`;
    await TelegramBotInstance.editMessageText(errMsg, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
    });
    await TelegramBotInstance.answerCallbackQuery(query.id, {
      text: 'Error',
      show_alert: true,
    });
    return;
  }

  // Success: link the new client to the group and clear the pending columns.
  const clientId = result.client_id;
  run(
    `UPDATE bot_group_links
        SET client_id = ?, status = 'linked', linked_at = CURRENT_TIMESTAMP,
            pending_create_name = NULL, pending_create_tele_id = NULL
      WHERE chat_id = ?`,
    [clientId, chatId]
  );
  // Update the legacy column if it's still empty (first link wins).
  run(
    `UPDATE clients SET telegram_group_id = ?
      WHERE id = ? AND (telegram_group_id IS NULL OR telegram_group_id = '')`,
    [chatId, clientId]
  );
  await TelegramBotInstance.editMessageText(
    `✅ Created and linked to <b>${escapeHtml(link.pending_create_name)}</b>!\n\n` +
    `Open the dashboard to add products to this client.`,
    {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
    }
  );
  await TelegramBotInstance.answerCallbackQuery(query.id);
}

async function handleEditedMessage(msg) {
  const chatId = String(msg.chat?.id || '');
  const messageId = msg.message_id;

  try {
    run(
      `INSERT OR REPLACE INTO telegram_edited_messages (message_id, chat_id, edited_at, new_text)
       VALUES (?, ?, ?, ?)`,
      [messageId, chatId, msg.edit_date, msg.text || '']
    );
    run(
      `UPDATE telegram_messages SET is_edited = 1, edited_at = ?, text = ?
       WHERE chat_id = ? AND message_id = ?`,
      [msg.edit_date, msg.text || '', chatId, messageId]
    );
  } catch (e) {
    console.error('[handleEditedMessage] error:', e.message);
  }
}

async function handleMessage(msg, TelegramBotInstance) {
  const text = msg.text || '';
  const chat = msg.chat;
  const chatId = String(chat.id);
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';

  // Store all group messages to DB for the admin chat UI.
  if (isGroup && !msg.from?.is_bot) {
    storeTelegramMessage(msg);
  }

  // Private chat: handle payment flow or generic help.
  if (!isGroup) {
    const userId = String(msg.from.id);

    // Check if user has a pending payment in AWAIT_TX step
    const pending = get(
      `SELECT pp.*, r.client_name, r.tier, r.bank_name, r.subscription_fee, r.valid_stopped_date
       FROM pending_payments pp
       JOIN renewals r ON r.sr_no = pp.sr_no AND r.client_id = pp.client_id
       WHERE pp.tele_id = ? AND pp.step = 'AWAIT_TX'
       ORDER BY pp.submitted_at DESC LIMIT 1`,
      [userId]
    );

    if (pending) {
      // ── Payment proof collection flow — TX ID only (no screenshot) ───────
      if (text && text.trim()) {
        const txHash = text.trim();

        // Store TX
        run(`UPDATE pending_payments SET transaction_id = ? WHERE id = ?`, [txHash, pending.id]);

        // Get client + renewal data
        const client = get('SELECT name, tele_id FROM clients WHERE id = ?', [pending.client_id]);
        const renewalData = get('SELECT bank_name, valid_stopped_date, subscription_fee, setup_fee, discount, tier FROM renewals WHERE sr_no = ?', [pending.sr_no]);

        // Calculate total amount due: subscription + setup - discount
        const subAmt = parseFloat(String(renewalData?.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
        const setupAmt = parseFloat(String(renewalData?.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
        const discAmt = parseFloat(String(renewalData?.discount || '0').replace(/[^0-9.]/g, '')) || 0;
        const amountDue = (subAmt + setupAmt - discAmt).toFixed(2);

        // Insert payment_proofs (no screenshot)
        run(
          `INSERT INTO payment_proofs (sr_no, client_id, transaction_id, status)
           VALUES (?, ?, ?, 'PENDING')`,
          [pending.sr_no, pending.client_id, txHash]
        );

        const proofRow = get(
          `SELECT id FROM payment_proofs WHERE sr_no = ? AND client_id = ? ORDER BY id DESC LIMIT 1`,
          [pending.sr_no, pending.client_id]
        );

        // Insert into approval_queue
        run(
          `INSERT INTO approval_queue (proof_id, sr_no, client_id, client_name, tele_id, product_type, amount_due, due_date, bank_name, transaction_id, submitted_at, status, is_topup, topup_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING', ?, ?)`,
          [
            proofRow.id,
            pending.sr_no,
            pending.client_id,
            client?.name || '',
            client?.tele_id || '',
            renewalData?.tier || '',
            amountDue,
            renewalData?.valid_stopped_date || '',
            renewalData?.bank_name || '',
            txHash,
            pending.topup_amount ? 1 : 0,
            pending.topup_amount || null,
          ]
        );

        // Clear pending_payment
        run(`UPDATE pending_payments SET step = 'SUBMITTED' WHERE id = ?`, [pending.id]);

        await TelegramBotInstance.sendMessage(
          chatId,
          `✅ <b>Transaction ID received:</b> <code>${escapeHtml(txHash)}</code>\n\n` +
          `Your payment is now <b>under review</b>. You'll be notified once approved.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Fallback: general instruction
      await TelegramBotInstance.sendMessage(
        chatId,
        `💳 Right-click my message above and choose <b>Reply</b> to send your <b>Transaction ID</b> (TX hash).`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // No pending payment — generic help
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '👋 Add me to a Telegram group with the seller and the client, then type /start there.\n' +
        'If the group title contains "Tele NNN" (recommended), the bot links automatically.\n' +
        'Otherwise use /link <client name> or /link <Tele ID number>.'
      );
      return;
    }
    return;
  }

  // Update last_seen_at on every message.
  run(
    `UPDATE bot_group_links
        SET last_seen_at = CURRENT_TIMESTAMP,
            chat_title = COALESCE(NULLIF(?, ''), chat_title)
      WHERE chat_id = ?`,
    [chat.title || '', chatId]
  );

  // ── Group topup flow: reply to bot's message with amount ─────
  if (isGroup && msg.reply_to_message && String(msg.reply_to_message.from.id) === String(globalThis.__pcaBotId)) {
    const userId = String(msg.from.id);

    // Check if there's a pending topup awaiting amount
    const pendingTopup = get(
      `SELECT pp.*, r.client_name, r.tier
       FROM pending_payments pp
       JOIN renewals r ON r.sr_no = pp.sr_no AND r.client_id = pp.client_id
       WHERE pp.chat_id = ? AND pp.step = 'AWAIT_TOPUP_AMOUNT'
       ORDER BY pp.submitted_at DESC LIMIT 1`,
      [chatId]
    );

    if (pendingTopup && text && text.trim()) {
      const amount = parseFloat(text.trim());
      if (isNaN(amount) || amount <= 0) {
        await TelegramBotInstance.sendMessage(
          chatId,
          `❌ Invalid amount. Please enter a positive number (e.g., 50.00)`,
          { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
        );
        return;
      }

      // Store the topup amount and show payment methods
      run(`UPDATE pending_payments SET topup_amount = ? WHERE id = ?`, [String(amount), pendingTopup.id]);

      const keyboard = buildPaymentMethodKeyboard(pendingTopup.sr_no, chatId, '');
      const msg2 =
        `💰 <b>Top-Up</b> — ${escapeHtml(pendingTopup.tier || 'Product')}\n\n` +
        `Amount: <b>$${amount.toFixed(2)}</b>\n\n` +
        `Select payment method:`;

      await TelegramBotInstance.sendMessage(chatId, msg2, {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify(keyboard.reply_markup),
      });
      return;
    }
  }

  // ── Group payment flow: reply to bot's message with TX ID ─────
  if (isGroup && msg.reply_to_message && String(msg.reply_to_message.from.id) === String(globalThis.__pcaBotId)) {
    const userId = String(msg.from.id);
    const pending = get(
      `SELECT pp.*, r.client_name, r.tier, r.bank_name, r.subscription_fee, r.valid_stopped_date
       FROM pending_payments pp
       JOIN renewals r ON r.sr_no = pp.sr_no AND r.client_id = pp.client_id
       WHERE pp.chat_id = ? AND pp.step = 'AWAIT_TX'
       ORDER BY pp.submitted_at DESC LIMIT 1`,
      [chatId]
    );

    if (pending) {
      // Group chat: TX ID submitted via reply — submit immediately (no screenshot)
      if (text && text.trim()) {
        const txHash = text.trim();
        const client = get('SELECT name, tele_id FROM clients WHERE id = ?', [pending.client_id]);
        const renewalData = get('SELECT bank_name, valid_stopped_date, subscription_fee, setup_fee, discount, tier FROM renewals WHERE sr_no = ?', [pending.sr_no]);

        // Calculate total amount due — use topup_amount if set
        let amountDue;
        if (pending.topup_amount) {
          amountDue = pending.topup_amount;
        } else {
          const subAmt = parseFloat(String(renewalData?.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
          const setupAmt = parseFloat(String(renewalData?.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
          const discAmt = parseFloat(String(renewalData?.discount || '0').replace(/[^0-9.]/g, '')) || 0;
          amountDue = (subAmt + setupAmt - discAmt).toFixed(2);
        }

        run(
          `INSERT INTO payment_proofs (sr_no, client_id, transaction_id, status)
           VALUES (?, ?, ?, 'PENDING')`,
          [pending.sr_no, pending.client_id, txHash]
        );

        const proofRow = get(`SELECT id FROM payment_proofs WHERE sr_no = ? AND client_id = ? ORDER BY id DESC LIMIT 1`, [pending.sr_no, pending.client_id]);

        run(
          `INSERT INTO approval_queue (proof_id, sr_no, client_id, client_name, tele_id, product_type, amount_due, due_date, bank_name, transaction_id, submitted_at, status, is_topup, topup_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING', ?, ?)`,
          [
            proofRow.id, pending.sr_no, pending.client_id,
            client?.name || '', client?.tele_id || '',
            renewalData?.tier || '', amountDue,
            renewalData?.valid_stopped_date || '', renewalData?.bank_name || '',
            txHash,
            pending.topup_amount ? 1 : 0,
            pending.topup_amount || null,
          ]
        );

        run(`UPDATE pending_payments SET step = 'SUBMITTED' WHERE id = ?`, [pending.id]);

        await TelegramBotInstance.sendMessage(
          chatId,
          `✅ <b>Transaction ID received:</b> <code>${escapeHtml(txHash)}</code>\n\n` +
          `<b>${escapeHtml(client?.name || '')}</b> — your payment is <b>under review</b>. You'll be notified once approved.`,
          { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
        );
        return;
      }
    }
  }

  if (text.match(/^\/start(?:@\w+)?\s*$/)) {
    console.error('[DEBUG] /start received, chatId=', chatId, 'title=', chat.title);
    await linkGroupByTitle(chatId, chat.title);
    console.error('[DEBUG] linkGroupByTitle done');
    return;
  }

  if (text.match(/^\/cancel(?:@\w+)?\s*$/)) {
    const result = run(
      `UPDATE bot_group_links
          SET pending_create_name = NULL, pending_create_tele_id = NULL
        WHERE chat_id = ?`,
      [chatId]
    );
    await TelegramBotInstance.sendMessage(
      chatId,
      result.changes > 0
        ? '❌ Cancelled the pending client creation.'
        : 'Nothing to cancel.'
    );
    return;
  }

  const linkMatch = text.match(/^\/link(?:@\w+)?\s+(.+)$/);
  if (linkMatch) {
    const arg = linkMatch[1].trim();
    // Pure digits → Tele ID match. Pure-name → fallback. The seller can
    // simply type `/link 256` and the bot finds the client automatically.
    const isPureNumber = /^\d+$/.test(arg);
    const out = isPureNumber
      ? linkGroupByTeleId(chatId, arg)
      : linkGroupExplicit(chatId, arg);

    // After a successful name link, if the group title has a "Tele NNN"
    // token that the DB doesn't yet have on the client, persist it. That
    // way a once-manually-linked group becomes auto-linkable next time.
    if (!isPureNumber && out.reply && out.reply.startsWith('✅')) {
      const teleId = extractTeleId(chat.title || '');
      if (teleId) {
        run(
          `UPDATE clients SET tele_id = ?
            WHERE id = (SELECT client_id FROM bot_group_links WHERE chat_id = ?)
              AND (tele_id IS NULL OR tele_id = '')`,
          [teleId, chatId]
        );
      }
    }

    await TelegramBotInstance.sendMessage(chatId, out.reply, { parse_mode: 'HTML' });
    return;
  }

  if (text.match(/^\/unlink(?:@\w+)?\s*$/)) {
    const out = unlinkGroup(chatId);
    await TelegramBotInstance.sendMessage(chatId, out.reply);
    return;
  }

  if (text.match(/^\/status(?:@\w+)?\s*$/)) {
    const row = get(
      `SELECT g.status, g.client_id, c.name AS client_name
         FROM bot_group_links g
         LEFT JOIN clients c ON c.id = g.client_id
        WHERE g.chat_id = ?`,
      [chatId]
    );
    if (!row) {
      await TelegramBotInstance.sendMessage(chatId, '❓ This group is not registered. Type /start to link it.');
    } else if (row.status === 'linked' && row.client_name) {
      await TelegramBotInstance.sendMessage(chatId, `✅ Linked to <b>${escapeHtml(row.client_name)}</b>.`, { parse_mode: 'HTML' });
    } else {
      await TelegramBotInstance.sendMessage(chatId, '⏳ This group is pending linking. Use /link <client name>.');
    }
    return;
  }

  if (text.match(/^\/pay(?:@\w+)?\s*$/)) {
    const row = get(
      `SELECT g.client_id, c.name AS client_name
         FROM bot_group_links g
         LEFT JOIN clients c ON c.id = g.client_id
        WHERE g.chat_id = ? AND g.status = 'linked'`,
      [chatId]
    );
    if (!row || !row.client_id) {
      await TelegramBotInstance.sendMessage(chatId, '❓ This group is not linked to any client. Use /start to link it.');
      return;
    }

    // Find the latest unpaid renewal for this client
    const renewal = get(
      `SELECT r.*, c.tele_id FROM renewals r
       JOIN clients c ON c.id = r.client_id
       WHERE r.client_id = ? AND COALESCE(r.reference_no, '') = ''
       ORDER BY r.valid_stopped_date DESC LIMIT 1`,
      [row.client_id]
    );

    if (!renewal) {
      await TelegramBotInstance.sendMessage(chatId, `✅ <b>${escapeHtml(row.client_name)}</b> — no pending payments found. You're all set!`, { parse_mode: 'HTML' });
      return;
    }

    // Send payment reminder message with Pay Now button
    const msg =
      `💳 <b>${escapeHtml(renewal.client_name)}</b> — <b>${renewal.subscription_fee || '$0'}</b>\n\n` +
      `Click <b>Pay Now</b> below to select your payment method.`;

    const keyboard = buildPaymentReminderKeyboard(renewal.sr_no, chatId);
    await TelegramBotInstance.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: JSON.stringify(keyboard.reply_markup),
    });
    return;
  }

  if (text.match(/^\/topup(?:@\w+)?\s*$/)) {
    // Find client by looking up the group in bot_group_links
    const link = get(
      `SELECT g.client_id, c.name AS client_name
       FROM bot_group_links g
       JOIN clients c ON c.id = g.client_id
       WHERE g.chat_id = ? AND g.status = 'linked' LIMIT 1`,
      [chatId]
    );

    if (!link || !link.client_id) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '❓ This group is not linked to any client. Use /start to link it.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Get active products for this client
    const activeProducts = all(
      `SELECT sr_no, tier, setup_type FROM renewals
       WHERE client_id = ? AND visual_status = 'Active'
       ORDER BY valid_stopped_date DESC`,
      [link.client_id]
    );

    if (activeProducts.length === 0) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '❌ No active products found. You need an active product to add a top-up.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const msg = '💰 <b>Top-Up</b>\n\nSelect a product to add funds to:';
    const keyboard = buildTopupProductKeyboard(activeProducts, chatId);

    await TelegramBotInstance.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: JSON.stringify(keyboard.reply_markup),
    });
    return;
  }

  if (text.match(/^\/dashboard(?:@\w+)?\s*$/)) {
    // Find client by looking up the group in bot_group_links
    const link = get(
      `SELECT g.client_id, c.name as client_name
       FROM bot_group_links g
       JOIN clients c ON c.id = g.client_id
       WHERE g.chat_id = ? AND g.status = 'linked' LIMIT 1`,
      [chatId]
    );

    if (!link || !link.client_id) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '❓ This group is not linked to any client.\n\n' +
        'Use /start to link this group first.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Check if client already has a user account
    const existingUser = get(
      `SELECT id, username FROM users WHERE client_id = ? AND role = 'client' LIMIT 1`,
      [link.client_id]
    );

    if (existingUser) {
      // User exists — resend credentials
      await TelegramBotInstance.sendMessage(
        chatId,
        `📋 Your client portal credentials:\n\n` +
        `Username: <code>${existingUser.username}</code>\n\n` +
        `🌐 Visit: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pca.primecircle.pro'}/login/client\n\n` +
        `Use /password to change your password.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Create new client user
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const username = `client_${link.client_id}_${Date.now().toString(36)}`;

    try {
      const { createUser, get: dbGet } = await import('./auth.js');
      const { run: dbRun, get: dbGet2 } = await import('./db.js');

      const result = createUser(username, generatedPassword, 'client', []);

      if (result && result.id) {
        // Link user to client
        dbRun('UPDATE users SET client_id = ? WHERE id = ?', [link.client_id, result.id]);
      }

      await TelegramBotInstance.sendMessage(
        chatId,
        `✅ Client account created!\n\n` +
        `Username: <code>${username}</code>\n` +
        `Password: <code>${generatedPassword}</code>\n\n` +
        `🌐 Visit: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pca.primecircle.pro'}/login/client\n\n` +
        `⚠️ Please change your password after logging in.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('[bot] /dashboard create user error:', err);
      await TelegramBotInstance.sendMessage(
        chatId,
        '❌ Failed to create your account. Please contact the administrator.',
        { parse_mode: 'HTML' }
      );
    }
    return;
  }

  if (text.match(/^\/password(?:@\w+)?\s*$/)) {
    // Find client by looking up the group in bot_group_links
    const link = get(
      `SELECT g.client_id, c.name as client_name
       FROM bot_group_links g
       JOIN clients c ON c.id = g.client_id
       WHERE g.chat_id = ? AND g.status = 'linked' LIMIT 1`,
      [chatId]
    );

    if (!link || !link.client_id) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '❓ This group is not linked to any client.\n\n' +
        'Use /start to link this group first.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const clientUser = get(
      `SELECT username FROM users WHERE client_id = ? AND role = 'client' LIMIT 1`,
      [link.client_id]
    );

    if (!clientUser) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '❓ No portal account found. Use /dashboard to create one.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    await TelegramBotInstance.sendMessage(
      chatId,
      `📋 Your login credentials:\n\n` +
      `Username: <code>${clientUser.username}</code>\n\n` +
      `🌐 Login at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pca.primecircle.pro'}/login/client`
    );
    return;
  }

  if (text.match(/^\/help(?:@\w+)?\s*$/)) {
    await TelegramBotInstance.sendMessage(
      chatId,
      'Available commands:\n' +
        '  /start — auto-link this group by Tele ID or group name (or propose to create a new client if no match)\n' +
        '  /link <number> — link by Tele ID (e.g. /link 256)\n' +
        '  /link <name> — link by exact client name\n' +
        '  /unlink — detach this group from its client\n' +
        '  /cancel — discard a pending "Create client" proposal\n' +
        '  /status — show the current link\n' +
        '  /pay — submit payment proof\n' +
        '  /topup — add funds to an active product\n' +
        '  /dashboard — get your client portal login credentials\n' +
        '  /password — resend your portal credentials\n' +
        '  /help — this message\n' +
        '  /id — show this chat\'s Chat ID'
    );
  }

  // /id — return the chat ID of the current conversation
  if (text.match(/^\/id(?:@\w+)?\s*$/)) {
    await TelegramBotInstance.sendMessage(
      chatId,
      `📌 This chat's ID: <code>${chatId}</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }
}

export async function startBot() {
  if (bot || globalThis.__pcaBot) return { started: true, reason: 'already_running' };
  // Reset the boot lock so a previous failure (invalid token, import error,
  // etc.) doesn't permanently wedge us. The next call will re-attempt.
  globalThis.__pcaTelegramBotStarted = true;

  const cfg = getConfig();
  if (!cfg) {
    console.log('[telegram] no bot_config row, bot disabled');
    return { started: false, reason: 'no_config' };
  }
  const token = cfg.token || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[telegram] no token, bot disabled');
    return { started: false, reason: 'no_token' };
  }
  if (!cfg.enabled) {
    console.log('[telegram] disabled in config');
    return { started: false, reason: 'disabled' };
  }

  let TelegramBot;
  try {
    TelegramBot = (await import('node-telegram-bot-api')).default;
  } catch (e) {
    console.error('[telegram] failed to import node-telegram-bot-api:', e.message);
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'import_error' };
  }

  try {
    bot = new TelegramBot(token, {
      polling: { interval: 1500, autoStart: true, params: { timeout: 30 } },
    });
    globalThis.__pcaBot = bot;
  } catch (e) {
    console.error('[telegram] failed to construct bot:', e.message);
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'construct_error' };
  }

  // Validate the token up front.
  try {
    const me = await bot.getMe();
    globalThis.__pcaBotId = me.id;
    upsertConfig({ bot_username: me.username });
    console.log(`[telegram] started, bot=@${me.username}`);
  } catch (e) {
    console.error('[telegram] getMe failed (invalid token?):', e.message);
    try { await bot.stopPolling(); } catch {}
    bot = null;
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'invalid_token' };
  }

  bot.on('message', (msg) => {
    handleMessage(msg, bot).catch((e) => console.error('[telegram] handler error', e));
  });
  bot.on('callback_query', (query) => {
    handleCallbackQuery(query, bot).catch((e) => console.error('[telegram] callback error', e));
  });
  bot.on('polling_error', (err) => {
    console.error('[telegram] polling_error:', err?.code || '', err?.message || err);
    if (err?.code === 409) {
      console.error('[telegram] 409 Conflict — stopping duplicate bot instance');
      bot.stopPolling().catch(() => {});
      bot = null;
      globalThis.__pcaBot = null;
    }
  });
  bot.on('edited_message', (msg) => {
    handleEditedMessage(msg).catch((e) => console.error('[telegram] edited_message error', e));
  });

  // Sweep timer.
  startSweepTimer(() => bot);

  // Graceful shutdown.
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    stopSweepTimer();
    try {
      if (bot) {
        console.log('[telegram] stopping polling…');
        await bot.stopPolling();
      }
    } catch (e) {
      console.error('[telegram] stopPolling error', e.message);
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { started: true, reason: 'ok' };
}

export async function startBotWithWebhook() {
  if (bot || globalThis.__pcaBot) return { started: true, reason: 'already_running' };
  globalThis.__pcaTelegramBotStarted = true;

  const cfg = getConfig();
  if (!cfg) {
    console.log('[telegram-webhook] no bot_config row, bot disabled');
    return { started: false, reason: 'no_config' };
  }
  const token = cfg.token || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[telegram-webhook] no token, bot disabled');
    return { started: false, reason: 'no_token' };
  }
  if (!cfg.enabled) {
    console.log('[telegram-webhook] disabled in config');
    return { started: false, reason: 'disabled' };
  }

  let TelegramBot;
  try {
    TelegramBot = (await import('node-telegram-bot-api')).default;
  } catch (e) {
    console.error('[telegram-webhook] failed to import node-telegram-bot-api:', e.message);
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'import_error' };
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/telegram`;
  if (!webhookUrl.startsWith('https://')) {
    console.error('[telegram-webhook] NEXT_PUBLIC_APP_URL must use https:// for webhook');
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'https_required' };
  }

  try {
    bot = new TelegramBot(token, { polling: false });
    globalThis.__pcaBot = bot;
  } catch (e) {
    console.error('[telegram-webhook] failed to construct bot:', e.message);
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'construct_error' };
  }

  // Validate the token up front.
  try {
    const me = await bot.getMe();
    globalThis.__pcaBotId = me.id;
    upsertConfig({ bot_username: me.username });
    console.log(`[telegram-webhook] started, bot=@${me.username}, webhook=${webhookUrl}`);
  } catch (e) {
    console.error('[telegram-webhook] getMe failed (invalid token?):', e.message);
    bot = null;
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'invalid_token' };
  }

  // Delete any stale webhook before setting a new one
  try {
    await bot.deleteWebHook();
    console.log('[telegram-webhook] deleted stale webhook');
  } catch (e) {
    console.log('[telegram-webhook] deleteWebhook (may have been already unset):', e.message);
  }

  // Set webhook
  try {
    await bot.setWebHook(webhookUrl, {
      max_connections: 100,
      allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member'],
    });
    console.log(`[telegram-webhook] webhook set to ${webhookUrl}`);
  } catch (e) {
    console.error('[telegram-webhook] setWebHook failed:', e.message);
  }

  // webhook_message instead of 'message' when using webhooks
  bot.on('webhook_message', (msg) => {
    handleMessage(msg, bot).catch((e) => console.error('[telegram] webhook handler error', e));
  });
  bot.on('callback_query', (query) => {
    handleCallbackQuery(query, bot).catch((e) => console.error('[telegram] callback error', e));
  });
  bot.on('edited_message', (msg) => {
    handleEditedMessage(msg).catch((e) => console.error('[telegram] edited_message error', e));
  });
  bot.on('my_chat_member', (member) => {
    // Bot was added or removed from a chat
    console.log(`[telegram] my_chat_member update:`, JSON.stringify(member));
  });

  // Sweep timer.
  startSweepTimer(() => bot);

  // Graceful shutdown.
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    stopSweepTimer();
    try {
      if (bot) {
        console.log('[telegram-webhook] deleting webhook…');
        await bot.deleteWebHook().catch(() => {});
      }
    } catch (e) {
      console.error('[telegram-webhook] deleteWebHook error', e.message);
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { started: true, reason: 'webhook_ok' };
}

export async function stopBot() {
  stopSweepTimer();
  if (!bot) return;
  try {
    // If webhook mode, delete the webhook; otherwise stop polling
    if (!bot.options?.polling) {
      await bot.deleteWebHook().catch(() => {});
    } else {
      await bot.stopPolling();
    }
  } catch {}
  bot = null;
  globalThis.__pcaBot = null;
  globalThis.__pcaTelegramBotStarted = false;
}
