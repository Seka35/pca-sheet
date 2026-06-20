import { NextResponse } from 'next/server';
import { getBot } from '@/lib/telegramBot';
import { generateInvoicePdfBuffer } from '@/lib/invoicePdf';

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      chatId,
      srNo,
      clientId,
      clientName,
      bankName,
      productName,
      subtotal,
      discount,
      invoiceDate,
      invoiceNo,
      billing,
    } = body;

    if (!chatId || !srNo) {
      return NextResponse.json({ error: 'chatId and srNo are required' }, { status: 400 });
    }

    const bot = getBot();
    if (!bot) {
      return NextResponse.json({ error: 'Bot is not running' }, { status: 500 });
    }

    // Generate PDF invoice
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePdfBuffer({
        sr_no: srNo,
        client_name: clientName,
        bank_name: bankName || 'crypto',
        product_name: productName || 'Service',
        subtotal: subtotal || '0',
        discount: discount || '0',
        invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
        invoice_no: invoiceNo || '001',
        referral_partner_name: billing?.referral_partner_name || 'N.A.',
        whop_link_type: 'tier',
      });
    } catch (e) {
      console.error('[send-invoice] PDF generation failed:', e.message);
    }

    const subTotal = parseFloat(subtotal || '0');
    const discAmt = parseFloat(discount || '0');
    const paidAmt = parseFloat(billing?.amount_received || '0');
    const dueAmount = Math.max(0, subTotal - discAmt - paidAmt).toFixed(2);

    // Build the message with invoice info and Pay Now button only
    const message =
      `📄 <b>Invoice for ${clientName}</b>\n\n` +
      `<b>Product:</b> ${productName}\n` +
      `<b>Subtotal:</b> $${subTotal.toFixed(2)}\n` +
      `<b>Discount:</b> $${discAmt.toFixed(2)}\n` +
      `<b>Amount Paid:</b> $${paidAmt.toFixed(2)}\n` +
      `<b>Balance Due:</b> $${dueAmount}\n` +
      `<b>Due Date:</b> ${invoiceDate || 'N/A'}\n\n` +
      `Click <b>Pay Now</b> to select your payment method.`;

    // Keyboard with Pay Now only (no Remind Later)
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          { text: '💳 Pay Now', callback_data: `pay_now:${srNo}:${chatId}` },
        ]],
      },
    };

    // Send the invoice message with PDF attachment
    if (pdfBuffer) {
      await bot.sendDocument(chatId, Buffer.from(pdfBuffer, 'base64'), {
        caption: message,
        parse_mode: 'HTML',
        reply_markup: JSON.stringify(keyboard.reply_markup),
      });
    } else {
      // Fallback: send just the text message if PDF fails
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify(keyboard.reply_markup),
      });
    }

    return NextResponse.json({ ok: true, message: 'Invoice sent successfully' });
  } catch (e) {
    console.error('[send-invoice] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
