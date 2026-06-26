"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

export default function UpcomingPage() {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allUpcoming = renewals.filter(r => {
    if (r.visual_status !== 'Active') return false;
    if (r.is_paid && r.diff_days === null) return false;
    if (r.diff_days !== null && r.diff_days < 0) return false; // past due - skip
    return true;
  }).sort((a, b) => {
    const daysA = a.diff_days !== null ? a.diff_days : 999;
    const daysB = b.diff_days !== null ? b.diff_days : 999;
    return daysA - daysB;
  });

  const overdue = allUpcoming.filter(r => r.diff_days !== null && r.diff_days < 0);
  const within30 = allUpcoming.filter(r => r.diff_days !== null && r.diff_days >= 0 && r.diff_days <= 30);
  const later = allUpcoming.filter(r => r.diff_days === null || r.diff_days > 30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Upcoming Renewals</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {allUpcoming.length} upcoming renewal{allUpcoming.length !== 1 ? 's' : ''}
        </p>
      </div>

      {overdue.length > 0 && (
        <Section title={`⚠️ Overdue (${overdue.length})`} color="#ef4444">
          {overdue.map(r => (
            <RenewalRow key={r.sr_no} renewal={r} onClick={() => setSelectedProduct(r)} />
          ))}
        </Section>
      )}

      {within30.length > 0 && (
        <Section title={`📅 Next 30 Days (${within30.length})`} color="#f59e0b">
          {within30.map(r => (
            <RenewalRow key={r.sr_no} renewal={r} onClick={() => setSelectedProduct(r)} />
          ))}
        </Section>
      )}

      {later.length > 0 && (
        <Section title={`🗓️ Later (${later.length})`} color="#3b82f6">
          {later.map(r => (
            <RenewalRow key={r.sr_no} renewal={r} onClick={() => setSelectedProduct(r)} />
          ))}
        </Section>
      )}

      {allUpcoming.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>✅</span>
          <p style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No upcoming renewals</p>
          <p style={{ fontSize: '13px', opacity: 0.7 }}>You're all caught up!</p>
        </div>
      )}

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onPay={() => { setSelectedProduct(null); router.push('/client/pay'); }} />
      )}
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div>
      <h2 style={{ fontSize: '14px', fontWeight: '700', color: color, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card)' }}>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Renewal Date</th>
              <th style={thStyle}>Days Left</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RenewalRow({ renewal, onClick }) {
  const getDaysColor = (d) => {
    if (d === null || d === undefined) return 'var(--text-secondary)';
    if (d < 0) return '#ef4444';
    if (d <= 7) return '#ef4444';
    if (d <= 14) return '#f59e0b';
    return '#22c55e';
  };

  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <td style={tdStyle}>
        <ProductBadge tier={renewal.tier} setup_type={renewal.setup_type} is_trial={renewal.is_trial} />
      </td>
      <td style={{ ...tdStyle, fontWeight: '500' }}>{renewal.valid_stopped_date || '—'}</td>
      <td style={{ ...tdStyle, fontWeight: '600', color: getDaysColor(renewal.diff_days) }}>
        {renewal.diff_days !== null && renewal.diff_days !== undefined
          ? (renewal.diff_days < 0 ? `${Math.abs(renewal.diff_days)}d overdue` : `${renewal.diff_days}d`)
          : '—'}
      </td>
      <td style={{ ...tdStyle, fontWeight: '600', color: renewal.total_due > 0 ? '#ef4444' : '#22c55e' }}>
        €{renewal.total_due > 0 ? renewal.total_due.toFixed(2) : '0.00'}
      </td>
      <td style={tdStyle}>
        <span style={{
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
          backgroundColor: renewal.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: renewal.is_paid ? '#22c55e' : '#ef4444'
        }}>
          {renewal.is_paid ? 'Paid' : 'Pending'}
        </span>
      </td>
      <td style={{ ...tdStyle, color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '500' }}>
        View →
      </td>
    </tr>
  );
}

const thStyle = {
  padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px',
  fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)'
};

// Inline product modal (same as products page)
function ProductModal({ product, onClose, onPay }) {
  const router = useRouter();

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const sub = parseFloat(String(product.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const setup = parseFloat(String(product.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const disc = parseFloat(String(product.discount || '0').replace(/[^0-9.]/g, '')) || 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '24px'
    }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px',
        width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', position: 'relative'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: '10px' }}>
              <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {product.tier} {product.setup_type ? `- ${product.setup_type}` : ''}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>N° {product.sr_no}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: product.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: product.is_paid ? '#22c55e' : '#ef4444' }}>
              {product.is_paid ? 'Paid' : 'Pending Payment'}
            </span>
            {product.is_trial && <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>Trial</span>}
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
            <DetailRow label="Subscription Fee" value={`€${sub.toFixed(2)}`} />
            {setup > 0 && <DetailRow label="Setup Fee" value={`€${setup.toFixed(2)}`} />}
            {disc > 0 && <DetailRow label="Discount" value={`-€${disc.toFixed(2)}`} valueColor="#22c55e" />}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Total Due</span>
              <span style={{ fontWeight: '700', fontSize: '16px', color: product.total_due > 0 ? '#ef4444' : '#22c55e' }}>€{product.total_due > 0 ? product.total_due.toFixed(2) : '0.00'}</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
            {product.valid_stopped_date && <DetailRow label="Renewal Date" value={product.valid_stopped_date} />}
            {product.start_date && <DetailRow label="Start Date" value={product.start_date} />}
            {product.diff_days !== null && product.diff_days !== undefined && (
              <DetailRow label="Days Until Renewal" value={product.diff_days >= 0 ? `${product.diff_days} days` : 'Past due'} valueColor={product.diff_days <= 7 ? '#ef4444' : undefined} />
            )}
            {product.reference_no && <DetailRow label="Reference No." value={product.reference_no} />}
          </div>

          {!product.is_paid && product.total_due > 0 && (
            <button
              onClick={onPay}
              style={{
                width: '100%', padding: '14px', backgroundColor: 'var(--primary-accent)', color: '#0B111A',
                border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '8px'
              }}
            >
              Pay €{product.total_due.toFixed(2)} Now →
            </button>
          )}
        </div>
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
