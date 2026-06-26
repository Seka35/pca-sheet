"use client";

import { useState, useEffect } from 'react';
import ProductBadge from '@/components/ProductBadge';

export default function ProfilePage() {
  const [client, setClient] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    fetch('/api/client/me')
      .then(r => r.json())
      .then(data => {
        if (data.client) {
          setClient(data.client);
          setForm({
            first_name: data.client.first_name || '',
            last_name: data.client.last_name || '',
            email: data.client.email || '',
            address: data.client.address || '',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess(false);
    setSaving(true);

    try {
      const res = await fetch('/api/client/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pwdForm)
      });

      if (res.ok) {
        setPwdSuccess(true);
        setPwdForm({ currentPassword: '', newPassword: '' });
        setTimeout(() => setPwdSuccess(false), 3000);
      } else {
        const data = await res.json();
        setPwdError(data.error || 'Failed to change password');
      }
    } catch {
      setPwdError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  const inputStyle = (value) => ({
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: `1px solid ${error ? '#ef4444' : 'var(--border-color)'}`,
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px' }}>
      {/* Profile Info */}
      <div className="card">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>My Profile</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Update your personal information.</p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                First Name
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })}
                style={inputStyle(form.first_name)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Last Name
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })}
                style={inputStyle(form.last_name)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              style={inputStyle(form.email)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="3 rue des bois"
              style={inputStyle(form.address)}
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ color: '#22c55e', fontSize: '13px', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" /></svg>
              Profile updated successfully!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--primary-accent)',
                color: '#0B111A',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Info (read-only) */}
      <div className="card">
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Account Info</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your account details from the system.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <InfoRow label="Group Name" value={client?.name} />
          <InfoRow label="Telegram Group ID" value={client?.telegram_group_id} />
          <InfoRow label="Telegram ID" value={client?.tele_id} />
          <InfoRow label="Client Since" value={client?.client_since || 'N/A'} />
          <InfoRow label="Status" value={client?.status === 'Actif' ? 'Active' : 'Inactive'} />
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Change Password</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Update your account password.</p>
        </div>

        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Password
            </label>
            <input
              type="password"
              value={pwdForm.currentPassword}
              onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              required
              style={inputStyle(pwdForm.currentPassword)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              New Password
            </label>
            <input
              type="password"
              value={pwdForm.newPassword}
              onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              style={inputStyle(pwdForm.newPassword)}
            />
          </div>

          {pwdError && (
            <div style={{ color: '#ef4444', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>
              {pwdError}
            </div>
          )}

          {pwdSuccess && (
            <div style={{ color: '#22c55e', fontSize: '13px', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" /></svg>
              Password changed successfully!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--primary-accent)',
                color: '#0B111A',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{value || '—'}</span>
    </div>
  );
}
