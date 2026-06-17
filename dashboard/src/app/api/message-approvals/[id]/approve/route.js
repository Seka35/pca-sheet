import { NextResponse } from 'next/server';
import { get, run, all } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';
import { buildPaymentReminderKeyboard } from '@/lib/telegramInlineButtons';
import { generateInvoicePdfBuffer } from '@/lib/invoicePdf';
import { buildVars, parseDate } from '@/lib/botTemplates';
import { renderTemplate } from '@/lib/botTemplates';
import fs from 'fs';
import path from 'path';
import os from 'os';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(req) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2]; // /api/message-approvals/[id]/approve

  try {
    let reviewed_by = 'admin';

    const entry = get('SELECT * FROM message_approvals WHERE id = ?', [id]);

    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (entry.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot not running' }, { status: 500 });
    }

    // Regenerate the keyboard (same as in sweep)
    const keyboard = buildPaymentReminderKeyboard(entry.renewal_sr_no, entry.chat_id);

    // Fetch bank details for PDF
    const allBanks = all('SELECT bank_key, data_json FROM bank_details');
    const bankDataMap = {};
    for (const bank of allBanks) {
      bankDataMap[bank.bank_key.toLowerCase()] = JSON.parse(bank.data_json || '{}');
    }

    // Fetch renewal row for PDF generation
    const renewalRow = get(`
      SELECT r.sr_no, r.client_id, r.client_name, r.tier, r.setup_type,
             r.subscription_fee, r.setup_fee, r.discount, r.amount_received,
             r.valid_stopped_date, r.reminders_sent_json, r.bank_name,
             r.referral_partner_name
      FROM renewals r
      WHERE r.sr_no = ?
    `, [entry.renewal_sr_no]);

    // Generate PDF invoice
    let pdfPath = null;
    try {
      if (renewalRow) {
        const bankKey = (renewalRow.bank_name || '').toLowerCase().trim();
        const bankData = bankDataMap[bankKey] || {};

        const parseMoney = (s) => parseFloat(String(s || '0').replace(/[^0-9.]/g, '')) || 0;
        const subscriptionFee = parseMoney(renewalRow.subscription_fee);
        const discountAmount = parseMoney(renewalRow.discount);

        const pdfBuffer = await generateInvoicePdfBuffer({
          sr_no: renewalRow.sr_no,
          client_name: renewalRow.client_name,
          bank_name: renewalRow.bank_name,
          product_name: renewalRow.tier || 'Service',
          subtotal: subscriptionFee.toFixed(2),
          discount: discountAmount.toFixed(2),
          invoice_date: renewalRow.valid_stopped_date || new Date().toISOString().split('T')[0],
          invoice_no: renewalRow.sr_no ? renewalRow.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001',
          bankData,
          referral_partner_name: renewalRow.referral_partner_name || 'N.A.',
          whop_link_type: 'tier',
        });
        pdfPath = path.join(os.tmpdir(), `invoice-${renewalRow.sr_no}-${Date.now()}.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);
      }
    } catch (pdfErr) {
      console.error('[approve] PDF generation failed:', pdfErr.message);
      // Continue without PDF
    }

    // Send the Telegram message
    let sentMessageId = null;
    try {
      const msg = await bot.sendMessage(entry.chat_id, entry.message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: JSON.stringify(keyboard.reply_markup),
      });
      sentMessageId = msg?.message_id || null;
    } catch (sendErr) {
      console.error('[approve] sendMessage failed:', sendErr.message);
      return NextResponse.json({ error: 'Failed to send message: ' + sendErr.message }, { status: 500 });
    }

    // Send PDF as document if available
    if (pdfPath && fs.existsSync(pdfPath)) {
      try {
        await bot.sendDocument(entry.chat_id, pdfPath, {
          parse_mode: 'HTML',
          caption: `📄 <b>Invoice</b> for ${entry.client_name} — ${renewalRow?.subscription_fee || '$0'}`,
        });
      } catch (docErr) {
        console.error('[approve] PDF send failed:', docErr.message);
      } finally {
        try { fs.unlinkSync(pdfPath); } catch {}
      }
    }

    // Update message_approvals to APPROVED
    run(
      `UPDATE message_approvals SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, sent_message_id = ? WHERE id = ?`,
      [reviewed_by, sentMessageId, id]
    );

    // Insert into reminder_logs
    run(
      `INSERT INTO reminder_logs
         (chat_id, client_id, renewal_sr_no, reminder_type, message, status, telegram_message_id)
       VALUES (?, ?, ?, ?, ?, 'sent', ?)
       ON CONFLICT(renewal_sr_no, reminder_type, chat_id) DO NOTHING`,
      [entry.chat_id, entry.client_id, entry.renewal_sr_no, entry.reminder_type, entry.message, sentMessageId]
    );

    // Update renewals.reminders_sent_json to mark this offset as sent
    if (renewalRow) {
      let cache = [];
      try { cache = JSON.parse(renewalRow.reminders_sent_json || '[]'); } catch {}
      // Parse offset from reminder_type (e.g. "T-7" -> -7, "T0" -> 0, "T+1" -> 1)
      const offsetMatch = entry.reminder_type.match(/^T([+-]?\d+)$/);
      const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
      if (!cache.includes(offset)) {
        cache.push(offset);
        run('UPDATE renewals SET reminders_sent_json = ? WHERE sr_no = ?',
          [JSON.stringify(cache), entry.renewal_sr_no]);
      }
    }

    // Product-disable step: if this is the final-reminder template
    if (entry.is_final_reminder) {
      // Mark product as inactive
      run('UPDATE renewals SET visual_status = ? WHERE sr_no = ?', ['', entry.renewal_sr_no]);

      // Fetch team_notification_chat_id
      const cfgRow = get('SELECT team_notification_chat_id FROM bot_config WHERE id = 1');
      if (cfgRow?.team_notification_chat_id) {
        const teamMsg =
          `🔕 <b>Product Disabled</b>\n\n` +
          `Client: <b>${escapeHtml(entry.client_name || '')}</b>\n` +
          `Product: <b>${escapeHtml(renewalRow?.tier || renewalRow?.setup_type || 'N/A')}</b>\n` +
          `Amount: <b>${escapeHtml(renewalRow?.subscription_fee || '$0')}</b>\n` +
          `Due date: ${renewalRow?.valid_stopped_date || 'N/A'}\n\n` +
          `The product has been marked <b>inactive</b> and reminders have stopped.`;

        bot.sendMessage(cfgRow.team_notification_chat_id, teamMsg, { parse_mode: 'HTML' }).catch((e) => {
          console.error('[approve] team notification failed:', e?.response?.body?.description || e?.message);
        });
      }
    }

    console.log('[approve] message approved and sent for sr_no:', entry.renewal_sr_no);
    return NextResponse.json({ ok: true, sent_message_id: sentMessageId });
  } catch (e) {
    console.error('[approve] ERROR:', e.message);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}
