"use client";

import { useState, useEffect } from 'react';

const TIER_OPTIONS = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
const SETUP_OPTIONS = ['Starter', 'Premium', 'VIP'];

const TIER_PRICING = {
  'TIER 1': 199,
  'TIER 2': 299,
  'TIER 3': 499,
  'TIER 4': 799,
  'TIER 5': 1399,
  'TIER 6': 1999,
};

const SETUP_PRICING = {
  'Starter': 399,
  'Premium': 499,
  'VIP': 699,
};

const TIER_SPEND_LIMITS = {
  'TIER 1': '$2,500',
  'TIER 2': '$5,000',
  'TIER 3': '$10,000',
  'TIER 4': '$20,000',
  'TIER 5': '$40,000',
  'TIER 6': 'Unlimited',
};

const fmtUSD = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function UpgradeModal({ product, onClose, onUpgradeInitiated }) {
  const [step, setStep] = useState(1); // 1: select component, 2: select target, 3: confirm
  const [componentType, setComponentType] = useState(null); // 'tier' or 'setup'
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [referralPartner, setReferralPartner] = useState('N.A.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Fetch client referral partner info
  useEffect(() => {
    fetch('/api/client/me')
      .then(r => r.json())
      .then(data => {
        if (data.client?.referral_partner_name) {
          setReferralPartner(data.client.referral_partner_name);
        }
      })
      .catch(() => {});
  }, []);

  // Get available upgrade targets based on component type and current value
  const getAvailableTargets = () => {
    if (!componentType) return [];

    if (componentType === 'tier') {
      const currentIndex = TIER_OPTIONS.indexOf(product.tier);
      if (currentIndex === -1) return TIER_OPTIONS.map(t => ({ tier: t }));
      // Return only higher tiers (upgrade)
      return TIER_OPTIONS.slice(currentIndex + 1).map(t => ({ tier: t }));
    }

    if (componentType === 'setup') {
      if (!product.setup_type) return SETUP_OPTIONS.map(s => ({ setup: s }));
      const currentIndex = SETUP_OPTIONS.indexOf(product.setup_type);
      if (currentIndex === -1) return SETUP_OPTIONS.map(s => ({ setup: s }));
      // Return only higher setups
      return SETUP_OPTIONS.slice(currentIndex + 1).map(s => ({ setup: s }));
    }

    return [];
  };

  // Calculate discount percentage based on referral partner
  const getDiscountPercentage = () => {
    const discounts = { 'N.A.': 0, 'Chris': 0, 'No Limit': 15, '8 Labs': 15, 'Master': 15 };
    return discounts[referralPartner] || 0;
  };

  // Calculate prorata amount
  const calculateProrata = () => {
    if (!selectedTarget || !componentType) return 0;

    const discountPct = getDiscountPercentage();
    const discountFactor = 1 - (discountPct / 100);

    let currentPrice = 0;
    let newPrice = 0;

    if (componentType === 'tier') {
      currentPrice = TIER_PRICING[product.tier] || 0;
      newPrice = TIER_PRICING[selectedTarget.tier] || 0;
    } else if (componentType === 'setup') {
      currentPrice = SETUP_PRICING[product.setup_type] || 0;
      newPrice = SETUP_PRICING[selectedTarget.setup] || 0;
    }

    const currentWithDiscount = currentPrice * discountFactor;
    const newWithDiscount = newPrice * discountFactor;

    return Math.max(0, newWithDiscount - currentWithDiscount);
  };

  const handleProceedToPayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/upgrade-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewal_sr_no: product.sr_no,
          component_type: componentType,
          to_tier: componentType === 'tier' ? selectedTarget.tier : undefined,
          to_setup: componentType === 'setup' ? selectedTarget.setup : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create upgrade request');
      }

      onUpgradeInitiated && onUpgradeInitiated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const currentComponentValue = componentType === 'tier' ? product.tier : product.setup_type;
  const availableTargets = getAvailableTargets();
  const prorataAmount = calculateProrata();
  const discountPct = getDiscountPercentage();

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
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Upgrade Product</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Product: {product.tier || 'Product'} {product.setup_type ? `- ${product.setup_type}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* Step 1: Select Component */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                What would you like to upgrade?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {product.tier && (
                  <button
                    onClick={() => { setComponentType('tier'); setStep(2); }}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '2px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Tier</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current: {product.tier}</div>
                      </div>
                      <span style={{ color: 'var(--primary-accent)', fontSize: '20px' }}>→</span>
                    </div>
                  </button>
                )}

                {product.setup_type && (
                  <button
                    onClick={() => { setComponentType('setup'); setStep(2); }}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '2px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Setup</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current: {product.setup_type}</div>
                      </div>
                      <span style={{ color: 'var(--primary-accent)', fontSize: '20px' }}>→</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select Target */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  ← Back
                </button>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                Select your upgrade target for {componentType === 'tier' ? 'Tier' : 'Setup'}:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {availableTargets.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'var(--bg-main)',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)'
                  }}>
                    No higher {componentType} available. You are on the highest tier/setup.
                  </div>
                ) : (
                  availableTargets.map((target) => {
                    const targetName = componentType === 'tier' ? target.tier : target.setup;
                    const targetPrice = componentType === 'tier'
                      ? TIER_PRICING[targetName]
                      : SETUP_PRICING[targetName];
                    const isSelected = selectedTarget && (
                      componentType === 'tier'
                        ? selectedTarget.tier === target.tier
                        : selectedTarget.setup === target.setup
                    );

                    return (
                      <button
                        key={targetName}
                        onClick={() => setSelectedTarget(target)}
                        style={{
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: `2px solid ${isSelected ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                          background: isSelected ? 'rgba(0, 245, 160, 0.08)' : 'var(--bg-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{targetName}</div>
                            {componentType === 'tier' && (
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Spend Limit: {TIER_SPEND_LIMITS[targetName]}</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '600', color: '#22c55e' }}>{fmtUSD(targetPrice)}/mo</div>
                            {isSelected && <div style={{ fontSize: '12px', color: 'var(--primary-accent)' }}>Selected</div>}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedTarget && (
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedTarget}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    background: selectedTarget ? 'var(--primary-accent)' : 'var(--border-color)',
                    color: selectedTarget ? '#0B111A' : 'var(--text-secondary)',
                    border: 'none',
                    fontWeight: '600',
                    cursor: selectedTarget ? 'pointer' : 'not-allowed',
                    marginTop: '8px',
                  }}
                >
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setStep(2)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  ← Back
                </button>
              </div>

              <div style={{
                background: 'var(--bg-main)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Upgrade Summary
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Current {componentType === 'tier' ? 'Tier' : 'Setup'}</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{currentComponentValue}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>New {componentType === 'tier' ? 'Tier' : 'Setup'}</span>
                    <span style={{ fontWeight: '600', color: 'var(--primary-accent)' }}>
                      {componentType === 'tier' ? selectedTarget.tier : selectedTarget.setup}
                    </span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Referral Partner</span>
                    <span style={{ fontWeight: '600', color: '#A78BFA' }}>{referralPartner}</span>
                  </div>
                  {discountPct > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your Discount</span>
                      <span style={{ fontWeight: '600', color: '#22c55e' }}>{discountPct}%</span>
                    </div>
                  )}
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Prorata Amount Due</span>
                    <span style={{ fontWeight: '700', fontSize: '18px', color: '#ef4444' }}>{fmtUSD(prorataAmount)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-4px' }}>
                    (New price - Current price, after your {discountPct}% discount)
                  </div>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center' }}>
                Click "Proceed to Payment" to submit your upgrade request. You will receive payment instructions after approval.
              </p>

              <button
                onClick={handleProceedToPayment}
                disabled={loading}
                style={{
                  padding: '14px 24px',
                  borderRadius: '8px',
                  background: loading ? 'var(--border-color)' : 'var(--primary-accent)',
                  color: loading ? 'var(--text-secondary)' : '#0B111A',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
