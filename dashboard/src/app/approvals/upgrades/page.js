"use client";

import { useEffect, useState } from 'react';
import ApprovalsTabs from '@/components/ApprovalsTabs';

const STATUS_COLORS = {
  'PENDING_PAYMENT': { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' },
  'PAYMENT_APPROVED': { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  'COMPLETED': { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  'REJECTED': { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

export default function UpgradeApprovalsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/upgrade-requests');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id, currentStatus) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/upgrade-requests/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setRequests(requests.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.id) return;
    setProcessing(rejectModal.id);
    try {
      const res = await fetch(`/api/upgrade-requests/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reject_reason: rejectModal.reason })
      });
      if (res.ok) {
        setRequests(requests.filter(r => r.id !== rejectModal.id));
        setRejectModal({ open: false, id: null, reason: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const pending = requests.filter(r => r.status === 'PENDING_PAYMENT' || r.status === 'PAYMENT_APPROVED');
  const history = requests.filter(r => r.status === 'COMPLETED' || r.status === 'REJECTED');

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Upgrade Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Review and approve client upgrade requests.
      </p>

      <ApprovalsTabs />

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
                <p style={{ color: 'var(--text-secondary)' }}>No pending upgrade requests.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pending.map(r => (
                  <UpgradeRequestCard
                    key={r.id}
                    request={r}
                    onApprove={() => handleApprove(r.id, r.status)}
                    onReject={() => setRejectModal({ open: true, id: r.id, reason: '' })}
                    processing={processing === r.id}
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
                {history.slice(0, 20).map(r => (
                  <HistoryRow key={r.id} request={r} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: '16px' }}>Reject Upgrade Request</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Tell the client why their upgrade request was rejected. They will be notified.
            </p>
            <textarea
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
              placeholder="Enter rejection reason..."
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
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectModal.reason.trim() || processing}
                style={{
                  padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: '#fff',
                  border: 'none', cursor: rejectModal.reason.trim() && !processing ? 'pointer' : 'not-allowed',
                  opacity: rejectModal.reason.trim() && !processing ? 1 : 0.5
                }}
              >
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UpgradeRequestCard({ request, onApprove, onReject, processing }) {
  const statusColors = STATUS_COLORS[request.status] || { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' };
  const isPaymentApproved = request.status === 'PAYMENT_APPROVED';

  const getUpgradeLabel = () => {
    if (request.component_type === 'tier') {
      return `${request.from_tier || '?'} → ${request.to_tier || '?'}`;
    } else if (request.component_type === 'setup') {
      return `${request.from_setup || '?'} → ${request.to_setup || '?'}`;
    }
    return 'Unknown';
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Left: Client Info */}
        <div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</span>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{request.client_name || 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product</span>
            <div style={{ fontSize: '14px' }}>{request.renewal_sr_no || 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current</span>
            <div style={{ fontSize: '14px' }}>
              {request.component_type === 'tier' ? request.current_tier : request.current_setup || 'N/A'}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
            <div style={{ marginTop: '4px' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                backgroundColor: statusColors.bg,
                color: statusColors.color,
              }}>
                {request.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Upgrade Details */}
        <div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upgrade</span>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-accent)' }}>
              {request.component_type === 'tier' ? 'Tier' : 'Setup'}: {getUpgradeLabel()}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Due</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>
              ${request.prorata_amount || '0'}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requested At</span>
            <div style={{ fontSize: '14px' }}>
              {request.created_at ? new Date(request.created_at).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={onReject}
          disabled={processing}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            background: 'transparent',
            color: '#ef4444',
            border: '1px solid #ef4444',
            fontWeight: '600',
            fontSize: '14px',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1,
          }}
        >
          ✕ Reject
        </button>
        <button
          onClick={onApprove}
          disabled={processing}
          style={{
            flex: 1,
            padding: '10px 20px',
            borderRadius: '8px',
            background: isPaymentApproved ? '#22c55e' : '#60a5fa',
            color: '#fff',
            border: 'none',
            fontWeight: '600',
            fontSize: '14px',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1,
          }}
        >
          {processing ? 'Processing...' : isPaymentApproved ? '✓ Complete Upgrade' : '✓ Approve Payment'}
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ request }) {
  const statusColors = STATUS_COLORS[request.status] || { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' };

  const getUpgradeLabel = () => {
    if (request.component_type === 'tier') {
      return `${request.from_tier || '?'} → ${request.to_tier || '?'}`;
    } else if (request.component_type === 'setup') {
      return `${request.from_setup || '?'} → ${request.to_setup || '?'}`;
    }
    return 'Unknown';
  };

  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: statusColors.bg,
          color: statusColors.color,
        }}>
          {request.status.replace(/_/g, ' ')}
        </span>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>{request.client_name}</span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {request.component_type === 'tier' ? 'Tier' : 'Setup'}: {getUpgradeLabel()}
        </span>
        <span style={{ fontSize: '13px', color: '#ef4444' }}>${request.prorata_amount}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : new Date(request.created_at).toLocaleDateString()}
        {request.reject_reason && <span style={{ color: '#ef4444', marginLeft: '8px' }}>— {request.reject_reason}</span>}
      </div>
    </div>
  );
}
