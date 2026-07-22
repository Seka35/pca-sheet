"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';
import SpendProgressBar from '@/components/SpendProgressBar';
import UpgradeModal from '@/components/UpgradeModal';

const fmtUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const IconArrowLeft = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconPackage = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const IconCheck = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconArrowRight = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const OTHER_PRODUCTS = [
  { type: 'tier', name: 'TIER 1', tier: 'TIER 1', price: '$199/mo', spend_limit: '$2,500' },
  { type: 'tier', name: 'TIER 2', tier: 'TIER 2', price: '$299/mo', spend_limit: '$5,000' },
  { type: 'tier', name: 'TIER 3', tier: 'TIER 3', price: '$499/mo', spend_limit: '$10,000' },
  { type: 'tier', name: 'TIER 4', tier: 'TIER 4', price: '$799/mo', spend_limit: '$20,000' },
  { type: 'tier', name: 'TIER 5', tier: 'TIER 5', price: '$1,399/mo', spend_limit: '$40,000' },
  { type: 'tier', name: 'TIER 6', tier: 'TIER 6', price: '$1,999/mo', spend_limit: 'Unlimited' },
  { type: 'setup', name: 'Starter Setup', setup_type: 'Starter', price: '$399', spend_limit: null },
  { type: 'setup', name: 'Premium Setup', setup_type: 'Premium', price: '$499', spend_limit: null },
  { type: 'setup', name: 'VIP Setup', setup_type: 'VIP', price: '$699', spend_limit: null },
  { type: 'extra', name: 'Extra Facebook Profile', price: '$50/mo', spend_limit: null },
  { type: 'extra', name: 'Extra Facebook Page', price: '$50/mo', spend_limit: null },
  { type: 'extra', name: 'Extra Business Manager', price: '$100/mo', spend_limit: null },
];

