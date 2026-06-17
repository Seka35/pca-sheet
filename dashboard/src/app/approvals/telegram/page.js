"use client";

import { useEffect, useState } from 'react';
import ApprovalsTabs from '@/components/ApprovalsTabs';

export default function TelegramApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/message-approvals');
      const data = await res.json();
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`/api/message-approvals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setApprovals(approvals.filter(a => a.id !== id));
      } else {
        const err = await res.json();
        alert('Failed to approve: ' + (err.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.id) return;
    try {
      const res = await fetch(`/api/message-approvals/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reject_reason: rejectModal.reason })
      });
      if (res.ok) {
        setApprovals(approvals.filter(a => a.id !== rejectModal.id));
        setRejectModal({ open: false, id: null, reason: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pending = approvals.filter(a => a.status === 'PENDING');
  const history = approvals.filter(a => a.status !== 'PENDING');

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Telegram Message Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Review Telegram reminder messages before they are sent to clients. Approve to send, or reject to discard.
      </p>

      <ApprovalsTabs telegramCount={pending.length} />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Pending Section */}
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-secondary)' }}>
              Pending Review ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No pending messages to review.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pending.map(a => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    onApprove={() => handleApprove(a.id)}
                    onReject={() => setRejectModal({ open: true, id: a.id, reason: '' })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* History Section */}
          {history.length > 0 && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                History ({history.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.slice(0, 20).map(a => (
                  <HistoryRow key={a.id} approval={a} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: '16px' }}>Reject Message</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              This message will not be sent. Add a reason if needed.
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
                onClick={handleReject}
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

function ApprovalCard({ approval, onApprove, onReject }) {
  const typeColors = {
    'T-7': { bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' },
    'T-2': { bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' },
    'T0':  { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171' },
    'T+1': { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171' },
  };
  const typeStyle = typeColors[approval.reminder_type] || { bg: 'var(--border-color)', color: 'var(--text-secondary)' };

  return (
    <div className="card" style={{ padding: '20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</span>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{approval.client_name || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tele ID</span>
            <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{approval.tele_id || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Group</span>
            <div style={{ fontSize: '14px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={approval.chat_title}>
              {approval.chat_title || approval.chat_id}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</span>
            <div style={{ marginTop: '2px' }}>
              <span style={{
                backgroundColor: typeStyle.bg, color: typeStyle.color,
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
              }}>
                {approval.reminder_type}
              </span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {approval.created_at ? new Date(approval.created_at).toLocaleString() : ''}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message Preview</span>
        <div style={{
          marginTop: '8px', padding: '12px', background: 'var(--bg-main)',
          borderRadius: '8px', border: '1px solid var(--border-color)',
          fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)',
          maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>
          <span dangerouslySetInnerHTML={{ __html: approval.message }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={onReject}
          style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', cursor: 'pointer', fontWeight: '600' }}
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-accent)', color: '#0B111A', border: 'none', cursor: 'pointer', fontWeight: '600' }}
        >
          Approve &amp; Send
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ approval }) {
  const isApproved = approval.status === 'APPROVED';
  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px',
          background: isApproved ? '#22c55e20' : '#ef444420', color: isApproved ? '#22c55e' : '#ef4444'
        }}>
          {approval.status}
        </span>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>{approval.client_name}</span>
        <span style={{
          background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '3px',
          fontSize: '11px', fontWeight: '700',
          color: approval.reminder_type === 'T-7' ? '#38BDF8' :
                 approval.reminder_type === 'T-2' ? '#FBBF24' : '#F87171'
        }}>
          {approval.reminder_type}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{approval.renewal_sr_no}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
        {approval.reviewed_at ? new Date(approval.reviewed_at).toLocaleString() : ''}
        {approval.reject_reason && <div style={{ color: '#ef4444', marginTop: '2px' }}>{approval.reject_reason}</div>}
      </div>
    </div>
  );
}
