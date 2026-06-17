// Reminder sweep — checks renewals and sends Telegram reminders.
// Runs on a setInterval timer, plus on-demand from /api/bot/sweep.

import { all, get, run, db } from './db.js';
import { renderTemplate, buildVars, parseDate } from './botTemplates.js';
import { buildPaymentReminderKeyboard } from './telegramInlineButtons.js';
import { generateInvoicePdfBuffer } from './invoicePdf.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MIN_INTERVAL_MIN = 1;
const DEFAULT_INTERVAL_MIN = 15;

function safeJsonParse(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

export function getConfig() {
  const row = get('SELECT * FROM bot_config WHERE id = 1');
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    enabled: !!row.enabled,
    reminder_days: safeJsonParse(row.reminder_days, [-7, -2, 0, 1]),
    templates: safeJsonParse(row.templates_json, {}),
    sweep_interval_minutes: row.sweep_interval_minutes || DEFAULT_INTERVAL_MIN,
    quiet_hours_start: row.quiet_hours_start || null,
    quiet_hours_end: row.quiet_hours_end || null,
    timezone: row.timezone || 'UTC',
    bot_username: row.bot_username || null,
    last_sweep_at: row.last_sweep_at || null,
    human_verification_enabled: !!row.human_verification_enabled,
    team_notification_chat_id: row.team_notification_chat_id || null,
  };
}

export function upsertConfig(patch) {
  const current = getConfig() || {};
  const merged = { ...current, ...patch };
  run(
    `INSERT INTO bot_config (
       id, token, enabled, reminder_days, templates_json,
       sweep_interval_minutes, quiet_hours_start, quiet_hours_end,
       timezone, bot_username, human_verification_enabled, team_notification_chat_id, updated_at
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       token = excluded.token,
       enabled = excluded.enabled,
       reminder_days = excluded.reminder_days,
       templates_json = excluded.templates_json,
       sweep_interval_minutes = excluded.sweep_interval_minutes,
       quiet_hours_start = excluded.quiet_hours_start,
       quiet_hours_end = excluded.quiet_hours_end,
       timezone = excluded.timezone,
       bot_username = excluded.bot_username,
       human_verification_enabled = excluded.human_verification_enabled,
       team_notification_chat_id = excluded.team_notification_chat_id,
       updated_at = CURRENT_TIMESTAMP`,
    [
      merged.token || null,
      merged.enabled ? 1 : 0,
      JSON.stringify(merged.reminder_days || []),
      JSON.stringify(merged.templates || {}),
      Math.max(MIN_INTERVAL_MIN, Number(merged.sweep_interval_minutes) || DEFAULT_INTERVAL_MIN),
      merged.quiet_hours_start || null,
      merged.quiet_hours_end || null,
      merged.timezone || 'UTC',
      merged.bot_username || null,
      merged.human_verification_enabled ? 1 : 0,
      merged.team_notification_chat_id || null,
    ]
  );
  return getConfig();
}

