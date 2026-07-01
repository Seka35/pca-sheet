"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';
import SpendProgressBar from '@/components/SpendProgressBar';

const fmtUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

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

const IconCheck = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconArrowRight = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

export default function ProductsPage() {
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/client/renewals')
      .then(r => r.json())
      .then(data => { setRenewals(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  const activeProducts = renewals.filter(r => r.visual_status === 'Active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500', alignSelf: 'flex-start' }}>
        <IconArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>My Products</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {activeProducts.length} active product{activeProducts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {activeProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: 'var(--text-secondary)' }}><IconPackage size={40} /></div>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No active products</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your active products will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {activeProducts.map(r => (
            <ProductCard key={r.sr_no} product={r} onClick={() => setSelectedProduct(r)} />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

function ProductCard({ product, onClick }) {
  const clAmount = parseFloat(String(product.cl_amount || '0').replace(/[^0-9.]/g, '')) || 0;
  const adSpendLimit = parseFloat(String(product.ad_spend_limit || '0').replace(/[^0-9.]/g, '')) || 0;

  const statusBg = product.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : product.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const statusColor = product.billing_status === 'FULLY PAID' ? '#22c55e' : product.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444';

  return (
    <div
      onClick={onClick}
      className="card"
      style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
          {product.ad_id_number && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>AD Account: {product.ad_id_number}</p>
          )}
          {adSpendLimit > 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>Limit: {fmtUSD(adSpendLimit)}</p>
          )}
        </div>
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: statusBg, color: statusColor }}>
          {product.billing_status}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Row label="N°" value={product.sr_no} bold />
        <div style={{ marginTop: '-4px' }}>
          <SpendProgressBar
            current={product.current_spend || 0}
            limit={product.ad_spend_limit || 0}
            showAmount={true}
          />
        </div>
        <Row label="Monthly Fee" value={product.subscription_fee ? fmtUSD(product.subscription_fee) : '—'} />
        {product.setup_fee && parseFloat(product.setup_fee) > 0 && (
          <Row label="Setup Fee" value={fmtUSD(product.setup_fee)} />
        )}
        {product.discount && parseFloat(product.discount) > 0 && (
          <Row label="Discount" value={'-' + fmtUSD(product.discount)} green />
        )}
        {clAmount > 0 && (
          <Row label="CL Amount" value={fmtUSD(clAmount)} purple />
        )}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Due</span>
          <span style={{ color: product.total_due > 0 ? '#ef4444' : '#22c55e', fontSize: '14px', fontWeight: '700' }}>{product.total_due > 0 ? fmtUSD(product.total_due) : '$0.00'}</span>
        </div>
        <Row label="Renewal Date" value={product.valid_stopped_date || '—'} />
      </div>

      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
        <span style={{ color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
          View Details <IconArrowRight size={12} />
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, bold, green, purple }) {
  const color = green ? '#22c55e' : purple ? '#a78bfa' : 'var(--text-primary)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span>
      <span style={{ color, fontSize: '12px', fontWeight: bold ? '600' : '500' }}>{value}</span>
    </div>
  );
}

function ProductModal({ product, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const sub = parseFloat(String(product.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const setup = parseFloat(String(product.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const disc = parseFloat(String(product.discount || '0').replace(/[^0-9.]/g, '')) || 0;
  const clAmount = parseFloat(String(product.cl_amount || '0').replace(/[^0-9.]/g, '')) || 0;
  const adSpendLimit = parseFloat(String(product.ad_spend_limit || '0').replace(/[^0-9.]/g, '')) || 0;

  const statusBg = product.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : product.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const statusColor = product.billing_status === 'FULLY PAID' ? '#22c55e' : product.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444';

  const Section = ({ title, children }) => (
    <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
      <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{title}</p>
      {children}
    </div>
  );

  const InfoRow = ({ label, value, green, purple }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: green ? '#22c55e' : purple ? '#a78bfa' : 'var(--text-primary)', fontWeight: green || purple ? '600' : '500' }}>{value}</span>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: '10px' }}><ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} /></div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{product.tier || 'Product'} {product.setup_type ? `- ${product.setup_type}` : ''}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>N° {product.sr_no}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: statusBg, color: statusColor }}>{product.billing_status}</span>
            {product.is_trial && <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>Trial</span>}
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>{product.visual_status || 'Active'}</span>
          </div>

          <Section title="Product Details">
            <InfoRow label="AD Account" value={product.ad_id_number || '—'} />
            <InfoRow label="Account Type" value={product.ad_account_type || '—'} />
            <InfoRow label="Spend Limit" value={adSpendLimit > 0 ? fmtUSD(adSpendLimit) : '—'} />
            <InfoRow label="Spend" value={(() => {
              const spend = parseFloat(String(product.current_spend || '0').replace(/[^0-9.-]+/g, '')) || 0;
              return fmtUSD(spend);
            })()} />
            <div style={{ marginTop: '6px', marginBottom: '4px' }}>
              <SpendProgressBar
                current={product.current_spend || 0}
                limit={product.ad_spend_limit || 0}
                showAmount={true}
              />
            </div>
            <InfoRow label="Start Date" value={product.start_date || '—'} />
            <InfoRow label="Renewal Date" value={product.valid_stopped_date || '—'} />
            <InfoRow label="Billing Month" value={product.month || '—'} />
          </Section>

          <Section title="Billing">
            <InfoRow label="Subscription Fee" value={fmtUSD(sub)} />
            <InfoRow label="Setup Fee" value={setup > 0 ? fmtUSD(setup) : '—'} />
            {disc > 0 && <InfoRow label="Discount" value={'-' + fmtUSD(disc)} green />}
            {clAmount > 0 && <InfoRow label="CL Amount (Top-Up)" value={fmtUSD(clAmount)} purple />}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Total Due</span>
              <span style={{ fontWeight: '700', fontSize: '16px', color: product.total_due > 0 ? '#ef4444' : '#22c55e' }}>{product.total_due > 0 ? fmtUSD(product.total_due) : '$0.00'}</span>
            </div>
          </Section>

          {product.reference_no && (
            <Section title="Payment">
              <InfoRow label="Reference No." value={product.reference_no} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
