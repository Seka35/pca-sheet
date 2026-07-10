"use client";
// Clients page - rebuilt at 2026-06-27
import { useEffect, useState, useCallback } from 'react';
import ClientModal from '@/components/ClientModal';
import AddClientModal from '@/components/AddClientModal';
import ProductBadge from '@/components/ProductBadge';
import TelegramBadge from '@/components/TelegramBadge';
import TeleIdBadge from '@/components/TeleIdBadge';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [channelFilter, setChannelFilter] = useState('All channels');
  const [productFilter, setProductFilter] = useState('All Products');

  // Modals
  const [selectedClientData, setSelectedClientData] = useState(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  const loadClients = useCallback((refetchClientId) => {
    setLoading(true);
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        setClients(data);
        setLoading(false);
        // Also refetch the currently open client so modal sees fresh data
        if (refetchClientId) {
          fetch(`/api/clients/${refetchClientId}`)
            .then(r => r.json())
            .then(fresh => setSelectedClientData(fresh))
            .catch(() => {});
        }
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

    // Product Filter
    const matchProduct = productFilter === 'All Products' ||
                        (c.productDetails && c.productDetails.some(p =>
                          (p.tier && p.tier === productFilter) ||
                          (p.setup_type && p.setup_type === productFilter)
                        ));

    return matchSearch && matchStatus && matchChannel && matchProduct;
  });

  // Extract unique products for the dropdown
  const uniqueProducts = ['All Products'];
  clients.forEach(c => {
    if (c.productDetails) {
      c.productDetails.forEach(p => {
        if (p.tier && !uniqueProducts.includes(p.tier)) uniqueProducts.push(p.tier);
        if (p.setup_type && !uniqueProducts.includes(p.setup_type)) uniqueProducts.push(p.setup_type);
      });
    }
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
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Clients</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
            Manage your <span style={{ color: 'var(--text-primary)' }}>{clients.length}</span> active client relationships
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={fixTeleIds}
            style={{ 
              backgroundColor: 'rgba(248, 113, 113, 0.05)', 
              color: '#F87171', 
              padding: '10px 16px', 
              borderRadius: '10px', 
              border: '1px solid rgba(248, 113, 113, 0.2)', 
              fontWeight: '600', 
              fontSize: '13px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.05)'}
            title="Fix missing Tele IDs so /start can link groups properly"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.772-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.149-.894z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>Fix Tele IDs</span>
          </button>
          <button
            style={{ 
              backgroundColor: 'var(--primary-accent)', 
              color: '#000', 
              padding: '10px 20px', 
              borderRadius: '10px', 
              border: 'none', 
              fontWeight: '700', 
              fontSize: '13px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 242, 181, 0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 242, 181, 0.3)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 242, 181, 0.2)'; }}
            onClick={() => setAddClientOpen(true)}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search clients by name, email or Pipedrive ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', 
              borderRadius: '10px', padding: '12px 16px 12px 44px', color: 'var(--text-primary)', outline: 'none',
              fontSize: '14px', transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ 
              backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px', 
              padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '150px',
              fontSize: '14px'
            }}
          >
            <option value="All statuses" style={{ color: '#000' }}>All Statuses</option>
            <option value="Active" style={{ color: '#000' }}>Active</option>
            <option value="Inactive" style={{ color: '#000' }}>Inactive</option>
          </select>
          
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px',
              padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '150px',
              fontSize: '14px'
            }}
          >
            {uniqueChannels.map((ch, idx) => (
              <option key={idx} value={ch} style={{ color: '#000' }}>{ch === 'All channels' ? 'All Channels' : ch}</option>
            ))}
          </select>

          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px',
              padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '150px',
              fontSize: '14px'
            }}
          >
            {uniqueProducts.map((prod, idx) => (
              <option key={idx} value={prod} style={{ color: '#000' }}>{prod}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--status-active-bg)', borderTopColor: 'var(--status-active)', borderRadius: '50%', margin: '0 auto 16px' }}></div>
            <div style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Loading client directory...</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Telegram Group Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Tele ID</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Products</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Monthly CA</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Channel</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Telegram</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Tenure</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => openModal(client.id)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px', fontSize: '14px' }}>{client.nom}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {client.email || 'No email provided'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <TeleIdBadge
                        teleId={client.tele_id}
                        parsedTeleId={client.parsed_tele_id}
                        conflict={client.tele_id_conflict}
                      />
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {client.productDetails && client.productDetails.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {client.productDetails.map((p, i) => (
                            <ProductBadge key={i} tier={p.tier} setup_type={p.setup_type} is_trial={p.is_trial} />
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                          {client.produits.length > 30 ? client.produits.substring(0, 30) + '...' : client.produits}
                        </div>
                      )}
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                        Renewal: {client.renouvellement || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--primary-accent)', fontSize: '15px' }}>
                        {client.mensuel > 0 ? formatCurrency(client.mensuel) : '—'}
                      </div>
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
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{client.anciennete || '—'}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace' }}>ID: {client.pd_id}</div>
                    </td>
                  </tr>
                ))}
                
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '64px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>No clients found</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Try adjusting your filters or search terms.</div>
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
        onSaved={(id) => loadClients(id)}
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
