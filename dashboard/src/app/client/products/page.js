"use client";

import { useState, useEffect } from 'react';
import ProductBadge from '@/components/ProductBadge';

export default function ProductsPage() {
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetch('/api/client/renewals')
      .then(r => r.json())
      .then(data => {
        setRenewals(data);
        setLoading(false);
      })
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>My Products</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {activeProducts.length} active product{activeProducts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {activeProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>📦</span>
          <p style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No active products</p>
          <p style={{ fontSize: '13px', opacity: 0.7 }}>Your active products will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {activeProducts.map(r => (
            <ProductCard key={r.sr_no} product={r} onClick={() => setSelectedProduct(r)} />
          ))}
        </div>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} client={null} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

function ProductCard({ product, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid var(--border-color)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--primary-accent)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
        <span style={{
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
          backgroundColor: product.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: product.is_paid ? '#22c55e' : '#ef4444'
        }}>
          {product.is_paid ? 'Paid' : 'Pending'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>N°</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600' }}>{product.sr_no}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Monthly Fee</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600' }}>€{product.subscription_fee || '—'}</span>
        </div>
        {product.setup_fee && parseFloat(product.setup_fee) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Setup Fee</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600' }}>€{product.setup_fee}</span>
          </div>
        )}
        {product.discount && parseFloat(product.discount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Discount</span>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: '600' }}>-€{product.discount}</span>
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Due</span>
          <span style={{ color: product.total_due > 0 ? '#ef4444' : '#22c55e', fontSize: '14px', fontWeight: '700' }}>
            €{product.total_due > 0 ? product.total_due.toFixed(2) : '0.00'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Renewal Date</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500' }}>{product.valid_stopped_date || '—'}</span>
        </div>
      </div>

      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
        <span style={{ color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '600' }}>
          View Details →
        </span>
      </div>
    </div>
  );
}

function ProductModal({ product, client, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const sub = parseFloat(String(product.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const setup = parseFloat(String(product.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const disc = parseFloat(String(product.discount || '0').replace(/[^0-9.]/g, '')) || 0;
  const total = sub + setup - disc;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: '24px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '85vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ marginBottom: '10px' }}>
              <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {product.tier || 'Product'} {product.setup_type ? `- ${product.setup_type}` : ''}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>N° {product.sr_no}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              fontSize: '28px', cursor: 'pointer', padding: '0', lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Row */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <StatusPill
              label={product.is_paid ? 'Paid' : 'Pending Payment'}
              color={product.is_paid ? '#22c55e' : '#ef4444'}
              bg={product.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
            />
            {product.is_trial && (
              <StatusPill label="Trial" color="#fbbf24" bg="rgba(251, 191, 36, 0.15)" />
            )}
            <StatusPill
              label={product.visual_status || 'Active'}
              color={product.visual_status === 'Active' ? '#3b82f6' : '#a78bfa'}
              bg={product.visual_status === 'Active' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)'}
            />
          </div>

          {/* Billing */}
          <Section title="Billing Details">
            <DetailRow label="Subscription Fee" value={`€${sub.toFixed(2)}`} />
            {setup > 0 && <DetailRow label="Setup Fee" value={`€${setup.toFixed(2)}`} />}
            {disc > 0 && <DetailRow label="Discount" value={`-€${disc.toFixed(2)}`} valueColor="#22c55e" />}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Total Due</span>
              <span style={{ fontWeight: '700', fontSize: '16px', color: product.total_due > 0 ? '#ef4444' : '#22c55e' }}>
                €{product.total_due > 0 ? product.total_due.toFixed(2) : '0.00'}
              </span>
            </div>
          </Section>

          {/* Dates */}
          <Section title="Dates">
            {product.valid_stopped_date && (
              <DetailRow label="Renewal Date" value={product.valid_stopped_date} />
            )}
            {product.start_date && (
              <DetailRow label="Start Date" value={product.start_date} />
            )}
            {product.month && (
              <DetailRow label="Billing Month" value={product.month} />
            )}
          </Section>

          {/* Other Info */}
          <Section title="Other Information">
            {product.reference_no && (
              <DetailRow label="Reference No." value={product.reference_no} />
            )}
            {product.diff_days !== null && product.diff_days !== undefined && (
              <DetailRow
                label="Days Until Renewal"
                value={product.diff_days >= 0 ? `${product.diff_days} days` : 'Past due'}
                valueColor={product.diff_days <= 7 ? '#ef4444' : product.diff_days <= 14 ? '#f59e0b' : undefined}
              />
            )}
          </Section>
        </div>
      </div>

      <style jsx>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
        {title}
      </h3>
      <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: valueColor || 'var(--text-primary)', fontWeight: '500' }}>{value || '—'}</span>
    </div>
  );
}

function StatusPill({ label, color, bg }) {
  return (
    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: bg, color }}>
      {label}
    </span>
  );
}
