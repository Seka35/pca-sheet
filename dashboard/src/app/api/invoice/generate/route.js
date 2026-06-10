import { NextResponse } from 'next/server';
import { get, all } from '@/lib/db';
import { getWhopLink, WHOP_REFERRAL_PARTNERS, WHOP_SETUP_LINKS } from '@/lib/whopLinks';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sr_no = searchParams.get('sr_no') || '';
    const client_id = searchParams.get('client_id') || '';
    const client_name = searchParams.get('client_name') || '';
    const bank_name = searchParams.get('bank_name') || '';
    const product_name = searchParams.get('product_name') || 'Service';
    const subtotal = searchParams.get('subtotal') || searchParams.get('amount') || 0;
    const discount = searchParams.get('discount') || 0;
    const invoice_date = searchParams.get('invoice_date') || new Date().toISOString().split('T')[0];
    const invoice_no = searchParams.get('invoice_no') || '001';
    // New billing info parameters
    const first_name = searchParams.get('first_name') || '';
    const last_name = searchParams.get('last_name') || '';
    const email = searchParams.get('email') || '';
    const address = searchParams.get('address') || '';
    // WHOP-specific parameters
    const referral_partner_name = searchParams.get('referral_partner_name') || 'N.A.';
    const whop_link_type = searchParams.get('whop_link_type') || 'tier';

    return generateInvoiceResponse({ sr_no, client_id, client_name, bank_name, product_name, subtotal, discount, invoice_date, invoice_no, first_name, last_name, email, address, referral_partner_name, whop_link_type });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return new NextResponse('Error generating invoice', { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    return generateInvoiceResponse(body);
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

function getWhopPaymentLink(referralPartner, tier, linkType = 'tier') {
  // Normalize tier: "TIER 1" -> "tier1", "tier1" -> "tier1"
  // linkType is the full key like "tier1", "tier1_7d_free", "tier1_50_off"
  const normalizedTier = tier ? tier.toUpperCase().replace(/\s+/g, '').replace(/^TIER/, 'tier') : 'tier1';
  // If linkType is provided and different from 'tier', use it directly as the key
  if (linkType && linkType !== 'tier') {
    return getWhopLink({ referralPartner, tier: linkType });
  }
  return getWhopLink({ referralPartner, tier: normalizedTier });
}

function generateInvoiceResponse({ sr_no, client_id, client_name, bank_name, product_name, subtotal, discount, invoice_date, invoice_no, first_name, last_name, email, address, referral_partner_name, whop_link_type }) {
  // Get invoice template
  const templateRow = get('SELECT data_json FROM invoice_settings WHERE id = 1');
  const template = templateRow ? JSON.parse(templateRow.data_json) : {};

  // Normalize bank_name for comparison
  const bankInput = (bank_name || '').toLowerCase().trim();

  // Get bank details
  let bankData = {};
  let bankKey = '';

  // Get all banks and find matching one by bank_key (case-insensitive)
  const banks = all('SELECT bank_key, data_json FROM bank_details', []);
  console.log('Available banks:', banks.map(b => b.bank_key));
  console.log('Looking for bank:', bankInput);

  for (const bank of banks) {
    const bKeyLower = bank.bank_key.toLowerCase();
    console.log('Comparing with:', bKeyLower, 'input:', bankInput);

    if (bankInput === bKeyLower) {
      bankData = JSON.parse(bank.data_json);
      bankKey = bank.bank_key;
      console.log('Matched exactly:', bank.bank_key);
      break;
    }

    // Also check if bank_input contains the bank_key or vice versa
    if (bankInput.includes(bKeyLower) || bKeyLower.includes(bankInput)) {
      bankData = JSON.parse(bank.data_json);
      bankKey = bank.bank_key;
      console.log('Matched partially:', bank.bank_key);
      break;
    }
  }

  // If still no match, try to match by bank_name (in case bank_name column has different values)
  if (!bankKey) {
    console.log('No match by bank_key, trying bank_name match...');
    const banksByName = all('SELECT bank_key, data_json, bank_name FROM bank_details', []);
    for (const bank of banksByName) {
      const bankNameLower = (bank.bank_name || '').toLowerCase();
      if (bankNameLower.includes(bankInput) || bankInput.includes(bankNameLower)) {
        bankData = JSON.parse(bank.data_json);
        bankKey = bank.bank_key;
        console.log('Matched by bank_name:', bank.bank_key, bank.bank_name);
        break;
      }
    }
  }

  console.log('Final bankKey:', bankKey);

  // Build payment instructions based on bank
  let paymentInstructions = '';
  if (bankKey === 'crypto') {
    paymentInstructions = `Payment Instructions:
Full payment must be made upon receipt of this invoice and prior to the start of services.

Beneficiary: WCATFM LLC

USDT TRC20:
${bankData.usdt_trc20 || 'N/A'}

USDT ERC20:
${bankData.usdt_erc20 || 'N/A'}

BTC:
${bankData.btc || 'N/A'}

${bankData.fee_note ? `Note: ${bankData.fee_note}` : ''}`;
  } else if (bankKey === 'lhv') {
    paymentInstructions = `Payment Instructions:
Full payment must be made upon receipt of this invoice and prior to the start of services.

Beneficiary: ${bankData.account_title || 'WCATFM LLC'}
Bank: AS LHV Pank (Sokin)
BIC/SWIFT: ${bankData.bic_swift || 'LHVBEE22'}
IBAN: ${bankData.iban || 'N/A'}
Bank Address: ${bankData.bank_address || 'N/A'}`;
  } else if (bankKey === 'slash') {
    paymentInstructions = `Payment Instructions:
Full payment must be made upon receipt of this invoice and prior to the start of services.

Beneficiary: ${bankData.account_name || 'WCATFM LLC'}
Account Number: ${bankData.account_number || 'N/A'}
Routing: ${bankData.routing || 'N/A'}
SWIFT/BIC: ${bankData.swift_bic || 'CLNOUS66XXX'}
Address: ${bankData.address_entity || 'N/A'}`;
  } else if (bankKey === 'whop') {
    // Get the specific WHOP link based on referral partner and tier
    const partner = referral_partner_name || 'N.A.';
    const tier = product_name || 'TIER 1';
    const linkType = whop_link_type || 'tier';
    const paymentLink = getWhopPaymentLink(partner, tier, linkType);

    paymentInstructions = `Payment Instructions:
Full payment must be made upon receipt of this invoice and prior to the start of services.

Payment via WHOP platform.

Your specific payment link:
${paymentLink || 'Please contact us for your payment link.'}

Referral Partner: ${partner}
Product: ${tier}

If you have any questions about your payment link, please contact us.`;
  } else {
    paymentInstructions = `Payment Instructions:
Full payment must be made upon receipt of this invoice and prior to the start of services.

Please contact us for payment details.`;
  }

  // Build meta rows
  const meta = [
    { label: '', value: 'WCATFM LLC' },
    { label: 'Tax Identification Number:', value: '39-2440278' },
    { label: 'INVOICE NO #', value: invoice_no || '001' },
    { label: 'INVOICE DATE:', value: invoice_date || new Date().toISOString().split('T')[0] }
  ];

  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');

  const parsedSubtotal = Number(subtotal) || 0;
  const parsedDiscount = Number(discount) || 0;

  const metaRows = meta.map(row =>
    `<div class="meta-row">
      ${row.label ? `<span class="m-label">${escapeHtml(row.label)}</span>` : ''}
      <span class="m-value">${escapeHtml(row.value)}</span>
    </div>`
  ).join('');

  const itemTotal = parsedSubtotal;
  const itemsHtml = `
    <tr>
      <td class="desc">${escapeHtml(product_name || 'Service')}</td>
      <td class="qty">1</td>
      <td class="num">${fmt(itemTotal)}</td>
      <td class="num">${fmt(itemTotal)}</td>
    </tr>`;

  const payInstParagraphs = paymentInstructions.split('\n').map(p =>
    `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
  ).join('');

  // Logo handling - use local URL for the logo
  const logoHtml = `<div class="logo-box"><img src="/PCA.png" alt="Prime Circle Agency" onerror="this.parentElement.innerHTML='<div style=\'width:280px;padding:10px 0 6px;text-align:center;margin-bottom:10px;\'><div style=\'font-size:32px;font-style:italic;color:#111;\'>Prime Circle</div><div style=\'font-size:8px;letter-spacing:5px;color:#444;margin-top:2px;\'>AGENCY</div></div>'"></div>`;

  // Build billing info - use personal info if provided, otherwise fall back to client_name
  const billingName = (first_name || last_name) ? `${first_name} ${last_name}`.trim() : (client_name || '');
  const billingEmail = email || '';
  const billingAddress = address || '';

  const billtoLines = [];
  if (billingEmail) billtoLines.push(escapeHtml(billingEmail));
  if (billingAddress) billtoLines.push(escapeHtml(billingAddress));
  if (!billingEmail && !billingAddress) billtoLines.push(`Ref: ${sr_no || 'N/A'}`);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${escapeHtml(billingName || client_name)}</title>
  <style>
    :root {
      --navy-bar: #1f3864;
      --navy-header: #2f5496;
      --label-navy: #1f3864;
      --balance-bg: #9dc3e6;
      --rule: #c9c9c9;
      --row-border: #000000;
      --text: #1a1a1a;
      --invoice-grey: #7f7f7f;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: var(--text); }
    .page { width: 985px; min-height: 1271px; margin: 0 auto; background: #fff; position: relative; display: flex; flex-direction: column; }
    .bar { height: 20px; background: var(--navy-bar); flex: none; }
    .content { padding: 0 30px; flex: 1; }
    .header { display: grid; grid-template-columns: 1fr 1fr; margin: 40px -30px; padding: 20px 30px 25px; }
    .header-left { display: flex; flex-direction: column; align-items: center; }
    .logo-box { background: transparent; width: 280px; padding: 10px 0 6px; text-align: center; margin-bottom: 10px; }
    .logo-box img { max-width: 280px; max-height: 100px; }
    .company-name { font-size: 16px; font-weight: 700; text-align: center; }
    .company-addr { font-size: 14px; text-align: center; line-height: 1.4; }
    .header-right { display: flex; flex-direction: column; }
    .invoice-word { font-size: 36px; font-weight: 300; color: var(--invoice-grey); text-align: center; letter-spacing: 1px; margin: 2px 0 20px; }
    .meta-table { margin-top: auto; }
    .meta-row { display: flex; justify-content: flex-end; align-items: baseline; border-bottom: 1px solid var(--rule); padding: 5px 3px; font-size: 12px; }
    .meta-row .m-label { color: var(--label-navy); font-weight: 700; text-align: right; }
    .meta-row .m-value { color: var(--label-navy); font-weight: 700; margin-left: 5px; }
    .billto-wrap { margin-top: 80px; }
    .billto-head { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .billto-label { color: var(--navy-header); font-weight: 700; font-size: 11px; letter-spacing: .5px; padding-bottom: 5px; border-bottom: 1px solid var(--rule); }
    .billto-spacer { border-bottom: 1px solid var(--rule); }
    .billto-name { font-weight: 700; font-size: 14px; margin-top: 18px; }
    .billto-lines { font-size: 13px; margin-top: 20px; line-height: 1.4; }
    .items { width: 100%; border-collapse: collapse; margin-top: 24px; margin-bottom: 40px; }
    .items thead th { background: var(--navy-header); color: #fff; font-size: 12px; font-weight: 700; padding: 7px 8px; text-align: center; border: 1px solid var(--navy-header); }
    .items thead th.desc { text-align: center; }
    .items tbody td { border: 1px solid var(--row-border); padding: 6px 8px; font-size: 12px; height: 24px; }
    .items td.desc { text-align: left; }
    .items td.qty { text-align: center; }
    .items td.num { text-align: right; }
    .lower { display: grid; grid-template-columns: 1fr 1fr; margin-top: 4px; }
    .pay-instructions { font-size: 11px; line-height: 1.4; padding-top: 5px; }
    .pay-instructions .pi-title { font-weight: 700; margin-bottom: 10px; }
    .pay-instructions p { margin-bottom: 10px; }
    .totals { align-self: start; }
    .totals .t-row { display: grid; grid-template-columns: 1fr 120px; align-items: center; }
    .totals .t-label { text-align: right; padding: 7px 12px 7px 0; font-weight: 700; font-size: 11px; color: var(--label-navy); letter-spacing: .3px; }
    .totals .t-value { text-align: right; padding: 7px 5px; font-size: 12px; border-bottom: 1px solid var(--rule); }
    .totals .balance .t-label { font-size: 16px; font-weight: 700; color: #000; }
    .totals .balance .t-value { background: var(--balance-bg); font-size: 18px; font-weight: 800; color: #000; border: none; padding: 10px 5px; }
    @media print { html, body { background: #fff; } .page { margin: 0; border: none; width: 100%; min-height: 100vh; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="bar"></div>
    <div class="content">
      <div class="header">
        <div class="header-left">
          ${logoHtml}
          <div class="company-name">${escapeHtml(template.company?.name || 'Prime Circle Agency')}</div>
          <div class="company-addr">${(template.company?.addressLines || []).map(l => escapeHtml(l)).join('<br>')}</div>
        </div>
        <div class="header-right">
          <div class="invoice-word">INVOICE</div>
          <div class="meta-table">${metaRows}</div>
        </div>
      </div>
      <div class="billto-wrap">
        <div class="billto-head">
          <div class="billto-label">BILL TO</div>
          <div class="billto-spacer"></div>
        </div>
        <div class="billto-name">${escapeHtml(billingName)}</div>
        <div class="billto-lines">${billtoLines.join('<br>')}</div>
      </div>
      <table class="items">
        <thead><tr><th class="desc">DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="lower">
        <div class="pay-instructions">
          ${payInstParagraphs}
        </div>
        <div class="totals">
          <div class="t-row"><div class="t-label">SUBTOTAL</div><div class="t-value">${template.currency || '$'}${fmt(parsedSubtotal)}</div></div>
          <div class="t-row"><div class="t-label">DISCOUNT</div><div class="t-value">-${template.currency || '$'}${fmt(parsedDiscount)}</div></div>
          <div class="t-row"><div class="t-label">TAX RATE</div><div class="t-value">0%</div></div>
          <div class="t-row"><div class="t-label">TOTAL TAX</div><div class="t-value">${template.currency || '$'}0.00</div></div>
          <div class="t-row"><div class="t-label">SHIPPING</div><div class="t-value">${template.currency || '$'}0.00</div></div>
          <div class="t-row balance"><div class="t-label">Balance Due</div><div class="t-value">${template.currency || '$'}${fmt(parsedSubtotal - parsedDiscount)}</div></div>
        </div>
      </div>
    </div>
    <div class="bar" style="margin-top:auto;"></div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}
