"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

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

const IconCheck = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconCopy = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

const IconArrowLeft = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconPackage = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const CRYPTO_ADDRESSES = {
  usdt_trc20: { label: 'USDT (TRC20)', address: 'TUcZNfx81JEdoNjG6orJxGPMrEpqX5gSuW', network: 'TRON' },
  usdt_erc20: { label: 'USDT (ERC20)', address: '0x49B4Dde3249D8Cc0Fb083247007E3C46a0135B09', network: 'Ethereum' },
  btc: { label: 'Bitcoin (BTC)', address: 'bc1quc4c6rm055guetjmnqt9rvvrzs3qpuu293rj8z', network: 'Bitcoin' },
};

const PAYMENT_METHODS = [
  { value: 'usdt_trc20', label: 'USDT (TRC20)' },
  { value: 'usdt_erc20', label: 'USDT (ERC20)' },
  { value: 'btc', label: 'Bitcoin (BTC)' },
  { value: 'lhv', label: 'LHV Bank' },
  { value: 'slash', label: 'Slash' },
  { value: 'whop', label: 'Whop' },
];

const BANK_DETAILS = {
  lhv: { accountTitle: 'WCATFM LLC', iban: 'EE157777000160817218', bic: 'LHVBEE22', bank: 'AS LHV Pank (Sokin)' },
  slash: { accountName: 'WCATFM LLC', accountNumber: '994768939333484', routing: '121145307', swift: 'CLNOUS66XXX' },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} title="Copy" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: copied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', color: copied ? '#22c55e' : 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}>
      {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function PaymentMethodSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = PAYMENT_METHODS.find(m => m.value === value);
  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Method</label>
      <button onClick={() => setOpen(!open)} type="button" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span>{selected ? selected.label : 'Select payment method...'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {PAYMENT_METHODS.map(m => (
            <button key={m.value} onClick={() => { onChange(m.value); setOpen(false); }} type="button" style={{ width: '100%', padding: '12px 16px', backgroundColor: value === m.value ? 'rgba(0, 245, 160, 0.08)' : 'transparent', border: 'none', color: value === m.value ? 'var(--primary-accent)' : 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontWeight: value === m.value ? '600' : '400' }}>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PayPage() {
  const [renewals, setRenewals] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [payType, setPayType] = useState('renewal');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [topupProduct, setTopupProduct] = useState(null);
  const [selectedBank, setSelectedBank] = useState('');
  const [txId, setTxId] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);
  const router = useRouter();

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
  const activeProducts = renewals.filter(r => r.visual_status === 'Active');

  const handleContinue = () => {
    const product = payType === 'renewal' ? selectedProduct : topupProduct;
    if (!product || !selectedBank) return;
    setStep(2);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPayError('');
    setPaySuccess(false);
    setPayLoading(true);
    try {
      const product = payType === 'renewal' ? selectedProduct : topupProduct;
      const body = { bank_name: selectedBank, transaction_id: txId.trim() };
      if (payType === 'topup') {
        body.sr_no = product.sr_no;
        body.is_topup = true;
        if (topupAmount) body.topup_amount = topupAmount;
      } else {
        body.sr_no = product.sr_no;
      }
      const res = await fetch('/api/client/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setPaySuccess(true);
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

  const canContinue = () => {
    const product = payType === 'renewal' ? selectedProduct : topupProduct;
    return product && selectedBank;
  };

  const currentProduct = payType === 'renewal' ? selectedProduct : topupProduct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <button onClick={() => step === 2 ? setStep(1) : router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500', alignSelf: 'flex-start' }}>
        <IconArrowLeft size={16} /> {step === 2 ? 'Back' : 'Back'}
      </button>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Make a Payment</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {step === 1 ? 'Select product and payment method to continue.' : 'Complete your payment details.'}
        </p>
      </div>

      {step === 1 && (
        <>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => { setPayType('renewal'); setSelectedProduct(null); setTopupProduct(null); }}
              style={{ flex: 1, padding: '14px', borderRadius: '10px', border: `1px solid ${payType === 'renewal' ? 'var(--primary-accent)' : 'var(--border-color)'}`, backgroundColor: payType === 'renewal' ? 'rgba(0, 245, 160, 0.08)' : 'var(--bg-card)', color: payType === 'renewal' ? 'var(--primary-accent)' : 'var(--text-secondary)', fontWeight: payType === 'renewal' ? '700' : '500', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <IconCreditCard size={18} color={payType === 'renewal' ? 'var(--primary-accent)' : 'var(--text-secondary)'} />
              Pay Renewal
            </button>
            <button onClick={() => { setPayType('topup'); setSelectedProduct(null); setTopupProduct(null); }}
              style={{ flex: 1, padding: '14px', borderRadius: '10px', border: `1px solid ${payType === 'topup' ? '#a78bfa' : 'var(--border-color)'}`, backgroundColor: payType === 'topup' ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-card)', color: payType === 'topup' ? '#a78bfa' : 'var(--text-secondary)', fontWeight: payType === 'topup' ? '700' : '500', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <IconLightning size={18} color={payType === 'topup' ? '#a78bfa' : 'var(--text-secondary)'} />
              Top-Up
            </button>
          </div>

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
                    <div key={r.sr_no} onClick={() => setSelectedProduct(r)} style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'var(--border-color)'}`, backgroundColor: selectedProduct?.sr_no === r.sr_no ? 'rgba(0, 245, 160, 0.06)' : 'var(--bg-main)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'var(--border-color)'}`, backgroundColor: selectedProduct?.sr_no === r.sr_no ? 'var(--primary-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selectedProduct?.sr_no === r.sr_no && <span style={{ color: '#0B111A', fontSize: '12px', fontWeight: '700' }}>✓</span>}
                        </div>
                        <div>
                          <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{r.valid_stopped_date ? `Due: ${r.valid_stopped_date}` : '—'}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>{fmt(r.total_due)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              activeProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--text-secondary)' }}><IconPackage size={32} /></div>
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>No active products</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>You need an active product to add a top-up.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {activeProducts.map(r => {
                    const subAmt = parseFloat(String(r.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
                    const setupAmt = parseFloat(String(r.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
                    const discAmt = parseFloat(String(r.discount || '0').replace(/[^0-9.]/g, '')) || 0;
                    const totalDue = subAmt + setupAmt - discAmt;
                    return (
                      <div key={r.sr_no} onClick={() => setTopupProduct(r)} style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'var(--border-color)'}`, backgroundColor: topupProduct?.sr_no === r.sr_no ? 'rgba(139, 92, 246, 0.06)' : 'var(--bg-main)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'var(--border-color)'}`, backgroundColor: topupProduct?.sr_no === r.sr_no ? '#a78bfa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {topupProduct?.sr_no === r.sr_no && <span style={{ color: '#fff', fontSize: '12px', fontWeight: '700' }}>✓</span>}
                          </div>
                          <div>
                            <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                              {r.is_paid ? 'Paid' : r.valid_stopped_date ? `Due: ${r.valid_stopped_date}` : '—'}
                              {!r.is_paid && totalDue > 0 && ` — ${fmt(totalDue)}`}
                            </p>
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '600' }}>+ Add Top-Up</span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <div className="card">
            <PaymentMethodSelector value={selectedBank} onChange={setSelectedBank} />
          </div>

          <button onClick={handleContinue} disabled={!canContinue()} style={{
            width: '100%', padding: '14px', backgroundColor: canContinue() ? 'var(--primary-accent)' : 'var(--border-color)',
            color: canContinue() ? '#0B111A' : 'var(--text-secondary)', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: canContinue() ? 'pointer' : 'not-allowed', opacity: canContinue() ? 1 : 0.5,
          }}>
            Continue
          </button>
        </>
      )}

      {step === 2 && currentProduct && (
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Payment Details</h3>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <ProductBadge tier={currentProduct.tier} setup_type={currentProduct.setup_type} is_trial={currentProduct.is_trial} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>N° {currentProduct.sr_no}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {payType === 'topup' ? 'Top-up' : 'Amount due'}
                </p>
                <p style={{ fontSize: '22px', fontWeight: '800', color: payType === 'topup' ? '#a78bfa' : '#ef4444' }}>
                  {payType === 'topup' ? '—' : fmt(currentProduct.total_due)}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {payType === 'topup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top-Up Amount (USD)</label>
                <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} required min="1" step="0.01" placeholder="e.g. 50.00" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              </div>
            )}

            {['usdt_trc20', 'usdt_erc20', 'btc'].includes(selectedBank) && (() => {
              const cryptoInfo = CRYPTO_ADDRESSES[selectedBank];
              if (!cryptoInfo) return null;
              return (
                <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e' }}>{cryptoInfo.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cryptoInfo.network}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${cryptoInfo.address}&bgcolor=0B111A&color=00F5A0`} alt={`${cryptoInfo.label} QR`} width={100} height={100} style={{ borderRadius: '8px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', flex: 1 }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '12px', wordBreak: 'break-all', lineHeight: '1.5' }}>{cryptoInfo.address}</p>
                      <CopyButton text={cryptoInfo.address} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                    There will be a transaction fee of 2% on the amount transferred.
                  </p>
                </div>
              );
            })()}

            {selectedBank === 'lhv' && BANK_DETAILS.lhv && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[['Account Title', BANK_DETAILS.lhv.accountTitle], ['IBAN', BANK_DETAILS.lhv.iban], ['BIC/SWIFT', BANK_DETAILS.lhv.bic], ['Bank', BANK_DETAILS.lhv.bank]].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500' }}>{value}</span>
                      <CopyButton text={value} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBank === 'slash' && BANK_DETAILS.slash && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[['Account Name', BANK_DETAILS.slash.accountName], ['Account Number', BANK_DETAILS.slash.accountNumber], ['Routing', BANK_DETAILS.slash.routing], ['SWIFT/BIC', BANK_DETAILS.slash.swift]].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500' }}>{value}</span>
                      <CopyButton text={value} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBank === 'whop' && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Payment via Whop platform</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>You will receive a payment link from our team after submitting your request.</p>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction ID (TX ID)</label>
              <input type="text" value={txId} onChange={e => setTxId(e.target.value)} required placeholder="Enter your transaction ID" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>For Crypto: paste your USDT or BTC transaction hash. For bank transfers: paste your transfer reference.</p>
            </div>

            {payError && <div style={{ color: '#ef4444', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>{payError}</div>}
            {paySuccess && <div style={{ color: '#22c55e', fontSize: '13px', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><IconCheck size={16} color="#22c55e" /> Payment submitted! Redirecting...</div>}

            <button type="submit" disabled={payLoading} style={{ width: '100%', padding: '14px', backgroundColor: payType === 'topup' ? '#a78bfa' : 'var(--primary-accent)', color: '#0B111A', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: payLoading ? 'not-allowed' : 'pointer', opacity: payLoading ? 0.7 : 1 }}>
              {payLoading ? 'Submitting...' : `Submit ${payType === 'topup' ? 'Top-Up' : 'Payment'}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
