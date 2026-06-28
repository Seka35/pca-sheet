"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

const fmtUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const IconCurrency = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);

const IconBox = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const IconCalendar = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconClock = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconArrowRight = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconCheck = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconUser = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconCreditCard = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const IconDocument = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

export default function ClientDashboardPage() {
  const [client, setClient] = useState(null);
  const [renewals, setRenewals] = useState([]);
  const [paymentsData, setPaymentsData] = useState({ payments: [], total_paid: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/client/me').then(r => r.json()),
      fetch('/api/client/renewals').then(r => r.json()),
      fetch('/api/client/payments').then(r => r.json()),
    ]).then(([clientData, renewalsData, paymentsData]) => {
      setClient(clientData.client);
      setRenewals(renewalsData);
      setPaymentsData(paymentsData);
      setLoading(false);
    }).catch(err => {
      console.error('Error loading data:', err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading...
        </div>
      </div>
    );
  }

  const activeProducts = renewals.filter(r => r.visual_status === 'Active');
  const trialProducts = renewals.filter(r => r.is_trial && r.visual_status === 'Active');
  const upcomingRenewals = renewals.filter(r => {
    return r.diff_days !== null && r.diff_days !== undefined && r.diff_days >= 0 && r.diff_days <= 15 && r.billing_status !== 'FULLY PAID';
  });

  // All products that need payment (not fully paid) — trial, partial, unpaid
  const unpaidProducts = renewals.filter(r => r.billing_status !== 'FULLY PAID');
  const unpaidAmount = unpaidProducts.reduce((sum, r) => sum + (r.total_due > 0 ? r.total_due : 0), 0);

  const quickActions = [
    { label: 'View Products', path: '/client/products', icon: <IconBox size={22} />, color: '#3b82f6' },
    { label: 'Pay Now', path: '/client/pay', icon: <IconCreditCard size={22} />, color: '#22c55e' },
    { label: 'Payment History', path: '/client/payments', icon: <IconDocument size={22} />, color: '#a78bfa' },
    { label: 'Edit Profile', path: '/client/profile', icon: <IconUser size={22} />, color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Welcome Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.08) 0%, rgba(0, 0, 0, 0) 60%)',
        border: '1px solid rgba(0, 245, 160, 0.15)',
        borderRadius: '12px',
        padding: '28px 32px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Welcome back, {client?.first_name || client?.name?.split(' ')[0] || 'Client'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Here's an overview of your account and services.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Paid" value={fmtUSD(paymentsData.total_paid)} icon={<IconCurrency size={24} />} color="#22c55e" subValue={`${paymentsData.payments.length} payments`} />
        <StatCard label="Active Products" value={activeProducts.length} icon={<IconBox size={24} />} color="#3b82f6" subValue={`${unpaidProducts.length} pending`} />
        <StatCard label="Upcoming Renewals" value={upcomingRenewals.length} icon={<IconCalendar size={24} />} color="#f59e0b" subValue="Next 30 days" />
        <StatCard label="Amount Due" value={unpaidAmount > 0 ? fmtUSD(unpaidAmount) : '$0.00'} icon={<IconClock size={24} />} color={unpaidAmount > 0 ? '#ef4444' : '#22c55e'} subValue={unpaidAmount > 0 ? 'Pending payment' : 'All clear'} />
      </div>

      {/* Payment Action Required */}
      {unpaidProducts.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <IconClock size={24} color="#ef4444" />
          <div style={{ flex: 1 }}>
            <p style={{ color: '#ef4444', fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
              {unpaidProducts.length} product{unpaidProducts.length > 1 ? 's' : ''} pending payment
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {unpaidProducts.map(p => `${p.tier}${p.billing_status !== 'UNPAID' ? ` (${p.billing_status})` : ''}`).join(', ')} — Make sure to pay before renewal date
            </p>
          </div>
          <button
            onClick={() => router.push('/client/pay')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            Pay Now <IconArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Upcoming Renewals Preview */}
      {upcomingRenewals.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Upcoming Renewals</h2>
            <button onClick={() => router.push('/client/upcoming')} style={{ color: 'var(--primary-accent)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <IconArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <TableHeader>Product</TableHeader>
                  <TableHeader>Renewal Date</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>
              <tbody>
                {upcomingRenewals.slice(0, 5).map(r => (
                  <tr key={r.sr_no} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <TableCell><ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} /></TableCell>
                    <TableCell style={{ color: r.diff_days <= 7 ? '#ef4444' : r.diff_days <= 14 ? '#f59e0b' : 'var(--text-primary)', fontWeight: '500' }}>
                      {r.valid_stopped_date || '—'}
                      <span style={{ fontSize: '11px', marginLeft: '6px', opacity: 0.7 }}>({r.diff_days}d)</span>
                    </TableCell>
                    <TableCell style={{ fontWeight: '600', color: '#ef4444' }}>{r.total_due > 0 ? fmtUSD(r.total_due) : '—'}</TableCell>
                    <TableCell>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: r.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : r.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: r.billing_status === 'FULLY PAID' ? '#22c55e' : r.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444' }}>
                        {r.billing_status}
                      </span>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Products Preview */}
      {activeProducts.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Active Products</h2>
            <button onClick={() => router.push('/client/products')} style={{ color: 'var(--primary-accent)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <IconArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <TableHeader>N°</TableHeader>
                  <TableHeader>Product</TableHeader>
                  <TableHeader>Monthly Fee</TableHeader>
                  <TableHeader>Renewal Date</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>
              <tbody>
                {activeProducts.slice(0, 5).map(r => (
                  <tr key={r.sr_no} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{r.sr_no}</TableCell>
                    <TableCell><ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} /></TableCell>
                    <TableCell style={{ fontWeight: '500' }}>{(() => { const sub = parseFloat(String(r.subscription_fee || '0').replace(/[^0-9.-]+/g, '')) || 0; const setup = parseFloat(String(r.setup_fee || '0').replace(/[^0-9.-]+/g, '')) || 0; const disc = parseFloat(String(r.discount || '0').replace(/[^0-9.-]+/g, '')) || 0; const total = sub + setup - disc; return total > 0 ? fmtUSD(total) : '—'; })()}</TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{r.valid_stopped_date || '—'}</TableCell>
                    <TableCell>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: r.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : r.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: r.billing_status === 'FULLY PAID' ? '#22c55e' : r.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444' }}>
                        {r.billing_status}
                      </span>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', textAlign: 'center' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {quickActions.map(action => (
            <button
              key={action.path}
              onClick={() => router.push(action.path)}
              style={{
                padding: '20px 16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = action.color;
                e.currentTarget.style.backgroundColor = `${action.color}10`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              }}
            >
              <span style={{ color: action.color }}>{action.icon}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Payments */}
      {paymentsData.payments.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Recent Payments</h2>
            <button onClick={() => router.push('/client/payments')} style={{ color: 'var(--primary-accent)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <IconArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Method</TableHeader>
                  <TableHeader>Product</TableHeader>
                  <TableHeader>Type</TableHeader>
                </tr>
              </thead>
              <tbody>
                {paymentsData.payments.slice(0, 5).map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{p.date || '—'}</TableCell>
                    <TableCell style={{ fontWeight: '600', color: '#22c55e' }}>{p.amount ? fmtUSD(p.amount) : '—'}</TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{p.method || '—'}</TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{p.product}</TableCell>
                    <TableCell>
                      {p.is_topup && (
                        <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>TOP-UP</span>
                      )}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, subValue }) {
  return (
    <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color }}>{icon}</div>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ fontSize: '26px', fontWeight: '800', color: color || 'var(--text-primary)', marginBottom: '4px' }}>{value}</p>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{subValue}</p>
    </div>
  );
}

function TableHeader({ children }) {
  return (
    <th style={{ padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function TableCell({ children, style }) {
  return (
    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
      {children}
    </td>
  );
}
