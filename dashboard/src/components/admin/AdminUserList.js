"use client";

import { useState } from 'react';
import AdminUserForm from './AdminUserForm';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  read_only: 'Read Only',
  invoice_only: 'Invoice Only',
  custom: 'Custom',
};

export default function AdminUserList({ users: initialUsers, currentUserId }) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        alert('Failed to delete user');
      }
    } catch (err) {
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    // Refresh users
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Users ({users.length})</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--primary-accent)',
            color: '#0B111A',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          + Create User
        </button>
      </div>

      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>USERNAME</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>ROLE</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>CREATED</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {user.username}
                  {user.id === currentUserId && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '11px',
                      padding: '2px 6px',
                      backgroundColor: 'var(--primary-accent)',
                      color: '#0B111A',
                      borderRadius: '4px',
                      fontWeight: '600',
                    }}>
                      YOU
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: user.role === 'super_admin'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : user.role === 'admin'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: user.role === 'super_admin'
                      ? '#F87171'
                      : user.role === 'admin'
                        ? '#60A5FA'
                        : 'var(--text-primary)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                  }}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button
                    onClick={() => setEditingUser(user)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      color: 'var(--primary-accent)',
                      border: '1px solid var(--primary-accent)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      marginRight: '8px',
                    }}
                  >
                    Edit
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        color: '#EF4444',
                        border: '1px solid #EF4444',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCreateForm || editingUser) && (
        <AdminUserForm
          user={editingUser}
          onSave={handleSave}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
