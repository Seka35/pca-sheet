"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';
import ProductBadge from '@/components/ProductBadge';

export default function RenewalsPage() {
  const [data, setData] = useState({ late: [], today: [], thisWeek: [], allActive: [] });
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  useEffect(() => {
    fetch('/api/renewals')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const openClientModal = async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}`);
    const clientData = await res.json();
    setSelectedClient(clientData);
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Renewals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* Cards */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ flex: 1, backgroundColor: 'var(--bg-main)' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Bot Renewals</h3>
          <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)' }}>Upcoming...</div>
        </div>
        <div className="card" style={{ flex: 1, borderColor: '#7f1d1d', backgroundColor: 'rgba(127, 29, 29, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <span style={{ fontSize: '18px' }}>❌</span> Late / Overdue
            </h3>
            <span style={{ backgroundColor: 'var(--bg-main)', color: '#ef4444', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>
              {data.late.length} clients
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', marginTop: '12px' }}>
            {formatCurrency(data.late.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>
        <div className="card" style={{ flex: 1, borderColor: 'var(--status-cut)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--status-cut)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <span style={{ fontSize: '18px' }}>⚠️</span> Today
            </h3>
            <span style={{ backgroundColor: 'var(--bg-main)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>
              {data.today.length} clients
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--status-cut)', marginTop: '12px' }}>
            {formatCurrency(data.today.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>
      </div>

      {/* LATE / OVERDUE TABLE */}
      {data.late.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>Late / Overdue</h2>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #7f1d1d' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Products</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Amount Due</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Due Date</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.late.map(row => (
                  <tr 
                    key={row.sr_no} 
                    onClick={() => openClientModal(row.client_id)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                  >
                    <td style={{ padding: '16px 24px', color: '#ef4444', fontWeight: '500' }}>{row.client_name}</td>
                    <td style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {row.products && row.products.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).map((p, i) => (
                        <ProductBadge key={i} tier={p.tier} setup_type={p.setup_type} />
                      ))}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--border-color)' }}>{row.bank_name || 'N/A'}</span>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: '#ef4444' }}>
                      {row.total_due > 0 ? formatCurrency(row.total_due) : '—'}
                      {row.total_products > 1 && <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '8px' }}>({row.total_products} items)</span>}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#ef4444', fontWeight: 'bold' }}>{row.valid_stopped_date || row.start_date || '—'}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#ef4444', color: '#fff', fontSize: '12px', border: 'none' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>Mark Paid</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TODAY TABLE */}
      {data.today.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--status-cut)' }}>Today</h2>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--status-cut)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Products</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Amount Due</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Due Date</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.today.map(row => (
                  <tr 
                    key={row.sr_no} 
                    onClick={() => openClientModal(row.client_id)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'rgba(255, 77, 77, 0.05)' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--status-cut-bg)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 77, 77, 0.05)'}
                  >
                    <td style={{ padding: '16px 24px', color: 'var(--status-cut)' }}>{row.client_name}</td>
                    <td style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {row.products && row.products.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).map((p, i) => (
                        <ProductBadge key={i} tier={p.tier} setup_type={p.setup_type} />
                      ))}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--border-color)' }}>{row.bank_name || 'N/A'}</span>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--status-cut)' }}>
                      {row.total_due > 0 ? formatCurrency(row.total_due) : '—'}
                      {row.total_products > 1 && <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '8px' }}>({row.total_products} items)</span>}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--status-cut)', fontWeight: 'bold' }}>{row.valid_stopped_date || row.start_date || '—'}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#FBBF24', color: '#000', fontSize: '12px', border: 'none', fontWeight: '500' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>Mark Paid</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* THIS WEEK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>This Week</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ backgroundColor: 'var(--primary-accent)', color: '#000', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>
            {data.thisWeek.length}
          </span>
          <button className="btn-primary" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            Generate WhatsApp Msg
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Name</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Products</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Amount Due</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Due Date</th>
                <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.thisWeek.map(row => (
                <tr 
                  key={row.sr_no} 
                  onClick={() => openClientModal(row.client_id)}
                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '16px 24px' }}>{row.client_name}</td>
                  <td style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {row.products && row.products.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).map((p, i) => (
                      <ProductBadge key={i} tier={p.tier} setup_type={p.setup_type} />
                    ))}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--border-color)' }}>{row.bank_name || 'N/A'}</span>
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: '600' }}>
                    {row.total_due > 0 ? formatCurrency(row.total_due) : '—'}
                    {row.total_products > 1 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>({row.total_products} items)</span>}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{row.valid_stopped_date || row.start_date || '—'}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--status-active-bg)', color: 'var(--primary-accent)', fontSize: '12px', border: '1px solid var(--primary-accent)', fontWeight: '500' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        <span>Mark Paid</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.thisWeek.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No renewals scheduled this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      
      {/* MODAL */}
      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
}
