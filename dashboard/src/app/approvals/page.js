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
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Review pending items before they are applied to the database.
      </p>

      <ApprovalsTabs pendingCount={pendingCount} />

      {loading ? (
        <p>Loading...</p>
      ) : updates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No pending updates. Everything is synchronized!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {updates.map(update => (
            <div key={update.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Client ID: <strong>{update.client_id}</strong> • Record: {update.sr_no} • {new Date(update.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: '16px' }}>
                  Field <strong>{update.field_name}</strong> changed to: <span style={{ color: 'var(--primary-accent)' }}>"{update.new_value}"</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => handleAction(update.id, 'REJECT')}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(update.id, 'APPROVE')}
                  className="btn-primary"
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