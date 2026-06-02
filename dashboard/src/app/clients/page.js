"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [channelFilter, setChannelFilter] = useState('All channels');

  // Modal
  const [selectedClientData, setSelectedClientData] = useState(null);

  useEffect(() => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        setClients(data);
        setLoading(false);
      });
  }, []);

  const openModal = async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}`);
    const clientData = await res.json();
    setSelectedClientData(clientData);
  };

  const filteredClients = clients.filter(c => {
    // Search
    const searchLower = search.toLowerCase();
    const matchSearch = c.nom?.toLowerCase().includes(searchLower) || 
                        c.email?.toLowerCase().includes(searchLower) ||
                        c.pd_id?.toString().includes(searchLower);
    
    // Status Filter
    const matchStatus = statusFilter === 'All statuses' || 
                        (statusFilter === 'Active' && c.statut === 'Active') || 
                        (statusFilter === 'Inactive' && c.statut !== 'Active');

    // Channel Filter
    const matchChannel = channelFilter === 'All channels' || c.canal?.toLowerCase() === channelFilter.toLowerCase();

    return matchSearch && matchStatus && matchChannel;
  });

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getStatusBadge = (status) => {
    if (status === 'Active') return <span style={{ color: '#34D399', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Active</span>;
    if (status === 'Paused') return <span style={{ color: '#FBBF24', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Paused</span>;
    return <span style={{ color: '#F87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Inactive</span>;
  };

  const getChannelBadge = (canal) => {
    const c = (canal || '').toLowerCase();
    if (c.includes('whop')) return <span style={{ color: '#A78BFA', backgroundColor: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Whop</span>;
    if (c.includes('stripe')) return <span style={{ color: '#60A5FA', backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Stripe</span>;
    if (c.includes('crypto')) return <span style={{ color: '#FBBF24', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Crypto</span>;
    if (c.includes('virement') || c.includes('transfer')) return <span style={{ color: '#38BDF8', backgroundColor: 'rgba(14, 165, 233, 0.15)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Transfer</span>;
    
    if (canal === '—') return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
    
    return <span style={{ color: 'var(--text-primary)', backgroundColor: 'var(--border-color)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>{canal}</span>;
  };

  // Extract unique channels for the dropdown
  const uniqueChannels = ['All channels'];
  clients.forEach(c => {
    if (c.canal && c.canal !== '—' && !uniqueChannels.includes(c.canal)) {
      uniqueChannels.push(c.canal);
    }
  });

  return (
    <div style={{ paddingBottom: '64px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Clients</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{clients.length} total clients</p>
        </div>
        <button 
          style={{ backgroundColor: '#14b8a6', color: '#fff', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          onClick={() => alert("Manual add feature coming soon, usually handled via webhook.")}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          <span>Add Client</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search by name, email or Pipedrive ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border-color)', 
              borderRadius: '8px', padding: '12px 16px 12px 40px', color: 'var(--text-primary)', outline: 'none' 
            }}
          />
        </div>
        
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ 
            backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', 
            padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '160px'
          }}
        >
          <option value="All statuses" style={{ color: '#000' }}>All statuses</option>
          <option value="Active" style={{ color: '#000' }}>Active</option>
          <option value="Inactive" style={{ color: '#000' }}>Inactive</option>
        </select>
        
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
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading clients...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Email</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Product(s)</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Monthly</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'center' }}>Renewal</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Tenure</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>PD ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => openModal(client.id)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px', fontWeight: '500', color: 'var(--text-primary)' }}>{client.nom}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{client.email}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {client.produits.length > 25 ? client.produits.substring(0, 25) + '...' : client.produits}
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {client.mensuel > 0 ? formatCurrency(client.mensuel) : '—'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getStatusBadge(client.statut)}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getChannelBadge(client.canal)}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {client.renouvellement}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {client.anciennete}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'monospace' }}>
                      {client.pd_id}
                    </td>
                  </tr>
                ))}
                
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No clients match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientModal selectedClient={selectedClientData} onClose={() => setSelectedClientData(null)} />
    </div>
  );
}
