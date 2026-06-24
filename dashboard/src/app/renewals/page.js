"use client";

import { useEffect, useState } from 'react';
import ClientModal from '@/components/ClientModal';
import ProductBadge from '@/components/ProductBadge';
import TelegramBadge from '@/components/TelegramBadge';
import TeleIdBadge from '@/components/TeleIdBadge';

const ITEMS_PER_PAGE = 5;

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${formatDate(d)} ${formatTime(d)}`;
}

export default function RenewalsPage() {
  const [data, setData] = useState({ late: [], today: [], thisWeek: [], thisMonth: [], upcoming: [], allActive: [] });
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedMessageLog, setSelectedMessageLog] = useState(null);

  // Telegram messages state
  const [telegramLogs, setTelegramLogs] = useState([]);
  const [telegramLogsPage, setTelegramLogsPage] = useState(1);
  const [telegramLogsTotalPages, setTelegramLogsTotalPages] = useState(1);
  const [telegramLogsLoading, setTelegramLogsLoading] = useState(false);

  // Pending Telegram message approvals state
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });

  // Pagination states for each category
  const [latePage, setLatePage] = useState(1);
  const [todayPage, setTodayPage] = useState(1);
  const [thisWeekPage, setThisWeekPage] = useState(1);
  const [thisMonthPage, setThisMonthPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  useEffect(() => {
    fetch('/api/renewals')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchTelegramLogs(1);
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch('/api/message-approvals?status=PENDING');
      const data = await res.json();
      setPendingApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveTelegram = async (id) => {
    try {
      const res = await fetch(`/api/message-approvals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchPendingApprovals();
        fetchTelegramLogs(telegramLogsPage);
      } else {
        const err = await res.json();
        alert('Failed to approve: ' + (err.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectTelegram = async () => {
    if (!rejectModal.id) return;
    try {
      const res = await fetch(`/api/message-approvals/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reject_reason: rejectModal.reason })
      });
      if (res.ok) {
        setPendingApprovals(pendingApprovals.filter(a => a.id !== rejectModal.id));
        setRejectModal({ open: false, id: null, reason: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTelegramLogs = (page) => {
    setTelegramLogsLoading(true);
    fetch(`/api/reminder-logs?page=${page}&limit=${ITEMS_PER_PAGE}`)
      .then(res => res.json())
      .then(d => {
        setTelegramLogs(d.logs || []);
        setTelegramLogsTotalPages(d.pagination?.totalPages || 1);
        setTelegramLogsLoading(false);
      });
  };

  const openClientModal = async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}`);
    const clientData = await res.json();
    setSelectedClient(clientData);
  };

  const MessageLogModal = ({ log, onClose }) => {
    if (!log) return null;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>📱 Telegram Message</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {log.id}</span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</span>
              <p style={{ fontWeight: '600', marginTop: '4px' }}>{log.client_name || 'Unknown'}</p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
              <p style={{ fontWeight: '600', marginTop: '4px', color: log.status === 'sent' ? 'var(--primary-accent)' : '#ef4444' }}>
                {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tele ID / Chat</span>
              <p style={{ fontWeight: '500', marginTop: '4px', fontSize: '13px' }}>{log.chat_id || 'N/A'}</p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Group Name</span>
              <p style={{ fontWeight: '500', marginTop: '4px', fontSize: '13px' }}>{log.chat_title || 'Group'}</p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reminder Type</span>
              <p style={{ marginTop: '4px' }}>
                <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60A5FA', fontSize: '11px' }}>{log.reminder_type || '—'}</span>
              </p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sent At</span>
              <p style={{ fontWeight: '600', marginTop: '4px', fontSize: '13px' }}>{formatDateTime(log.sent_at)}</p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message</span>
            <div style={{
              marginTop: '8px',
              padding: '16px',
              backgroundColor: 'var(--bg-card-hover)',
              borderRadius: '8px',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {log.message || '—'}
            </div>
          </div>

          {log.error && (
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Error</span>
              <div style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#ef4444'
              }}>
                {log.error}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const uniqueClients = (list) => new Set(list.map(r => r.client_id)).size;

  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: currentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Page {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: currentPage >= totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          Next →
        </button>
      </div>
    );
  };

  const RenewalTable = ({ title, list, color = 'var(--text-primary)', borderColor = 'var(--border-color)', page, setPage }) => {
    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const paginatedList = list.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color }}>{title}</h2>
          <span style={{ backgroundColor: 'var(--bg-card)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold', border: `1px solid ${borderColor}` }}>
            {uniqueClients(list)} clients
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
                </tr>
              </thead>
              <tbody>
                {paginatedList.map(row => (
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
                        <ProductBadge key={i} tier={p.tier} setup_type={p.setup_type} is_trial={p.is_trial} />
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
                  </tr>
                ))}
                {paginatedList.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No items in this category.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '64px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Renewals & Churn Risk</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid-metrics" style={{ marginBottom: '32px' }}>

        {/* LATE */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overdue</h3>
            </div>
            <span style={{ backgroundColor: '#F87171', color: '#fff', padding: '2px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: '800' }}>
              {uniqueClients(data.late)}
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#F87171', marginTop: '16px' }}>
            {formatCurrency(data.late.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>

        {/* TODAY */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px', border: '1px solid rgba(245, 158, 11, 0.2)', backgroundColor: 'rgba(245, 158, 11, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</h3>
            </div>
            <span style={{ backgroundColor: '#FBBF24', color: '#000', padding: '2px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: '800' }}>
              {uniqueClients(data.today)}
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#FBBF24', marginTop: '16px' }}>
            {formatCurrency(data.today.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>

        {/* THIS WEEK */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week</h3>
            </div>
            <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', padding: '2px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: '800' }}>
              {uniqueClients(data.thisWeek)}
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#60A5FA', marginTop: '16px' }}>
            {formatCurrency(data.thisWeek.reduce((acc, row) => acc + (row.total_due || 0), 0))}
          </div>
        </div>

        {/* THIS MONTH */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(0, 242, 181, 0.1)', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month</h3>
            </div>
            <span style={{ backgroundColor: 'rgba(0, 242, 181, 0.15)', color: 'var(--primary-accent)', padding: '2px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: '800' }}>
              {uniqueClients(data.thisMonth || [])}
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary-accent)', marginTop: '16px' }}>
            {formatCurrency(data.thisMonth?.reduce((acc, row) => acc + (row.total_due || 0), 0) || 0)}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading renewals...</div>
      ) : (
        <>
          {/* Pending Telegram Message Approvals */}
          {pendingApprovals.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#FBBF24' }}>⏳ Pending Approvals</h2>
                <span style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold' }}>
                  {pendingApprovals.length} pending
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingApprovals.map(a => (
                  <PendingApprovalRow
                    key={a.id}
                    approval={a}
                    onApprove={() => handleApproveTelegram(a.id)}
                    onReject={() => setRejectModal({ open: true, id: a.id, reason: '' })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Telegram Messages - Full Width Card */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#9CA3AF' }}>📱 Telegram Messages</h2>
              <span style={{ backgroundColor: 'var(--bg-card)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(156, 163, 175, 0.2)' }}>
                {telegramLogs.length} messages
              </span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(156, 163, 175, 0.2)' }}>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Client</th>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Tele ID</th>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Group</th>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Message</th>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Type</th>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Status</th>
                      <th style={{ padding: '16px 24px', fontWeight: '500' }}>Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telegramLogsLoading ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</td>
                      </tr>
                    ) : telegramLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No messages sent yet</td>
                      </tr>
                    ) : telegramLogs.map(log => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedMessageLog(log)}
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '16px 24px', fontWeight: '500' }}>{log.client_name || 'Unknown'}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className="badge" style={{ backgroundColor: 'var(--border-color)', fontSize: '12px' }}>{log.chat_id || 'N/A'}</span>
                        </td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '13px' }}>{log.chat_title || 'Group'}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message || '—'}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60A5FA', fontSize: '11px' }}>{log.reminder_type || '—'}</span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '500', color: log.status === 'sent' ? 'var(--primary-accent)' : '#ef4444' }}>
                            {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', fontWeight: 'bold', fontSize: '13px' }}>{formatDateTime(log.sent_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {telegramLogsTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => { setTelegramLogsPage(p => Math.max(1, p - 1)); fetchTelegramLogs(telegramLogsPage - 1); }}
                    disabled={telegramLogsPage <= 1}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: telegramLogsPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: telegramLogsPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Page {telegramLogsPage} / {telegramLogsTotalPages}
                  </span>
                  <button
                    onClick={() => { setTelegramLogsPage(p => Math.min(telegramLogsTotalPages, p + 1)); fetchTelegramLogs(telegramLogsPage + 1); }}
                    disabled={telegramLogsPage >= telegramLogsTotalPages}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: telegramLogsPage >= telegramLogsTotalPages ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: telegramLogsPage >= telegramLogsTotalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>

          {data.late.length > 0 && <RenewalTable title="Late / Overdue" list={data.late} color="#F87171" borderColor="rgba(239, 68, 68, 0.2)" page={latePage} setPage={setLatePage} />}
          {data.today.length > 0 && <RenewalTable title="Today" list={data.today} color="#FBBF24" borderColor="rgba(245, 158, 11, 0.2)" page={todayPage} setPage={setTodayPage} />}
          <RenewalTable title="This Week" list={data.thisWeek} color="#60A5FA" borderColor="rgba(59, 130, 246, 0.2)" page={thisWeekPage} setPage={setThisWeekPage} />
          <RenewalTable title="This Month" list={data.thisMonth} color="var(--primary-accent)" borderColor="rgba(0, 242, 181, 0.2)" page={thisMonthPage} setPage={setThisMonthPage} />
          {data.upcoming && data.upcoming.length > 0 && <RenewalTable title="Upcoming (7+ days)" list={data.upcoming} color="#A78BFA" borderColor="rgba(139, 92, 246, 0.2)" page={upcomingPage} setPage={setUpcomingPage} />}
        </>
      )}

      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
      <MessageLogModal log={selectedMessageLog} onClose={() => setSelectedMessageLog(null)} />

      {/* Reject Modal for Pending Telegram Approvals */}
      {rejectModal.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: '16px' }}>Reject Message</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              This message will not be sent to the Telegram group.
            </p>
            <textarea
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
              placeholder="Enter rejection reason (optional)..."
              rows={4}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px',
                resize: 'vertical', marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRejectModal({ open: false, id: null, reason: '' })}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectTelegram}
                style={{
                  padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: '600'
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingApprovalRow({ approval, onApprove, onReject }) {
  const typeColors = {
    'T-7': { bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' },
    'T-2': { bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' },
    'T0':  { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171' },
    'T+1': { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171' },
  };
  const typeStyle = typeColors[approval.reminder_type] || { bg: 'var(--border-color)', color: 'var(--text-secondary)' };

  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{approval.client_name || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tele ID</span>
          <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{approval.tele_id || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '80px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</span>
          <span style={{
            backgroundColor: typeStyle.bg, color: typeStyle.color,
            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', display: 'inline-block', width: 'fit-content'
          }}>
            {approval.reminder_type}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message</span>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={approval.message}>
            <span dangerouslySetInnerHTML={{ __html: approval.message }} />
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {approval.created_at ? new Date(approval.created_at).toLocaleString() : '—'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
        <button
          onClick={onReject}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary-accent)', color: '#0B111A', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}