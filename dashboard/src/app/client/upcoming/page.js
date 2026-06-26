"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

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

const IconAlertCircle = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconCalendar = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconArrowRight = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconCheck = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

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
    if (r.billing_status === 'FULLY PAID' && r.diff_days === null) return false;
    if (r.diff_days !== null && r.diff_days < 0) return false;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500', alignSelf: 'flex-start' }}>
        <IconArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Upcoming Renewals</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{allUpcoming.length} upcoming renewal{allUpcoming.length !== 1 ? 's' : ''}</p>
      </div>

      {overdue.length > 0 && (
        <Section title={`Overdue (${overdue.length})`} color="#ef4444" icon={<IconAlertCircle size={16} color="#ef4444" />}>
          {overdue.map(r => <RenewalRow key={r.sr_no} renewal={r} onClick={() => setSelectedProduct(r)} />)}
        </Section>
      )}

      {within30.length > 0 && (
        <Section title={`Next 30 Days (${within30.length})`} color="#f59e0b" icon={<IconCalendar size={16} color="#f59e0b" />}>
          {within30.map(r => <RenewalRow key={r.sr_no} renewal={r} onClick={() => setSelectedProduct(r)} />)}
        </Section>
      )}

      {later.length > 0 && (
        <Section title={`Later (${later.length})`} color="#60a5fa" icon={<IconCalendar size={16} color="#60a5fa" />}>
          {later.map(r => <RenewalRow key={r.sr_no} renewal={r} onClick={() => setSelectedProduct(r)} />)}
        </Section>
      )}

      {allUpcoming.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: 'var(--text-secondary)' }}><IconCheck size={40} /></div>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No upcoming renewals</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>You're all caught up!</p>
        </div>
      )}

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onPay={() => { setSelectedProduct(null); router.push('/client/pay'); }} />
      )}
    </div>
  );
}

function Section({ title, color, icon, children }) {
  return (
    <div>
      <h2 style={{ fontSize: '13px', fontWeight: '700', color: color, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {icon} {title}
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
          <tbody>{children}</tbody>
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
      <td style={tdStyle}><ProductBadge tier={renewal.tier} setup_type={renewal.setup_type} is_trial={renewal.is_trial} /></td>
      <td style={{ ...tdStyle, fontWeight: '500' }}>{renewal.valid_stopped_date || '—'}</td>
      <td style={{ ...tdStyle, fontWeight: '600', color: getDaysColor(renewal.diff_days) }}>
        {renewal.diff_days !== null && renewal.diff_days !== undefined ? (renewal.diff_days < 0 ? `${Math.abs(renewal.diff_days)}d overdue` : `${renewal.diff_days}d`) : '—'}
      </td>
      <td style={{ ...tdStyle, fontWeight: '600', color: renewal.total_due > 0 ? '#ef4444' : '#22c55e' }}>{renewal.total_due > 0 ? fmtUSD(renewal.total_due) : '$0.00'}</td>
      <td style={tdStyle}>
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: renewal.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : renewal.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: renewal.billing_status === 'FULLY PAID' ? '#22c55e' : renewal.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444' }}>
          {renewal.billing_status}
        </span>
      </td>
      <td style={{ ...tdStyle, color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
        View <IconArrowRight size={12} />
      </td>
    </tr>
  );
}

const thStyle = { padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' };

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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: '10px' }}><ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} /></div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{product.tier} {product.setup_type ? `- ${product.setup_type}` : ''}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>N° {product.sr_no}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: product.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : product.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: product.billing_status === 'FULLY PAID' ? '#22c55e' : product.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444' }}>{product.billing_status}</span>
            {product.is_trial && <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>Trial</span>}
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
            {[['Subscription Fee', fmtUSD(sub)], setup > 0 && ['Setup Fee', fmtUSD(setup)], disc > 0 && ['Discount', '-' + fmtUSD(disc)]].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: label === 'Discount' ? '#22c55e' : 'var(--text-primary)', fontWeight: '500' }}>{value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Total Due</span>
              <span style={{ fontWeight: '700', fontSize: '16px', color: product.total_due > 0 ? '#ef4444' : '#22c55e' }}>{product.total_due > 0 ? fmtUSD(product.total_due) : '$0.00'}</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
            {[['Renewal Date', product.valid_stopped_date], ['Start Date', product.start_date], product.diff_days !== null && product.diff_days !== undefined && ['Days Until Renewal', `${product.diff_days >= 0 ? product.diff_days + ' days' : 'Past due'}`], product.reference_no && ['Reference No.', product.reference_no]].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{value}</span>
              </div>
            ))}
          </div>

          {product.billing_status !== 'FULLY PAID' && product.total_due > 0 && (
            <button onClick={onPay} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary-accent)', color: '#0B111A', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Pay {fmtUSD(product.total_due)} Now <IconArrowRight size={14} color="#0B111A" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