export default function ProductsPage() {
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [upgradeProduct, setUpgradeProduct] = useState(null);
  const [selectedOtherProducts, setSelectedOtherProducts] = useState([]);
  const [productRequests, setProductRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/client/renewals').then(r => r.json()),
      fetch('/api/product-requests?status=PENDING').then(r => r.json()).catch(() => []),
    ]).then(([renewalsData, requestsData]) => {
      setRenewals(renewalsData);
      setProductRequests(Array.isArray(requestsData) ? requestsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleOtherProduct = (product) => {
    setSelectedOtherProducts(prev => {
      const exists = prev.find(p => p.name === product.name);
      if (exists) {
        return prev.filter(p => p.name !== product.name);
      }
      return [...prev, product];
    });
  };

  const handleRequestProducts = async () => {
    if (selectedOtherProducts.length === 0) return;
    setRequestLoading(true);
    try {
      const res = await fetch('/api/product-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: selectedOtherProducts })
      });
      if (res.ok) {
        setRequestSuccess(true);
        setSelectedOtherProducts([]);
        // Refresh requests
        const requestsRes = await fetch('/api/product-requests?status=PENDING').catch(() => ({ json: () => [] }));
        const requestsData = await requestsRes.json().catch(() => []);
        setProductRequests(Array.isArray(requestsData) ? requestsData : []);
        setTimeout(() => setRequestSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Request failed:', e);
    } finally {
      setRequestLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  const activeProducts = renewals.filter(r => r.visual_status === 'Active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500', alignSelf: 'flex-start' }}>
        <IconArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>My Products</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {activeProducts.length} active product{activeProducts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {activeProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: 'var(--text-secondary)' }}><IconPackage size={40} /></div>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No active products</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your active products will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {activeProducts.map(r => (
            <ProductCard
              key={r.sr_no}
              product={r}
              onClick={() => setSelectedProduct(r)}
              onUpgrade={() => setUpgradeProduct(r)}
              onAdAccountNameSave={() => {
                fetch('/api/client/renewals').then(res => res.json()).then(data => setRenewals(data));
              }}
            />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUpgrade={() => { setUpgradeProduct(selectedProduct); setSelectedProduct(null); }}
          onSaveSuccess={({ ad_account_name }) => {
            // Refresh renewals list with updated ad_account_name
            fetch('/api/client/renewals').then(r => r.json()).then(data => {
              setRenewals(data);
              setSelectedProduct(null);
            });
          }}
        />
      )}

      {upgradeProduct && (
        <UpgradeModal
          product={upgradeProduct}
          onClose={() => setUpgradeProduct(null)}
          onUpgradeInitiated={() => {
            // Refresh renewals
            fetch('/api/client/renewals').then(r => r.json()).then(data => setRenewals(data));
          }}
        />
      )}

      {/* Other Products Section */}
      <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '24px', marginTop: '8px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Other Products</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Request additional products or upgrades
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {OTHER_PRODUCTS.map(product => {
            const isSelected = selectedOtherProducts.some(p => p.name === product.name);
            return (
              <div
                key={product.name}
                onClick={() => toggleOtherProduct(product)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: `2px solid ${isSelected ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                  backgroundColor: isSelected ? 'rgba(0, 245, 160, 0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{product.name}</span>
                  {isSelected && (
                    <span style={{ color: 'var(--primary-accent)', fontSize: '16px' }}>✓</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#22c55e' }}>{product.price}</span>
                  {product.spend_limit && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Spend Limit: {product.spend_limit}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedOtherProducts.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
              {selectedOtherProducts.length} product{selectedOtherProducts.length !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={handleRequestProducts}
              disabled={requestLoading}
              style={{
                padding: '12px 32px',
                backgroundColor: requestLoading ? 'var(--border-color)' : 'var(--primary-accent)',
                color: requestLoading ? 'var(--text-secondary)' : '#0B111A',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: requestLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {requestLoading ? 'Submitting...' : requestSuccess ? 'Request Submitted!' : 'Request Selected Products'}
            </button>
          </div>
        )}
      </div>

      {/* My Requests Section */}
      {productRequests.length > 0 && (
        <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '24px', marginTop: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>My Pending Requests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {productRequests.map(request => (
              <div key={request.id} className="card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>
                    {request.products.map(p => p.name).join(', ')}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px' }}>
                    Requested {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: request.status === 'PENDING' ? 'rgba(251, 191, 36, 0.15)' :
                    request.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: request.status === 'PENDING' ? '#fbbf24' :
                    request.status === 'APPROVED' ? '#22c55e' : '#ef4444',
                }}>
                  {request.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onClick, onUpgrade, onAdAccountNameSave }) {
  const clAmount = parseFloat(String(product.cl_amount || '0').replace(/[^0-9.]/g, '')) || 0;
  const adSpendLimit = parseFloat(String(product.ad_spend_limit || '0').replace(/[^0-9.]/g, '')) || 0;

  const statusBg = product.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : product.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const statusColor = product.billing_status === 'FULLY PAID' ? '#22c55e' : product.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444';

  return (
    <div
      onClick={onClick}
      className="card"
      style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
          {product.ad_id_number && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>AD Account:</span>
                <input
                  type="text"
                  defaultValue={product.ad_account_name || ''}
                  placeholder="Name"
                  onBlur={(e) => {
                    const newName = e.target.value;
                    if (newName !== (product.ad_account_name || '')) {
                      fetch(`/api/renewals/${product.sr_no}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ client_ad_id_name: newName }),
                      }).then(() => {
                        if (onAdAccountNameSave) onAdAccountNameSave();
                      });
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    minWidth: '80px',
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace' }}>({product.ad_id_number})</span>
              </div>
            </div>
          )}
          {adSpendLimit > 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>Limit: {fmtUSD(adSpendLimit)}</p>
          )}
        </div>
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: statusBg, color: statusColor }}>
          {product.billing_status}
        </span>
        {product.upgrade_status && (
          <span style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            backgroundColor: product.upgrade_status === 'PAYMENT_APPROVED' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(251, 191, 36, 0.15)',
            color: product.upgrade_status === 'PAYMENT_APPROVED' ? '#60a5fa' : '#fbbf24',
          }}>
            {product.upgrade_status === 'PENDING_PAYMENT' ? 'Upgrade Pending' : 'Upgrade Approved'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Row label="N°" value={product.sr_no} bold />
        <div style={{ marginTop: '-4px' }}>
          <SpendProgressBar
            current={product.current_spend || 0}
            limit={product.ad_spend_limit || 0}
            showAmount={true}
          />
        </div>
        <Row label="Monthly Fee" value={product.subscription_fee ? fmtUSD(product.subscription_fee) : '—'} />
        {product.setup_fee && parseFloat(product.setup_fee) > 0 && (
          <Row label="Setup Fee" value={fmtUSD(product.setup_fee)} />
        )}
        {product.discount && parseFloat(product.discount) > 0 && (
          <Row label="Discount" value={'-' + fmtUSD(product.discount)} green />
        )}
        {clAmount > 0 && (
          <Row label="CL Amount" value={fmtUSD(clAmount)} purple />
        )}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Due</span>
          <span style={{ color: product.total_due > 0 ? '#ef4444' : '#22c55e', fontSize: '14px', fontWeight: '700' }}>{product.total_due > 0 ? fmtUSD(product.total_due) : '$0.00'}</span>
        </div>
        <Row label="Renewal Date" value={product.valid_stopped_date || '—'} />
      </div>

      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={onClick}
          style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '0' }}
        >
          View Details <IconArrowRight size={12} />
        </button>
        {(product.tier || product.setup_type) && (
          <button
            onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#A78BFA',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '6px 16px',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '200px',
            }}
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, green, purple }) {
  const color = green ? '#22c55e' : purple ? '#a78bfa' : 'var(--text-primary)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span>
      <span style={{ color, fontSize: '12px', fontWeight: bold ? '600' : '500' }}>{value}</span>
    </div>
  );
}

