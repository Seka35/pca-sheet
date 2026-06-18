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
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>
          Admin <span style={{ color: 'var(--primary-accent)' }}>Panel</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
          Manage users, permissions, and monitor activity.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === tab.id ? 'var(--primary-accent)' : 'transparent',
              color: activeTab === tab.id ? '#000' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '16px' }}>{tab.icon}</span>
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
          <div className="card" style={{
            padding: '32px',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            maxWidth: '600px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                💾
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>Backup Management</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Create manual backups or restore from previous backups.
                </p>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              The full backup management interface is available at a dedicated route to ensure security and isolation of backup processes.
            </p>
            <Link href="/backup">
              <button style={{
                padding: '12px 24px',
                backgroundColor: 'var(--primary-accent)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(52, 211, 153, 0.2)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(52, 211, 153, 0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(52, 211, 153, 0.2)'; }}
              >
                Open Backup Manager →
              </button>
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'bot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{
            padding: '32px',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            maxWidth: '600px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                🤖
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>Bot Telegram</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Configure the Telegram bot, reminder templates, and group links.
                </p>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              The bot management interface allows you to customize automated messages, check bot health, and manually trigger syncs.
            </p>
            <Link href="/bot">
              <button style={{
                padding: '12px 24px',
                backgroundColor: '#38BDF8',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.2)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(56, 189, 248, 0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(56, 189, 248, 0.2)'; }}
              >
                Open Bot Manager →
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
