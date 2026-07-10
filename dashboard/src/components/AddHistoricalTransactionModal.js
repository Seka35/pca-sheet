"use client";

import { useState } from 'react';

const TRANSACTION_TYPES = ['MONTHLY', 'UPGRADE', 'SUB_UPGRADE', 'RENEWAL_PONCTUAL', 'RETURN', 'PROMOTION'];
const TIER_OPTIONS = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
const SETUP_OPTIONS = ['Starter', 'Premium', 'VIP'];

export default function AddHistoricalTransactionModal({ clientId, products, renewalSrNo, onClose, onAdded }) {
  const [type, setType] = useState('MONTHLY');
  const [fromTier, setFromTier] = useState('');
  const [toTier, setToTier] = useState('');
  const [fromSetup, setFromSetup] = useState('');
  const [toSetup, setToSetup] = useState('');
  const [prorataAmount, setProrataAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [untilDate, setUntilDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!renewalSrNo) {
      setError('Select a product first');
      return;
    }
    if (!date) {
      setError('Date is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          from_tier: fromTier || null,
          to_tier: toTier || null,
          from_setup: fromSetup || null,
          to_setup: toSetup || null,
          prorata_amount: prorataAmount || null,
          amount: amount || null,
          date,
          until_date: untilDate || null,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add transaction');

      onAdded && onAdded();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isUpgradeType = ['UPGRADE', 'SUB_UPGRADE', 'RENEWAL_PONCTUAL'].includes(type);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '24px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '550px',
        maxHeight: '85vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Add Historical Transaction</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Record a past payment or upgrade</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* Transaction Type */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Transaction Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px',
                color: '#fff',
                fontSize: '13px'
              }}
            >
              {TRANSACTION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* From/To for upgrades */}
          {isUpgradeType && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  From Tier
                </label>
                <select
                  value={fromTier}
                  onChange={(e) => setFromTier(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select...</option>
                  {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  To Tier
                </label>
                <select
                  value={toTier}
                  onChange={(e) => setToTier(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select...</option>
                  {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  From Setup
                </label>
                <select
                  value={fromSetup}
                  onChange={(e) => setFromSetup(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select...</option>
                  {SETUP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  To Setup
                </label>
                <select
                  value={toSetup}
                  onChange={(e) => setToSetup(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select...</option>
                  {SETUP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Amount fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {isUpgradeType && (
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  Prorata Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prorataAmount}
                  onChange={(e) => setProrataAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            )}
            {(type === 'MONTHLY' || type === 'RETURN') && (
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            )}
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#fff',
                  fontSize: '13px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Valid Until
              </label>
              <input
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#fff',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px',
                color: '#fff',
                fontSize: '13px',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? 'var(--border-color)' : '#14b8a6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Adding...' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}
