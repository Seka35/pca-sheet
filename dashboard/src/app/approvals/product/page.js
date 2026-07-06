"use client";

import { useEffect, useState } from 'react';
import ApprovalsTabs from '@/components/ApprovalsTabs';

export default function ProductApprovalsPage() {
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
      const res = await fetch('/api/product-requests');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/product-requests/${id}/approve`, { method: 'POST' });
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
      const res = await fetch(`/api/product-requests/${rejectModal.id}/reject`, {
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

  const pending = requests.filter(r => r.status === 'PENDING');
  const history = requests.filter(r => r.status !== 'PENDING');

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Product Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Review client product requests and approve or reject them.
      </p>

      <ApprovalsTabs productRequestsCount={pending.length} />

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
                <p style={{ color: 'var(--text-secondary)' }}>No pending product requests to review.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pending.map(r => (
                  <ProductRequestCard
                    key={r.id}
                    request={r}
                    onApprove={() => handleApprove(r.id)}
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
            <h3 style={{ marginBottom: '16px' }}>Reject Product Request</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Tell the client why their product request was rejected. They will be notified.
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

function ProductRequestCard({ request, onApprove, onReject, processing }) {
  const products = request.products || [];

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
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client ID</span>
            <div style={{ fontSize: '14px' }}>{request.client_id || 'N/A'}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tele ID</span>
            <div style={{ fontSize: '14px' }}>{request.tele_id || 'N/A'}</div>
          </div>
        </div>

        {/* Right: Product Details */}
        <div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requested Products</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {products.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: p.type === 'tier' ? 'rgba(0, 245, 160, 0.15)' :
                      p.type === 'setup' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: p.type === 'tier' ? '#00F5A0' :
                      p.type === 'setup' ? '#A78BFA' : '#60A5FA',
                  }}>
                    {p.type?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requested At</span>
            <div style={{ fontSize: '14px' }}>{request.created_at ? new Date(request.created_at).toLocaleString() : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={onApprove}
          disabled={processing}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            fontWeight: '600',
            fontSize: '14px',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1,
          }}
        >
          {processing ? 'Processing...' : '✓ Approve'}
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          style={{
            flex: 1,
            padding: '10px 16px',
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
      </div>
    </div>
  );
}

function HistoryRow({ request }) {
  const products = request.products || [];

  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: request.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: request.status === 'APPROVED' ? '#22c55e' : '#ef4444',
        }}>
          {request.status}
        </span>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>{request.client_name}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {products.map(p => p.name).join(', ')}
        </span>
      </div>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : new Date(request.created_at).toLocaleDateString()}
      </span>
    </div>
  );
}
