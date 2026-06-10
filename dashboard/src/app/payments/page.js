"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';
import InvoiceTab from '@/components/InvoiceTab';
import { WHOP_REFERRAL_PARTNERS, WHOP_TIER_LINKS, WHOP_DISCOUNT_BY_PARTNER, WHOP_SETUP_LINKS } from '@/lib/whopLinks';

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
  const [activeTab, setActiveTab] = useState('payments'); // 'payments', 'banks', or 'invoice'
  const [banks, setBanks] = useState([]);
  const [editingBank, setEditingBank] = useState(null);
  const [bankFormData, setBankFormData] = useState({});

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
    const params = new URLSearchParams({
      sr_no: paymentRow.sr_no || paymentRow.period || 'N/A',
      client_id: paymentRow.client_id || '',
      client_name: paymentRow.client_name || '',
      bank_name: paymentRow.channel || 'crypto',  // channel is the bank_name in payments API
      product_name: paymentRow.tier || 'Service',
      amount: paymentRow.amount || 0,
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
    return matchesSearch && matchesChannel;
  });

  const uniqueChannels = ['All Channels', ...new Set(payments.map(p => p.channel).filter(Boolean))];

  return (
    <div style={{ paddingBottom: '64px' }}>

      {/* Header + Tabs */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Payments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {activeTab === 'payments' ? `${payments.length} total payments` : activeTab === 'banks' ? `${banks.length} payment methods` : 'Invoice configuration'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              backgroundColor: activeTab === 'payments' ? 'var(--primary-accent)' : 'var(--bg-card)',
              color: activeTab === 'payments' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('banks')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              backgroundColor: activeTab === 'banks' ? 'var(--primary-accent)' : 'var(--bg-card)',
              color: activeTab === 'banks' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Bank Details
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              backgroundColor: activeTab === 'invoice' ? 'var(--primary-accent)' : 'var(--bg-card)',
              color: activeTab === 'invoice' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Invoice
          </button>
        </div>
      </div>

      {activeTab === 'payments' && (
        <>
          {/* Metric Cards */}
          <div className="flex-mobile-column" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '32px' }}>
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
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Invoice</th>
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
                        <td style={{ padding: '16px 24px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadInvoice(row); }}
                            style={{
                              padding: '6px 12px', borderRadius: '6px', border: 'none',
                              backgroundColor: 'var(--primary-accent)', color: '#fff',
                              fontSize: '11px', fontWeight: '500', cursor: 'pointer'
                            }}
                          >
                            📥 PDF
                          </button>
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
              <div key={bank.bank_key} style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{
                  backgroundColor: colors.bg,
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>{colors.icon}</span>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>{bank.bank_name}</h3>
                  </div>
                  {editingBank === bank.bank_key ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => saveBank(bank.bank_key)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Save</button>
                      <button onClick={cancelEditBank} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : bank.bank_key !== 'whop' && (
                    <button onClick={() => startEditBank(bank)} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Edit</button>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                  {bank.bank_key === 'crypto' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {[
                        { label: 'USDT - TRC20', field: 'usdt_trc20', crypto: 'USDT' },
                        { label: 'USDT - ERC20', field: 'usdt_erc20', crypto: 'USDT' },
                        { label: 'BTC', field: 'btc', crypto: 'BTC' }
                      ].map(({ label, field, crypto }) => (
                        <div key={field} style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '16px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                          {editingBank === 'crypto' ? (
                            <input type="text" value={bankFormData[field] || ''} onChange={(e) => updateBankField(field, e.target.value)} style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }} />
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{bank.data[field] || '—'}</div>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Info Banner */}
                      <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500', marginBottom: '4px' }}>💡 WHOP Payment Links by Referral Partner</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Links are organized by referral partner. Each partner has different pricing tiers and discounts. These links are used automatically for invoices and Telegram reminders.</div>
                      </div>

                      {/* Partner Grid - 5 columns for partners */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                        {[
                          { partner: 'N.A.', discount: '0%', color: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' },
                          { partner: 'Chris', discount: '0%', color: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
                          { partner: 'No Limit', discount: '-15%', color: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' },
                          { partner: '8 Labs', discount: '-15%', color: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                          { partner: 'Master', discount: '-15%', color: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                        ].map(({ partner, discount, color, borderColor }) => {
                          const partnerLinks = WHOP_TIER_LINKS[partner] || {};
                          return (
                            <div key={partner} style={{ backgroundColor: color, borderRadius: '10px', border: `1px solid ${borderColor}`, padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>{partner}</span>
                                <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '50px', backgroundColor: discount === '0%' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: discount === '0%' ? '#A78BFA' : '#34D399' }}>{discount}</span>
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Full Tiers</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px', marginBottom: '8px' }}>
                                {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                  <div key={tierKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '3px', padding: '3px 5px' }}>
                                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{tierKey.replace('tier', 'T')}</span>
                                    {partnerLinks[tierKey] ? (
                                      <button onClick={() => { navigator.clipboard.writeText(partnerLinks[tierKey]); alert('Copied!'); }} style={{ padding: '1px 3px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                    ) : (
                                      <span style={{ fontSize: '6px', color: '#666' }}>—</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>7 Days Free</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px', marginBottom: '8px' }}>
                                {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                  <div key={`${tierKey}_7d`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '3px', padding: '3px 5px' }}>
                                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{tierKey.replace('tier', 'T')}F</span>
                                    {partnerLinks[`${tierKey}_7d_free`] ? (
                                      <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_7d_free`]); alert('Copied!'); }} style={{ padding: '1px 3px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                    ) : (
                                      <span style={{ fontSize: '6px', color: '#666' }}>—</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {discount === '-15%' && (
                                <>
                                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>50% Off</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px' }}>
                                    {['tier1', 'tier2', 'tier3', 'tier4', 'tier5'].map((tierKey) => (
                                      <div key={`${tierKey}_50`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '3px', padding: '3px 5px' }}>
                                        <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{tierKey.replace('tier', 'T')}H</span>
                                        {partnerLinks[`${tierKey}_50_off`] ? (
                                          <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_50_off`]); alert('Copied!'); }} style={{ padding: '1px 3px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                        ) : (
                                          <span style={{ fontSize: '6px', color: '#666' }}>—</span>
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
                        <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '12px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Setup Price</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {[
                              { label: 'OLD Setup', link: WHOP_SETUP_LINKS.oldSetup },
                              { label: 'Starter', link: WHOP_SETUP_LINKS.newClient.starter },
                              { label: 'Premium', link: WHOP_SETUP_LINKS.newClient.premium },
                              { label: 'VIP', link: WHOP_SETUP_LINKS.newClient.vip }
                            ].map(({ label, link }) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '6px', padding: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
                                {link && (
                                  <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '8px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '12px' }}>
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
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>{colors.icon}</span>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>{bank.bank_name}</h3>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Info Banner */}
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500', marginBottom: '4px' }}>💡 WHOP Payment Links by Referral Partner</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Links are organized by referral partner. Each partner has different pricing tiers and discounts. These links are used automatically for invoices and Telegram reminders.</div>
                    </div>

                    {/* Partner Grid - 5 columns for partners */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                      {[
                        { partner: 'N.A.', discount: '0%', color: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' },
                        { partner: 'Chris', discount: '0%', color: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
                        { partner: 'No Limit', discount: '-15%', color: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' },
                        { partner: '8 Labs', discount: '-15%', color: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                        { partner: 'Master', discount: '-15%', color: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                      ].map(({ partner, discount, color, borderColor }) => {
                        const partnerLinks = WHOP_TIER_LINKS[partner] || {};
                        return (
                          <div key={partner} style={{ backgroundColor: color, borderRadius: '10px', border: `1px solid ${borderColor}`, padding: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>{partner}</span>
                              <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '50px', backgroundColor: discount === '0%' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: discount === '0%' ? '#A78BFA' : '#34D399' }}>{discount}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Full Tiers</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px', marginBottom: '8px' }}>
                              {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                <div key={tierKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '3px', padding: '3px 5px' }}>
                                  <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{tierKey.replace('tier', 'T')}</span>
                                  {partnerLinks[tierKey] ? (
                                    <button onClick={() => { navigator.clipboard.writeText(partnerLinks[tierKey]); alert('Copied!'); }} style={{ padding: '1px 3px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                  ) : (
                                    <span style={{ fontSize: '6px', color: '#666' }}>—</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>7 Days Free</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px', marginBottom: '8px' }}>
                              {['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'].map((tierKey) => (
                                <div key={`${tierKey}_7d`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '3px', padding: '3px 5px' }}>
                                  <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{tierKey.replace('tier', 'T')}F</span>
                                  {partnerLinks[`${tierKey}_7d_free`] ? (
                                    <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_7d_free`]); alert('Copied!'); }} style={{ padding: '1px 3px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                  ) : (
                                    <span style={{ fontSize: '6px', color: '#666' }}>—</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {discount === '-15%' && (
                              <>
                                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>50% Off</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px' }}>
                                  {['tier1', 'tier2', 'tier3', 'tier4', 'tier5'].map((tierKey) => (
                                    <div key={`${tierKey}_50`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '3px', padding: '3px 5px' }}>
                                      <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{tierKey.replace('tier', 'T')}H</span>
                                      {partnerLinks[`${tierKey}_50_off`] ? (
                                        <button onClick={() => { navigator.clipboard.writeText(partnerLinks[`${tierKey}_50_off`]); alert('Copied!'); }} style={{ padding: '1px 3px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '6px', border: 'none', cursor: 'pointer' }}>Copy</button>
                                      ) : (
                                        <span style={{ fontSize: '6px', color: '#666' }}>—</span>
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
                      <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Setup Price</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {[
                            { label: 'OLD Setup', link: WHOP_SETUP_LINKS.oldSetup },
                            { label: 'Starter', link: WHOP_SETUP_LINKS.newClient.starter },
                            { label: 'Premium', link: WHOP_SETUP_LINKS.newClient.premium },
                            { label: 'VIP', link: WHOP_SETUP_LINKS.newClient.vip }
                          ].map(({ label, link }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '6px', padding: '8px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
                              {link && (
                                <button onClick={() => { navigator.clipboard.writeText(link); alert('Copied!'); }} style={{ padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--primary-accent)', color: '#fff', fontSize: '8px', border: 'none', cursor: 'pointer' }}>Copy</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '12px' }}>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'invoice' && (
        <InvoiceTab />
      )}

      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
}
