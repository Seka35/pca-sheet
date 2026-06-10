"use client";

import { useEffect, useState, useCallback } from 'react';
import ClientModal from '@/components/ClientModal';
import AddClientModal from '@/components/AddClientModal';
import TelegramBadge from '@/components/TelegramBadge';
import TeleIdBadge from '@/components/TeleIdBadge';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [channelFilter, setChannelFilter] = useState('All channels');

  // Modals
  const [selectedClientData, setSelectedClientData] = useState(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  const loadClients = useCallback(() => {
    setLoading(true);
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const openModal = async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}`);
    const clientData = await res.json();
    setSelectedClientData(clientData);
  };

  const fixTeleIds = async () => {
    try {
      const res = await fetch('/api/clients/fix-teleids', { method: 'POST' });
      const data = await res.json();
      setFixResult(data);
      if (data.success) {
        loadClients();
        setTimeout(() => setFixResult(null), 8000);
      }
    } catch (e) {
      setFixResult({ success: false, error: e.message });
    }
  };

  const filteredClients = clients.filter(c => {
    // Search
    const searchLower = search.toLowerCase();
    const matchSearch = c.nom?.toLowerCase().includes(searchLower) ||
                        c.email?.toLowerCase().includes(searchLower) ||
                        c.pd_id?.toString().includes(searchLower) ||
                        c.telegram_group_id?.toLowerCase().includes(searchLower) ||
                        c.tele_id?.toString().includes(searchLower);
    
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
      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Clients</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{clients.length} total clients</p>
        </div>
        <button
          style={{ backgroundColor: '#14b8a6', color: '#fff', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          onClick={() => setAddClientOpen(true)}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          <span>Add Client</span>
        </button>
        <button
          onClick={fixTeleIds}
          style={{ backgroundColor: 'transparent', color: '#F87171', padding: '10px 16px', borderRadius: '8px', border: '1px solid #F87171', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          title="Fix missing Tele IDs so /start can link groups properly"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.772-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.149-.894z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>Fix Tele IDs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex-mobile-column" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
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
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '900px' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Tele ID</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Email</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Product(s)</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Monthly</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Telegram</th>
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
                    <td style={{ padding: '16px 24px' }}>
                      <TeleIdBadge
                        teleId={client.tele_id}
                        parsedTeleId={client.parsed_tele_id}
                        conflict={client.tele_id_conflict}
                      />
                    </td>
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
                    <td style={{ padding: '16px 24px' }}>
                      <TelegramBadge chatId={client.telegram_group_id} title="Primary linked group" />
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
                    <td colSpan="11" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No clients match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientModal
        selectedClient={selectedClientData}
        onClose={() => setSelectedClientData(null)}
        onSaved={loadClients}
      />
      <AddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onCreated={() => {
          setAddClientOpen(false);
          loadClients();
        }}
      />

      {/* Fix Tele IDs result toast */}
      {fixResult && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: fixResult.success ? 'var(--status-active-bg)' : 'var(--status-cut-bg)',
          color: fixResult.success ? 'var(--status-active)' : 'var(--status-cut)',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          maxWidth: '400px',
          fontSize: '13px',
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            {fixResult.success ? '✓ Tele IDs fixed' : '✕ Error'}
          </div>
          {fixResult.success ? (
            <div>
              <div>{fixResult.newlyFixed > 0 ? `${fixResult.newlyFixed} client(s) fixed` : 'All clients already have Tele IDs'}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                {fixResult.clientsWithTeleId}/{fixResult.totalClients} clients with Tele ID
                {fixResult.withoutTeleIds?.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    Without Tele ID: {fixResult.withoutTeleIds.map(c => c.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>{fixResult.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
