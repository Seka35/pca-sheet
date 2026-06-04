// Telegram bot singleton — long-polling inside the Next.js Node process.
// Imported by src/instrumentation.js (boot) and by API routes (test send).

import 'server-only';
import { all, get, run } from './db.js';
import { startSweepTimer, stopSweepTimer, getConfig, upsertConfig } from './botScheduler.js';
import { extractTeleId } from './teleIdParser.js';

let bot = null;
let isShuttingDown = false;

export function getBot() {
  return bot;
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
    const teleMatch = get(
      `SELECT id, name, telegram_group_id FROM clients
        WHERE tele_id = ? AND status = 'Actif' LIMIT 1`,
      [teleId]
    );
    if (teleMatch) return finalizeLink(chatId, teleMatch);
    // Tele ID found in title but no client in DB has it.
    return {
      reply:
        `🔎 Detected "Tele <b>${escapeHtml(teleId)}</b>" in this group title, but no client in the dashboard has this ID.\n\n` +
        `Either wait for the next Google Sheet sync to pick it up, or link manually with:\n` +
        `  <code>/link &lt;client name&gt;</code>\n` +
        `  or\n` +
        `  <code>/link ${escapeHtml(teleId)}</code> (if a client already has this ID)`,
    };
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
    const suggestions = all(
      `SELECT name FROM clients
        WHERE status = 'Actif' AND LOWER(name) LIKE ? LIMIT 3`,
      ['%' + title.toLowerCase() + '%']
    );
    return {
      reply:
        `❓ No client in the DB matches the group name "<b>${escapeHtml(title)}</b>".\n\n` +
        (suggestions.length > 0
          ? `Did you mean:\n${suggestions.map((s) => '  • ' + s.name).join('\n')}\n\n`
          : '') +
        `Use the command: <code>/link &lt;client name&gt;</code> to link this group to a client, ` +
        `or <code>/link &lt;number&gt;</code> if you know the Tele ID.`,
    };
  }
  return {
    reply:
      `⚠️ Multiple clients match the group name "<b>${escapeHtml(title)}</b>".\n\n` +
      `Please use: <code>/link &lt;exact client name&gt;</code> or <code>/link &lt;number&gt;</code>`,
  };
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
    reply: `✅ Linked this group to <b>${escapeHtml(client.name)}</b>. Renewal reminders will be sent here.`,
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
  return { reply: '🔌 This group is no longer linked to any client.' };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function handleMessage(msg, TelegramBotInstance) {
  const text = msg.text || '';
  const chat = msg.chat;
  const chatId = String(chat.id);
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';

  // Private chat instructions.
  if (!isGroup) {
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await TelegramBotInstance.sendMessage(
        chatId,
        '👋 Add me to a Telegram group with the seller and the client, then type /start there.\n' +
        'If the group title contains "Tele NNN" (recommended), the bot links automatically.\n' +
        'Otherwise use /link <client name> or /link <Tele ID number>.'
      );
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

  if (text.match(/^\/start(?:@\w+)?\s*$/)) {
    const out = linkGroupByTitle(chatId, chat.title);
    await TelegramBotInstance.sendMessage(chatId, out.reply, { parse_mode: 'HTML' });
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

  if (text.match(/^\/help(?:@\w+)?\s*$/)) {
    await TelegramBotInstance.sendMessage(
      chatId,
      'Available commands:\n' +
        '  /start — auto-link this group by Tele ID or group name\n' +
        '  /link <number> — link by Tele ID (e.g. /link 256)\n' +
        '  /link <name> — link by exact client name\n' +
        '  /unlink — detach this group from its client\n' +
        '  /status — show the current link\n' +
        '  /help — this message'
    );
  }
}

export async function startBot() {
  if (bot) return { started: true, reason: 'already_running' };
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
  } catch (e) {
    console.error('[telegram] failed to construct bot:', e.message);
    globalThis.__pcaTelegramBotStarted = false;
    return { started: false, reason: 'construct_error' };
  }

  // Validate the token up front.
  try {
    const me = await bot.getMe();
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
  bot.on('polling_error', (err) => {
    console.error('[telegram] polling_error:', err?.code || '', err?.message || err);
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
  globalThis.__pcaTelegramBotStarted = false;
}
