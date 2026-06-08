"use client";

import { useEffect, useState } from 'react';

export default function ApprovalQueuePage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/approval-queue');
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
      const res = await fetch(`/api/approval-queue/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setApprovals(approvals.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.id) return;
    try {
      const res = await fetch(`/api/approval-queue/${rejectModal.id}/reject`, {
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
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Payment Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Review client payment submissions and approve or reject them.
      </p>

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
                <p style={{ color: 'var(--text-secondary)' }}>No pending payments to review.</p>
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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: '16px' }}>Reject Payment</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Tell the client why their payment was rejected. They will be notified and can resubmit.
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
                disabled={!rejectModal.reason.trim()}
                style={{
                  padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: '#fff',
                  border: 'none', cursor: rejectModal.reason.trim() ? 'pointer' : 'not-allowed',
                  opacity: rejectModal.reason.trim() ? 1 : 0.5
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
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Left: Client Info */}
        <div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</span>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{approval.client_name || 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tele ID</span>
            <div style={{ fontSize: '14px' }}>{approval.tele_id || 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product / Amount</span>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-accent)' }}>
              {approval.product_type || 'N/A'} — {approval.amount_due || 'N/A'}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Date</span>
            <div style={{ fontSize: '14px' }}>{approval.due_date ? new Date(approval.due_date).toLocaleDateString() : 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bank Used</span>
            <div style={{ fontSize: '14px' }}>{approval.bank_name || 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction ID</span>
            <div style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{approval.transaction_id || 'N/A'}</div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Submitted {approval.submitted_at ? new Date(approval.submitted_at).toLocaleString() : 'N/A'}
          </div>
        </div>

        {/* Right: Screenshot */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proof of Payment</span>
          {approval.proof_image_url ? (
            <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              {!imgLoaded && <div style={{ height: '200px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading...</div>}
              <img
                src={approval.proof_image_url}
                alt="Proof of payment"
                onLoad={() => setImgLoaded(true)}
                style={{ width: '100%', display: imgLoaded ? 'block' : 'none', cursor: 'pointer' }}
                onClick={() => window.open(approval.proof_image_url, '_blank')}
              />
            </div>
          ) : (
            <div style={{ marginTop: '8px', padding: '40px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
              No screenshot uploaded
            </div>
          )}
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
          style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600' }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ approval }) {
  const isApproved = approval.status === 'APPROVED';
  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px',
          background: isApproved ? '#22c55e20' : '#ef444420', color: isApproved ? '#22c55e' : '#ef4444'
        }}>
          {approval.status}
        </span>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>{approval.client_name}</span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{approval.sr_no}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {approval.reviewed_at ? new Date(approval.reviewed_at).toLocaleString() : ''}
        {approval.reject_reason && <span style={{ color: '#ef4444', marginLeft: '8px' }}>— {approval.reject_reason}</span>}
      </div>
    </div>
  );
}