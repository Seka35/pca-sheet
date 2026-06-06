"use client";

// A single product's editable form fields. Renders inside a card and is
// reused by AddClientModal (new product) and ClientModal in edit mode
// (existing product). All updates flow through onChange; this component
// holds no state of its own.

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
          <TextInput value={product.tier} onChange={set('tier')} placeholder="e.g. Tier 1" disabled={disabled} />
        </Field>
        <Field label="Setup type" required={isNew}>
          <TextInput value={product.setup_type} onChange={set('setup_type')} placeholder="e.g. Ad Account" disabled={disabled} />
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
        <Field label="Ad ID name">
          <TextInput value={product.client_ad_id_name} onChange={set('client_ad_id_name')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Ad ID number">
          <TextInput value={product.ad_id_number} onChange={set('ad_id_number')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Ad account type">
          <TextInput value={product.ad_account_type} onChange={set('ad_account_type')} placeholder="Personal / Business" disabled={disabled} />
        </Field>
        <Field label="Ad spend limit">
          <TextInput value={product.ad_spend_limit} onChange={set('ad_spend_limit')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Referral partner">
          <TextInput value={product.referral_partner_name} onChange={set('referral_partner_name')} placeholder="—" disabled={disabled} />
        </Field>
        <Field label="Referral amount">
          <TextInput value={product.referral_amount} onChange={set('referral_amount')} placeholder="0" disabled={disabled} />
        </Field>
        <Field label="Bank name">
          <TextInput value={product.bank_name} onChange={set('bank_name')} placeholder="Whop / Stripe / ..." disabled={disabled} />
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
        <Field label="Status history">
          <TextInput value={product.client_status_history} onChange={set('client_status_history')} placeholder="—" disabled={disabled} />
        </Field>
        <div style={{ ...fieldWrapStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notes</label>
          <TextArea value={product.notes} onChange={set('notes')} placeholder="—" rows={2} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
