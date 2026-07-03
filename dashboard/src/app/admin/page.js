"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminUserList from '@/components/admin/AdminUserList';
import ActivityLogList from '@/components/admin/ActivityLogList';

// SVG Icons matching sidebar style
const IconUsers = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconActivity = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

const IconBackup = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconBot = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" />
    <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" />
  </svg>
);

const IconClients = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const TABS = [
  { id: 'users', label: 'Users', Icon: IconUsers },
  { id: 'clients', label: 'Clients', Icon: IconClients },
  { id: 'activity', label: 'Activity', Icon: IconActivity },
  { id: 'backup', label: 'Backup', Icon: IconBackup },
  { id: 'bot', label: 'Bot Telegram', Icon: IconBot },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsOffset, setClientsOffset] = useState(0);
  const clientsLimit = 20;
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

  useEffect(() => {
    if (activeTab === 'clients') {
      // Fetch only clients that have login accounts (users with role='client')
      const params = new URLSearchParams({ limit: clientsLimit, offset: clientsOffset });
      fetch(`/api/admin/clients?${params}`)
        .then(res => res.json())
        .then(data => {
          if (data.clients) {
            setClients(data.clients);
            setClientsTotal(data.total);
          } else if (Array.isArray(data)) {
            setClients(data);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, clientsOffset]);

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
            <tab.Icon size={16} color={activeTab === tab.id ? '#000' : 'var(--text-secondary)'} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <AdminUserList users={users} currentUserId={currentUserId} />
      )}

      {activeTab === 'clients' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Client Accounts</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Showing {clients.length > 0 ? clientsOffset + 1 : 0}–{clientsOffset + clients.length} of {clientsTotal} clients with portal access
              </p>
            </div>
            <Link href="/clients">
              <button style={{
                padding: '10px 20px',
                backgroundColor: 'var(--primary-accent)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
              }}>
                Full Client List →
              </button>
            </Link>
          </div>

          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>Login</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>Client Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No client accounts found
                    </td>
                  </tr>
                ) : (
                  clients.map(client => (
                    <ClientRow key={client.user_id} client={client} onUpdate={() => {
                      // Refresh clients list after update
                      fetch('/api/admin/clients')
                        .then(res => res.json())
                        .then(data => {
                          if (Array.isArray(data)) setClients(data);
                        });
                    }} />
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {clientsTotal > clientsLimit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Page {Math.floor(clientsOffset / clientsLimit) + 1} of {Math.ceil(clientsTotal / clientsLimit)}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setClientsOffset(o => Math.max(0, o - clientsLimit))}
                    disabled={clientsOffset === 0}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: clientsOffset === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                      color: clientsOffset === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: clientsOffset === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setClientsOffset(o => o + clientsLimit)}
                    disabled={clientsOffset + clientsLimit >= clientsTotal}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: clientsOffset + clientsLimit >= clientsTotal ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                      color: clientsOffset + clientsLimit >= clientsTotal ? 'var(--text-secondary)' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: clientsOffset + clientsLimit >= clientsTotal ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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

// Client Row component with inline edit functionality
function ClientRow({ client, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(client.username);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (newPassword && newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const body = { username: username.trim() };
      if (newPassword) body.password = newPassword;

      const res = await fetch(`/api/admin/users/${client.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      setNewPassword('');
      setEditing(false);
      onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setUsername(client.username);
    setNewPassword('');
    setError('');
    setEditing(false);
  };

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <td colSpan="4" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>USERNAME</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>NEW PASSWORD (leave empty to keep current)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
            {error && (
              <div style={{ color: '#EF4444', fontSize: '12px' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--primary-accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace' }}>{client.username}</td>
      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{client.name || client.username}</td>
      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
        <span style={{
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: client.status === 'Active' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: client.status === 'Active' ? '#34D399' : '#EF4444',
        }}>
          {client.status}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Edit Login
        </button>
      </td>
    </tr>
  );
}