"use client";

import { useState, useEffect } from 'react';
import ClientFormFields from './ClientFormFields';
import { defaultMonthLabel } from '@/lib/sheetSchema';

function emptyProduct() {
  return {
    tier: '',
    setup_type: '',
    month: defaultMonthLabel(),
    subscription_fee: '',
    setup_fee: '',
    discount: '',
    cl_amount: '',
    start_date: '',
    valid_stopped_date: '',
    client_ad_id_name: '',
    ad_id_number: '',
    ad_account_type: '',
    ad_spend_limit: '',
    referral_partner_name: '',
    referral_amount: '',
    bank_name: '',
    payment_name: '',
    amount_received: '',
    payment_received_date: '',
    payment_received_month: '',
    reference_no: '',
    actual_balance_difference: '',
    client_status_history: '',
    notes: '',
    active: true,
  };
}

const labelStyle = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  fontWeight: '500',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: '4px',
  display: 'block',
};

const inputStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '12px 16px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '14px',
};

const primaryBtn = {
  backgroundColor: '#14b8a6',
  color: '#fff',
  padding: '10px 20px',
  borderRadius: '8px',
  border: 'none',
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer',
};

const secondaryBtn = {
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  padding: '10px 20px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  fontWeight: '500',
  fontSize: '13px',
  cursor: 'pointer',
};

export default function AddClientModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [telegramGroupId, setTelegramGroupId] = useState('');
  const [products, setProducts] = useState([emptyProduct()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  // Reset form whenever the modal opens.
  useEffect(() => {
    if (open) {
      setName('');
      setTelegramGroupId('');
      setProducts([emptyProduct()]);
      setError(null);
      setWarning(null);
      setSubmitting(false);
    }
  }, [open]);

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const updateProduct = (idx, next) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? next : p)));
  };

  const removeProduct = (idx) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  const addProduct = () => {
    setProducts((prev) => [...prev, emptyProduct()]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setWarning(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          telegram_group_id: telegramGroupId.trim(),
          products,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Sheet succeeded but DB failed → warn the user, kick a sync, and close.
        if (data.code === 'SHEETS_OK_DB_FAIL') {
          setWarning(
            'Client was added to the Google Sheet but the local DB write failed. ' +
            'A full sync will be triggered to reconcile.'
          );
          try { await fetch('/api/sync', { method: 'POST' }); } catch {}
          setTimeout(() => {
            onCreated && onCreated(data.client_id);
          }, 1500);
          return;
        }
        setError(data.error || `Request failed (${res.status})`);
        return;
      }

      onCreated && onCreated(data.client_id);
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '16px',
      }}
      onClick={() => { if (!submitting) onClose(); }}
    >
      <form
        className="card"
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '900px', maxHeight: '90vh',
          overflowY: 'auto', position: 'relative',
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => { if (!submitting) onClose(); }}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            color: 'var(--text-secondary)', fontSize: '20px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            background: 'transparent', border: 'none', zIndex: 10,
          }}
        >
          ✕
        </button>

        <div style={{ paddingRight: '40px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Add Client</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            The client will be added to the dashboard AND to the Google Sheet (1 blue header + green product rows).
          </p>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>
                Client name <span style={{ color: 'var(--status-cut)' }}>*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 🟢John Doe X Prime circle: Tele 305"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Telegram group ID (optional)</label>
              <input
                value={telegramGroupId}
                onChange={(e) => setTelegramGroupId(e.target.value)}
                placeholder="-1001234567890"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '12px', borderBottom: '1px solid var(--border-color)',
            paddingBottom: '8px', flexWrap: 'wrap', gap: '8px',
          }}>
            <h3 style={{ fontSize: '15px', margin: 0 }}>
              Products ({products.length})
            </h3>
            <button
              type="button"
              onClick={addProduct}
              disabled={submitting}
              style={{
                backgroundColor: 'transparent',
                color: '#14b8a6',
                border: '1px solid #14b8a6',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              + Add product
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {products.map((p, idx) => (
              <ClientFormFields
                key={idx}
                product={p}
                onChange={(next) => updateProduct(idx, next)}
                onRemove={() => removeProduct(idx)}
                index={idx}
                isFirst={idx === 0}
                disabled={submitting}
                isNew={true}
                headerLabel={`Product #${idx + 1}`}
              />
            ))}
          </div>
        </div>

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
        {warning && (
          <div style={{
            backgroundColor: 'var(--status-pause-bg)',
            color: 'var(--status-pause)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
          }}>
            {warning}
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          borderTop: '1px solid var(--border-color)', paddingTop: '16px',
        }}>
          <button type="button" onClick={onClose} disabled={submitting} style={secondaryBtn}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || !name.trim()} style={{
            ...primaryBtn,
            opacity: (submitting || !name.trim()) ? 0.5 : 1,
            cursor: (submitting || !name.trim()) ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
