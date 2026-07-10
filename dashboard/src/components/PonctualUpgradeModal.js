"use client";

import { useState, useEffect } from 'react';
import { TIER_PRICING, SETUP_PRICING, getPartnerDiscount } from '@/lib/whopLinks';

const TIER_OPTIONS = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
const SETUP_OPTIONS = ['Starter', 'Premium', 'VIP'];

export default function PonctualUpgradeModal({ clientId, products, currentProduct, onClose, onUpgraded }) {
  const [selectedProductSrNo, setSelectedProductSrNo] = useState(currentProduct?.sr_no || '');
  const [upgradeTier, setUpgradeTier] = useState(true);
  const [upgradeSetup, setUpgradeSetup] = useState(false);
  const [targetTier, setTargetTier] = useState('');
  const [targetSetup, setTargetSetup] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedProduct = products.find(p => p.sr_no === selectedProductSrNo);

  // Calculate prorata
  const calculateProrata = () => {
    if (!selectedProduct || (!upgradeTier && !upgradeSetup)) return 0;

    const client = {}; // TODO: get referral partner from client
    const discount = 0;
    const discountFactor = 1 - (discount / 100);

    let prorata = 0;

    if (upgradeTier && targetTier && targetTier !== selectedProduct.tier) {
      const fromPrice = parseFloat(TIER_PRICING[selectedProduct.tier] || 0);
      const toPrice = parseFloat(TIER_PRICING[targetTier] || 0);
      prorata += Math.max(0, toPrice * discountFactor - fromPrice * discountFactor);
    }

    if (upgradeSetup && targetSetup && targetSetup !== selectedProduct.setup_type) {
      const fromPrice = parseFloat(SETUP_PRICING[selectedProduct.setup_type] || 0);
      const toPrice = parseFloat(SETUP_PRICING[targetSetup] || 0);
      prorata += Math.max(0, toPrice * discountFactor - fromPrice * discountFactor);
    }

    return prorata;
  };

  const prorata = calculateProrata();

  const handleSubmit = async () => {
    if (!selectedProductSrNo) {
      setError('Select a product');
      return;
    }
    if (!upgradeTier && !upgradeSetup) {
      setError('Select at least tier or setup to upgrade');
      return;
    }
    if (upgradeTier && !targetTier) {
      setError('Select a target tier');
      return;
    }
    if (upgradeSetup && !targetSetup) {
      setError('Select a target setup');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/renewals/${encodeURIComponent(selectedProductSrNo)}/upgrade-ponctual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_tier: upgradeTier ? targetTier : null,
          to_setup: upgradeSetup ? targetSetup : null,
          expires_at: expiresAt || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create upgrade');

      onUpgraded && onUpgraded();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Get available tiers for upgrade (only higher tiers)
  const getAvailableTiers = () => {
    if (!selectedProduct) return [];
    const currentIndex = TIER_OPTIONS.indexOf(selectedProduct.tier);
    if (currentIndex === -1) return TIER_OPTIONS;
    return TIER_OPTIONS.slice(currentIndex + 1);
  };

  // Get available setups for upgrade (only higher setups)
  const getAvailableSetups = () => {
    if (!selectedProduct) return SETUP_OPTIONS;
    const currentIndex = SETUP_OPTIONS.indexOf(selectedProduct.setup_type);
    if (currentIndex === -1) return SETUP_OPTIONS;
    return SETUP_OPTIONS.slice(currentIndex + 1);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '24px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '85vh',
        overflowY: 'auto',
        position: 'relative'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>⭐ Ponctual Upgrade</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Temporary upgrade for one billing period</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* Product Selection */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Select Product to Upgrade
            </label>
            <select
              value={selectedProductSrNo}
              onChange={(e) => {
                setSelectedProductSrNo(e.target.value);
                setTargetTier('');
                setTargetSetup('');
              }}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px',
                color: '#fff',
                fontSize: '13px'
              }}
            >
              <option value="">Select a product...</option>
              {(products || []).map(p => (
                <option key={p.sr_no} value={p.sr_no}>
                  {p.tier} {p.setup_type} ({p.month || 'Current'})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <>
              {/* Current State */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Current Product</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedProduct.tier} {selectedProduct.setup_type}
                </div>
              </div>

              {/* Upgrade Options */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                  What to Upgrade
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={upgradeTier}
                      onChange={(e) => setUpgradeTier(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>Tier</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={upgradeSetup}
                      onChange={(e) => setUpgradeSetup(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>Setup</span>
                  </label>
                </div>
              </div>

              {/* Target Tier */}
              {upgradeTier && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Target Tier
                  </label>
                  <select
                    value={targetTier}
                    onChange={(e) => setTargetTier(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">Select target tier...</option>
                    {getAvailableTiers().map(t => (
                      <option key={t} value={t}>{t} - ${TIER_PRICING[t]}/mo</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Setup */}
              {upgradeSetup && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Target Setup
                  </label>
                  <select
                    value={targetSetup}
                    onChange={(e) => setTargetSetup(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">Select target setup...</option>
                    {getAvailableSetups().map(s => (
                      <option key={s} value={s}>{s} - ${SETUP_PRICING[s]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Expiry Date */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  Upgrade Expires (leave empty for 1 month)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Prorata Preview */}
              {prorata > 0 && (
                <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Prorata Amount</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#C084FC' }}>${prorata.toFixed(2)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Difference between {selectedProduct.tier} and {targetTier || selectedProduct.tier}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedProductSrNo}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? 'var(--border-color)' : '#C084FC',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating...' : 'Create Ponctual Upgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}
