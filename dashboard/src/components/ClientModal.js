"use client";

import ProductBadge from './ProductBadge';

export default function ClientModal({ selectedClient, onClose }) {
  if (!selectedClient) return null;
  
  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const { client, history } = selectedClient;

  const latestMonth = history.length > 0 ? history[0].month : null;
  const currentProducts = history.filter(row => row.month === latestMonth);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div className="card" style={{ width: '900px', maxHeight: '85vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: '24px' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          ✕
        </button>
        
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>{client.name}</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge" style={{ backgroundColor: client.status === 'Actif' ? 'var(--status-active-bg)' : 'var(--status-cut-bg)', color: client.status === 'Actif' ? 'var(--status-active)' : 'var(--status-cut)' }}>
              {client.status === 'Actif' ? 'Active' : 'Inactive'}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Telegram ID: {client.telegram_group_id || 'N/A'}</span>
          </div>
        </div>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '16px', margin: 0 }}>Active Products ({latestMonth || 'No data'})</h3>
            {currentProducts.length > 0 && (
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--status-cut)' }}>
                Total Due: {formatCurrency(currentProducts.reduce((acc, p) => acc + (parseFloat((p.subscription_fee || '0').toString().replace(/[^0-9.-]+/g, "")) || 0) + (parseFloat((p.setup_fee || '0').toString().replace(/[^0-9.-]+/g, "")) || 0), 0))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentProducts.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).length > 0 ? currentProducts.filter(p => !String(p.tier || '').toLowerCase().includes('top') && !String(p.setup_type || '').toLowerCase().includes('top')).map(product => {
              const subFee = parseFloat((product.subscription_fee || '0').toString().replace(/[^0-9.-]+/g, "")) || 0;
              const setupFee = parseFloat((product.setup_fee || '0').toString().replace(/[^0-9.-]+/g, "")) || 0;
              const productDue = subFee + setupFee;
              
              return (
              <div key={product.sr_no} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Product Type</div>
                  <ProductBadge tier={product.tier} setup_type={product.setup_type} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Amount Due</div>
                  <div style={{ fontWeight: '700', color: 'var(--status-cut)', fontSize: '16px' }}>
                    {formatCurrency(productDue)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    (Sub: {product.subscription_fee ? formatCurrency(parseFloat(product.subscription_fee.toString().replace(/[^0-9.-]+/g, ""))) : '$0'} / Setup: {product.setup_fee ? formatCurrency(parseFloat(product.setup_fee.toString().replace(/[^0-9.-]+/g, ""))) : '$0'})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Discount / CL Amount</div>
                  <div style={{ fontWeight: '500' }}>{product.discount || '—'} / {product.cl_amount || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Start Date / Valid Until</div>
                  <div style={{ fontWeight: '500' }}>{product.start_date || '—'} ➔ {product.valid_stopped_date || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ad ID Number</div>
                  <div style={{ fontWeight: '500' }}>{product.ad_id_number || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ad Spend Limit</div>
                  <div style={{ fontWeight: '500' }}>{product.ad_spend_limit || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bank Name</div>
                  <div style={{ fontWeight: '500' }}>{product.bank_name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status / Client Status</div>
                  <div style={{ fontWeight: '500' }}>{product.status_validation || '—'} / {product.client_status || '—'}</div>
                </div>
              </div>
            )}) : (
              <div style={{ color: 'var(--text-secondary)' }}>No active products found.</div>
            )}
          </div>
        </div>
        
        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Payment History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px' }}>Period</th>
                <th style={{ padding: '8px' }}>Product</th>
                <th style={{ padding: '8px' }}>Bank</th>
                <th style={{ padding: '8px' }}>Valid Until</th>
                <th style={{ padding: '8px' }}>Amount Received</th>
                <th style={{ padding: '8px' }}>Ref.</th>
              </tr>
            </thead>
            <tbody>
              {history.map(row => (
                <tr key={row.sr_no} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px' }}>{row.month}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <ProductBadge tier={row.tier} setup_type={row.setup_type} />
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {row.bank_name ? <span className="badge" style={{ backgroundColor: 'var(--border-color)' }}>{row.bank_name}</span> : '—'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>{row.valid_stopped_date}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--primary-accent)', fontWeight: '500' }}>{row.amount_received}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{row.reference_no || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
