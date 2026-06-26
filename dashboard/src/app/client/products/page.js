"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

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
  return (
    <div
      onClick={onClick}
      className="card"
      style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: product.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: product.is_paid ? '#22c55e' : '#ef4444' }}>
          {product.is_paid ? 'Paid' : 'Pending'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[['N°', product.sr_no], ['Monthly Fee', product.subscription_fee ? `€${product.subscription_fee}` : null], ['Setup Fee', product.setup_fee && parseFloat(product.setup_fee) > 0 ? `€${product.setup_fee}` : null], ['Discount', product.discount && parseFloat(product.discount) > 0 ? `-€${product.discount}` : null]].filter(([, v]) => v !== null).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span>
            <span style={{ color: label === 'Discount' ? '#22c55e' : 'var(--text-primary)', fontSize: '12px', fontWeight: label === 'N°' ? '600' : '500' }}>{value}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Due</span>
          <span style={{ color: product.total_due > 0 ? '#ef4444' : '#22c55e', fontSize: '14px', fontWeight: '700' }}>€{product.total_due > 0 ? product.total_due.toFixed(2) : '0.00'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Renewal Date</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500' }}>{product.valid_stopped_date || '—'}</span>
        </div>
      </div>

      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
        <span style={{ color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
          View Details <IconArrowRight size={12} />
        </span>
      </div>
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
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: product.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: product.is_paid ? '#22c55e' : '#ef4444' }}>{product.is_paid ? 'Paid' : 'Pending Payment'}</span>
            {product.is_trial && <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>Trial</span>}
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>{product.visual_status || 'Active'}</span>
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
            {[['Subscription Fee', `€${sub.toFixed(2)}`], setup > 0 && ['Setup Fee', `€${setup.toFixed(2)}`], disc > 0 && ['Discount', `-€${disc.toFixed(2)}`]].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: label === 'Discount' ? '#22c55e' : 'var(--text-primary)', fontWeight: '500' }}>{value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Total Due</span>
              <span style={{ fontWeight: '700', fontSize: '16px', color: product.total_due > 0 ? '#ef4444' : '#22c55e' }}>€{product.total_due > 0 ? product.total_due.toFixed(2) : '0.00'}</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
            {[['Renewal Date', product.valid_stopped_date], ['Start Date', product.start_date], ['Billing Month', product.month]].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{value}</span>
              </div>
            ))}
            {product.reference_no && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Reference No.</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{product.reference_no}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