function ProductModal({ product, onClose, onUpgrade, onSaveSuccess }) {
  const [adAccountName, setAdAccountName] = useState(product.ad_account_name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const saveAdAccountName = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/renewals/${product.sr_no}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_ad_id_name: adAccountName }),
      });
      if (res.ok) {
        if (onSaveSuccess) onSaveSuccess({ ...product, ad_account_name: adAccountName });
        else onClose();
      }
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  const sub = parseFloat(String(product.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const setup = parseFloat(String(product.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
  const disc = parseFloat(String(product.discount || '0').replace(/[^0-9.]/g, '')) || 0;
  const clAmount = parseFloat(String(product.cl_amount || '0').replace(/[^0-9.]/g, '')) || 0;
  const adSpendLimit = parseFloat(String(product.ad_spend_limit || '0').replace(/[^0-9.]/g, '')) || 0;

  const statusBg = product.billing_status === 'FULLY PAID' ? 'rgba(34, 197, 94, 0.15)' : product.billing_status === 'PARTIALLY PAID' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const statusColor = product.billing_status === 'FULLY PAID' ? '#22c55e' : product.billing_status === 'PARTIALLY PAID' ? '#f59e0b' : '#ef4444';

  const Section = ({ title, children }) => (
    <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-color)' }}>
      <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{title}</p>
      {children}
    </div>
  );

  const InfoRow = ({ label, value, green, purple }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: green ? '#22c55e' : purple ? '#a78bfa' : 'var(--text-primary)', fontWeight: green || purple ? '600' : '500' }}>{value}</span>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: '10px' }}><ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} /></div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{product.tier || 'Product'} {product.setup_type ? `- ${product.setup_type}` : ''}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>N° {product.sr_no}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: statusBg, color: statusColor }}>{product.billing_status}</span>
            {product.is_trial && <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>Trial</span>}
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>{product.visual_status || 'Active'}</span>
          </div>

          <Section title="Product Details">
            <InfoRow label="AD Account ID" value={product.ad_id_number || '—'} />
            <div style={{ padding: '6px 0', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>AD Account Name</span>
                <button
                  onClick={saveAdAccountName}
                  disabled={saving || adAccountName === (product.ad_account_name || '')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: saving ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <input
                type="text"
                value={adAccountName}
                onChange={(e) => setAdAccountName(e.target.value)}
                placeholder="Enter AD Account Name"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <InfoRow label="Account Type" value={product.ad_account_type || '—'} />
            <InfoRow label="Spend Limit" value={adSpendLimit > 0 ? fmtUSD(adSpendLimit) : '—'} />
            <InfoRow label="Spend" value={(() => {
              const spend = parseFloat(String(product.current_spend || '0').replace(/[^0-9.-]+/g, '')) || 0;
              return fmtUSD(spend);
            })()} />
            <div style={{ marginTop: '6px', marginBottom: '4px' }}>
              <SpendProgressBar
                current={product.current_spend || 0}
                limit={product.ad_spend_limit || 0}
                showAmount={true}
              />
            </div>
            <InfoRow label="Start Date" value={product.start_date || '—'} />
            <InfoRow label="Renewal Date" value={product.valid_stopped_date || '—'} />
            <InfoRow label="Billing Month" value={product.month || '—'} />
          </Section>

          <Section title="Billing">
            <InfoRow label="Subscription Fee" value={fmtUSD(sub)} />
            <InfoRow label="Setup Fee" value={setup > 0 ? fmtUSD(setup) : '—'} />
            {disc > 0 && <InfoRow label="Discount" value={'-' + fmtUSD(disc)} green />}
            {clAmount > 0 && <InfoRow label="CL Amount (Top-Up)" value={fmtUSD(clAmount)} purple />}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Total Due</span>
              <span style={{ fontWeight: '700', fontSize: '16px', color: product.total_due > 0 ? '#ef4444' : '#22c55e' }}>{product.total_due > 0 ? fmtUSD(product.total_due) : '$0.00'}</span>
            </div>
          </Section>

          {product.reference_no && (
            <Section title="Payment">
              <InfoRow label="Reference No." value={product.reference_no} />
            </Section>
          )}

          {/* Upgrade Button */}
          {(product.tier || product.setup_type) && (
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={onUpgrade}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  color: '#A78BFA',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Upgrade Product
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
