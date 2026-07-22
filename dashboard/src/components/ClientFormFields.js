"use client";

import { useEffect } from 'react';

// SVG Icons matching sidebar style
const IconDollar = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const IconChart = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
);

const IconCalendar = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const TIER_PRICING = {
  'TIER 1': { subscription_fee: '199', ad_spend_limit: '2500' },
  'TIER 2': { subscription_fee: '299', ad_spend_limit: '5000' },
  'TIER 3': { subscription_fee: '499', ad_spend_limit: '10000' },
  'TIER 4': { subscription_fee: '799', ad_spend_limit: '20000' },
  'TIER 5': { subscription_fee: '1399', ad_spend_limit: '40000' },
  'TIER 6': { subscription_fee: '1999', ad_spend_limit: 'Unlimited' },
};

const SETUP_PRICING = {
  'Invincible set up (old)': { setup_fee: '299' },
  'Starter': { setup_fee: '399' },
  'Premium': { setup_fee: '499' },
  'VIP': { setup_fee: '699' },
};

const inputStyle = {
  width: '100%',
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  padding: '8px 10px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '13px',
  fontFamily: 'inherit',
};

const compactInputStyle = {
  width: '100%',
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  padding: '6px 8px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '12px',
  fontFamily: 'inherit',
};

const labelStyle = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  fontWeight: '500',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: '4px',
  display: 'block',
};

const compactLabelStyle = {
  fontSize: '10px',
  color: 'var(--text-secondary)',
  fontWeight: '500',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: '3px',
  display: 'block',
};

const fieldWrapStyle = { display: 'flex', flexDirection: 'column' };

function Field({ label, children, compact = false }) {
  return (
    <div style={fieldWrapStyle}>
      <label style={compact ? compactLabelStyle : labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled, style, compact = false }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...(compact ? compactInputStyle : inputStyle), ...style }}
    />
  );
}

