// Telegram bot singleton — long-polling inside the Next.js Node process.
// Imported by src/instrumentation.js (boot) and by API routes (test send).

import 'server-only';
import { all, get, run } from './db.js';
import { startSweepTimer, stopSweepTimer, getConfig, upsertConfig } from './botScheduler.js';
import { extractTeleId } from './teleIdParser.js';
import { buildCreateClientKeyboard, buildPaymentReminderKeyboard, buildPaymentMethodKeyboard, buildPaymentDetailsKeyboard, parseCallbackData } from './telegramInlineButtons.js';
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

// Linking logic — called by /start (auto-match by group title) and /link
// (explicit name match). The Tele ID, when present in the group title, takes
// priority over the full-name match because it's much more reliable
// (emojis, "X Prime circle:" prefixes, "(...)" suffixes, casing variations
// all break exact-name matching).
function linkGroupByTitle(chatId, chatTitle) {
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
    // explicitly tagged the group, so propose to create a new client
    // (header-only — they add products from the dashboard later).
    return proposeAutoCreate(chatId, title, teleId);
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
    // No client at all matches the group name — propose to create a new one
    // with tele_id=null (the human can add "Tele NNN" via the dashboard).
    return proposeAutoCreate(chatId, title, null);
  }
  // Multiple matches: ambiguous, fall back to /link for explicit disambiguation.
  return {
    reply:
      `⚠️ Multiple clients match the group name "<b>${escapeHtml(title)}</b>".\n\n` +
      `Please use: <code>/link &lt;exact client name&gt;</code> or <code>/link &lt;number&gt;</code>`,
  };
}

