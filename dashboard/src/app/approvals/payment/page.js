"use client";

import { useEffect, useState } from 'react';
import ApprovalsTabs from '@/components/ApprovalsTabs';

export default function ApprovalQueuePage() {
  const [approvals, setApprovals] = useState([]);
  const [productRequestsCount, setProductRequestsCount] = useState(0);
  const [upgradeRequestsCount, setUpgradeRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });

  useEffect(() => {
    fetchApprovals();
    fetchProductRequestsCount();
    fetchUpgradeRequestsCount();
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

  const fetchProductRequestsCount = async () => {
    try {
      const res = await fetch('/api/product-requests?status=PENDING');
      const data = await res.json();
      setProductRequestsCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUpgradeRequestsCount = async () => {
    try {
      const res = await fetch('/api/upgrade-requests');
      const data = await res.json();
      const pending = Array.isArray(data) ? data.filter(r => r.status === 'PENDING_PAYMENT' || r.status === 'PAYMENT_APPROVED') : [];
      setUpgradeRequestsCount(pending.length);
    } catch (err) {
      console.error(err);
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
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Review client payment submissions and approve or reject them.
      </p>

      <ApprovalsTabs pendingCount={pending.length} productRequestsCount={productRequestsCount} upgradeRequestsCount={upgradeRequestsCount} />

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
  const verif = approval.verificationDisplay;
  const verifBadge = verif?.badge || '⚪';
  const verifText = verif?.text || 'En attente de vérification...';
  const verifColor = verif?.color || 'gray';

  const badgeBg = {
    green: '#22c55e15',
    red: '#ef444415',
    orange: '#f9731615',
    gray: '#6b728015',
  }[verifColor] || '#6b728015';

  const badgeColor = {
    green: '#22c55e',
    red: '#ef4444',
    orange: '#f97316',
    gray: '#6b7280',
  }[verifColor] || '#6b7280';

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

          {/* Bot Verification Result */}
          <div style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: badgeBg,
            border: `1px solid ${badgeColor}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px' }}>{verifBadge}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: badgeColor, letterSpacing: '0.5px' }}>
                Vérification Bot
              </span>
            </div>
            <div style={{ fontSize: '13px', color: badgeColor, lineHeight: '1.4' }}>
              {verifText}
            </div>
            {verif?.foundAmount !== undefined && verif.foundAmount !== null && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Montant trouvé: <b>{verif.foundAmount} {approval.bank_name?.toLowerCase().includes('btc') ? 'BTC' : 'USDT'}</b>
              </div>
            )}
            {approval.auto_verification_checked_at && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Vérifié il y a: {Math.round((Date.now() - new Date(approval.auto_verification_checked_at).getTime()) / 60000)} min
              </div>
            )}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Submitted {approval.submitted_at ? new Date(approval.submitted_at).toLocaleString() : 'N/A'}
          </div>
        </div>

        {/* Right: Bot Verification Detail */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verification Detail</span>
          {verif?.foundAmount !== undefined && verif?.foundAmount !== null ? (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                {verif.foundAmount} {approval.bank_name?.toLowerCase().includes('btc') ? 'BTC' : 'USDT'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                TX: <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{approval.transaction_id?.slice(0, 12)}...</span>
              </div>
              {verif.txDate && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Date: {new Date(verif.txDate).toLocaleDateString('fr-FR')}
                </div>
              )}
              {approval.fraud_notes && (
                <div style={{ marginTop: '8px', padding: '8px', borderRadius: '6px', background: '#ef444415', fontSize: '12px', color: '#ef4444' }}>
                  ⚠️ {approval.fraud_notes}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '8px', padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {approval.auto_verification_status === 'PENDING' || !approval.auto_verification_status
                ? 'En attente de vérification...'
                : approval.auto_verification_status === 'ERROR'
                ? 'Erreur de vérification'
                : 'Non trouvé sur le réseau'}
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