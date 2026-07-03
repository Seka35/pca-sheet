"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';
import InvoiceTab from '@/components/InvoiceTab';
import ProductBadge from '@/components/ProductBadge';
import { WHOP_REFERRAL_PARTNERS, WHOP_TIER_LINKS, WHOP_DISCOUNT_BY_PARTNER, WHOP_SETUP_LINKS } from '@/lib/whopLinks';
import WhopProductsSection from '@/components/WhopProductsSection';

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
  const [productFilter, setProductFilter] = useState('All Products');
  const [selectedClient, setSelectedClient] = useState(null);
  const [activeTab, setActiveTab] = useState('payments'); // 'payments', 'banks', or 'invoice'
  const [banks, setBanks] = useState([]);
  const [editingBank, setEditingBank] = useState(null);
  const [bankFormData, setBankFormData] = useState({});
  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const paymentsLimit = 20;

  useEffect(() => {
    fetch('/api/payments')
      .then(res => res.json())
      .then(data => {
        setPayments(data.payments || []);
        setPaymentsTotal(data.payments?.length || 0);
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

  useEffect(() => {
    if (activeTab === 'banks') {
      fetch('/api/banks')
        .then(res => res.json())
        .then(data => setBanks(data))
        .catch(err => console.error("Error fetching banks:", err));
    }
  }, [activeTab]);

  const startEditBank = (bank) => {
    setEditingBank(bank.bank_key);
    setBankFormData({ ...bank.data });
  };

  const cancelEditBank = () => {
    setEditingBank(null);
    setBankFormData({});
  };

  const saveBank = async (bank_key) => {
    try {
      const res = await fetch('/api/banks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_key, data: bankFormData })
      });
      if (res.ok) {
        setBanks(prev => prev.map(b => b.bank_key === bank_key ? { ...b, data: { ...bankFormData }, updated_at: new Date().toISOString() } : b));
        setEditingBank(null);
        setBankFormData({});
      }
    } catch (err) {
      console.error("Error saving bank:", err);
    }
  };

  const updateBankField = (field, value) => {
    setBankFormData(prev => ({ ...prev, [field]: value }));
  };

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

  const downloadInvoice = (paymentRow) => {
    // For topups, don't pass sr_no so invoice uses passed params directly (not DB data)
    const isTopup = paymentRow.is_topup === 1 || paymentRow.is_topup === true;
    const params = new URLSearchParams({
      sr_no: isTopup ? '' : (paymentRow.sr_no || paymentRow.period || 'N/A'),
      client_id: paymentRow.client_id || '',
      client_name: paymentRow.client_name || '',
      bank_name: paymentRow.channel || 'crypto',
      product_name: isTopup ? 'Top-Up' : ([paymentRow.tier, paymentRow.setup_type].filter(Boolean).join(' + ') || 'Service'),
      subtotal: paymentRow.amount || 0,
      discount: 0,
      invoice_date: paymentRow.date || new Date().toISOString().split('T')[0],
      invoice_no: paymentRow.sr_no ? paymentRow.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001'
    });
    window.open('/api/invoice/generate?' + params.toString(), '_blank');
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (p.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (p.period || '').toLowerCase().includes(search.toLowerCase()) ||
                          (p.link || '').toLowerCase().includes(search.toLowerCase());
    const matchesChannel = channelFilter === 'All Channels' || p.channel === channelFilter;
    const matchesProduct = productFilter === 'All Products' ||
                          (p.tier && p.tier === productFilter) ||
                          (p.setup_type && p.setup_type === productFilter);
    return matchesSearch && matchesChannel && matchesProduct;
  });

  const paginatedPayments = filteredPayments.slice(paymentsOffset, paymentsOffset + paymentsLimit);
  const totalFiltered = filteredPayments.length;

  const uniqueChannels = ['All Channels', ...new Set(payments.map(p => p.channel).filter(Boolean))];
  const uniqueProducts = ['All Products', ...new Set(payments.map(p => p.tier).filter(Boolean)), ...new Set(payments.map(p => p.setup_type).filter(Boolean))].filter(Boolean);

  return (
    <div style={{ paddingBottom: '64px' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Financial Overview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
            {activeTab === 'payments' ? `Showing ${paginatedPayments.length > 0 ? paymentsOffset + 1 : 0}–${paymentsOffset + paginatedPayments.length} of ${totalFiltered} payment records` : activeTab === 'banks' ? 'Configure and share your payment methods' : 'Customize your invoice generation settings'}
          </p>
        </div>
        
        {/* Tab Navigation (Pill Style) */}
        <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          {[
            { id: 'payments', label: 'Payments' },
            { id: 'banks', label: 'Bank Details' },
            { id: 'invoice', label: 'Invoices' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: activeTab === tab.id ? 'var(--primary-accent)' : 'transparent',
                color: activeTab === tab.id ? '#000' : 'var(--text-secondary)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'payments' && (
        <>
          {/* Key Metrics Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {/* Total Revenue Card */}
            <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '64px', opacity: 0.05, transform: 'rotate(-15deg)' }}>💰</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Total Revenue</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary-accent)' }}>{formatCurrency(summary.totalCollected)}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#10B981', fontWeight: '700' }}>↑ 12%</span> vs last month
              </div>
            </div>

            {/* Collected by Channel Summary */}
            <div className="card" style={{ padding: '24px', gridColumn: 'span 2' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Revenue by Channel</div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {Object.entries(summary.collectedByChannel || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([channel, amount]) => (
                  <div key={channel} style={{ flex: 1, minWidth: '140px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ marginBottom: '8px' }}>{getChannelBadge(channel)}</div>
                    <div style={{ fontSize: '18px', fontWeight: '800' }}>{formatCurrency(amount)}</div>
                    <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${(amount / summary.totalCollected * 100).toFixed(0)}%`, height: '100%', backgroundColor: 'var(--primary-accent)' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues Card */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Financial Health</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Failed Payments</span>
                  <span style={{ color: '#EF4444', fontWeight: '800', fontSize: '18px' }}>{summary.failedPaymentsCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Refunds</span>
                  <span style={{ color: '#A855F7', fontWeight: '800', fontSize: '18px' }}>{formatCurrency(summary.totalRefunds)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="Search transactions by client or reference..."
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
            
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px',
                padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '180px',
                fontSize: '14px'
              }}
            >
              {uniqueChannels.map((ch, idx) => (
                <option key={idx} value={ch} style={{ color: '#000' }}>{ch === 'All Channels' ? 'All Channels' : ch}</option>
              ))}
            </select>

            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px',
                padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '180px',
                fontSize: '14px'
              }}
            >
              {uniqueProducts.map((prod, idx) => (
                <option key={idx} value={prod} style={{ color: '#000' }}>{prod === 'All Products' ? 'All Products' : prod}</option>
              ))}
            </select>
          </div>

          {/* Transactions Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            {loading ? (
              <div style={{ padding: '64px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--status-active-bg)', borderTopColor: 'var(--status-active)', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Retrieving transactions...</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Date / Period</th>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Client & Product</th>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Amount</th>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Payment Method</th>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Status</th>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'center' }}>Invoice</th>
                      <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.map((row) => (
                      <tr
                        key={row.id || row.sr_no}
                        onClick={() => openClientModal(row.client_id)}
                        style={{ borderBottom: '1px solid var(--border-color)', transition: 'all 0.2s', cursor: 'pointer' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{row.date || '—'}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{row.period || '—'}</div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{row.client_name}</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <ProductBadge tier={row.tier} setup_type={row.setup_type} is_trial={row.is_trial} />
                            {row.is_topup === 1 && (
                              <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>TOP-UP</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: '800', color: row.amount > 0 ? 'var(--primary-accent)' : '#F87171', fontSize: '15px' }}>
                            {formatCurrency(row.amount)}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>{getChannelBadge(row.channel)}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className="badge" style={{ 
                            backgroundColor: row.status === 'Paid' ? 'rgba(0, 242, 181, 0.1)' : 'rgba(255, 77, 77, 0.1)', 
                            color: row.status === 'Paid' ? 'var(--primary-accent)' : '#FF4D4D',
                            fontWeight: '700',
                            fontSize: '10px'
                          }}>
                            {row.status?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadInvoice(row); }}
                            style={{
                              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--primary-accent)',
                              backgroundColor: 'rgba(0, 242, 181, 0.05)', color: 'var(--primary-accent)',
                              fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-accent)'; e.currentTarget.style.color = '#000'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 242, 181, 0.05)'; e.currentTarget.style.color = 'var(--primary-accent)'; }}
                          >
                            PDF
                          </button>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace', opacity: 0.8 }}>{row.link || '—'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalFiltered > paymentsLimit && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Page {Math.floor(paymentsOffset / paymentsLimit) + 1} of {Math.ceil(totalFiltered / paymentsLimit)}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setPaymentsOffset(o => Math.max(0, o - paymentsLimit))}
                        disabled={paymentsOffset === 0}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: paymentsOffset === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                          color: paymentsOffset === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: paymentsOffset === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={() => setPaymentsOffset(o => o + paymentsLimit)}
                        disabled={paymentsOffset + paymentsLimit >= totalFiltered}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: paymentsOffset + paymentsLimit >= totalFiltered ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                          color: paymentsOffset + paymentsLimit >= totalFiltered ? 'var(--text-secondary)' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: paymentsOffset + paymentsLimit >= totalFiltered ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'banks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Crypto, LHV, Slash - grid side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          {banks.filter(b => b.bank_key !== 'whop').map((bank) => {
            const bankColors = {
              crypto: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', icon: '₿' },
              lhv: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', icon: '🏦' },
              slash: { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', icon: '⚡' },
              whop: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', icon: '🎫' }
            };
            const colors = bankColors[bank.bank_key] || { bg: 'rgba(255,255,255,0.05)', border: 'var(--border-color)', icon: '📦' };

            return (
              <div key={bank.bank_key} className="card" style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                padding: 0
              }}>
                {/* Header */}
                <div style={{
                  backgroundColor: colors.bg,
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                      {colors.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{bank.bank_name}</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Payment Method</div>
                    </div>
                  </div>
                  {editingBank === bank.bank_key ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={cancelEditBank} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>Cancel</button>
                      <button onClick={() => saveBank(bank.bank_key)} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(52, 211, 153, 0.2)' }}>Save</button>
                    </div>
                  ) : bank.bank_key !== 'whop' && (
                    <button onClick={() => startEditBank(bank)} style={{ padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>Edit</button>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                  {bank.bank_key === 'crypto' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {[
                        { label: 'USDT - TRC20', field: 'usdt_trc20', crypto: 'USDT' },
                        { label: 'USDT - ERC20', field: 'usdt_erc20', crypto: 'USDT' },
                        { label: 'BTC', field: 'btc', crypto: 'BTC' }
                      ].map(({ label, field, crypto }) => (
                        <div key={field} style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                          {editingBank === 'crypto' ? (
                            <input type="text" value={bankFormData[field] || ''} onChange={(e) => updateBankField(field, e.target.value)} style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'monospace' }} />
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, fontWeight: '600' }}>{bank.data[field] || '—'}</div>
                              {bank.data[field] && (
                                <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(bank.data[field])}`} alt="QR" style={{ width: '64px', height: '64px', borderRadius: '8px' }} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ fontSize: '12px', color: '#F87171', marginBottom: '4px', fontWeight: '500' }}>⚠️ Transaction Fee</div>
                        {editingBank === 'crypto' ? (
                          <input type="text" value={bankFormData.fee_note || ''} onChange={(e) => updateBankField('fee_note', e.target.value)} style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '12px' }} />
                        ) : (
                          <div style={{ fontSize: '12px', color: '#F87171' }}>{bank.data.fee_note || '—'}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {bank.bank_key === 'lhv' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {[
                        { label: 'Account Title', field: 'account_title', span: true },
                        { label: 'Country', field: 'bank_country' },
                        { label: 'Account Type', field: 'account_type' },
                        { label: 'BIC / Swift', field: 'bic_swift', span: true },
                        { label: 'IBAN', field: 'iban', span: true, mono: true },
                        { label: 'Address', field: 'bank_address', span: true }
                      ].map(({ label, field, span, mono }) => (
                        <div key={field} style={{ gridColumn: span ? '1 / -1' : undefined, backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '14px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                          {editingBank === 'lhv' ? (
                            <input type="text" value={bankFormData[field] || ''} onChange={(e) => updateBankField(field, e.target.value)} style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: mono ? 'monospace' : 'inherit' }} />
                          ) : (
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word', fontFamily: mono ? 'monospace' : 'inherit' }}>{bank.data[field] || '—'}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {bank.bank_key === 'slash' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {[
                        { label: 'Account Name', field: 'account_name', span: true },
                        { label: 'Account Number', field: 'account_number', mono: true },
                        { label: 'Routing', field: 'routing', mono: true },
                        { label: 'Swift / BIC', field: 'swift_bic', mono: true },
                        { label: 'Address', field: 'address_entity', span: true }
                      ].map(({ label, field, span, mono }) => (
                        <div key={field} style={{ gridColumn: span ? '1 / -1' : undefined, backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '14px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                          {editingBank === 'slash' ? (
                            <input type="text" value={bankFormData[field] || ''} onChange={(e) => updateBankField(field, e.target.value)} style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: mono ? 'monospace' : 'inherit' }} />
                          ) : (
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word', fontFamily: mono ? 'monospace' : 'inherit' }}>{bank.data[field] || '—'}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {bank.bank_key === 'whop' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Info Banner */}
                      <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '13px', color: '#10B981', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>💡</span> WHOP Payment Links by Referral Partner
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Links are organized by referral partner. Each partner has different pricing tiers and discounts. These links are used automatically for invoices and Telegram reminders.</div>
                      </div>

                      {/* Partner Grid - 5 columns for partners */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        {[
                          { partner: 'N.A.', discount: '0%', color: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.3)' },
                          { partner: 'Chris', discount: '0%', color: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.3)' },
                          { partner: 'No Limit', discount: '-15%', color: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)' },
                          { partner: '8 Labs', discount: '-15%', color: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                          { partner: 'Master', discount: '-15%', color: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                        ].map(({ partner, discount, color, borderColor }) => {
                          const partnerLinks = WHOP_TIER_LINKS[partner] || {};
                          return (
                            <div key={partner} style={{ backgroundColor: color, borderRadius: '12px', border: `1px solid ${borderColor}`, padding: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{partner}</span>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: discount === '0%' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: discount === '0%' ? '#A78BFA' : '#34D399', fontWeight: '700' }}>{discount}</span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Full Tiers</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                                {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                  <div key={tierKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{tierKey.replace('tier', 'Tier ')}</span>
                                    {partnerLinks[tierKey] ? (
                                      <button onClick={() => { navigator.clipboard.writeText(partnerLinks[tierKey]); alert('Copied!'); }} style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>7 Days Free</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                                {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                  <div key={`${tierKey}_7d`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{tierKey.replace('tier', 'Tier ')}</span>
                                    {partnerLinks[`${tierKey}_7d_free`] ? (
                                      <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_7d_free`]); alert('Copied!'); }} style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {discount === '-15%' && (
                                <>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>50% Off</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {['tier1', 'tier2', 'tier3', 'tier4', 'tier5'].map((tierKey) => (
                                      <div key={`${tierKey}_50`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{tierKey.replace('tier', 'Tier ')}</span>
                                        {partnerLinks[`${tierKey}_50_off`] ? (
                                          <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_50_off`]); alert('Copied!'); }} style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                                        ) : (
                                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Setup Links & Other Products */}
                      <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Setup Fees</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          {[
                            { label: 'OLD Setup', link: WHOP_SETUP_LINKS.oldSetup },
                            { label: 'Starter', link: WHOP_SETUP_LINKS.newClient.starter },
                            { label: 'Premium', link: WHOP_SETUP_LINKS.newClient.premium },
                            { label: 'VIP', link: WHOP_SETUP_LINKS.newClient.vip }
                          ].map(({ label, link }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</span>
                              {link ? (
                                <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '12px', marginTop: '12px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Other Products</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            {[
                              { label: 'Only Profile', link: WHOP_SETUP_LINKS.otherProducts.onlyProfile },
                              { label: 'Only Page', link: WHOP_SETUP_LINKS.otherProducts.onlyPage },
                              { label: 'Extra BM', link: WHOP_SETUP_LINKS.otherProducts.extraBM }
                            ].map(({ label, link }) => (
                              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', padding: '8px' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
                                {link && (
                                  <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '8px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Last updated: {bank.updated_at ? new Date(bank.updated_at).toLocaleString() : 'Never'}</span>
                    {bank.data.usdt_trc20 && (
                      <button onClick={() => navigator.clipboard.writeText(bank.data.usdt_trc20)} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '11px', border: 'none', cursor: 'pointer' }}>Copy USDT TRC20</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* WHOP Bank - Full Width */}
          {banks.filter(b => b.bank_key === 'whop').map((bank) => {
            const colors = { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', icon: '🎫' };
            return (
              <div key={bank.bank_key} style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                width: '100%'
              }}>
                {/* Header */}
                <div style={{
                  backgroundColor: colors.bg,
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                      {colors.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{bank.bank_name}</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Payment Method</div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Info Banner */}
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '13px', color: '#10B981', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💡</span> WHOP Payment Links by Referral Partner
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Links are organized by referral partner. Each partner has different pricing tiers and discounts. These links are used automatically for invoices and Telegram reminders.</div>
                    </div>

                    {/* Partner Grid - 5 columns for partners */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      {[
                        { partner: 'N.A.', discount: '0%', color: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.3)' },
                        { partner: 'Chris', discount: '0%', color: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.3)' },
                        { partner: 'No Limit', discount: '-15%', color: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)' },
                        { partner: '8 Labs', discount: '-15%', color: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                        { partner: 'Master', discount: '-15%', color: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                      ].map(({ partner, discount, color, borderColor }) => {
                        const partnerLinks = WHOP_TIER_LINKS[partner] || {};
                        return (
                          <div key={partner} style={{ backgroundColor: color, borderRadius: '12px', border: `1px solid ${borderColor}`, padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{partner}</span>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: discount === '0%' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: discount === '0%' ? '#A78BFA' : '#34D399', fontWeight: '700' }}>{discount}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Full Tiers</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                              {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                <div key={tierKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{tierKey.replace('tier', 'Tier ')}</span>
                                  {partnerLinks[tierKey] ? (
                                    <button onClick={() => { navigator.clipboard.writeText(partnerLinks[tierKey]); alert('Copied!'); }} style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>7 Days Free</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                              {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                <div key={`${tierKey}_7d`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{tierKey.replace('tier', 'Tier ')}</span>
                                  {partnerLinks[`${tierKey}_7d_free`] ? (
                                    <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_7d_free`]); alert('Copied!'); }} style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {discount === '-15%' && (
                              <>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>50% Off</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {['tier1', 'tier2', 'tier3', 'tier4', 'tier5'].map((tierKey) => (
                                    <div key={`${tierKey}_50`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '6px', padding: '6px 10px', border: '1px solid var(--border-color)' }}>
                                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{tierKey.replace('tier', 'Tier ')}</span>
                                      {partnerLinks[`${tierKey}_50_off`] ? (
                                        <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_50_off`]); alert('Copied!'); }} style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Setup Links & Other Products */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Setup Fees</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          {[
                            { label: 'OLD Setup', link: WHOP_SETUP_LINKS.oldSetup },
                            { label: 'Starter', link: WHOP_SETUP_LINKS.newClient.starter },
                            { label: 'Premium', link: WHOP_SETUP_LINKS.newClient.premium },
                            { label: 'VIP', link: WHOP_SETUP_LINKS.newClient.vip }
                          ].map(({ label, link }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</span>
                              {link ? (
                                <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Other Products</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                          {[
                            { label: 'Only Profile', link: WHOP_SETUP_LINKS.otherProducts.onlyProfile },
                            { label: 'Only Page', link: WHOP_SETUP_LINKS.otherProducts.onlyPage },
                            { label: 'Extra BM', link: WHOP_SETUP_LINKS.otherProducts.extraBM }
                          ].map(({ label, link }) => (
                            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</span>
                              {link && (
                                <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer', width: '100%', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>Copy</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Upgrade Links */}
                    <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>🔄 Tier Upgrades</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                        {[
                          { from: 'T1', to: ['T2','T3','T4','T5','T6'], key: 't1' },
                          { from: 'T2', to: ['T3','T4','T5','T6'], key: 't2' },
                          { from: 'T3', to: ['T4','T5','T6'], key: 't3' },
                          { from: 'T4', to: ['T5','T6'], key: 't4' },
                          { from: 'T5', to: ['T6'], key: 't5' }
                        ].map(({ from, to }) => (
                          <div key={from} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ fontSize: '9px', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'center' }}>{from} →</div>
                            {to.map((t) => {
                              const upgradeKey = `upgrade_${from.toLowerCase()}_to_${t.toLowerCase()}`;
                              const link = bank.data[upgradeKey];
                              return (
                                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '4px', padding: '4px 6px' }}>
                                  <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{t}</span>
                                  {link ? (
                                    <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '1px 4px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                  ) : (
                                    <span style={{ fontSize: '6px', color: '#666' }}>—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'banks' && <WhopProductsSection />}

      {activeTab === 'invoice' && (
        <div className="card" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>Generate Custom Invoice</h2>
          <InvoiceTab />
        </div>
      )}

      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
}
