"use client";

import { useEffect, useState } from 'react';

const IconPlus = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconEdit = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconClose = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const inputStyle = {
  width: '100%',
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  padding: '10px 12px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const labelStyle = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '6px',
  display: 'block',
};

const fieldWrapStyle = { display: 'flex', flexDirection: 'column' };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'tier', 'setup'

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'tier',
    billing_cycle: 'monthly',
    price: '',
    ad_spend_limit: '',
  });

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const tierProducts = products.filter(p => p.category === 'tier');
  const setupProducts = products.filter(p => p.category === 'setup');

  const filteredProducts = products.filter(p => {
    if (filter === 'all') return true;
    return p.category === filter;
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', category: 'tier', price: '', ad_spend_limit: '' });
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      billing_cycle: product.billing_cycle || 'monthly',
      price: product.price,
      ad_spend_limit: product.ad_spend_limit || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingProduct ? '/api/products' : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct ? { ...formData, id: editingProduct.id } : formData),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchProducts();
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const getCategoryBadge = (category) => {
    if (category === 'tier') {
      return <span style={{ color: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>TIER</span>;
    }
    return <span style={{ color: '#A78BFA', backgroundColor: 'rgba(167, 139, 250, 0.1)', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>SETUP</span>;
  };

  const getBillingCycleBadge = (cycle) => {
    if (cycle === 'monthly') {
      return <span style={{ color: '#60A5FA', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Monthly</span>;
    }
    if (cycle === 'oneshot') {
      return <span style={{ color: '#FBBF24', backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>One-shot</span>;
    }
    if (cycle === 'annually') {
      return <span style={{ color: '#F472B6', backgroundColor: 'rgba(244, 114, 182, 0.1)', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' }}>Annual</span>;
    }
    return <span style={{ color: 'var(--text-secondary)' }}>{cycle}</span>;
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Products</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
            Manage your <span style={{ color: 'var(--text-primary)' }}>{products.length}</span> products (Tiers &amp; Setup fees)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={openAddModal}
            style={{
              backgroundColor: 'var(--primary-accent)',
              color: '#000',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 242, 181, 0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 242, 181, 0.3)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 242, 181, 0.2)'; }}
          >
            <IconPlus size={18} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['all', 'tier', 'setup'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              backgroundColor: filter === f ? 'var(--primary-accent)' : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            {f === 'all' ? 'All Products' : f === 'tier' ? 'Tiers' : 'Setup Fees'}
          </button>
        ))}
      </div>

      {/* Products Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--status-active-bg)', borderTopColor: 'var(--status-active)', borderRadius: '50%', margin: '0 auto 16px' }}></div>
            <div style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Loading products...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>No products found</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Add your first product to get started.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Category</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Billing</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Price</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Ad Spend Limit</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>{product.name}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getCategoryBadge(product.category)}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getBillingCycleBadge(product.billing_cycle)}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--primary-accent)' }}>${product.price}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ color: product.ad_spend_limit ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {product.ad_spend_limit || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openEditModal(product)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#60A5FA',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            cursor: 'pointer',
                          }}
                          title="Edit product"
                        >
                          <IconEdit />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(product)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(248, 113, 113, 0.1)',
                            color: '#F87171',
                            border: '1px solid rgba(248, 113, 113, 0.2)',
                            cursor: 'pointer',
                          }}
                          title="Delete product"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                }}
              >
                <IconClose size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={fieldWrapStyle}>
                  <label style={labelStyle}>Product Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., TIER 7, Enterprise Setup"
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={fieldWrapStyle}>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="tier">Tier</option>
                    <option value="setup">Setup Fee</option>
                  </select>
                </div>

                <div style={fieldWrapStyle}>
                  <label style={labelStyle}>Billing Cycle</label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="oneshot">One-shot</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>

                <div style={fieldWrapStyle}>
                  <label style={labelStyle}>
                    {formData.category === 'tier' ? 'Subscription Fee ($)' : 'Setup Fee ($)'}
                  </label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., 299"
                    style={inputStyle}
                    required
                  />
                </div>

                {formData.category === 'tier' && (
                  <div style={fieldWrapStyle}>
                    <label style={labelStyle}>Ad Spend Limit</label>
                    <input
                      type="text"
                      value={formData.ad_spend_limit}
                      onChange={(e) => setFormData({ ...formData, ad_spend_limit: e.target.value })}
                      placeholder="e.g., 5000 or Unlimited"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary-accent)',
                    color: '#000',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '400px',
          }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Delete Product?</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.id)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#F87171',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
