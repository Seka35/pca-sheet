"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminUserList from '@/components/admin/AdminUserList';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Get current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          router.push('/login');
          return;
        }
        if (!data.user.permissions.includes('manage_users')) {
          setError('You do not have permission to access this page.');
          setLoading(false);
          return;
        }
        setCurrentUserId(data.user.id);
      })
      .catch(() => {
        setError('Failed to load user info');
        setLoading(false);
      });

    // Get users
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(() => {
        setError('Failed to load users');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '16px',
      }}>
        <div style={{ color: '#EF4444', fontSize: '14px' }}>{error}</div>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--primary-accent)',
            color: '#0B111A',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          Admin <span style={{ color: 'var(--primary-accent)' }}>Users</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Manage user accounts and permissions.
        </p>
      </div>

      <AdminUserList users={users} currentUserId={currentUserId} />
    </div>
  );
}
