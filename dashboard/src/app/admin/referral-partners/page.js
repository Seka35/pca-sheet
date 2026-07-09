"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

const IconBack = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconEdit = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconPlus = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function ReferralPartnersPage() {
  const [partners, setPartners] = useState([]);
  const [partnerStats, setPartnerStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [form, setForm] = useState({ name: '', commission_percentage: '', client_discount_percentage: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [partnersRes, statsRes] = await Promise.all([
        fetch('/api/referral-partners'),
        fetch('/api/referral-partners/stats')
      ]);
      const partnersData = await partnersRes.json();
      const statsData = statsRes.ok ? await statsRes.json() : {};
      setPartners(Array.isArray(partnersData) ? partnersData : []);
      setPartnerStats(statsData);
    } catch (err) {
      console.error(err);
      // Still try to fetch just partners
      try {
        const res = await fetch('/api/referral-partners');
        const data = await res.json();
        setPartners(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingPartner(null);
    setForm({ name: '', commission_percentage: '', client_discount_percentage: '' });
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (partner) => {
    setEditingPartner(partner);
    setForm({
      name: partner.name,
      commission_percentage: partner.commission_percentage || '',
      client_discount_percentage: partner.client_discount_percentage || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const url = editingPartner
        ? `/api/referral-partners/${editingPartner.id}`
        : '/api/referral-partners';
      const method = editingPartner ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          commission_percentage: parseFloat(form.commission_percentage) || 0,
          client_discount_percentage: parseFloat(form.client_discount_percentage) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setShowModal(false);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partner) => {
    if (!confirm(`Are you sure you want to delete "${partner.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/referral-partners/${partner.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStats = (partnerName) => {
    return partnerStats[partnerName] || { client_count: 0, total_commission: 0 };
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
          <IconBack size={16} /> Admin
        </Link>
        <span style={{ color: 'var(--text-secondary)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Referral Partners</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Referral Partners</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Manage referral partners, commissions, and client discounts.
          </p>
        </div>
        <button
          onClick={openAddModal}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            background: 'var(--primary-accent)',
            color: '#0B111A',
            border: 'none',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconPlus size={16} color="#0B111A" /> Add Partner
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {partners.map(partner => {
            const stats = getStats(partner.name);
            return (
              <div key={partner.id} className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '20px', fontWeight: '700', color: '#A78BFA'
                    }}>
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {partner.name}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: partner.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: partner.status === 'active' ? '#22c55e' : '#ef4444',
                          fontWeight: '600'
                        }}>
                          {partner.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => openEditModal(partner)}
                      style={{
                        width: '36px', height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(20, 184, 166, 0.1)',
                        color: '#14b8a6',
                        border: '1px solid rgba(20, 184, 166, 0.2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Edit"
                    >
                      <IconEdit size={16} color="#14b8a6" />
                    </button>
                    <button
                      onClick={() => handleDelete(partner)}
                      style={{
                        width: '36px', height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete"
                    >
                      <IconTrash size={16} color="#ef4444" />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Commission Rate
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#A78BFA' }}>
                      {partner.commission_percentage}%
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      per payment
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Client Discount
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                      {partner.client_discount_percentage}%
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      off subscription + setup
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Total Clients
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {stats.client_count}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      linked to this partner
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Total Commission
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#A78BFA' }}>
                      ${stats.total_commission?.toFixed(2) || '0.00'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      earned from this partner
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
              {editingPartner ? 'Edit Referral Partner' : 'Add Referral Partner'}
            </h3>

            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                  placeholder="Partner name"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                  Commission Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.commission_percentage}
                  onChange={e => setForm(f => ({ ...f, commission_percentage: e.target.value }))}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                  placeholder="0"
                />
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Percentage the partner receives from each payment.
                </p>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                  Client Discount Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.client_discount_percentage}
                  onChange={e => setForm(f => ({ ...f, client_discount_percentage: e.target.value }))}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                  placeholder="0"
                />
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Discount percentage applied to the client's subscription + setup fees.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--primary-accent)',
                  color: '#0B111A',
                  border: 'none',
                  fontWeight: '600',
                  cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !form.name.trim() ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
