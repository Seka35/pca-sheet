import { NextResponse } from 'next/server';
import { get } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { chatId, srNo, clientName, productName, subtotal, discount, invoiceDate, receivedAmt } = body;

    if (!chatId || !srNo) {
      return NextResponse.json({ error: 'chatId and srNo are required' }, { status: 400 });
    }

    // Get bot token from database config
    const botConfig = get('SELECT token FROM bot_config WHERE id = 1');
    const token = botConfig?.token;
    if (!token) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const dueAmount = (parseFloat(subtotal || '0') - parseFloat(discount || '0')).toFixed(2);
    const received = parseFloat(receivedAmt || '0') || 0;
    const due = Math.max(0, parseFloat(dueAmount) - received).toFixed(2);

    // Send just the text message with Pay Now button (NO PDF)
    // PDF will be sent after admin approval
    const message =
      `📄 <b>Invoice for ${clientName}</b>\n\n` +
      `<b>Product:</b> ${productName || 'Service'}\n` +
      `<b>Total:</b> $${dueAmount}\n` +
      `<b>Already Paid:</b> $${received.toFixed(2)}\n` +
      `<b>Amount Due:</b> $${due}\n` +
      `<b>Due Date:</b> ${invoiceDate || 'N/A'}\n\n` +
      `Click <b>Pay Now</b> below to select your payment method.`;

    const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: 'HTML',
        text: message,
        reply_markup: JSON.stringify({
          inline_keyboard: [[
            { text: '💳 Pay Now', callback_data: `pay_now:${srNo}:${chatId}` },
          ]],
        }),
      }),
    });

    const data = await telegramRes.json();
    if (!data.ok) {
      return NextResponse.json({ error: data.description || 'Telegram API error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Invoice message sent successfully' });
  } catch (e) {
    console.error('[send-invoice-message] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
