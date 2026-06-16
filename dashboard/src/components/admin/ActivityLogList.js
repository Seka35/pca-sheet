"use client";

import { useState, useEffect } from 'react';

const ACTION_COLORS = {
  CREATE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', label: 'CREATE' },
  UPDATE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', label: 'UPDATE' },
  DELETE: { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', label: 'DELETE' },
  APPROVE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', label: 'APPROVE' },
  REJECT: { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', label: 'REJECT' },
  RESTORE: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', label: 'RESTORE' },
};

const CATEGORY_LABELS = {
  clients: 'Clients',
  payments: 'Payments',
  renewals: 'Renewals',
  approvals: 'Approvals',
  bot: 'Bot Telegram',
  backup: 'Backup',
  users: 'Users',
};

export default function ActivityLogList() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    action: '',
    user_id: '',
  });
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.action) params.set('action', filters.action);
    if (filters.user_id) params.set('user_id', filters.user_id);
    params.set('limit', limit);
    params.set('offset', offset);

    try {
      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Failed to load activity logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, filters.category, filters.action, filters.user_id]);

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setOffset(0);
  };

  const actionInfo = (action) => ACTION_COLORS[action] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', label: action };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <select
          value={filters.category}
          onChange={e => handleFilterChange('category', e.target.value)}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={e => handleFilterChange('action', e.target.value)}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="APPROVE">Approve</option>
          <option value="REJECT">Reject</option>
          <option value="RESTORE">Restore</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', width: '160px' }}>TIMESTAMP</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', width: '100px' }}>USER</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', width: '90px' }}>ACTION</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', width: '120px' }}>CATEGORY</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>ENTITY</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No activity logs found.
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const ai = actionInfo(log.action);
                return (
                  <tr key={log.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                      {log.username}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: ai.bg,
                        color: ai.color,
                      }}>
                        {ai.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {CATEGORY_LABELS[log.category] || log.category}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px' }}>
                      {log.entity_name || log.entity_id || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.details ? (
                        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {JSON.stringify(log.details).slice(0, 80)}
                          {JSON.stringify(log.details).length > 80 ? '...' : ''}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setOffset(o => Math.max(0, o - limit))}
              disabled={offset === 0}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: offset === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                cursor: offset === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: offset === 0 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(o => o + limit)}
              disabled={offset + limit >= total}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: offset + limit >= total ? 'var(--text-secondary)' : 'var(--text-primary)',
                cursor: offset + limit >= total ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: offset + limit >= total ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