// Persist a pending auto-create proposal in bot_group_links and return the
// preview message + inline keyboard. The seller clicks "Create" or "Cancel";
// the callback_query handler in handleCallbackQuery resolves it.
function proposeAutoCreate(chatId, title, teleId) {
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

  const teleLine = safeTele
    ? `\n  • <b>Tele ID</b>: ${escapeHtml(safeTele)} <i>(extracted from group title)</i>`
    : `\n  • <b>Tele ID</b>: <i>none — add "Tele NNN" to the group title or the client name on the dashboard to enable auto-linking</i>`;
  const reply =
    `🆕 No client in the dashboard matches this group. I can create a new one with:\n` +
    `\n  • <b>Name</b>: ${escapeHtml(safeTitle)}` +
    teleLine +
    `\n  • <b>Status</b>: Inactive (no products yet — add them from the dashboard)\n` +
    `\nClick <b>Create this client</b> to confirm, or <b>Cancel</b> to abort. ` +
    `You can also type <code>/cancel</code> to clear the proposal.`;

  return { reply, options: buildCreateClientKeyboard(chatId) };
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
//   already_paid → initiate DM flow for TX ID + screenshot
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

    const msg =
      `💳 <b>${escapeHtml(renewal.client_name)}</b> — choose your payment method\n\n` +
      `Amount: <b>${escapeHtml(renewal.subscription_fee || '$0')}</b>\n` +
      `Bank: <b>${escapeHtml(bankLabel)}</b>\n\n` +
      `Select how you want to pay:`;

    const keyboard = buildPaymentMethodKeyboard(srNo, chatId, bankKey);
    await TelegramBotInstance.editMessageText(msg, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: JSON.stringify(keyboard.reply_markup),
    });
    await TelegramBotInstance.answerCallbackQuery(query.id);
    return;
  }

  if (parsed.action === 'select_payment') {
    const { srNo, chatId, method } = parsed;
    const renewal = get('SELECT r.*, c.tele_id FROM renewals r JOIN clients c ON c.id = r.client_id WHERE r.sr_no = ?', [srNo]);
    if (!renewal) {
      await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Renewal not found.', show_alert: true });
      return;
    }

    // Get bank details from DB
    const banks = all('SELECT bank_key, bank_name, data_json FROM bank_details');
    const bankKey = (renewal.bank_name || '').toLowerCase().replace(/\s+/g, '_');
    const bank = banks.find(b => b.bank_key === bankKey);
    const bankData = bank ? JSON.parse(bank.data_json || '{}') : {};

    // Store the selection
    let address = '';
    if (method === 'usdt_trc20') address = bankData.usdt_trc20 || '';
    else if (method === 'usdt_erc20') address = bankData.usdt_erc20 || '';
    else if (method === 'btc') address = bankData.btc || '';
    else if (method === 'lhv') address = `IBAN: ${bankData.iban || ''}\nBIC: ${bankData.bic_swift || ''}\nAccount: ${bankData.account_title || ''}`;
    else if (method === 'slash') address = `Account: ${bankData.account_number || ''}\nRouting: ${bankData.routing || ''}\nSWIFT: ${bankData.swift_bic || ''}`;
    else if (method === 'whop') address = `WHOP subscription — link will be sent to your email`;

    // Save selection
    run(
      `INSERT INTO payment_selections (sr_no, chat_id, method, address)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sr_no, chat_id) DO UPDATE SET method = excluded.method, address = excluded.address, selected_at = CURRENT_TIMESTAMP`,
      [srNo, chatId, method, address]
    );

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

    const feeNote = bankKey === 'crypto' && bankData.fee_note ? `\n\n⚠️ ${bankData.fee_note}` : '';

    const msg =
      `💳 <b>Payment Details</b>\n\n` +
      `Method: <b>${methodLabel}</b>\n` +
      `Amount: <b>${escapeHtml(renewal.subscription_fee || '$0')}</b>\n\n` +
      `<pre>${escapeHtml(address)}</pre>${qrLine}${feeNote}`;

    const keyboard = buildPaymentDetailsKeyboard(srNo, chatId);
    await TelegramBotInstance.editMessageText(msg, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
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

    // Store pending payment state — will be resolved when user replies with TX ID + screenshot
    run(
      `INSERT INTO pending_payments (sr_no, client_id, tele_id, chat_id, step, transaction_id)
       VALUES (?, ?, ?, ?, 'AWAIT_TX', NULL)
       ON CONFLICT(sr_no, chat_id) DO UPDATE SET step = 'AWAIT_TX', submitted_at = CURRENT_TIMESTAMP`,
      [srNo, renewal.client_id, fromId, chatId]
    );

    // Edit the original message to show instructions
    await TelegramBotInstance.editMessageText(
      `💳 <b>${escapeHtml(renewal.client_name)}</b> — payment proof requested!\n\n` +
      `To submit your proof of payment:\n\n` +
      `1️⃣ <b>Reply to this message</b> with your <b>Transaction ID</b> (TX hash)\n` +
      `2️⃣ Then <b>reply to the TX message</b> with your <b>screenshot</b>\n\n` +
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
    await TelegramBotInstance.answerCallbackQuery(query.id, { text: 'Reply with your TX ID and screenshot to this message!', show_alert: false });
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

async function handleMessage(msg, TelegramBotInstance) {
  const text = msg.text || '';
  const chat = msg.chat;
  const chatId = String(chat.id);
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';

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
      // ── Payment proof collection flow ───────────────────────────────────
      if (msg.photo) {
        // User sent a screenshot — get the best photo resolution
        const photo = msg.photo[msg.photo.length - 1];
        const file = await TelegramBotInstance.getFile(photo.file_id);
        const photoUrl = `https://api.telegram.org/file/bot${TelegramBotInstance.token}/${file.file_path}`;

        if (!pending.transaction_id) {
          // No TX ID yet — ask for it first
          await TelegramBotInstance.sendMessage(
            chatId,
            '📸 I received your screenshot, thanks! Before I can submit, please also send me your <b>Transaction ID (TX ID)</b> — the hash shown on your payment confirmation.',
            { parse_mode: 'HTML' }
          );
          return;
        }

        // Both TX ID and screenshot collected — create payment_proofs + approval_queue
        const client = get('SELECT name, tele_id FROM clients WHERE id = ?', [pending.client_id]);
        await TelegramBotInstance.sendMessage(chatId,
          '✅ Payment proof received!\n\nYour submission is now <b>under review</b>. You will be notified once approved. Thank you!',
          { parse_mode: 'HTML' }
        );

        // Insert payment_proofs
        run(
          `INSERT INTO payment_proofs (sr_no, client_id, transaction_id, proof_image_url, status)
           VALUES (?, ?, ?, ?, 'PENDING')`,
          [pending.sr_no, pending.client_id, pending.transaction_id, photoUrl]
        );

        // Get the just-inserted proof id
        const proofRow = get(
          `SELECT id FROM payment_proofs WHERE sr_no = ? AND client_id = ? ORDER BY id DESC LIMIT 1`,
          [pending.sr_no, pending.client_id]
        );

        // Get bank name from renewal
        const renewalData = get('SELECT bank_name, valid_stopped_date, subscription_fee FROM renewals WHERE sr_no = ?', [pending.sr_no]);

        // Insert into approval_queue
        run(
          `INSERT INTO approval_queue (proof_id, sr_no, client_id, client_name, tele_id, product_type, amount_due, due_date, bank_name, transaction_id, proof_image_url, submitted_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING')`,
          [
            proofRow.id,
            pending.sr_no,
            pending.client_id,
            client?.name || '',
            client?.tele_id || '',
            renewalData?.tier || '',
            renewalData?.subscription_fee || '',
            renewalData?.valid_stopped_date || '',
            renewalData?.bank_name || '',
            pending.transaction_id,
            photoUrl,
          ]
        );

        // Clear pending_payment
        run(`UPDATE pending_payments SET step = 'SUBMITTED' WHERE id = ?`, [pending.id]);
        return;
      }

      if (text && text.trim()) {
        if (!pending.transaction_id) {
          // Store TX ID and ask for screenshot
          run(`UPDATE pending_payments SET transaction_id = ? WHERE id = ?`, [text.trim(), pending.id]);
          await TelegramBotInstance.sendMessage(
            chatId,
            `✅ Got it — <code>${escapeHtml(text.trim())}</code>\n\n` +
            `Now please send me a <b>screenshot</b> of your payment confirmation (as a photo, not a file).`,
            { parse_mode: 'HTML' }
          );
          return;
        }
      }

      // No photo yet, TX ID already stored — prompt for screenshot
      if (pending.transaction_id) {
        await TelegramBotInstance.sendMessage(
          chatId,
          '📸 Please send your payment screenshot as a <b>photo</b> to complete your submission.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Fallback: general instruction
      await TelegramBotInstance.sendMessage(
        chatId,
        '💳 To submit your payment proof, please send your <b>Transaction ID</b> followed by the <b>screenshot</b> of payment.',
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

  // ── Group payment flow: reply to bot's message with TX ID or screenshot ─────
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
      if (text && text.trim() && !pending.transaction_id) {
        // TX ID submitted
        run(`UPDATE pending_payments SET transaction_id = ? WHERE id = ?`, [text.trim(), pending.id]);
        await TelegramBotInstance.sendMessage(
          chatId,
          `✅ <b>Transaction ID received:</b> <code>${escapeHtml(text.trim())}</code>\n\n` +
          `Now reply to this message with your <b>payment screenshot</b> (as a photo).`,
          { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
        );
        return;
      }

      if (msg.photo && pending.transaction_id) {
        // Screenshot received — download and create proof
        const photo = msg.photo[msg.photo.length - 1];
        const file = await TelegramBotInstance.getFile(photo.file_id);
        const photoUrl = `https://api.telegram.org/file/bot${TelegramBotInstance.token}/${file.file_path}`;
        const client = get('SELECT name, tele_id FROM clients WHERE id = ?', [pending.client_id]);
        const renewalData = get('SELECT bank_name, valid_stopped_date, subscription_fee, tier FROM renewals WHERE sr_no = ?', [pending.sr_no]);

        run(
          `INSERT INTO payment_proofs (sr_no, client_id, transaction_id, proof_image_url, status)
           VALUES (?, ?, ?, ?, 'PENDING')`,
          [pending.sr_no, pending.client_id, pending.transaction_id, photoUrl]
        );

        const proofRow = get(`SELECT id FROM payment_proofs WHERE sr_no = ? AND client_id = ? ORDER BY id DESC LIMIT 1`, [pending.sr_no, pending.client_id]);

        run(
          `INSERT INTO approval_queue (proof_id, sr_no, client_id, client_name, tele_id, product_type, amount_due, due_date, bank_name, transaction_id, proof_image_url, submitted_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING')`,
          [
            proofRow.id, pending.sr_no, pending.client_id,
            client?.name || '', client?.tele_id || '',
            renewalData?.tier || '', renewalData?.subscription_fee || '',
            renewalData?.valid_stopped_date || '', renewalData?.bank_name || '',
            pending.transaction_id, photoUrl,
          ]
        );

        run(`UPDATE pending_payments SET step = 'SUBMITTED' WHERE id = ?`, [pending.id]);

        await TelegramBotInstance.sendMessage(
          chatId,
          `✅ <b>Payment proof received!</b>\n\n` +
          `<b>${escapeHtml(client?.name || '')}</b> — your payment is <b>under review</b>. You'll be notified once approved.`,
          { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
        );
        return;
      }

      if (msg.photo && !pending.transaction_id) {
        await TelegramBotInstance.sendMessage(
          chatId,
          `📸 Screenshot received! But first, please reply with your <b>Transaction ID</b> (TX hash).`,
          { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
        );
        return;
      }
    }
  }

  if (text.match(/^\/start(?:@\w+)?\s*$/)) {
    const out = linkGroupByTitle(chatId, chat.title);
    await TelegramBotInstance.sendMessage(chatId, out.reply, {
      parse_mode: 'HTML',
      ...(out.options || {}),
    });
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

export async function stopBot() {
  stopSweepTimer();
  if (!bot) return;
  try { await bot.stopPolling(); } catch {}
  bot = null;
  globalThis.__pcaBot = null;
  globalThis.__pcaTelegramBotStarted = false;
}
