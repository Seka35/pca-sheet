"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    totalCollected: 0,
    failedPaymentsCount: 0,
    totalRefunds: 0,
    collectedByChannel: {}
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('All Channels');
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    fetch('/api/payments')
      .then(res => res.json())
      .then(data => {
        setPayments(data.payments || []);
        setSummary(data.summary || {
          totalCollected: 0,
          failedPaymentsCount: 0,
          totalRefunds: 0,
          collectedByChannel: {}
        });
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching payments:", err);
        setLoading(false);
      });
  }, []);

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getChannelBadge = (channel) => {
    let color = 'var(--text-secondary)';
    let bg = 'rgba(255,255,255,0.05)';
    
    const ch = (channel || '').toLowerCase();
    if (ch.includes('whop')) { color = '#A78BFA'; bg = 'rgba(139, 92, 246, 0.1)'; }
    else if (ch.includes('stripe')) { color = '#60A5FA'; bg = 'rgba(59, 130, 246, 0.1)'; }
    else if (ch.includes('crypto')) { color = '#FBBF24'; bg = 'rgba(245, 158, 11, 0.1)'; }
    else if (ch.includes('virement')) { color = '#38BDF8'; bg = 'rgba(14, 165, 233, 0.1)'; }

    return (
      <span style={{ 
        color, backgroundColor: bg, padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600'
      }}>
        {channel || 'Unknown'}
      </span>
    );
  };

  const openClientModal = async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}`);
    const clientData = await res.json();
    setSelectedClient(clientData);
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (p.client_name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.period || '').toLowerCase().includes(search.toLowerCase()) ||
                          (p.link || '').toLowerCase().includes(search.toLowerCase());
    const matchesChannel = channelFilter === 'All Channels' || p.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const uniqueChannels = ['All Channels', ...new Set(payments.map(p => p.channel).filter(Boolean))];

  return (
    <div style={{ paddingBottom: '64px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Payments</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{payments.length} total payments</p>
      </div>

      {/* Metric Cards */}
      <div className="flex-mobile-column" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '32px' }}>
        
        {/* Left Side: Single Premium Card for 3 Metrics */}
        <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
            {Object.entries(summary.collectedByChannel || {})
              .sort((a, b) => b[1] - a[1])
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
      <div className="flex-mobile-column" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search by client or reference..."
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
            padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', minWidth: '160px'
          }}
        >
          {uniqueChannels.map((ch, idx) => (
            <option key={idx} value={ch} style={{ color: '#000' }}>{ch}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
        {filteredPayments.length} results
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading payments...</div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '900px' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Date</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Period</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Client</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Product</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Amount</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((row) => (
                  <tr 
                    key={row.id || row.sr_no} 
                    onClick={() => openClientModal(row.client_id)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s', cursor: 'pointer' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{row.date || '—'}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{row.period || '—'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{row.client_name}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>{row.tier || '—'}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: row.amount > 0 ? '#34D399' : '#F87171' }}>{formatCurrency(row.amount)}</td>
                    <td style={{ padding: '16px 24px' }}>{getChannelBadge(row.channel)}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span className="badge" style={{ backgroundColor: row.status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: row.status === 'Paid' ? '#34D399' : '#F87171' }}>{row.status}</span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {row.link || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
}
