"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminUserList from '@/components/admin/AdminUserList';
import ActivityLogList from '@/components/admin/ActivityLogList';

const TABS = [
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'activity', label: 'Activity', icon: '📋' },
  { id: 'backup', label: 'Backup', icon: '💾' },
  { id: 'bot', label: 'Bot Telegram', icon: '🤖' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          router.push('/login');
          return;
        }
        if (!data.user.permissions.includes('read_users')) {
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
          Admin <span style={{ color: 'var(--primary-accent)' }}>Panel</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Manage users, permissions, and monitor activity.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary-accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--primary-accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: '-1px',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <AdminUserList users={users} currentUserId={currentUserId} />
      )}

      {activeTab === 'activity' && (
        <ActivityLogList />
      )}

      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '20px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>💾</span>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Backup Management</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Create manual backups or restore from previous backups.
                </p>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              The full backup management interface is available at{' '}
              <Link href="/backup" style={{ color: 'var(--primary-accent)' }}>/backup</Link>.
            </p>
            <Link href="/backup">
              <button style={{
                padding: '8px 16px',
                backgroundColor: 'var(--primary-accent)',
                color: '#0B111A',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}>
                Open Backup Manager
              </button>
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'bot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '20px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Bot Telegram</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Configure the Telegram bot, reminder templates, and group links.
                </p>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              The full bot management interface is available at{' '}
              <Link href="/bot" style={{ color: 'var(--primary-accent)' }}>/bot</Link>.
            </p>
            <Link href="/bot">
              <button style={{
                padding: '8px 16px',
                backgroundColor: 'var(--primary-accent)',
                color: '#0B111A',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}>
                Open Bot Manager
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
