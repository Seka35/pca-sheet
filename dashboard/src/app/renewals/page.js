"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';
import ProductBadge from '@/components/ProductBadge';
import TelegramBadge from '@/components/TelegramBadge';
import TeleIdBadge from '@/components/TeleIdBadge';

export default function RenewalsPage() {
  const [data, setData] = useState({ late: [], today: [], thisWeek: [], thisMonth: [], allActive: [] });
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

  const RenewalTable = ({ title, list, color = 'var(--text-primary)', borderColor = 'var(--border-color)' }) => (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color }}>{title}</h2>
        <span style={{ backgroundColor: 'var(--bg-card)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold', border: `1px solid ${borderColor}` }}>
          {list.length} clients
        </span>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${borderColor}` }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Name</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Tele ID</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Products</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Amount Due</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Due Date</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Due</th>
              <th style={{ padding: '16px 24px', fontWeight: '500' }}>Telegram</th>
              <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(row => (
              <tr 
                key={row.sr_no} 
                onClick={() => openClientModal(row.client_id)}
                style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '16px 24px', fontWeight: '500' }}>{row.client_name}</td>
                <td style={{ padding: '16px 24px' }}>
                  <TeleIdBadge
                    teleId={row.tele_id}
                    parsedTeleId={row.parsed_tele_id}
                    conflict={row.tele_id_conflict}
                  />
                </td>
                <td style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Array.isArray(row.products) && row.products.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).map((p, i) => (
                    <ProductBadge key={i} tier={p.tier} setup_type={p.setup_type} />
                  ))}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--border-color)' }}>{row.bank_name || 'N/A'}</span>
                </td>
                <td style={{ padding: '16px 24px', fontWeight: '600' }}>
                  {row.total_due > 0 ? formatCurrency(row.total_due) : '—'}
                  {row.total_products > 1 && <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '8px' }}>({row.total_products} items)</span>}
                </td>
                <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{row.valid_stopped_date || row.start_date || '—'}</td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{
                    fontWeight: '700',
                    color: row.diff_days < 0 ? '#ef4444' : row.diff_days === 0 ? '#FBBF24' : 'var(--primary-accent)'
                  }}>
                    {row.diff_days > 0 ? `+${row.diff_days}j` : row.diff_days < 0 ? `${row.diff_days}j` : 'Today'}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <TelegramBadge chatId={row.telegram_chat_id} title={row.telegram_chats?.[0]?.chat_title} />
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                   <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--status-active-bg)', color: 'var(--primary-accent)', fontSize: '12px', border: '1px solid var(--primary-accent)', fontWeight: '500' }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span>Mark Paid</span>
                   </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No items in this category.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Renewals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* Cards */}
      <div className="grid-metrics" style={{ marginBottom: '32px' }}>
        
        {/* LATE */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Late / Overdue</h3>
            </div>
            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '700' }}>
              {data.late.length}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#F87171', marginTop: '16px' }}>
            {formatCurrency(data.late.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>

        {/* TODAY */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</h3>
            </div>
            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '700' }}>
              {data.today.length}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#FBBF24', marginTop: '16px' }}>
            {formatCurrency(data.today.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>

        {/* THIS MONTH */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(52, 211, 153, 0.08)', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month</h3>
            </div>
            <span style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)', color: 'var(--primary-accent)', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '700' }}>
              {data.thisMonth?.length || 0}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--primary-accent)', marginTop: '16px' }}>
            {formatCurrency(data.thisMonth?.reduce((acc, row) => acc + (row.total_due || 0), 0) || 0)}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading renewals...</div>
      ) : (
        <>
          {data.late.length > 0 && <RenewalTable title="Late / Overdue" list={data.late} color="#F87171" borderColor="rgba(239, 68, 68, 0.2)" />}
          {data.today.length > 0 && <RenewalTable title="Today" list={data.today} color="#FBBF24" borderColor="rgba(245, 158, 11, 0.2)" />}
          <RenewalTable title="This Week" list={data.thisWeek} borderColor="rgba(0, 242, 181, 0.2)" />
          <RenewalTable title="This Month" list={data.thisMonth} />
        </>
      )}
      
      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
}
