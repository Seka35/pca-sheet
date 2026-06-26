"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

const IconCreditCard = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const IconLightning = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconCheck = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconPackage = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const PAYMENT_METHODS = [
  { value: '', label: 'Select a payment method...', disabled: true },
  { value: 'Crypto', label: 'Crypto (USDT TRC20/ERC20, BTC)', disabled: false },
  { value: 'LHV', label: 'LHV Bank (Sokin)', disabled: false },
  { value: 'Slash', label: 'Slash', disabled: false },
  { value: 'Whop', label: 'Whop', disabled: false },
];

export default function PayPage() {
  const [renewals, setRenewals] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [payType, setPayType] = useState('renewal');
  const [topupProduct, setTopupProduct] = useState(null);
  const router = useRouter();

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
      const body = { bank_name: selectedBank, transaction_id: txId.trim() };

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
        setTimeout(() => router.push('/client/payments'), 2000);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Make a Payment</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Select a product and submit your payment details.</p>
      </div>

      {/* Pay Type Toggle */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => { setPayType('renewal'); setSelectedProduct(null); setTopupProduct(null); }}
          style={{ flex: 1, padding: '14px', borderRadius: '10px', border: `1px solid ${payType === 'renewal' ? 'var(--primary-accent)' : 'var(--border-color)'}`, backgroundColor: payType === 'renewal' ? 'rgba(0, 245, 160, 0.08)' : 'var(--bg-card)', color: payType === 'renewal' ? 'var(--primary-accent)' : 'var(--text-secondary)', fontWeight: payType === 'renewal' ? '700' : '500', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
        >
          <IconCreditCard size={18} color={payType === 'renewal' ? 'var(--primary-accent)' : 'var(--text-secondary)'} />
          Pay Renewal
        </button>
        <button
          onClick={() => { setPayType('topup'); setSelectedProduct(null); setTopupProduct(null); }}
          style={{ flex: 1, padding: '14px', borderRadius: '10px', border: `1px solid ${payType === 'topup' ? '#a78bfa' : 'var(--border-color)'}`, backgroundColor: payType === 'topup' ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-card)', color: payType === 'topup' ? '#a78bfa' : 'var(--text-secondary)', fontWeight: payType === 'topup' ? '700' : '500', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
        >
          <IconLightning size={18} color={payType === 'topup' ? '#a78bfa' : 'var(--text-secondary)'} />
          Top-Up
        </button>
      </div>

      {/* Product Selection */}
      <div className="card">
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
          {payType === 'renewal' ? 'Select Product to Pay' : 'Select Product to Top-Up'}
        </h3>

        {payType === 'renewal' ? (
          unpaidRenewals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: '#22c55e' }}><IconCheck size={32} /></div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>No pending renewals</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>All your products are paid!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {unpaidRenewals.map(r => (
                <div key={r.sr_no} onClick={() => setSelectedProduct(r)} style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'var(--border-color)'}`, backgroundColor: selectedProduct?.sr_no === r.sr_no ? 'rgba(0, 245, 160, 0.06)' : 'var(--bg-main)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'var(--border-color)'}`, backgroundColor: selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedProduct?.sr_no === r.sr_no && <span style={{ color: '#0B111A', fontSize: '12px', fontWeight: '700' }}>✓</span>}
                    </div>
                    <div>
                      <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>Due: {r.valid_stopped_date || '—'}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>€{r.total_due.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          renewals.filter(r => r.visual_status === 'Active').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--text-secondary)' }}><IconPackage size={32} /></div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>No active products</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>You need an active product to add a top-up.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {renewals.filter(r => r.visual_status === 'Active').map(r => (
                <div key={r.sr_no} onClick={() => setTopupProduct(r)} style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'var(--border-color)'}`, backgroundColor: topupProduct?.sr_no === r.sr_no ? 'rgba(139, 92, 246, 0.06)' : 'var(--bg-main)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'var(--border-color)'}`, backgroundColor: topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {topupProduct?.sr_no === r.sr_no && <span style={{ color: '#fff', fontSize: '12px', fontWeight: '700' }}>✓</span>}
                    </div>
                    <div>
                      <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{r.is_paid ? 'Paid' : `Due: ${r.valid_stopped_date || '—'}`}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '600' }}>+ Add Top-Up</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Payment Form */}
      {(selectedProduct || topupProduct) && (
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Payment Details</h3>

          <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <ProductBadge tier={(selectedProduct || topupProduct).tier} setup_type={(selectedProduct || topupProduct).setup_type} is_trial={(selectedProduct || topupProduct).is_trial} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>N° {(selectedProduct || topupProduct).sr_no}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{payType === 'topup' ? 'Top-up amount' : 'Amount due'}</p>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: payType === 'topup' ? '#a78bfa' : '#ef4444' }}>{payType === 'topup' ? '—' : `€${selectedProduct?.total_due?.toFixed(2) || '—'}`}</p>
                  {payType === 'topup' && <p style={{ fontSize: '11px', color: '#a78bfa' }}>Amount will be confirmed by admin</p>}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Method</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} required style={selectStyle}>
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value} disabled={m.disabled} style={{ color: m.disabled ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction ID (TX ID)</label>
              <input type="text" value={txId} onChange={e => setTxId(e.target.value)} required placeholder="Enter your transaction ID" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>For Crypto: paste your USDT or BTC transaction hash. For bank transfers: paste your transfer reference.</p>
            </div>

            {payError && <div style={{ color: '#ef4444', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>{payError}</div>}
            {paySuccess && <div style={{ color: '#22c55e', fontSize: '13px', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><IconCheck size={16} color="#22c55e" /> Payment submitted successfully! Redirecting...</div>}

            <button type="submit" disabled={payLoading} style={{ width: '100%', padding: '14px', backgroundColor: payType === 'topup' ? '#a78bfa' : 'var(--primary-accent)', color: '#0B111A', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: payLoading ? 'not-allowed' : 'pointer', opacity: payLoading ? 0.7 : 1, marginTop: '8px' }}>
              {payLoading ? 'Submitting...' : `Submit ${payType === 'topup' ? 'Top-Up' : 'Payment'}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
