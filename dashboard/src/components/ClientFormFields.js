"use client";

// A single product's editable form fields. Renders inside a card and is
// reused by AddClientModal (new product) and ClientModal in edit mode
// (existing product). All updates flow through onChange; this component
// holds no state of its own.

// Tier pricing - auto-fills subscription_fee and ad_spend_limit
const TIER_PRICING = {
  'TIER 1': { subscription_fee: '199', ad_spend_limit: '2500' },
  'TIER 2': { subscription_fee: '299', ad_spend_limit: '5000' },
  'TIER 3': { subscription_fee: '499', ad_spend_limit: '10000' },
  'TIER 4': { subscription_fee: '799', ad_spend_limit: '20000' },
  'TIER 5': { subscription_fee: '1399', ad_spend_limit: '40000' },
  'TIER 6': { subscription_fee: '1999', ad_spend_limit: 'Unlimited' },
};

// Setup pricing - auto-fills setup_fee
const SETUP_PRICING = {
  'Invincible set up': { setup_fee: '299' },
  'Starter': { setup_fee: '399' },
  'Premium': { setup_fee: '499' },
  'VIP': { setup_fee: '699' },
};

const inputStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  padding: '8px 10px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '13px',
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

const fieldWrapStyle = { display: 'flex', flexDirection: 'column' };

function Field({ label, children, required }) {
  return (
    <div style={fieldWrapStyle}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--status-cut)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled, style }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...inputStyle, ...style }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 2, disabled }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={{ ...inputStyle, resize: 'vertical', minHeight: '40px', fontFamily: 'inherit' }}
    />
  );
}

function Select({ value, onChange, options, placeholder = '—', disabled }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...inputStyle,
        cursor: disabled ? 'not-allowed' : 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718699' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: '30px',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export default function ClientFormFields({
  product,
  onChange,
  onRemove,
  index,
  isFirst = false,
  disabled = false,
  showRemove = true,
  headerLabel,
  // For new products (no sr_no) we mark the product type fields as required.
  isNew = false,
}) {
  const set = (key) => (val) => onChange({ ...product, [key]: val });

  // Handle tier change - auto-fill subscription_fee and ad_spend_limit
  const handleTierChange = (val) => {
    const updates = { tier: val };
    if (TIER_PRICING[val]) {
      updates.subscription_fee = TIER_PRICING[val].subscription_fee;
      updates.ad_spend_limit = TIER_PRICING[val].ad_spend_limit;
    }
    onChange({ ...product, ...updates });
  };

  // Handle setup_type change - auto-fill setup_fee
  const handleSetupTypeChange = (val) => {
    const updates = { setup_type: val };
    if (SETUP_PRICING[val]) {
      updates.setup_fee = SETUP_PRICING[val].setup_fee;
    }
    onChange({ ...product, ...updates });
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-main)',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        position: 'relative',
      }}
    >
      {/* Header row: product #N, sr_no (if any), Active toggle, Remove */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
          {headerLabel || `Product #${index + 1}`}
          {product.sr_no && (
            <span style={{ marginLeft: '8px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
              (sr_no: {product.sr_no})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <input
              type="checkbox"
              checked={product.active !== false}
              onChange={(e) => set('active')(e.target.checked)}
              disabled={disabled}
            />
            Active
          </label>
          {showRemove && onRemove && !isFirst && (
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        <Field label="Tier" required={isNew}>
          <Select
            value={product.tier}
            onChange={handleTierChange}
            options={['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6']}
            placeholder="—"
            disabled={disabled}
          />
        </Field>
        <Field label="Setup type" required={isNew}>
          <Select
            value={product.setup_type}
            onChange={handleSetupTypeChange}
            options={['Ad Account', 'Setup', 'Ad Account + Setup', 'Top-Up', 'Only profile', 'Only page', 'Invincible set up', 'Starter', 'Premium', 'VIP']}
            placeholder="—"
            disabled={disabled}
          />
        </Field>
        <Field label="Month">
          <TextInput value={product.month} onChange={set('month')} placeholder="e.g. Jun-2026" disabled={disabled} />
        </Field>
        <Field label="Subscription fee">
          <TextInput value={product.subscription_fee} onChange={set('subscription_fee')} placeholder="0" disabled={disabled} />
        </Field>
        <Field label="Setup fee">
          <TextInput value={product.setup_fee} onChange={set('setup_fee')} placeholder="0" disabled={disabled} />
        </Field>
        <Field label="Discount">
          <TextInput value={product.discount} onChange={set('discount')} placeholder="0" disabled={disabled} />
        </Field>
        <Field label="CL amount">
          <TextInput value={product.cl_amount} onChange={set('cl_amount')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Start date">
          <TextInput value={product.start_date} onChange={set('start_date')} type="date" disabled={disabled} />
        </Field>
        <Field label="Valid until">
          <TextInput value={product.valid_stopped_date} onChange={set('valid_stopped_date')} type="date" disabled={disabled} />
        </Field>
        <Field label="Ad ID number">
          <TextInput value={product.ad_id_number} onChange={set('ad_id_number')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Ad account type">
          <Select
            value={product.ad_account_type}
            onChange={set('ad_account_type')}
            options={['CC', 'CL']}
            placeholder="—"
            disabled={disabled}
          />
        </Field>
        <Field label="Ad spend limit">
          <TextInput value={product.ad_spend_limit} onChange={set('ad_spend_limit')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Referral partner">
          <Select
            value={product.referral_partner_name}
            onChange={set('referral_partner_name')}
            options={['Chris', 'Master', 'N.A.', 'No Limit', '8 Labs', 'Mathias']}
            placeholder="—"
            disabled={disabled}
          />
        </Field>
        <Field label="Referral amount">
          <TextInput value={product.referral_amount} onChange={set('referral_amount')} placeholder="0" disabled={disabled} />
        </Field>
        <Field label="Bank name">
          <Select
            value={product.bank_name}
            onChange={set('bank_name')}
            options={['Airxalex', 'Crypto', 'Slash Bank', 'Revolut', 'WHOP']}
            placeholder="—"
            disabled={disabled}
          />
        </Field>
        <Field label="Payment name">
          <TextInput value={product.payment_name} onChange={set('payment_name')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Amount received">
          <TextInput value={product.amount_received} onChange={set('amount_received')} placeholder="0" disabled={disabled} />
        </Field>
        <Field label="Payment received date">
          <TextInput value={product.payment_received_date} onChange={set('payment_received_date')} type="date" disabled={disabled} />
        </Field>
        <Field label="Payment month">
          <TextInput value={product.payment_received_month} onChange={set('payment_received_month')} placeholder="Jun-2026" disabled={disabled} />
        </Field>
        <Field label="Reference no.">
          <TextInput value={product.reference_no} onChange={set('reference_no')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Balance diff">
          <TextInput value={product.actual_balance_difference} onChange={set('actual_balance_difference')} placeholder="0" disabled={disabled} />
        </Field>
      </div>
    </div>
  );
}
