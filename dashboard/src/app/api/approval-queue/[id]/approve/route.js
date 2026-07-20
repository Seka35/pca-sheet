import { NextResponse } from 'next/server';
import { get, run, all } from '@/lib/db';
import { getBot } from '@/lib/telegramBot';
import { generateInvoicePdfBuffer } from '@/lib/invoicePdf';
import fs from 'fs';
import path from 'path';
import os from 'os';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Creates a new renewal row for the next month after a product is paid in full.
 */
function createNextMonthRenewal(existingRenewal, paymentReceivedDate) {
  const existingSrNos = all(
    "SELECT sr_no FROM renewals WHERE client_id = ? ORDER BY sr_no DESC LIMIT 1",
    [existingRenewal.client_id]
  );
  let nextSeq = 1;
  if (existingSrNos.length > 0) {
    const lastSrNo = existingSrNos[0].sr_no;
    const parts = lastSrNo.split('.');
    if (parts.length === 2) {
      nextSeq = parseInt(parts[1], 10) + 1;
    }
  }
  const newSrNo = `${existingRenewal.client_id}.${String(nextSeq).padStart(2, '0')}`;

  let startDate = paymentReceivedDate || new Date().toISOString().split('T')[0];
  if (startDate && startDate.includes('/')) {
    const [d, m, y] = startDate.split('/');
    startDate = `${y}-${m}-${d}`;
  }

  const startD = new Date(startDate);
  startD.setMonth(startD.getMonth() + 1);
  const validStoppedDate = startD.toISOString().split('T')[0];
  const monthLabel = startD.toLocaleString('en-US', { month: 'short', year: 'numeric' });

  // Determine the effective tier for the new renewal
  // If the existing renewal was a ponctual upgrade (is_ponctual_upgrade=1),
  // use original_tier for the new month's renewal (not the temporarily upgraded tier)
  const wasPonctualUpgrade = existingRenewal.is_ponctual_upgrade == 1;
  const effectiveTier = (wasPonctualUpgrade && existingRenewal.original_tier)
    ? existingRenewal.original_tier
    : existingRenewal.tier;
  const effectiveSetupType = (wasPonctualUpgrade && existingRenewal.original_setup)
    ? existingRenewal.original_setup
    : existingRenewal.setup_type;

  run(`
    INSERT INTO renewals (
      sr_no, client_id, client_name, client_status_history, month,
      start_date, client_ad_id_name, ad_id_number, ad_account_type,
      tier, ad_spend_limit, setup_type, subscription_fee, setup_fee,
      discount, cl_amount, referral_partner_name, referral_amount,
      valid_stopped_date, payment_name, bank_name,
      amount_received, payment_received_date, payment_received_month,
      reference_no, actual_balance_difference, notes, visual_status,
      original_tier, original_setup, is_ponctual_upgrade, upgrade_chain_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newSrNo,
    existingRenewal.client_id,
    existingRenewal.client_name,
    existingRenewal.client_status_history || '',
    monthLabel,
    startDate,
    existingRenewal.client_ad_id_name || '',
    existingRenewal.ad_id_number || '',
    existingRenewal.ad_account_type || '',
    effectiveTier || '',
    existingRenewal.ad_spend_limit || '',
    effectiveSetupType || '',
    existingRenewal.subscription_fee || '',
    existingRenewal.setup_fee || '',
    existingRenewal.discount || '',
    existingRenewal.cl_amount || '',
    existingRenewal.referral_partner_name || '',
    existingRenewal.referral_amount || '',
    validStoppedDate,
    existingRenewal.payment_name || '',
    existingRenewal.bank_name || '',
    '',
    '',
    '',
    '',
    existingRenewal.actual_balance_difference || '',
    existingRenewal.notes || '',
    'Active',
    wasPonctualUpgrade ? (existingRenewal.original_tier || '') : '',
    wasPonctualUpgrade ? (existingRenewal.original_setup || '') : '',
    0,
    '[]',
  ]);

  return newSrNo;
}

export async function POST(req) {
  // Extract ID from URL since params can be empty in Next.js 16
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2]; // /api/approval-queue/[id]/approve -> index -2 is [id]

  console.log('[APPROVE] id from url:', id);

  try {
    let reviewed_by = 'admin';

    const entry = get('SELECT * FROM approval_queue WHERE id = ?', [id]);
    console.log('[APPROVE] entry:', entry ? 'found' : 'NOT FOUND');

    if (!entry) {
      return NextResponse.json({ error: 'Not found', id }, { status: 404 });
    }

    if (entry.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    run(
      `UPDATE approval_queue SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?`,
      [reviewed_by, id]
    );

    run(
      `UPDATE payment_proofs SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [entry.proof_id]
    );

    const existingRenewal = get('SELECT * FROM renewals WHERE sr_no = ?', [entry.sr_no]);

    // Get the payment method chosen by client (from payment_selections)
    const paymentSelection = get('SELECT method FROM payment_selections WHERE sr_no = ? AND chat_id = (SELECT chat_id FROM bot_group_links WHERE client_id = ? LIMIT 1) ORDER BY selected_at DESC LIMIT 1', [entry.sr_no, entry.client_id]);

    // Calculate amount_due: subscription + setup - discount
    const amountDue = parseFloat(String(entry.amount_due || '0').replace(/[^0-9.]/g, '')) || 0;

    // Calculate valid_stopped_date = start_date + 7 days (trial) or + 1 month (regular)
    const isTrial = existingRenewal?.is_trial === 1;
    let newValidStoppedDate = null;
    if (existingRenewal && existingRenewal.start_date) {
      const startDate = new Date(existingRenewal.start_date);
      if (!isNaN(startDate.getTime())) {
        if (isTrial) {
          startDate.setDate(startDate.getDate() + 7);
        } else {
          startDate.setMonth(startDate.getMonth() + 1);
        }
        newValidStoppedDate = startDate.toISOString().split('T')[0];
      }
    }

    // Check if this is a topup
    const isTopup = entry.is_topup === 1;

    // Topups require an existing renewal - reject if not found
    if (isTopup && !existingRenewal) {
      return NextResponse.json({ error: 'Topup requires an existing product' }, { status: 400 });
    }

    if (existingRenewal) {
      // Determine the bank_name to store: use payment method if available, otherwise keep existing
      const methodLabels = {
        usdt_trc20: 'Crypto - USDT TRC20',
        usdt_erc20: 'Crypto - USDT ERC20',
        btc: 'Crypto - BTC',
        lhv: 'LHV - SEPA',
        slash: 'Slash - US Wire',
        whop: 'WHOP'
      };
      const bankNameToStore = paymentSelection?.method ? (methodLabels[paymentSelection.method] || entry.bank_name) : entry.bank_name;

      if (isTopup) {
        // TOPUP: add ONLY the topup_amount to cl_amount (credit balance)
        // amountDue is the total paid which may include subscription, but CL gets only topup
        const currentCl = parseAmount(existingRenewal.cl_amount);
        const topupOnlyAmount = parseFloat(entry.topup_amount || amountDue);
        const newClAmount = currentCl + topupOnlyAmount;

        run(
          `UPDATE renewals SET
            cl_amount = ?,
            bank_name = ?
          WHERE sr_no = ?`,
          [newClAmount.toString(), bankNameToStore, entry.sr_no]
        );

        // Record this topup in the payments table with is_topup=1
        run(
          `INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, is_topup, notes)
           VALUES (?, ?, ?, DATE('now'), strftime('%Y-%m', 'now'), ?, ?, 1, ?)`,
          [entry.client_id, entry.sr_no, topupOnlyAmount, entry.transaction_id, bankNameToStore, 'Approved top-up - Telegram bot']
        );
      } else {
        // REGULAR PAYMENT: update amount_received, set visual_status to Active
        run(
          `UPDATE renewals SET
            reference_no = ?,
            transaction_id = ?,
            payment_proof_url = ?,
            paid_at = CURRENT_TIMESTAMP,
            payment_received_date = DATE('now'),
            payment_received_month = strftime('%Y-%m', 'now'),
            amount_received = ?,
            bank_name = ?,
            valid_stopped_date = COALESCE(?, valid_stopped_date),
            visual_status = 'Active'
          WHERE sr_no = ?`,
          [entry.transaction_id, entry.transaction_id, entry.proof_image_url, amountDue, bankNameToStore, newValidStoppedDate, entry.sr_no]
        );

        // Also record this payment in the payments table (for multiple payments per product)
        run(
          `INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, notes)
           VALUES (?, ?, ?, DATE('now'), strftime('%Y-%m', 'now'), ?, ?, ?)`,
          [entry.client_id, entry.sr_no, amountDue, entry.transaction_id, bankNameToStore, 'Approved payment - Telegram bot']
        );

        // Also activate the client if payment is approved
        run(`UPDATE clients SET status = 'Actif' WHERE id = ?`, [entry.client_id]);

        // NOTE: We do NOT create a new renewal here. The product stays as ONE product.
        // Each payment is recorded in the payments table for history.
        // The renewal's valid_stopped_date is updated above to extend the current product.
      }
    } else {
      // Renewal doesn't exist - create it with the approval data
      const startDate = new Date().toISOString().split('T')[0];
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);
      const validUntilStr = validUntil.toISOString().split('T')[0];

      run(
        `INSERT INTO renewals (
          sr_no, client_id, client_name, month,
          reference_no, transaction_id, payment_proof_url,
          paid_at, payment_received_date, payment_received_month,
          visual_status, start_date, valid_stopped_date,
          amount_received, bank_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, DATE('now'), strftime('%Y-%m', 'now'), 'Active', ?, ?, ?, ?)`,
        [
          entry.sr_no,
          entry.client_id,
          entry.client_name,
          entry.due_date ? entry.due_date.slice(0, 7) : (new Date().toISOString().slice(0, 7)),
          entry.transaction_id,
          entry.transaction_id,
          entry.proof_image_url,
          startDate,
          validUntilStr,
          amountDue,
          entry.bank_name,
        ]
      );
      run(`UPDATE clients SET status = 'Actif' WHERE id = ?`, [entry.client_id]);

      // Also record this payment in the payments table (for newly created renewal)
      run(
        `INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, notes)
         VALUES (?, ?, ?, DATE('now'), strftime('%Y-%m', 'now'), ?, ?, ?)`,
        [entry.client_id, entry.sr_no, amountDue, entry.transaction_id, entry.bank_name, 'Approved payment - Telegram bot (new renewal)']
      );
    }

    // Send Telegram notification + invoice to the client
    try {
      const link = get(`SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`, [entry.client_id]);
      const bot = getBot();
      if (link && bot) {
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
        `, [entry.sr_no]);

        // Generate PDF invoice
        let pdfPath = null;
        try {
          if (renewalRow) {
            const bankKey = (renewalRow.bank_name || '').toLowerCase().trim();
            const bankData = bankDataMap[bankKey] || {};

            const parseMoney = (s) => parseFloat(String(s || '0').replace(/[^0-9.]/g, '')) || 0;
            const discountAmount = parseMoney(renewalRow.discount);

            // For topups: show "Top-Up" as product name and use the topup amount as subtotal
            // For regular payments: use the renewal's subscription fee
            let productName, subtotal;
            if (isTopup) {
              productName = 'Top-Up';
              subtotal = amountDue.toFixed(2);
            } else {
              productName = renewalRow.tier || 'Service';
              subtotal = parseMoney(renewalRow.subscription_fee).toFixed(2);
            }

            // For topups, don't pass sr_no so invoice uses passed params directly
            // (otherwise the invoice route fetches renewal data and ignores our params)
            const pdfBuffer = await generateInvoicePdfBuffer({
              sr_no: isTopup ? '' : renewalRow.sr_no,
              client_name: renewalRow.client_name,
              bank_name: renewalRow.bank_name,
              product_name: productName,
              subtotal: subtotal,
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
          console.error('[APPROVE] PDF generation failed:', pdfErr.message);
        }

        // Send payment confirmation without buttons (approved = no more action needed)
        const confirmMsg = isTopup
          ? `✅ <b>Top-Up Approved!</b>\n\n` +
            `<b>${entry.client_name}</b>, your top-up of <b>${entry.amount_due}</b> has been <b>approved</b>!\n\n` +
            `Transaction ID: <code>${entry.transaction_id || 'N/A'}</code>\n\n` +
            `Your credit balance has been updated. Thank you!`
          : `✅ <b>Payment Approved!</b>\n\n` +
            `<b>${entry.client_name}</b>, your payment of <b>${entry.amount_due}</b> has been <b>approved</b>!\n\n` +
            `Transaction ID: <code>${entry.transaction_id || 'N/A'}</code>\n\n` +
            `Your account is now active. Thank you for your payment!`;

        await bot.sendMessage(
          link.chat_id,
          confirmMsg,
          {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }
        );

        // Send PDF invoice as document if available
        if (pdfPath && fs.existsSync(pdfPath)) {
          try {
            await bot.sendDocument(link.chat_id, pdfPath, {
              parse_mode: 'HTML',
              caption: `📄 <b>Invoice</b> for ${entry.client_name} — ${isTopup ? entry.amount_due : (renewalRow?.subscription_fee || entry.amount_due)}`,
            });
          } catch (docErr) {
            console.error('[APPROVE] PDF send failed:', docErr.message);
          } finally {
            try { fs.unlinkSync(pdfPath); } catch {}
          }
        }
      }
    } catch (e) {
      console.error('[APPROVE] Telegram notification failed:', e.message);
    }

    console.log('[APPROVE] success for sr_no:', entry.sr_no);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[APPROVE] ERROR:', e.message);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}