import { NextResponse } from 'next/server';
import { get } from '@/lib/db';

export async function GET() {
  try {
    // Get invoice template
    const templateRow = get('SELECT data_json FROM invoice_settings WHERE id = 1');
    const template = templateRow ? JSON.parse(templateRow.data_json) : {};

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Use logo from template or default
    const logoSrc = template.logo?.src || 'https://pca.primecircle.pro/PCA.png';

    // Meta rows
    const meta = template.meta || [
      { label: '', value: 'WCATFM LLC' },
      { label: 'Tax Identification Number:', value: '39-2440278' },
      { label: 'INVOICE NO #', value: '001' },
      { label: 'INVOICE DATE:', value: new Date().toISOString().split('T')[0] }
    ];

    const metaRows = meta.map(row =>
      `<div class="meta-row">
        ${row.label ? `<span class="m-label">${escapeHtml(row.label)}</span>` : ''}
        <span class="m-value">${escapeHtml(row.value)}</span>
      </div>`
    ).join('');

    // Items
    const items = template.items || [{ description: 'Sample Service', qty: 1, unitPrice: 0 }];
    const itemsHtml = items.map(item => {
      const total = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
      return `<tr>
        <td class="desc">${escapeHtml(item.description || '')}</td>
        <td class="qty">${escapeHtml(String(item.qty || ''))}</td>
        <td class="num">${fmt(item.unitPrice)}</td>
        <td class="num">${fmt(total)}</td>
      </tr>`;
    }).join('');

    // Totals
    const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
    const discount = Number(template.adjustments?.discount) || 0;
    const lessDisc = subtotal - discount;
    const taxRate = Number(template.adjustments?.taxRate) || 0;
    const totalTax = lessDisc * taxRate / 100;
    const shipping = Number(template.adjustments?.shipping) || 0;
    const balanceDue = lessDisc + totalTax + shipping;

    // Payment instructions
    const payInstParagraphs = (template.paymentInstructions?.paragraphs || []).map(p =>
      `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
    ).join('');

    // Bill to
    const billToLines = (template.billTo?.lines || []).map(l => escapeHtml(l)).join('<br>');

    // Logo with fallback - use local path since external URL requires auth
    const logoHtml = `<div class="logo-box"><img src="/PCA.png" alt="Prime Circle Agency" onerror="this.parentElement.innerHTML='<div style=\'width:280px;padding:10px 0 6px;text-align:center;margin-bottom:10px;\'><div style=\'font-size:32px;font-style:italic;color:#111;\'>Prime Circle</div><div style=\'font-size:8px;letter-spacing:5px;color:#444;margin-top:2px;\'>AGENCY</div></div>'"></div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice Preview</title>
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
        <div class="billto-name">${escapeHtml(template.billTo?.name || 'Client Name')}</div>
        <div class="billto-lines">${billToLines}</div>
      </div>
      <table class="items">
        <thead><tr><th class="desc">DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="lower">
        <div class="pay-instructions">
          <div class="pi-title">${escapeHtml(template.paymentInstructions?.title || 'Payment Instructions:')}</div>
          ${payInstParagraphs}
        </div>
        <div class="totals">
          <div class="t-row"><div class="t-label">SUBTOTAL</div><div class="t-value">${fmt(subtotal)}</div></div>
          ${discount > 0 ? `<div class="t-row"><div class="t-label">DISCOUNT</div><div class="t-value">${fmt(discount)}</div></div>` : ''}
          <div class="t-row"><div class="t-label">SUBTOTAL LESS DISCOUNT</div><div class="t-value">${fmt(lessDisc)}</div></div>
          ${taxRate > 0 ? `<div class="t-row"><div class="t-label">TAX RATE</div><div class="t-value">${fmt(taxRate)}%</div></div><div class="t-row"><div class="t-label">TOTAL TAX</div><div class="t-value">${fmt(totalTax)}</div></div>` : ''}
          ${shipping > 0 ? `<div class="t-row"><div class="t-label">SHIPPING/HANDLING</div><div class="t-value">${fmt(shipping)}</div></div>` : ''}
          <div class="t-row balance"><div class="t-label">Balance Due</div><div class="t-value">${template.currency || '$'}${fmt(balanceDue)}</div></div>
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
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return new NextResponse('Error generating preview', { status: 500 });
  }
}