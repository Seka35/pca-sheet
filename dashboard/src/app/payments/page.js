"use client";

import { useEffect, useState } from 'react';
import ProductBadge from '@/components/ProductBadge';
import ClientModal from '@/components/ClientModal';

export default function PaymentsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [channelFilter, setChannelFilter] = useState('All channels');

  useEffect(() => {
    fetch('/api/payments')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getStatusBadge = (status) => {
    if (status === 'Paid') return <span style={{ color: '#34D399', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Paid</span>;
    return <span style={{ color: '#F87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Failed</span>;
  };

  const getChannelBadge = (canal) => {
    const c = (canal || '').toLowerCase();
    if (c.includes('whop')) return <span style={{ color: '#A78BFA', backgroundColor: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Whop</span>;
    if (c.includes('stripe')) return <span style={{ color: '#60A5FA', backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Stripe</span>;
    if (c.includes('crypto')) return <span style={{ color: '#FBBF24', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Crypto</span>;
    if (c.includes('virement') || c.includes('transfer')) return <span style={{ color: '#38BDF8', backgroundColor: 'rgba(14, 165, 233, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Transfer</span>;
    if (canal === 'Unknown') return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
    
    return <span style={{ color: 'var(--text-primary)', backgroundColor: 'var(--border-color)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>{canal}</span>;
  };

  const openClientModal = (clientId) => {
    if (!clientId) {
      alert("Erreur: Impossible de charger la fiche de ce client.");
      return;
    }
    setSelectedClientId(clientId);
    setIsModalOpen(true);
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading payments...</div>;
  }

  const { summary, payments } = data;

  const filteredPayments = payments.filter(p => {
    const searchLower = search.toLowerCase();
    const matchSearch = p.client_name?.toLowerCase().includes(searchLower) || 
                        p.client_email?.toLowerCase().includes(searchLower) ||
                        p.period?.toLowerCase().includes(searchLower);
    
    const matchStatus = statusFilter === 'All statuses' || p.status === statusFilter;
    const matchChannel = channelFilter === 'All channels' || p.channel === channelFilter;

    return matchSearch && matchStatus && matchChannel;
  });

  const uniqueChannels = ['All channels'];
  Object.keys(summary.collectedByChannel).forEach(ch => {
    if (!uniqueChannels.includes(ch)) uniqueChannels.push(ch);
  });

  return (
    <div style={{ paddingBottom: '64px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Payments</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{payments.length} total payments</p>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '32px' }}>
        
        {/* Left Side: Single Premium Card for 3 Metrics */}
        <div className="card" style={{ padding: '32px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Collected</div>
            <div style={{ fontSize: '42px', fontWeight: '700', color: '#10B981' }}>{formatCurrency(summary.totalCollected)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Failed Payments</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#EF4444' }}>{summary.failedPaymentsCount}</div>
            </div>

            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Refunds</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#A855F7' }}>{formatCurrency(summary.totalRefunds)}</div>
            </div>
          </div>

        </div>

        {/* Right Side: Channels */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Collected by Channel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(summary.collectedByChannel)
              .sort((a, b) => b[1] - a[1]) // Sort by amount DESC
              .map(([channel, amount]) => (
              <div key={channel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {getChannelBadge(channel)}
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
        
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search by client or period (MM-YYYY)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border-color)', 
              borderRadius: '8px', padding: '12px 16px 12px 40px', color: 'var(--text-primary)', outline: 'none' 
            }}
          />
        </div>
        
        <select 
          value={channelFilter} 
          onChange={(e) => setChannelFilter(e.target.value)}
          style={{ 
            backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', 
            padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '160px'
          }}
        >
          {uniqueChannels.map((ch, idx) => (
            <option key={idx} value={ch} style={{ color: '#000' }}>{ch}</option>
          ))}
        </select>
        
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ 
            backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', 
            padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '160px'
          }}
        >
          <option value="All statuses" style={{ color: '#000' }}>All statuses</option>
          <option value="Paid" style={{ color: '#000' }}>Paid</option>
          <option value="Failed" style={{ color: '#000' }}>Failed</option>
        </select>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {filteredPayments.length} results
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Period</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Product</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Amount</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((row) => (
                <tr 
                  key={row.id} 
                  onClick={() => openClientModal(row.client_id)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s', cursor: 'pointer' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{row.date}</td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{row.period}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{row.client_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.client_email}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <ProductBadge tier={row.tier} setup_type={row.setup_type} />
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {row.amount > 0 ? formatCurrency(row.amount) : '—'}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {getChannelBadge(row.channel)}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {getStatusBadge(row.status)}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'monospace' }}>
                    {row.link}
                  </td>
                </tr>
              ))}
              
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No payments match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        clientId={selectedClientId} 
      />
    </div>
  );
}