function inQuietHours(cfg) {
  if (!cfg.quiet_hours_start || !cfg.quiet_hours_end) return false;
  const now = new Date();
  const fmt = (s) => {
    const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const start = fmt(cfg.quiet_hours_start);
  const end = fmt(cfg.quiet_hours_end);
  if (start == null || end == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return cur >= start && cur < end;
  // Wraparound (e.g. 22:00 -> 08:00).
  return cur >= start || cur < end;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function runReminderSweepOnce(bot) {
  const cfg = getConfig();
  if (!cfg) return { skipped: 'no_config' };
  if (!cfg.enabled) return { skipped: 'disabled' };
  if (inQuietHours(cfg)) return { skipped: 'quiet_hours' };

  const templates = cfg.templates || {};
  // Build list of { key: '+1', offset: 1 } from actual template keys
  const templateOffsets = Object.keys(templates)
    .map((k) => {
      const n = Number(String(k).replace(/^[+-]/, ''));
      return { key: k, offset: n, enabled: templates[k].enabled !== false };
    })
    .filter((t) => Number.isFinite(t.offset) && t.enabled);
  if (templateOffsets.length === 0) return { skipped: 'no_templates' };

  // Pull candidates: real renewals, active clients, valid date, unpaid, has a linked group.
  const candidates = all(
    `SELECT r.sr_no, r.client_id, r.client_name, r.tier, r.setup_type,
            r.subscription_fee, r.setup_fee, r.discount, r.amount_received,
            r.valid_stopped_date, r.reminders_sent_json, r.bank_name,
            r.referral_partner_name,
            g.chat_id, g.chat_title
       FROM renewals r
       JOIN clients c ON c.id = r.client_id AND c.status = 'Actif'
       JOIN bot_group_links g ON g.client_id = c.id AND g.status = 'linked'
      WHERE COALESCE(r.valid_stopped_date,'') <> ''
        AND COALESCE(r.reference_no,'') = ''`
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all bank details once for PDF generation
  const allBanks = all('SELECT bank_key, data_json FROM bank_details');
  const bankDataMap = {};
  for (const bank of allBanks) {
    bankDataMap[bank.bank_key.toLowerCase()] = JSON.parse(bank.data_json || '{}');
  }

  const result = { scheduled: 0, sent: 0, failed: 0, skipped_existing: 0, errors: [] };

  for (const row of candidates) {
    const dueDate = parseDate(row.valid_stopped_date);
    if (!dueDate) continue;
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);

    for (const { key: tplKey, offset: dayOffset } of templateOffsets) {
      // dayOffset = 7 means "7 days before due date" (negative diffDays = -7)
      // dayOffset = 1 means "1 day after due date" (diffDays = +1 or -1 for already expired)
      // For negative offsets (before expiry): targetDiff = -dayOffset (e.g. -7 → diffDays must be 7)
      // For positive offsets (after expiry): targetDiff = -dayOffset (e.g. +1 → diffDays must be -1)
      // But for after-expiry, diffDays is already negative, so we match abs: |diffDays| === dayOffset
      const isBefore = dayOffset < 0;
      const targetDiff = isBefore ? -dayOffset : -dayOffset;
      if (diffDays !== targetDiff) continue;

      // Fast cache check (store the numeric offset).
      let cache = [];
      try { cache = JSON.parse(row.reminders_sent_json || '[]'); } catch { cache = []; }
      if (cache.includes(dayOffset)) { result.skipped_existing++; continue; }

      // Belt-and-braces: log table check.
      const existing = get(
        'SELECT 1 AS hit FROM reminder_logs WHERE renewal_sr_no = ? AND reminder_type = ? AND chat_id = ?',
        [row.sr_no, formatType(dayOffset), row.chat_id]
      );
      if (existing) { result.skipped_existing++; continue; }

      const tpl = templates[tplKey];
      const vars = buildVars(row, diffDays);
      const text = renderTemplate(tpl.message, vars);
      const isFinalReminder = tpl.is_final_reminder === true;

      result.scheduled++;
      if (!bot) {
        result.errors.push({ sr_no: row.sr_no, chat_id: row.chat_id, reason: 'bot_not_started' });
        continue;
      }

      const keyboard = buildPaymentReminderKeyboard(row.sr_no, row.chat_id);

      if (cfg.human_verification_enabled) {
        // Human verification enabled: create pending approval entry instead of sending
        run(`
          INSERT INTO message_approvals
            (renewal_sr_no, client_id, client_name, tele_id, chat_id, chat_title,
             reminder_type, message, is_final_reminder, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
          ON CONFLICT(renewal_sr_no, reminder_type, chat_id) DO NOTHING
        `, [
          row.sr_no, row.client_id, row.client_name, row.tele_id,
          row.chat_id, row.chat_title,
          formatType(dayOffset), text, isFinalReminder ? 1 : 0
        ]);
        // Mark as scheduled so it's not re-queued on next sweep
        cache.push(dayOffset);
        run('UPDATE renewals SET reminders_sent_json = ? WHERE sr_no = ?',
          [JSON.stringify(cache), row.sr_no]);
        // No Telegram message sent yet — will be sent after admin approval
      } else {
        // No human verification: send directly
        try {
          // Generate PDF invoice using Puppeteer (renders the exact HTML invoice)
          let pdfPath = null;
          try {
            const bankKey = (row.bank_name || '').toLowerCase().trim();
            const bankData = bankDataMap[bankKey] || {};

            // Parse amounts correctly (subscription_fee is "$199.00", discount is "$29.85")
            const parseMoney = (s) => parseFloat(String(s || '0').replace(/[^0-9.]/g, '')) || 0;
            const subscriptionFee = parseMoney(row.subscription_fee);
            const discountAmount = parseMoney(row.discount);

            const pdfBuffer = await generateInvoicePdfBuffer({
              sr_no: row.sr_no,
              client_name: row.client_name,
              bank_name: row.bank_name,
              product_name: row.tier || 'Service',
              subtotal: subscriptionFee.toFixed(2),
              discount: discountAmount.toFixed(2),
              invoice_date: row.valid_stopped_date || new Date().toISOString().split('T')[0],
              invoice_no: row.sr_no ? row.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001',
              bankData,
              referral_partner_name: row.referral_partner_name || 'N.A.',
              whop_link_type: 'tier',
            });
            // Write to temp file for Telegram sending
            pdfPath = path.join(os.tmpdir(), `invoice-${row.sr_no}-${Date.now()}.pdf`);
            fs.writeFileSync(pdfPath, pdfBuffer);
          } catch (pdfErr) {
            console.error('[sweep] PDF generation failed:', pdfErr.message);
            // Continue without PDF if generation fails
          }

          const msg = await bot.sendMessage(row.chat_id, text, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: JSON.stringify(keyboard.reply_markup),
          });

          // Send PDF as document if available
          if (pdfPath && fs.existsSync(pdfPath)) {
            try {
              await bot.sendDocument(row.chat_id, pdfPath, {
                parse_mode: 'HTML',
                caption: `📄 <b>Invoice</b> for ${row.client_name} — ${row.subscription_fee || '$0'}`,
              });
            } catch (docErr) {
              console.error('[sweep] PDF send failed:', docErr.message);
            } finally {
              // Clean up temp file
              try { fs.unlinkSync(pdfPath); } catch {}
            }
          }

          run(
            `INSERT INTO reminder_logs
               (chat_id, client_id, renewal_sr_no, reminder_type, message, status, telegram_message_id)
             VALUES (?, ?, ?, ?, ?, 'sent', ?)
             ON CONFLICT(renewal_sr_no, reminder_type, chat_id) DO NOTHING`,
            [row.chat_id, row.client_id, row.sr_no, formatType(dayOffset), text, msg?.message_id || null]
          );
          cache.push(dayOffset);
          run('UPDATE renewals SET reminders_sent_json = ? WHERE sr_no = ?', [JSON.stringify(cache), row.sr_no]);
          result.sent++;

          // Product-disable step: runs after the message is sent
          if (isFinalReminder) {
            // Mark product as inactive
            run('UPDATE renewals SET visual_status = ? WHERE sr_no = ?', ['', row.sr_no]);

            // Send team notification if configured
            if (cfg?.team_notification_chat_id) {
              const teamMsg =
                `🔕 <b>Product Disabled</b>\n\n` +
                `Client: <b>${escapeHtml(row.client_name || '')}</b>\n` +
                `Product: <b>${escapeHtml(row.tier || row.setup_type || 'N/A')}</b>\n` +
                `Amount: <b>${escapeHtml(row.subscription_fee || '$0')}</b>\n` +
                `Due date: ${row.valid_stopped_date || 'N/A'}\n\n` +
                `The product has been marked <b>inactive</b> and reminders have stopped.`;

              bot.sendMessage(cfg.team_notification_chat_id, teamMsg, { parse_mode: 'HTML' }).catch((e) => {
                console.error('[sweep] team notification failed:', e?.response?.body?.description || e?.message);
              });
            }
          }
        } catch (err) {
          const errMsg = err?.response?.body?.description || err?.message || String(err);
          run(
            `INSERT INTO reminder_logs
               (chat_id, client_id, renewal_sr_no, reminder_type, message, status, error)
             VALUES (?, ?, ?, ?, ?, 'failed', ?)
             ON CONFLICT(renewal_sr_no, reminder_type, chat_id) DO NOTHING`,
            [row.chat_id, row.client_id, row.sr_no, formatType(dayOffset), text, errMsg]
          );
          result.failed++;
          result.errors.push({ sr_no: row.sr_no, chat_id: row.chat_id, reason: errMsg });
        }
      }

      // Telegram per-chat rate limit: 1 msg/s.
      await sleep(1100);
    }
  }

  run('UPDATE bot_config SET last_sweep_at = CURRENT_TIMESTAMP WHERE id = 1');
  return result;
}

export function formatType(dayOffset) {
  if (dayOffset === 0) return 'T0';
  return dayOffset > 0 ? `T+${dayOffset}` : `T${dayOffset}`;
}

// Timer management. Stored on globalThis so dev hot-reload doesn't double-schedule.
export function startSweepTimer(getBot) {
  if (globalThis.__pcaSweepTimer) clearInterval(globalThis.__pcaSweepTimer);
  const cfg = getConfig();
  const minutes = cfg?.sweep_interval_minutes || DEFAULT_INTERVAL_MIN;
  const ms = Math.max(MIN_INTERVAL_MIN, minutes) * 60 * 1000;

  // Kick off one immediately on boot.
  runReminderSweepOnce(getBot()).catch((e) => console.error('[sweep] initial run failed', e));

  globalThis.__pcaSweepTimer = setInterval(() => {
    runReminderSweepOnce(getBot()).catch((e) => console.error('[sweep] tick failed', e));
  }, ms);
  return ms;
}

export function stopSweepTimer() {
  if (globalThis.__pcaSweepTimer) {
    clearInterval(globalThis.__pcaSweepTimer);
    globalThis.__pcaSweepTimer = null;
  }
}