function Select({ value, onChange, options, placeholder = '—', disabled, compact = false }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...(compact ? compactInputStyle : inputStyle),
        cursor: disabled ? 'not-allowed' : 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718699' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `right ${compact ? '8px' : '10px'} center`,
        paddingRight: compact ? '26px' : '30px',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

const sectionHeaderStyle = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const sectionCardStyle = {
  backgroundColor: 'rgba(255,255,255,0.02)',
  padding: '16px',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
};

export default function ClientFormFields({
  product,
  onChange,
  onRemove,
  index,
  isFirst = false,
  disabled = false,
  showRemove = true,
  headerLabel,
  isNew = false,
  compact = false,
  tierProducts = [],
  setupProducts = [],
  referralPartner = 'N.A.',
  calculateDiscount = () => 0,
}) {
  const set = (key) => (val) => onChange({ ...product, [key]: val });

  // Build lookup maps from dynamic products
  const tierPricingMap = {};
  tierProducts.forEach(p => { tierPricingMap[p.name] = p; });

  const setupPricingMap = {};
  setupProducts.forEach(p => { setupPricingMap[p.name] = p; });

  const handleTierChange = (val) => {
    const updates = { tier: val };
    const tierProduct = tierPricingMap[val];
    if (tierProduct) {
      updates.subscription_fee = tierProduct.price;
      updates.ad_spend_limit = tierProduct.ad_spend_limit;
    }
    // Recalculate discount based on new subscription + current setup fee + referral partner
    const newSub = updates.subscription_fee || product.subscription_fee;
    const currentSetup = product.setup_fee;
    updates.discount = String(calculateDiscount(referralPartner, newSub, currentSetup));
    updates.referral_amount = '';
    onChange({ ...product, ...updates });
  };

  const handleSetupTypeChange = (val) => {
    const updates = { setup_type: val };
    const setupProduct = setupPricingMap[val];
    if (setupProduct) {
      updates.setup_fee = setupProduct.price;
    }
    // Recalculate discount based on current subscription + new setup fee + referral partner
    const currentSub = product.subscription_fee;
    const newSetup = updates.setup_fee || product.setup_fee;
    updates.discount = String(calculateDiscount(referralPartner, currentSub, newSetup));
    updates.referral_amount = '';
    onChange({ ...product, ...updates });
  };

  const TIER_OPTIONS = tierProducts.length > 0 ? tierProducts.map(p => p.name) : ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
  const SETUP_OPTIONS = setupProducts.length > 0 ? setupProducts.map(p => p.name) : ['Invincible set up (old)', 'Starter', 'Premium', 'VIP'];

  // Compact styles
  const pad = compact ? '16px' : '24px';
  const gap = compact ? '16px' : '24px';
  const sectionPad = compact ? '12px' : '16px';
  const gridGap = compact ? '10px' : '12px';
  const sectionRadius = compact ? '10px' : '12px';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-main)',
        padding: pad,
        borderRadius: compact ? '12px' : '16px',
        border: '1px solid var(--border-color)',
        borderLeft: `5px solid var(--primary-accent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: gap,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: compact ? '8px' : '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: compact ? '28px' : '36px', height: compact ? '28px' : '36px', borderRadius: compact ? '8px' : '10px',
            backgroundColor: 'rgba(20, 184, 166, 0.15)',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: compact ? '12px' : '14px', fontWeight: '800', color: 'var(--primary-accent)'
          }}>
            {index + 1}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: compact ? '12px' : '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {product.tier || 'Product'} {product.setup_type ? `- ${product.setup_type}` : ''}
            </div>
            {product.sr_no && (
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-secondary)' }}>
                {product.sr_no}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '10px' : '16px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: compact ? '11px' : '12px', color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <input
              type="checkbox"
              checked={product.active !== false}
              onChange={(e) => set('active')(e.target.checked)}
              disabled={disabled}
            />
            Active
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: compact ? '11px' : '12px', color: product.is_trial ? '#FBBF24' : 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: product.is_trial ? '600' : '400' }}>
            <input
              type="checkbox"
              checked={product.is_trial == 1}
              onChange={(e) => {
                const trial = e.target.checked;
                let updates = { is_trial: trial };
                if (trial) {
                  let baseDate = product.start_date ? new Date(product.start_date) : new Date();
                  if (isNaN(baseDate.getTime())) baseDate = new Date();
                  baseDate.setDate(baseDate.getDate() + 7);
                  updates.valid_stopped_date = baseDate.toISOString().split('T')[0];
                } else {
                  updates.valid_stopped_date = '';
                }
                onChange({ ...product, ...updates });
              }}
              disabled={disabled}
            />
            7 days trial
          </label>
          {showRemove && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--status-cut)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: '500',
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Product Identity */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(140px, 1fr))' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: gridGap }}>
        <Field label="Tier" compact={compact}>
          <Select
            value={product.tier}
            onChange={handleTierChange}
            options={TIER_OPTIONS}
            placeholder="—"
            disabled={disabled}
            compact={compact}
          />
        </Field>
        <Field label="Setup type" compact={compact}>
          <Select
            value={product.setup_type}
            onChange={handleSetupTypeChange}
            options={SETUP_OPTIONS}
            placeholder="—"
            disabled={disabled}
            compact={compact}
          />
        </Field>
      </div>

      {/* Financials section */}
      <div style={{ ...sectionCardStyle, padding: sectionPad, borderRadius: sectionRadius }}>
        <div style={sectionHeaderStyle}><IconDollar size={14} /> Financials</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: gridGap }}>
          <Field label="Subscription fee" compact={compact}>
            <TextInput value={product.subscription_fee} onChange={set('subscription_fee')} placeholder="0" disabled={disabled} compact={compact} />
          </Field>
          <Field label="Setup fee" compact={compact}>
            <TextInput value={product.setup_fee} onChange={set('setup_fee')} placeholder="0" disabled={disabled} compact={compact} />
          </Field>
          <Field label="Discount" compact={compact}>
            <TextInput value={product.discount} onChange={set('discount')} placeholder="0" disabled={disabled} compact={compact} />
          </Field>
          <Field label="CL amount" compact={compact}>
            <TextInput value={product.cl_amount} onChange={set('cl_amount')} placeholder="—" disabled={disabled} compact={compact} />
          </Field>
        </div>
      </div>

      {/* Ad Account section */}
      <div style={{ ...sectionCardStyle, padding: sectionPad, borderRadius: sectionRadius }}>
        <div style={sectionHeaderStyle}><IconChart size={14} /> Ad Account</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: gridGap }}>
          <Field label="Ad ID number" compact={compact}>
            <TextInput value={product.ad_id_number} onChange={set('ad_id_number')} placeholder="—" disabled={disabled} compact={compact} />
          </Field>
          <Field label="Ad Account Name" compact={compact}>
            <TextInput value={product.client_ad_id_name || ''} onChange={set('client_ad_id_name')} placeholder="—" disabled={disabled} compact={compact} />
          </Field>
          <Field label="Setup ID number" compact={compact}>
            <TextInput value={product.setup_id_number} onChange={set('setup_id_number')} placeholder="—" disabled={disabled} compact={compact} />
          </Field>
          <Field label="Ad account type" compact={compact}>
            <Select
              value={product.ad_account_type}
              onChange={set('ad_account_type')}
              options={['CC', 'CL']}
              placeholder="—"
              disabled={disabled}
              compact={compact}
            />
          </Field>
          <Field label="Ad spend limit" compact={compact}>
            <TextInput value={product.ad_spend_limit} onChange={set('ad_spend_limit')} placeholder="—" disabled={disabled} compact={compact} />
          </Field>
        </div>
      </div>

      {/* Lifecycle section */}
      <div style={{ ...sectionCardStyle, padding: sectionPad, borderRadius: sectionRadius }}>
        <div style={sectionHeaderStyle}><IconCalendar size={14} /> Lifecycle</div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: gridGap }}>
          <Field label="Start date" compact={compact}>
            <TextInput value={product.start_date} onChange={set('start_date')} type="date" disabled={disabled} compact={compact} />
          </Field>
          <Field label="Valid until" compact={compact}>
            <TextInput value={product.valid_stopped_date} onChange={set('valid_stopped_date')} type="date" disabled={disabled} compact={compact} />
          </Field>
        </div>
      </div>
    </div>
  );
}
