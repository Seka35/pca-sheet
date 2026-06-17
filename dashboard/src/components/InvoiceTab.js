"use client";

import { useState, useEffect, useRef } from 'react';

export default function InvoiceTab() {
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    fetch('/api/invoice')
      .then(res => res.json())
      .then(data => {
        setInvoiceData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching invoice:', err);
        setLoading(false);
      });
  }, []);

  const handleChange = (path, value) => {
    setInvoiceData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleArrayChange = (path, index, value) => {
    setInvoiceData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]][index] = value;
      return next;
    });
  };

  const handleMetaChange = (index, field, value) => {
    setInvoiceData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.meta[index][field] = value;
      return next;
    });
  };

  const handleItemChange = (index, field, value) => {
    setInvoiceData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.items[index][field] = field === 'qty' || field === 'unitPrice' ? parseFloat(value) || 0 : value;
      return next;
    });
  };

  const addItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', qty: 1, unitPrice: 0 }]
    }));
  };

  const removeItem = (index) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/invoice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      if (res.ok) {
        setPreviewKey(k => k + 1);
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
    }
    setSaving(false);
  };

  const downloadPdf = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generatePreviewHtml());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const generatePreviewHtml = () => {
    if (!invoiceData) return '';

    const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const d = invoiceData;
    const itemsHtml = d.items.map(item => {
      const total = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
      return `<tr>
        <td class="desc">${escapeHtml(item.description)}</td>
        <td class="qty">${escapeHtml(item.qty)}</td>
        <td class="num">${fmt(item.unitPrice)}</td>
        <td class="num">${fmt(total)}</td>
      </tr>`;
    }).join('');

    const subtotal = d.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
    const discount = Number(d.adjustments?.discount) || 0;
    const lessDisc = subtotal - discount;
    const taxRate = Number(d.adjustments?.taxRate) || 0;
    const totalTax = lessDisc * taxRate / 100;
    const shipping = Number(d.adjustments?.shipping) || 0;
    const balanceDue = lessDisc + totalTax + shipping;

    const metaRows = d.meta.map(row =>
      `<div class="meta-row">
        ${row.label ? `<span class="m-label">${escapeHtml(row.label)}</span>` : ''}
        <span class="m-value">${escapeHtml(row.value)}</span>
      </div>`
    ).join('');

    const payInstParagraphs = (d.paymentInstructions?.paragraphs || []).map(p =>
      `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
    ).join('');

    // Logo handling - use local path /PCA.png which is in public folder
    const logoSrc = d.logo?.src || '/PCA.png';
    const logoHtml = `<div class="logo-box"><img src="${logoSrc}" alt="Prime Circle Agency" onerror="this.parentElement.innerHTML='<div style=\'width:280px;padding:10px 0 6px;text-align:center;margin-bottom:10px;\'><div style=\'font-size:32px;font-style:italic;color:#111;\'>Prime Circle</div><div style=\'font-size:8px;letter-spacing:5px;color:#444;margin-top:2px;\'>AGENCY</div></div>'"></div>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
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
    html, body { background: #fff; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: var(--text); width: 100%; height: 100%; overflow: hidden; }
    .page { width: 100%; max-width: 985px; min-height: 100%; margin: 0 auto; background: #fff; position: relative; display: flex; flex-direction: column; }
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
          <div class="company-name">${escapeHtml(d.company?.name || '')}</div>
          <div class="company-addr">${(d.company?.addressLines || []).map(l => escapeHtml(l)).join('<br>')}</div>
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
        <div class="billto-name">${escapeHtml(d.billTo?.name || '')}</div>
        <div class="billto-lines">${(d.billTo?.lines || []).map(l => escapeHtml(l)).join('<br>')}</div>
      </div>
      <table class="items">
        <thead><tr><th class="desc">DESCRIPTION</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="lower">
        <div class="pay-instructions">
          <div class="pi-title">${escapeHtml(d.paymentInstructions?.title || '')}</div>
          ${payInstParagraphs}
        </div>
        <div class="totals">
          <div class="t-row"><div class="t-label">SUBTOTAL</div><div class="t-value">${fmt(subtotal)}</div></div>
          ${discount > 0 ? `<div class="t-row"><div class="t-label">DISCOUNT</div><div class="t-value">${fmt(discount)}</div></div>` : ''}
          <div class="t-row"><div class="t-label">SUBTOTAL LESS DISCOUNT</div><div class="t-value">${fmt(lessDisc)}</div></div>
          ${taxRate > 0 ? `<div class="t-row"><div class="t-label">TAX RATE</div><div class="t-value">${fmt(taxRate)}%</div></div><div class="t-row"><div class="t-label">TOTAL TAX</div><div class="t-value">${fmt(totalTax)}</div></div>` : ''}
          ${shipping > 0 ? `<div class="t-row"><div class="t-label">SHIPPING/HANDLING</div><div class="t-value">${fmt(shipping)}</div></div>` : ''}
          <div class="t-row balance"><div class="t-label">Balance Due</div><div class="t-value">${d.currency || '$'}${fmt(balanceDue)}</div></div>
        </div>
      </div>
    </div>
    <div class="bar" style="margin-top:auto;"></div>
  </div>
</body>
</html>`;
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading invoice settings...</div>;
  }

  if (!invoiceData) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Failed to load invoice settings</div>;
  }

  // Use real URL endpoint for preview so external resources (logo) can load
  const previewSrc = '/api/invoice/preview?t=' + previewKey;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
      {/* Left: Form */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Invoice Settings</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={downloadPdf}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--primary-accent)',
                backgroundColor: 'transparent', color: 'var(--primary-accent)', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
              }}
            >
              📥 PDF
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                backgroundColor: saving ? '#666' : 'var(--primary-accent)',
                color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save & Preview'}
            </button>
          </div>
        </div>

        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Company Info */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Company Header</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Company Name</label>
                <input type="text" value={invoiceData.company?.name || ''} onChange={(e) => handleChange('company.name', e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Address Line 1</label>
                <input type="text" value={invoiceData.company?.addressLines?.[0] || ''} onChange={(e) => handleArrayChange('company.addressLines', 0, e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Address Line 2</label>
                <input type="text" value={invoiceData.company?.addressLines?.[1] || ''} onChange={(e) => handleArrayChange('company.addressLines', 1, e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Logo URL (use absolute URL like https://...)</label>
                <input type="text" value={invoiceData.logo?.src || ''} onChange={(e) => handleChange('logo.src', e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
            </div>
          </div>

          {/* Meta Rows */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Invoice Meta</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {invoiceData.meta?.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="text" placeholder="Label" value={row.label || ''} onChange={(e) => handleMetaChange(i, 'label', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '12px' }} />
                  <input type="text" placeholder="Value" value={row.value || ''} onChange={(e) => handleMetaChange(i, 'value', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '12px' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Bill To */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Bill To (Default Template)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Client Name</label>
                <input type="text" value={invoiceData.billTo?.name || ''} onChange={(e) => handleChange('billTo.name', e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Address / Reference</label>
                <textarea value={(invoiceData.billTo?.lines || []).join('\n')} onChange={(e) => handleChange('billTo.lines', e.target.value.split('\n'))}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', minHeight: '80px', resize: 'vertical' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '10px', borderRadius: '8px' }}>
                💡 When generating an invoice for a client, the Bill To is auto-filled with the client's name. The payment instructions are auto-filled based on the client's "Bank Name" selection.
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Line Items</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {invoiceData.items?.map((item, i) => (
                <div key={i} style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 32px', gap: '8px', alignItems: 'center' }}>
                  <input type="text" placeholder="Description" value={item.description || ''} onChange={(e) => handleItemChange(i, 'description', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: 'var(--text-primary)', fontSize: '12px' }} />
                  <input type="number" placeholder="Qty" value={item.qty || ''} onChange={(e) => handleItemChange(i, 'qty', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'center' }} />
                  <input type="number" placeholder="Price" value={item.unitPrice || ''} onChange={(e) => handleItemChange(i, 'unitPrice', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right' }} />
                  <div style={{ fontSize: '12px', fontWeight: '600', textAlign: 'right', padding: '8px', color: 'var(--text-primary)' }}>
                    ${((item.qty || 0) * (item.unitPrice || 0)).toFixed(2)}
                  </div>
                  <button onClick={() => removeItem(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer', color: '#F87171', fontSize: '14px' }}>×</button>
                </div>
              ))}
              <button onClick={addItem} style={{ padding: '10px', borderRadius: '8px', border: '1px dashed var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                + Add Line Item
              </button>
            </div>
          </div>

          {/* Adjustments */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Adjustments</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Discount ($)</label>
                <input type="number" value={invoiceData.adjustments?.discount || 0} onChange={(e) => handleChange('adjustments.discount', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Tax Rate (%)</label>
                <input type="number" value={invoiceData.adjustments?.taxRate || 0} onChange={(e) => handleChange('adjustments.taxRate', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Shipping ($)</label>
                <input type="number" value={invoiceData.adjustments?.shipping || 0} onChange={(e) => handleChange('adjustments.shipping', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Payment Instructions (Default Template)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Title</label>
                <input type="text" value={invoiceData.paymentInstructions?.title || ''} onChange={(e) => handleChange('paymentInstructions.title', e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Paragraphs (one per line)</label>
                <textarea value={(invoiceData.paymentInstructions?.paragraphs || []).join('\n')} onChange={(e) => handleChange('paymentInstructions.paragraphs', e.target.value.split('\n'))}
                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', minHeight: '120px', resize: 'vertical' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '10px', borderRadius: '8px' }}>
                💡 When generating an invoice for a client, the payment instructions will be auto-filled based on the client's "Bank Name" selection (Crypto, LHV, Slash, or WHOP).
              </div>
            </div>
          </div>

          {/* Generate Personalized Invoice */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Generate Personalized Invoice</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
 💡 Generate a personalized invoice with specific payment link. Select a payment method below and click "Generate PDF" to open a new invoice.
                </div>
              </div>

              {/* Payment Method Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Payment Method</label>
                  <select
                    id="paymentMethodSelect"
                    value={invoiceData.genPaymentMethod || 'crypto'}
                    onChange={(e) => handleChange('genPaymentMethod', e.target.value)}
                    style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                  >
                    <option value="crypto">Crypto (USDT/TRC20)</option>
                    <option value="lhv">LHV Bank (SEPA/IBAN)</option>
                    <option value="slash">Slash Bank (US)</option>
                    <option value="whop">WHOP</option>
                  </select>
                </div>

                {/* WHOP-specific options */}
                {invoiceData.genPaymentMethod === 'whop' && (
                  <>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Referral Partner</label>
                      <select
                        value={invoiceData.genReferralPartner || 'N.A.'}
                        onChange={(e) => handleChange('genReferralPartner', e.target.value)}
                        style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                      >
                        <option value="N.A.">N.A. (0% discount)</option>
                        <option value="Chris">Chris (0% discount)</option>
                        <option value="No Limit">No Limit (-15% discount)</option>
                        <option value="8 Labs">8 Labs (-15% discount)</option>
                        <option value="Master">Master (-15% discount)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Product / Tier</label>
                      <select
                        value={invoiceData.genProduct || 'tier1'}
                        onChange={(e) => handleChange('genProduct', e.target.value)}
                        style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                      >
                        <option value="tier1">Tier 1</option>
                        <option value="tier2">Tier 2</option>
                        <option value="tier3">Tier 3</option>
                        <option value="tier4">Tier 4</option>
                        <option value="tier5">Tier 5</option>
                        <option value="tier6">Tier 6</option>
                        <option value="tier1_7d_free">Tier 1 - 7 Days Free</option>
                        <option value="tier2_7d_free">Tier 2 - 7 Days Free</option>
                        <option value="tier3_7d_free">Tier 3 - 7 Days Free</option>
                        <option value="tier4_7d_free">Tier 4 - 7 Days Free</option>
                        <option value="tier5_7d_free">Tier 5 - 7 Days Free</option>
                        <option value="tier6_7d_free">Tier 6 - 7 Days Free</option>
                        <option value="tier1_50_off">Tier 1 - 50% Off</option>
                        <option value="tier2_50_off">Tier 2 - 50% Off</option>
                        <option value="tier3_50_off">Tier 3 - 50% Off</option>
                        <option value="tier4_50_off">Tier 4 - 50% Off</option>
                        <option value="tier5_50_off">Tier 5 - 50% Off</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={() => {
                  const method = invoiceData.genPaymentMethod || 'crypto';
                  const params = new URLSearchParams({
                    client_name: invoiceData.billTo?.name || 'Client',
                    bank_name: method,
                    product_name: invoiceData.items?.[0]?.description || 'Service',
                    subtotal: String(invoiceData.items?.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0) || '0'),
                    discount: String(invoiceData.adjustments?.discount || 0),
                    invoice_date: new Date().toISOString().split('T')[0],
                    invoice_no: '001',
                    currency: invoiceData.currency || '$'
                  });

                  if (method === 'whop') {
                    params.set('referral_partner_name', invoiceData.genReferralPartner || 'N.A.');
                    params.set('whop_link_type', invoiceData.genProduct || 'tier');
                  }

                  window.open('/api/invoice/generate?' + params.toString(), '_blank');
                }}
                style={{
                  padding: '12px 20px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
                }}
              >
 📥 Generate Personalized PDF
              </button>
            </div>
          </div>

          {/* Currency */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Currency</h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input type="text" value={invoiceData.currency || '$'} onChange={(e) => handleChange('currency', e.target.value)}
                style={{ width: '80px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Preview - fits entire A4 without scrolling */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'sticky', top: '24px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Invoice Preview</h3>
        </div>
        <div style={{
          width: '100%',
          height: 'calc(100vh - 180px)',
          backgroundColor: '#d9d9d9',
          padding: '8px',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={previewSrc}
            style={{
              width: '100%',
              maxWidth: '985px',
              height: '100%',
              maxHeight: '1271px',
              border: 'none',
              borderRadius: '4px',
              zoom: '0.65',
              transformOrigin: 'center center'
            }}
            title="Invoice Preview"
            scrolling="no"
          />
        </div>
      </div>
    </div>
  );
}