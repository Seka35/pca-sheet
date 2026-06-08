"use client";

import { useEffect, useState, useMemo } from 'react';
import ProductBadge from './ProductBadge';
import TelegramBadge from './TelegramBadge';
import TeleIdBadge from './TeleIdBadge';
import ClientFormFields from './ClientFormFields';
import { extractTeleId } from '@/lib/teleIdParser';

function emptyProduct() {
  return {
    tier: '', setup_type: '', month: '',
    subscription_fee: '', setup_fee: '', discount: '', cl_amount: '',
    start_date: '', valid_stopped_date: '',
    client_ad_id_name: '', ad_id_number: '', ad_account_type: '', ad_spend_limit: '',
    referral_partner_name: '', referral_amount: '',
    bank_name: '', payment_name: '', amount_received: '',
    payment_received_date: '', payment_received_month: '',
    reference_no: '', actual_balance_difference: '',
    client_status_history: '', notes: '',
    active: true,
  };
}

export default function ClientModal({ selectedClient, onClose, onSaved }) {
  if (!selectedClient) return null;

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const { client, history } = selectedClient;
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'

  // Edit-mode form state.
  const [formName, setFormName] = useState(client?.name || '');
  const [formTelegramGroupId, setFormTelegramGroupId] = useState(client?.telegram_group_id || '');
  const [formStatus, setFormStatus] = useState(client?.status || 'inactif');
  const [formProducts, setFormProducts] = useState([]);
  const [removedSrNos, setRemovedSrNos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Re-init form state whenever a fresh client is loaded.
  useEffect(() => {
    if (!client?.id) return;
    setMode('view');
    setError(null);
    setRemovedSrNos([]);
    setFormName(client.name || '');
    setFormTelegramGroupId(client.telegram_group_id || '');
    setFormStatus(client.status || 'inactif');
    setFormProducts(
      (history || []).map((h) => ({
        sr_no: h.sr_no,
        tier: h.tier || '',
        setup_type: h.setup_type || '',
        month: h.month || '',
        subscription_fee: h.subscription_fee || '',
        setup_fee: h.setup_fee || '',
        discount: h.discount || '',
        cl_amount: h.cl_amount || '',
        start_date: h.start_date || '',
        valid_stopped_date: h.valid_stopped_date || '',
        client_ad_id_name: h.client_ad_id_name || '',
        ad_id_number: h.ad_id_number || '',
        ad_account_type: h.ad_account_type || '',
        ad_spend_limit: h.ad_spend_limit || '',
        referral_partner_name: h.referral_partner_name || '',
        referral_amount: h.referral_amount || '',
        bank_name: h.bank_name || '',
        payment_name: h.payment_name || '',
        amount_received: h.amount_received || '',
        payment_received_date: h.payment_received_date || '',
        payment_received_month: h.payment_received_month || '',
        reference_no: h.reference_no || '',
        actual_balance_difference: h.actual_balance_difference || '',
        client_status_history: h.client_status_history || '',
        notes: h.notes || '',
        active: h.visual_status === 'Active',
      }))
    );
  }, [client?.id, client?.name, client?.telegram_group_id, client?.status, history]);

  useEffect(() => {
    if (!client?.id) return;
    fetch(`/api/bot/groups?client_id=${client.id}`)
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setLinkedGroups(rows.filter((g) => g.status === 'linked'));
      })
      .catch(() => {});
  }, [client?.id]);

  // Esc closes (only in view mode, or when not saving).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const parseAmount = (val) => {
    if (!val) return 0;
    const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateProductDue = (p) => {
    const isPaid = p.reference_no && p.reference_no.trim() !== '';
    if (isPaid) return 0;
    const sub = parseAmount(p.subscription_fee);
    const setup = parseAmount(p.setup_fee);
    const disc = parseAmount(p.discount);
    const received = parseAmount(p.amount_received);
    const due = (sub + setup) - disc - received;
    return Math.max(0, due);
  };

  const outstandingProducts = (history || []).filter((p) => calculateProductDue(p) > 0);
  const latestMonth = history && history.length > 0 ? history[0].month : null;
  const latestProducts = (history || []).filter((row) => row.month === latestMonth);

  const displayProducts = [...outstandingProducts];
  latestProducts.forEach((lp) => {
    if (!displayProducts.find((dp) => dp.sr_no === lp.sr_no)) {
      displayProducts.push(lp);
    }
  });

  const totalDue = outstandingProducts.reduce((acc, p) => acc + calculateProductDue(p), 0);

  // Tele ID derived from the (possibly edited) name.
  const parsedTeleId = useMemo(() => extractTeleId(mode === 'edit' ? formName : client?.name), [mode, formName, client?.name]);
  const teleIdConflict = !client?.tele_id && !!parsedTeleId;

  // Edit-mode handlers.
  const updateProduct = (idx, next) => {
    setFormProducts((prev) => prev.map((p, i) => (i === idx ? next : p)));
  };
  const removeProductAt = (idx) => {
    const removed = formProducts[idx];
    setFormProducts((prev) => prev.filter((_, i) => i !== idx));
    if (removed && removed.sr_no) {
      setRemovedSrNos((prev) => (prev.includes(removed.sr_no) ? prev : [...prev, removed.sr_no]));
    }
  };
  const addProduct = () => {
    setFormProducts((prev) => [...prev, emptyProduct()]);
  };

  const cancelEdit = () => {
    setError(null);
    setMode('view');
    // Reset form state.
    setFormName(client.name || '');
    setFormTelegramGroupId(client.telegram_group_id || '');
    setFormStatus(client.status || 'inactif');
    setRemovedSrNos([]);
    setFormProducts(
      (history || []).map((h) => ({
        sr_no: h.sr_no,
        tier: h.tier || '', setup_type: h.setup_type || '',
        month: h.month || '',
        subscription_fee: h.subscription_fee || '', setup_fee: h.setup_fee || '',
        discount: h.discount || '', cl_amount: h.cl_amount || '',
        start_date: h.start_date || '', valid_stopped_date: h.valid_stopped_date || '',
        client_ad_id_name: h.client_ad_id_name || '', ad_id_number: h.ad_id_number || '',
        ad_account_type: h.ad_account_type || '', ad_spend_limit: h.ad_spend_limit || '',
        referral_partner_name: h.referral_partner_name || '', referral_amount: h.referral_amount || '',
        bank_name: h.bank_name || '', payment_name: h.payment_name || '',
        amount_received: h.amount_received || '',
        payment_received_date: h.payment_received_date || '', payment_received_month: h.payment_received_month || '',
        reference_no: h.reference_no || '', actual_balance_difference: h.actual_balance_difference || '',
        client_status_history: h.client_status_history || '', notes: h.notes || '',
        active: h.visual_status === 'Active',
      }))
    );
  };

  const saveEdit = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          telegram_group_id: formTelegramGroupId.trim(),
          status: formStatus,
          products: formProducts,
          removed_sr_nos: removedSrNos,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'SHEETS_OK_DB_FAIL') {
          setError(
            'Saved to Google Sheet but local DB write failed. ' +
            'A full sync will be triggered to reconcile.'
          );
          try { await fetch('/api/sync', { method: 'POST' }); } catch {}
          setTimeout(() => {
            onSaved && onSaved();
            onClose();
          }, 1800);
          return;
        }
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      onSaved && onSaved();
      // Re-fetch the client detail to refresh the modal.
      try {
        const refetch = await fetch(`/api/clients/${client.id}`);
        if (refetch.ok) {
          const fresh = await refetch.json();
          // The parent owns `selectedClientData`; we can't update it directly,
          // but `onSaved()` already triggered a list refresh, and the modal
          // will get a fresh `selectedClient` on next open. For now, just
          // close the modal — the list and a re-open will show the new data.
        }
      } catch {}
      onClose();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = useMemo(() => {
    if (mode !== 'edit') return false;
    if ((formName || '').trim() !== (client?.name || '')) return true;
    if ((formTelegramGroupId || '').trim() !== (client?.telegram_group_id || '')) return true;
    if ((formStatus || '') !== (client?.status || 'inactif')) return true;
    if (removedSrNos.length > 0) return true;
    const original = history || [];
    if (formProducts.length !== original.length) return true;
    for (let i = 0; i < formProducts.length; i++) {
      const f = formProducts[i];
      const o = original.find((h) => h.sr_no === f.sr_no);
      if (!o) return true; // new product
      const fields = ['tier', 'setup_type', 'month', 'subscription_fee', 'setup_fee',
        'discount', 'cl_amount', 'start_date', 'valid_stopped_date',
        'client_ad_id_name', 'ad_id_number', 'ad_account_type', 'ad_spend_limit',
        'referral_partner_name', 'referral_amount', 'bank_name', 'payment_name',
        'amount_received', 'payment_received_date', 'payment_received_month',
        'reference_no', 'actual_balance_difference', 'client_status_history', 'notes'];
      for (const fld of fields) {
        if ((f[fld] || '') !== (o[fld] || '')) return true;
      }
      const fActive = f.active !== false;
      const oActive = o.visual_status === 'Active';
      if (fActive !== oActive) return true;
    }
    return false;
  }, [mode, formName, formTelegramGroupId, formStatus, formProducts, removedSrNos, client, history]);

  const primaryBtn = {
    backgroundColor: '#14b8a6', color: '#fff', padding: '8px 16px',
    borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
  };
  const secondaryBtn = {
    backgroundColor: 'transparent', color: 'var(--text-primary)',
    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
    fontWeight: '500', fontSize: '13px', cursor: 'pointer',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px',
    }} onClick={() => { if (!saving) onClose(); }}>
      <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => { if (!saving) onClose(); }}
          style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-secondary)', fontSize: '20px', cursor: saving ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', zIndex: 10 }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ paddingRight: '100px' }}>
          {mode === 'view' ? (
            <>
              <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>{client.name}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge" style={{ backgroundColor: client.status === 'Actif' ? 'var(--status-active-bg)' : 'var(--status-cut-bg)', color: client.status === 'Actif' ? 'var(--status-active)' : 'var(--status-cut)' }}>
                  {client.status === 'Actif' ? 'Active' : 'Inactive'}
                </span>
                <TeleIdBadge
                  teleId={client.tele_id}
                  parsedTeleId={parsedTeleId}
                  conflict={teleIdConflict}
                />
                <TelegramBadge chatId={client.telegram_group_id} title="Primary linked group" />
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  style={{
                    marginLeft: 'auto',
                    backgroundColor: 'transparent',
                    color: '#14b8a6',
                    border: '1px solid #14b8a6',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', marginBottom: 0 }}>Edit Client</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Name <span style={{ color: 'var(--status-cut)' }}>*</span>
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Telegram group ID</label>
                  <input
                    value={formTelegramGroupId}
                    onChange={(e) => setFormTelegramGroupId(e.target.value)}
                    placeholder="-1001234567890"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  disabled={saving}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)', borderRadius: '6px',
                    padding: '6px 10px', color: 'var(--text-primary)', outline: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="Actif" style={{ color: '#000' }}>Active</option>
                  <option value="inactif" style={{ color: '#000' }}>Inactive</option>
                </select>
                <TeleIdBadge
                  teleId={client.tele_id}
                  parsedTeleId={parsedTeleId}
                  conflict={teleIdConflict}
                />
              </div>
            </div>
          )}

          {linkedGroups.length > 1 && (
            <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                All linked Telegram groups ({linkedGroups.length})
              </div>
              {linkedGroups.map((g) => (
                <div key={g.chat_id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                  <TelegramBadge chatId={g.chat_id} title={g.chat_title} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{g.chat_title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products section */}
        <div>
          {mode === 'view' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', margin: 0 }}>Outstanding & Latest Products</h3>
                {displayProducts.length > 0 && (
                  <div style={{ fontSize: '15px', fontWeight: '600', color: totalDue > 0 ? 'var(--status-cut)' : 'var(--status-active)' }}>
                    Total Debt: {formatCurrency(totalDue)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayProducts.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).length > 0 ? displayProducts.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).map(product => {
                  const productDue = calculateProductDue(product);
                  const isPaid = product.reference_no && product.reference_no.trim() !== '';
                  return (
                    <div key={product.sr_no} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', position: 'relative', border: isPaid ? 'none' : '1px solid var(--status-cut)' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Product Type ({product.month})</div>
                        <ProductBadge tier={product.tier} setup_type={product.setup_type} />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Amount Due</div>
                        <div style={{ fontWeight: '700', color: productDue > 0 ? 'var(--status-cut)' : 'var(--status-active)', fontSize: '16px' }}>
                          {isPaid ? 'PAID' : formatCurrency(productDue)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          (Sub: {product.subscription_fee ? formatCurrency(parseAmount(product.subscription_fee)) : '$0'} / Setup: {product.setup_fee ? formatCurrency(parseAmount(product.setup_fee)) : '$0'})
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Discount / CL Amount</div>
                        <div style={{ fontWeight: '500' }}>{product.discount || '—'} / {product.cl_amount || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Start Date / Valid Until</div>
                        <div style={{ fontWeight: '500' }}>{product.start_date || '—'} ➔ {product.valid_stopped_date || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ad ID Number</div>
                        <div style={{ fontWeight: '500' }}>{product.ad_id_number || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ad Spend Limit</div>
                        <div style={{ fontWeight: '500' }}>{product.ad_spend_limit || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bank Name</div>
                        <div style={{ fontWeight: '500' }}>{product.bank_name || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Reference no.</div>
                        <div style={{ fontWeight: '500' }}>{product.reference_no || '—'}</div>
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ color: 'var(--text-secondary)' }}>No active products found.</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', margin: 0 }}>Products ({formProducts.length})</h3>
                <button
                  type="button"
                  onClick={addProduct}
                  disabled={saving}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#14b8a6',
                    border: '1px solid #14b8a6',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  + Add product
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formProducts.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', padding: '16px' }}>
                    No products. Click "Add product" to add one.
                  </div>
                ) : (
                  formProducts.map((p, idx) => (
                    <ClientFormFields
                      key={p.sr_no || `new-${idx}`}
                      product={p}
                      onChange={(next) => updateProduct(idx, next)}
                      onRemove={() => removeProductAt(idx)}
                      index={idx}
                      isFirst={idx === 0}
                      disabled={saving}
                      headerLabel={`Product #${idx + 1}${p.sr_no ? '' : ' (new)'}`}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Payment history (always read-only) */}
        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Payment History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px' }}>Period</th>
                <th style={{ padding: '8px' }}>Product</th>
                <th style={{ padding: '8px' }}>Bank</th>
                <th style={{ padding: '8px' }}>Valid Until</th>
                <th style={{ padding: '8px' }}>Amount Received</th>
                <th style={{ padding: '8px' }}>Ref.</th>
                <th style={{ padding: '8px' }}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {(history || []).map(row => (
                <tr key={row.sr_no} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px' }}>{row.month}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <ProductBadge tier={row.tier} setup_type={row.setup_type} />
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {row.bank_name ? <span className="badge" style={{ backgroundColor: 'var(--border-color)' }}>{row.bank_name}</span> : '—'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>{row.valid_stopped_date}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--primary-accent)', fontWeight: '500' }}>{row.amount_received}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{row.reference_no || '—'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <a
                      href={`/api/invoice/generate?sr_no=${encodeURIComponent(row.sr_no || '')}&client_id=${client.id}&client_name=${encodeURIComponent(client.name || '')}&bank_name=${encodeURIComponent(row.bank_name || 'crypto')}&product_name=${encodeURIComponent(row.tier ? row.tier + (row.setup_type ? ' - ' + row.setup_type : '') : 'Service')}&subtotal=${encodeURIComponent(row.subscription_fee ? row.subscription_fee.replace(/[^0-9.]/g, '') : '0')}&discount=${encodeURIComponent(row.discount ? row.discount.replace(/[^0-9.]/g, '') : '0')}&invoice_date=${encodeURIComponent(row.payment_received_date || new Date().toISOString().split('T')[0])}&invoice_no=${encodeURIComponent(row.sr_no ? row.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px', borderRadius: '4px', border: 'none',
                        backgroundColor: 'var(--primary-accent)', color: '#fff',
                        fontSize: '11px', fontWeight: '500', textDecoration: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      📥 PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit-mode footer: error + Save/Cancel */}
        {mode === 'edit' && (
          <>
            {error && (
              <div style={{
                backgroundColor: 'var(--status-cut-bg)',
                color: 'var(--status-cut)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
              }}>
                {error}
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '12px',
              borderTop: '1px solid var(--border-color)', paddingTop: '16px',
            }}>
              <button type="button" onClick={cancelEdit} disabled={saving} style={secondaryBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving || !isDirty}
                style={{
                  ...primaryBtn,
                  opacity: (saving || !isDirty) ? 0.5 : 1,
                  cursor: (saving || !isDirty) ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
