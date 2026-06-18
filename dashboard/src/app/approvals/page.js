"use client";

import { useEffect, useState } from 'react';
import ApprovalsTabs from '@/components/ApprovalsTabs';

export default function ApprovalsPage() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/approvals');
      const data = await res.json();
      setUpdates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      setUpdates(updates.filter(u => u.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const pendingCount = updates.filter(u => u.status === 'PENDING').length;

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Approvals</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
          Review pending items before they are applied to the database.
        </p>
      </div>

      <ApprovalsTabs pendingCount={pendingCount} />

      {loading ? (
        <div style={{ padding: '64px', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--status-active-bg)', borderTopColor: 'var(--status-active)', borderRadius: '50%', margin: '0 auto 16px' }}></div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Loading pending approvals...</div>
        </div>
      ) : updates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px', border: '1px solid rgba(52, 211, 153, 0.2)', backgroundColor: 'rgba(52, 211, 153, 0.02)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-accent)' }}>All Caught Up!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No pending updates. Everything is perfectly synchronized.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {updates.map(update => (
            <div key={update.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderLeft: '4px solid #FBBF24', backgroundColor: 'rgba(251, 191, 36, 0.02)' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                  Client ID: <strong style={{ color: 'var(--text-primary)' }}>{update.client_id}</strong> • Record: {update.sr_no} • {new Date(update.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: '15px' }}>
                  Field <strong style={{ color: 'var(--text-primary)' }}>{update.field_name}</strong> changed to: <span style={{ color: 'var(--primary-accent)', fontWeight: '700', backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>"{update.new_value}"</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => handleAction(update.id, 'REJECT')}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: '700', fontSize: '13px', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(update.id, 'APPROVE')}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', color: '#000', backgroundColor: 'var(--primary-accent)', cursor: 'pointer', fontWeight: '700', fontSize: '13px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(52, 211, 153, 0.2)' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(52, 211, 153, 0.3)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(52, 211, 153, 0.2)'; }}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}