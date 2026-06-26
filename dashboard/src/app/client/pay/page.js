"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

const PAYMENT_METHODS = [
  { value: '', label: 'Select a payment method...', disabled: true },
  { value: 'Crypto', label: '💎 Crypto (USDT TRC20/ERC20, BTC)', disabled: false },
  { value: 'LHV', label: '🏦 LHV Bank (Sokin)', disabled: false },
  { value: 'Slash', label: '⚡ Slash', disabled: false },
  { value: 'Whop', label: '🌐 Whop', disabled: false },
];

export default function PayPage() {
  const [renewals, setRenewals] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [payType, setPayType] = useState('renewal'); // 'renewal' or 'topup'
  const [topupProduct, setTopupProduct] = useState(null);
  const router = useRouter();

  // Payment form state
  const [selectedBank, setSelectedBank] = useState('');
  const [txId, setTxId] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/client/renewals').then(r => r.json()),
      fetch('/api/client/me').then(r => r.json()),
    ]).then(([renewalsData, clientData]) => {
      setRenewals(renewalsData);
      setClient(clientData.client);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  const unpaidRenewals = renewals.filter(r => !r.is_paid && r.visual_status === 'Active' && r.total_due > 0);

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPayError('');
    setPaySuccess(false);
    setPayLoading(true);

    try {
      const body = {
        bank_name: selectedBank,
        transaction_id: txId.trim(),
      };

      if (payType === 'topup' && topupProduct) {
        body.sr_no = topupProduct.sr_no;
        body.is_topup = true;
      } else if (selectedProduct) {
        body.sr_no = selectedProduct.sr_no;
      } else {
        setPayError('Please select a product to pay');
        setPayLoading(false);
        return;
      }

      const res = await fetch('/api/client/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setPaySuccess(true);
        setTxId('');
        setSelectedBank('');
        setSelectedProduct(null);
        setTopupProduct(null);
        setTimeout(() => {
          router.push('/client/payments');
        }, 2000);
      } else {
        const data = await res.json();
        setPayError(data.error || 'Failed to submit payment');
      }
    } catch {
      setPayError('An error occurred');
    } finally {
      setPayLoading(false);
    }
  };

  const selectStyle = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 16px center',
    paddingRight: '40px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Make a Payment</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Select a product and submit your payment details.
        </p>
      </div>

      {/* Pay Type Toggle */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => { setPayType('renewal'); setSelectedProduct(null); setTopupProduct(null); }}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '10px',
            border: `1px solid ${payType === 'renewal' ? 'var(--primary-accent)' : 'var(--border-color)'}`,
            backgroundColor: payType === 'renewal' ? 'rgba(0, 245, 160, 0.08)' : 'var(--bg-card)',
            color: payType === 'renewal' ? 'var(--primary-accent)' : 'var(--text-secondary)',
            fontWeight: payType === 'renewal' ? '700' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          💳 Pay Renewal
        </button>
        <button
          onClick={() => { setPayType('topup'); setSelectedProduct(null); setTopupProduct(null); }}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '10px',
            border: `1px solid ${payType === 'topup' ? '#a78bfa' : 'var(--border-color)'}`,
            backgroundColor: payType === 'topup' ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-card)',
            color: payType === 'topup' ? '#a78bfa' : 'var(--text-secondary)',
            fontWeight: payType === 'topup' ? '700' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ⚡ Top-Up
        </button>
      </div>

      {/* Product Selection */}
      <div className="card">
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
          {payType === 'renewal' ? 'Select Product to Pay' : 'Select Product to Top-Up'}
        </h3>

        {payType === 'renewal' ? (
          unpaidRenewals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>✅</span>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>No pending renewals</p>
              <p style={{ fontSize: '13px', opacity: 0.7 }}>All your products are paid!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {unpaidRenewals.map(r => (
                <div
                  key={r.sr_no}
                  onClick={() => setSelectedProduct(r)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: `1px solid ${selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                    backgroundColor: selectedProduct?.sr_no === r.sr_no ? 'rgba(0, 245, 160, 0.06)' : 'var(--bg-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      border: `2px solid ${selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                      backgroundColor: selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {selectedProduct?.sr_no === r.sr_no && (
                        <span style={{ color: '#0B111A', fontSize: '12px', fontWeight: '700' }}>✓</span>
                      )}
                    </div>
                    <div>
                      <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                        Due: {r.valid_stopped_date || '—'}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>
                    €{r.total_due.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Top-up: all active products */
          renewals.filter(r => r.visual_status === 'Active').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📦</span>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>No active products</p>
              <p style={{ fontSize: '13px', opacity: 0.7 }}>You need an active product to add a top-up.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {renewals.filter(r => r.visual_status === 'Active').map(r => (
                <div
                  key={r.sr_no}
                  onClick={() => setTopupProduct(r)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: `1px solid ${topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'var(--border-color)'}`,
                    backgroundColor: topupProduct?.sr_no === r.sr_no ? 'rgba(139, 92, 246, 0.06)' : 'var(--bg-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      border: `2px solid ${topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'var(--border-color)'}`,
                      backgroundColor: topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {topupProduct?.sr_no === r.sr_no && (
                        <span style={{ color: '#fff', fontSize: '12px', fontWeight: '700' }}>✓</span>
                      )}
                    </div>
                    <div>
                      <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                        {r.is_paid ? 'Paid' : `Due: ${r.valid_stopped_date || '—'}`}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '600' }}>
                    + Add Top-Up
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Payment Form */}
      {(selectedProduct || topupProduct) && (
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Payment Details
          </h3>

          <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Selected product summary */}
            <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <ProductBadge
                    tier={(selectedProduct || topupProduct).tier}
                    setup_type={(selectedProduct || topupProduct).setup_type}
                    is_trial={(selectedProduct || topupProduct).is_trial}
                  />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>N° {(selectedProduct || topupProduct).sr_no}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {payType === 'topup' ? 'Top-up amount' : 'Amount due'}
                  </p>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: payType === 'topup' ? '#a78bfa' : '#ef4444' }}>
                    €{payType === 'topup' ? '—' : (selectedProduct?.total_due?.toFixed(2) || '—')}
                  </p>
                  {payType === 'topup' && (
                    <p style={{ fontSize: '11px', color: '#a78bfa' }}>Amount will be confirmed by admin</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payment Method
              </label>
              <select
                value={selectedBank}
                onChange={e => setSelectedBank(e.target.value)}
                required
                style={selectStyle}
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value} disabled={m.disabled} style={m.disabled ? { color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction ID */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Transaction ID (TX ID)
              </label>
              <input
                type="text"
                value={txId}
                onChange={e => setTxId(e.target.value)}
                required
                placeholder="Enter your transaction ID"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>
                For Crypto: paste your USDT or BTC transaction hash. For bank transfers: paste your transfer reference.
              </p>
            </div>

            {payError && (
              <div style={{ color: '#ef4444', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>
                {payError}
              </div>
            )}

            {paySuccess && (
              <div style={{ color: '#22c55e', fontSize: '13px', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" /></svg>
                Payment submitted successfully! Redirecting...
              </div>
            )}

            <button
              type="submit"
              disabled={payLoading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: payType === 'topup' ? '#a78bfa' : 'var(--primary-accent)',
                color: '#0B111A',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: payLoading ? 'not-allowed' : 'pointer',
                opacity: payLoading ? 0.7 : 1,
                marginTop: '8px'
              }}
            >
              {payLoading ? 'Submitting...' : `Submit ${payType === 'topup' ? 'Top-Up' : 'Payment'}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
