"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

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
  const paidProducts = renewals.filter(r => r.is_paid);
  const upcomingRenewals = renewals.filter(r => {
    return r.diff_days !== null && r.diff_days !== undefined && r.diff_days >= 0 && r.diff_days <= 30 && !r.is_paid;
  });
  const unpaidAmount = activeProducts.filter(r => !r.is_paid).reduce((sum, r) => sum + (r.total_due > 0 ? r.total_due : 0), 0);

  const quickActions = [
    { label: 'View Products', path: '/client/products', icon: '📦', color: '#3b82f6' },
    { label: 'Pay Now', path: '/client/pay', icon: '💳', color: '#22c55e' },
    { label: 'Payment History', path: '/client/payments', icon: '📜', color: '#a78bfa' },
    { label: 'Edit Profile', path: '/client/profile', icon: '👤', color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.08) 0%, rgba(0, 0, 0, 0) 60%)',
        border: '1px solid rgba(0, 245, 160, 0.15)',
        borderRadius: '12px',
        padding: '28px 32px'
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Welcome back, {client?.first_name || client?.name?.split(' ')[0] || 'Client'} 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Here's an overview of your account and services.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Total Paid"
          value={`€${paymentsData.total_paid.toFixed(2)}`}
          icon="💰"
          color="#22c55e"
          subValue={`${paymentsData.payments.length} payments`}
        />
        <StatCard
          label="Active Products"
          value={activeProducts.length}
          icon="📦"
          color="#3b82f6"
          subValue={`${trialProducts.length} on trial`}
        />
        <StatCard
          label="Upcoming Renewals"
          value={upcomingRenewals.length}
          icon="📅"
          color="#f59e0b"
          subValue="Next 30 days"
        />
        <StatCard
          label="Amount Due"
          value={unpaidAmount > 0 ? `€${unpaidAmount.toFixed(2)}` : '€0.00'}
          icon="⏳"
          color={unpaidAmount > 0 ? '#ef4444' : '#22c55e'}
          subValue={unpaidAmount > 0 ? 'Pending payment' : 'All clear'}
        />
      </div>

      {/* Trial Alert */}
      {trialProducts.length > 0 && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '24px' }}>⏰</span>
          <div>
            <p style={{ color: '#fbbf24', fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
              You have {trialProducts.length} product{trialProducts.length > 1 ? 's' : ''} on trial
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {trialProducts.map(p => p.tier).join(', ')} — Make sure to pay before renewal date
            </p>
          </div>
          <button
            onClick={() => router.push('/client/pay')}
            style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              backgroundColor: '#fbbf24',
              color: '#0B111A',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Pay Now
          </button>
        </div>
      )}

      {/* Upcoming Renewals Preview */}
      {upcomingRenewals.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Upcoming Renewals</h2>
            <button
              onClick={() => router.push('/client/upcoming')}
              style={{ color: 'var(--primary-accent)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
            >
              View all →
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
                {upcomingRenewals.slice(0, 5).map((r, i) => (
                  <tr key={r.sr_no} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                      </div>
                    </TableCell>
                    <TableCell style={{ color: r.diff_days <= 7 ? '#ef4444' : r.diff_days <= 14 ? '#f59e0b' : 'var(--text-primary)', fontWeight: '500' }}>
                      {r.valid_stopped_date || '—'}
                      <span style={{ fontSize: '11px', marginLeft: '6px', opacity: 0.7 }}>({r.diff_days}d)</span>
                    </TableCell>
                    <TableCell style={{ fontWeight: '600', color: '#ef4444' }}>
                      €{r.total_due > 0 ? r.total_due.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                        backgroundColor: r.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: r.is_paid ? '#22c55e' : '#ef4444'
                      }}>
                        {r.is_paid ? 'Paid' : 'Pending'}
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
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Active Products</h2>
            <button
              onClick={() => router.push('/client/products')}
              style={{ color: 'var(--primary-accent)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
            >
              View all →
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
                {activeProducts.slice(0, 5).map((r, i) => (
                  <tr key={r.sr_no} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{r.sr_no}</TableCell>
                    <TableCell>
                      <ProductBadge tier={r.tier} setup_type={r.setup_type} is_trial={r.is_trial} />
                    </TableCell>
                    <TableCell style={{ fontWeight: '500' }}>€{r.subscription_fee || '—'}</TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{r.valid_stopped_date || '—'}</TableCell>
                    <TableCell>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                        backgroundColor: r.is_paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: r.is_paid ? '#22c55e' : '#ef4444'
                      }}>
                        {r.is_paid ? 'Paid' : 'Pending'}
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
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {quickActions.map(action => (
            <button
              key={action.path}
              onClick={() => router.push(action.path)}
              style={{
                padding: '18px 16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
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
              <span style={{ fontSize: '24px' }}>{action.icon}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Payments */}
      {paymentsData.payments.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Recent Payments</h2>
            <button
              onClick={() => router.push('/client/payments')}
              style={{ color: 'var(--primary-accent)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
            >
              View all →
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
                    <TableCell style={{ fontWeight: '600', color: '#22c55e' }}>€{p.amount || '—'}</TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{p.method || '—'}</TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{p.product}</TableCell>
                    <TableCell>
                      {p.is_topup && (
                        <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          TOP-UP
                        </span>
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
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '28px' }}>{icon}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>{subValue}</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: '700', color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function TableHeader({ children }) {
  return (
    <th style={{
      padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px',
      fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)',
      whiteSpace: 'nowrap'
    }}>
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
