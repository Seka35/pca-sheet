"use client";

import { useEffect, useState, useCallback, useRef } from 'react';

const PER_PAGE = 20;

export default function WhopProductsSection() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [referralFilter, setReferralFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [productOptions, setProductOptions] = useState([]);
  const [referralOptions, setReferralOptions] = useState([]);
  const debounceRef = useRef(null);

  const fetchProducts = useCallback(async (pageNum = 1, searchTerm = search, prodFilter = productFilter, refFilter = referralFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        search: searchTerm,
        product: prodFilter,
        referral: refFilter,
      });
      const res = await fetch(`/api/admin/whop-products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error fetching whop products:', err);
    } finally {
      setLoading(false);
    }
  }, [search, productFilter, referralFilter]);

  useEffect(() => {
    fetchProducts(1, search, productFilter, referralFilter);
  }, [fetchProducts]);

  useEffect(() => {
    fetch('/api/admin/whop-products/options')
      .then(res => res.json())
      .then(data => {
        const prods = [...(data.tiers || []), ...(data.setups || [])];
        setProductOptions(prods);
        setReferralOptions(data.referralPartners || []);
      })
      .catch(err => console.error('Error fetching options:', err));
  }, []);

  const handleSearchChange = (value) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
      fetchProducts(1, value, productFilter, referralFilter);
    }, 300);
  };

  const handleProductFilterChange = (value) => {
    setProductFilter(value);
    setPage(1);
    fetchProducts(1, search, value, referralFilter);
  };

  const handleReferralFilterChange = (value) => {
    setReferralFilter(value);
    setPage(1);
    fetchProducts(1, search, productFilter, value);
  };

  const clearAll = () => {
    setSearchInput('');
    setSearch('');
    setProductFilter('');
    setReferralFilter('');
    setPage(1);
    fetchProducts(1, '', '', '');
  };

  const hasFilters = search || productFilter || referralFilter;

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/whop-products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        setEditForm({});
        fetchProducts(page, search, productFilter, referralFilter);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hide this product from the list?')) return;
    try {
      await fetch(`/api/admin/whop-products?id=${id}`, { method: 'DELETE' });
      fetchProducts(page, search, productFilter, referralFilter);
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: '16px',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      overflow: 'hidden',
      marginTop: '24px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        padding: '24px',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎫</span> WHOP Products
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0', fontWeight: '500' }}>
            {total} products
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search name, ID, price…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '10px 12px 10px 38px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '13px',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>

        {/* Product filter */}
        <select
          value={productFilter}
          onChange={(e) => handleProductFilterChange(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: productFilter ? 'var(--text-primary)' : 'var(--text-secondary)',
            outline: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: productFilter ? '600' : '400',
            minWidth: '160px',
          }}
        >
          <option value="">All Products</option>
          {productOptions.map((opt) => (
            <option key={opt} value={opt} style={{ color: '#000' }}>{opt}</option>
          ))}
        </select>

        {/* Referral filter */}
        <select
          value={referralFilter}
          onChange={(e) => handleReferralFilterChange(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: referralFilter ? 'var(--text-primary)' : 'var(--text-secondary)',
            outline: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: referralFilter ? '600' : '400',
            minWidth: '160px',
          }}
        >
          <option value="">All Partners</option>
          {referralOptions.map((opt) => (
            <option key={opt} value={opt} style={{ color: '#000' }}>{opt}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={clearAll}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '1000px' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
              {['Product ID', 'Name', 'Price', 'PRODUCT', 'REFERRAL PARTNER', 'Payment URL', 'Created', ''].map((h) => (
                <th key={h} style={{ padding: '14px 20px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center' }}>
                  <div className="spinner" style={{ width: '28px', height: '28px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-accent)', borderRadius: '50%', margin: '0 auto 12px' }}></div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Loading products…</div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {hasFilters ? 'No products match your filters.' : 'No products found.'}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Product ID */}
                  <td style={{ padding: '14px 20px', maxWidth: '160px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {product.product_id}
                    </span>
                  </td>

                  {/* Name */}
                  <td style={{ padding: '14px 20px', minWidth: '200px', maxWidth: '280px' }}>
                    {editingId === product.id ? (
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--primary-accent)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{product.name}</span>
                    )}
                  </td>

                  {/* Price */}
                  <td style={{ padding: '14px 20px', minWidth: '140px' }}>
                    {editingId === product.id ? (
                      <input
                        type="text"
                        value={editForm.price || ''}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--primary-accent)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--primary-accent)', fontWeight: '700', fontSize: '13px' }}>{product.price || '—'}</span>
                    )}
                  </td>

                  {/* PRODUCT */}
                  <td style={{ padding: '14px 20px', minWidth: '160px' }}>
                    {editingId === product.id ? (
                      <select
                        value={editForm.product || ''}
                        onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--primary-accent)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          outline: 'none',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        <option value="" style={{ color: '#000' }}>—</option>
                        {productOptions.map((opt) => (
                          <option key={opt} value={opt} style={{ color: '#000' }}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: '12px', color: product.product ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: product.product ? '600' : '400' }}>
                        {product.product || '—'}
                      </span>
                    )}
                  </td>

                  {/* REFERRAL PARTNER */}
                  <td style={{ padding: '14px 20px', minWidth: '140px' }}>
                    {editingId === product.id ? (
                      <select
                        value={editForm.referral_partner || ''}
                        onChange={(e) => setEditForm({ ...editForm, referral_partner: e.target.value })}
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--primary-accent)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          outline: 'none',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        <option value="" style={{ color: '#000' }}>—</option>
                        {referralOptions.map((opt) => (
                          <option key={opt} value={opt} style={{ color: '#000' }}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: '12px', color: product.referral_partner ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: product.referral_partner ? '600' : '400' }}>
                        {product.referral_partner || '—'}
                      </span>
                    )}
                  </td>

                  {/* Payment URL */}
                  <td style={{ padding: '14px 20px', minWidth: '200px', maxWidth: '260px' }}>
                    {editingId === product.id ? (
                      <input
                        type="text"
                        value={editForm.payment_url || ''}
                        onChange={(e) => setEditForm({ ...editForm, payment_url: e.target.value })}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--primary-accent)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          outline: 'none',
                          fontFamily: 'monospace',
                        }}
                      />
                    ) : (
                      <a
                        href={product.payment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: 'var(--primary-accent)', textDecoration: 'none', wordBreak: 'break-all' }}
                        title={product.payment_url}
                      >
                        {product.payment_url?.substring(0, 45)}…
                      </a>
                    )}
                  </td>

                  {/* Created */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {product.created_at || '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    {editingId === product.id ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={saveEdit} disabled={saving} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary-accent)', color: '#000', fontSize: '11px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                          Save
                        </button>
                        <button onClick={cancelEdit} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => startEdit(product)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-accent)'; e.currentTarget.style.color = 'var(--primary-accent)'; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(product.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'transparent', color: '#F87171', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                          Hide
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && products.length > 0 && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
            Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total} products
            {hasFilters && ' (filtered)'}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => { setPage(1); fetchProducts(1, search, productFilter, referralFilter); }} disabled={page === 1} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '12px', fontWeight: '600', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              «
            </button>
            <button onClick={() => { const p = page - 1; setPage(p); fetchProducts(p, search, productFilter, referralFilter); }} disabled={page === 1} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '12px', fontWeight: '600', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button key={p} onClick={() => { setPage(p); fetchProducts(p, search, productFilter, referralFilter); }} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: page === p ? 'var(--primary-accent)' : 'var(--border-color)', backgroundColor: page === p ? 'var(--primary-accent)' : 'transparent', color: page === p ? '#000' : 'var(--text-primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => { const p = page + 1; setPage(p); fetchProducts(p, search, productFilter, referralFilter); }} disabled={page === totalPages} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: page === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '12px', fontWeight: '600', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              Next ›
            </button>
            <button onClick={() => { setPage(totalPages); fetchProducts(totalPages, search, productFilter, referralFilter); }} disabled={page === totalPages} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: page === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '12px', fontWeight: '600', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
