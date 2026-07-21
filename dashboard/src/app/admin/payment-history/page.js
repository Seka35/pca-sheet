'use client';

import { useEffect, useState } from 'react';

// Simple admin page to manage products and payment history using the new architecture

export default function PaymentHistoryManager() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [products, setProducts] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Form states
  const [newPayment, setNewPayment] = useState({
    product_id: '',
    type: 'MONTHLY',
    from_tier: '',
    to_tier: '',
    from_setup: '',
    to_setup: '',
    prorata_amount: '',
    amount: '',
    date: '',
    until_date: '',
    notes: ''
  });

  const [newProduct, setNewProduct] = useState({
    tier: 'TIER 1',
    setup_type: '',
    subscription_fee: '199',
    setup_fee: '0',
    discount: '0',
    start_date: new Date().toISOString().split('T')[0]
  });

  // Fetch all clients
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClients(data);
        }
      });
  }, []);

  // Fetch products when client selected
  useEffect(() => {
    if (!selectedClient) {
      setProducts([]);
      setPaymentHistory([]);
      return;
    }

    fetch(`/api/client-products?client_id=${selectedClient.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.products) {
          setProducts(data.products);
        }
      });

    fetch(`/api/payment-history?client_id=${selectedClient.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.payments) {
          setPaymentHistory(data.payments);
        }
      });
  }, [selectedClient]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/client-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          ...newProduct
        })
      });
      const data = await res.json();
      if (data.ok) {
        setProducts([...products, data.product]);
        setShowAddProduct(false);
        setNewProduct({
          tier: 'TIER 1',
          setup_type: '',
          subscription_fee: '199',
          setup_fee: '0',
          discount: '0',
          start_date: new Date().toISOString().split('T')[0]
        });
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/payment-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          ...newPayment
        })
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh payment history
        const refreshRes = await fetch(`/api/payment-history?client_id=${selectedClient.id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.payments) {
          setPaymentHistory(refreshData.payments);
        }
        // Refresh products (valid_until may have changed)
        const prodRes = await fetch(`/api/client-products?client_id=${selectedClient.id}`);
        const prodData = await prodRes.json();
        if (prodData.products) {
          setProducts(prodData.products);
        }
        setShowAddPayment(false);
        setNewPayment({
          product_id: '',
          type: 'MONTHLY',
          from_tier: '',
          to_tier: '',
          from_setup: '',
          to_setup: '',
          prorata_amount: '',
          amount: '',
          date: '',
          until_date: '',
          notes: ''
        });
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const handleUpgradePonctual = async (productId) => {
    const toTier = prompt('Enter target tier (e.g., TIER 2):');
    if (!toTier) return;

    const expiresAt = prompt('Enter expiry date (YYYY-MM-DD):', (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })());
    if (!expiresAt) return;

    const prorata = prompt('Enter prorata amount (or leave blank to calculate):', '');
    const paymentDate = prompt('Enter payment date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!paymentDate) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/client-products/${productId}/upgrade-ponctual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_tier: toTier,
          expires_at: expiresAt,
          payment_date: paymentDate,
          prorata_amount: prorata || undefined
        })
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh
        const prodRes = await fetch(`/api/client-products?client_id=${selectedClient.id}`);
        const prodData = await prodRes.json();
        if (prodData.products) setProducts(prodData.products);
        const histRes = await fetch(`/api/payment-history?client_id=${selectedClient.id}`);
        const histData = await histRes.json();
        if (histData.payments) setPaymentHistory(histData.payments);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const handleReturnToOriginal = async (productId) => {
    const paymentDate = prompt('Enter payment date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!paymentDate) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/client-products/${productId}/return-to-original`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_date: paymentDate })
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh
        const prodRes = await fetch(`/api/client-products?client_id=${selectedClient.id}`);
        const prodData = await prodRes.json();
        if (prodData.products) setProducts(prodData.products);
        const histRes = await fetch(`/api/payment-history?client_id=${selectedClient.id}`);
        const histData = await histRes.json();
        if (histData.payments) setPaymentHistory(histData.payments);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const handlePromotePonctual = async (productId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/client-products/${productId}/promote-ponctual`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh
        const prodRes = await fetch(`/api/client-products?client_id=${selectedClient.id}`);
        const prodData = await prodRes.json();
        if (prodData.products) setProducts(prodData.products);
        const histRes = await fetch(`/api/payment-history?client_id=${selectedClient.id}`);
        const histData = await histRes.json();
        if (histData.payments) setPaymentHistory(histData.payments);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const handleRenewalPonctual = async (productId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/client-products/${productId}/renewal-ponctual`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh
        const prodRes = await fetch(`/api/client-products?client_id=${selectedClient.id}`);
        const prodData = await prodRes.json();
        if (prodData.products) setProducts(prodData.products);
        const histRes = await fetch(`/api/payment-history?client_id=${selectedClient.id}`);
        const histData = await histRes.json();
        if (histData.payments) setPaymentHistory(histData.payments);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const getTypeColor = (type) => {
    const colors = {
      'MONTHLY': '#60A5FA',
      'UPGRADE_PONCTUAL': '#C084FC',
      'UPGRADE_PERMANENT': '#A78BFA',
      'RETURN': '#FB923C',
      'PROMOTION': '#F472B6',
      'RENEWAL_PONCTUAL': '#2DD4BF',
      'TOPUP': '#A78BFA',
      'SUB_UPGRADE': '#C084FC'
    };
    return colors[type] || '#fff';
  };

  return (
    <div style={{ padding: '20px', color: '#fff', minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Payment History Manager (New Architecture)</h1>

      {/* Client Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Select Client:</label>
        <select
          value={selectedClient?.id || ''}
          onChange={(e) => {
            const client = clients.find(c => c.id === parseInt(e.target.value));
            setSelectedClient(client || null);
          }}
          style={{
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #333',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            width: '300px',
            fontSize: '14px'
          }}
        >
          <option value="">-- Select a client --</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
          ))}
        </select>
      </div>

      {selectedClient && (
        <>
          {/* Products Section */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px' }}>Products ({products.length})</h2>
              <button
                onClick={() => setShowAddProduct(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#10B981',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Add Product
              </button>
            </div>

            {products.length === 0 ? (
              <p style={{ color: '#888' }}>No products found. Add one to get started.</p>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {products.map(product => (
                  <div key={product.id} style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{product.tier}</span>
                        {product.setup_type && <span style={{ color: '#888', marginLeft: '8px' }}>+ {product.setup_type}</span>}
                        {product.is_ponctual === 1 && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            color: '#C084FC',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>PONCTUAL</span>
                        )}
                      </div>
                      <span style={{ color: '#888', fontSize: '12px' }}>ID: {product.id}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '13px' }}>
                      <div><span style={{ color: '#888' }}>Start:</span> {product.start_date}</div>
                      <div><span style={{ color: '#888' }}>Valid Until:</span> {product.valid_until}</div>
                      <div><span style={{ color: '#888' }}>Fee:</span> ${product.subscription_fee}/mo</div>
                      <div><span style={{ color: '#888' }}>Original:</span> {product.original_tier || product.tier}</div>
                    </div>
                    {product.is_ponctual === 1 && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRenewalPonctual(product.id)}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(45, 212, 191, 0.2)',
                            color: '#2DD4BF',
                            border: '1px solid rgba(45, 212, 191, 0.4)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Renew Ponctual
                        </button>
                        <button
                          onClick={() => handlePromotePonctual(product.id)}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(236, 72, 153, 0.2)',
                            color: '#F472B6',
                            border: '1px solid rgba(236, 72, 153, 0.4)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Make Permanent
                        </button>
                        <button
                          onClick={() => handleReturnToOriginal(product.id)}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(251, 146, 60, 0.2)',
                            color: '#FB923C',
                            border: '1px solid rgba(251, 146, 60, 0.4)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Return to Original
                        </button>
                      </div>
                    )}
                    {product.is_ponctual !== 1 && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleUpgradePonctual(product.id)}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            color: '#C084FC',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Upgrade Ponctual
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment History Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px' }}>Payment History ({paymentHistory.length})</h2>
              <button
                onClick={() => setShowAddPayment(true)}
                disabled={products.length === 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: products.length === 0 ? '#333' : '#3B82F6',
                  color: '#fff',
                  border: 'none',
                  cursor: products.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                + Add Payment Entry
              </button>
            </div>

            {paymentHistory.length === 0 ? (
              <p style={{ color: '#888' }}>No payment history found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>Type</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>Date</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>From</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>To</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>Prorata</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>Amount</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>Until</th>
                    <th style={{ padding: '12px 8px', color: '#888', fontSize: '12px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          backgroundColor: `${getTypeColor(p.type)}20`,
                          color: getTypeColor(p.type),
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {p.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px' }}>{p.date}</td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: '#888' }}>
                        {p.from_tier || '—'}{p.from_setup ? ` + ${p.from_setup}` : ''}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: '#60A5FA' }}>
                        {p.to_tier || '—'}{p.to_setup ? ` + ${p.to_setup}` : ''}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', color: '#C084FC' }}>
                        {p.prorata_amount ? `$${p.prorata_amount}` : '—'}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: 'bold' }}>
                        ${p.amount || '0'}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px' }}>{p.until_date || '—'}</td>
                      <td style={{ padding: '12px 8px', fontSize: '12px', color: '#888' }}>{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Add New Product</h3>
            <form onSubmit={handleAddProduct}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Tier</label>
                <select
                  value={newProduct.tier}
                  onChange={e => setNewProduct({ ...newProduct, tier: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                >
                  <option value="TIER 1">TIER 1 - $199</option>
                  <option value="TIER 2">TIER 2 - $299</option>
                  <option value="TIER 3">TIER 3 - $499</option>
                  <option value="TIER 4">TIER 4 - $799</option>
                  <option value="TIER 5">TIER 5 - $1399</option>
                  <option value="TIER 6">TIER 6 - $1999</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Start Date</label>
                <input
                  type="date"
                  value={newProduct.start_date}
                  onChange={e => setNewProduct({ ...newProduct, start_date: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#10B981', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {loading ? 'Adding...' : 'Add Product'}
                </button>
                <button type="button" onClick={() => setShowAddProduct(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '12px',
            padding: '24px',
            width: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Add Payment Entry</h3>
            <form onSubmit={handleAddPayment}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Product</label>
                <select
                  value={newPayment.product_id}
                  onChange={e => setNewPayment({ ...newPayment, product_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.tier} (ID: {p.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Type</label>
                <select
                  value={newPayment.type}
                  onChange={e => setNewPayment({ ...newPayment, type: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                >
                  <option value="MONTHLY">MONTHLY</option>
                  <option value="UPGRADE_PONCTUAL">UPGRADE_PONCTUAL</option>
                  <option value="UPGRADE_PERMANENT">UPGRADE_PERMANENT</option>
                  <option value="RETURN">RETURN</option>
                  <option value="PROMOTION">PROMOTION</option>
                  <option value="RENEWAL_PONCTUAL">RENEWAL_PONCTUAL</option>
                  <option value="TOPUP">TOPUP</option>
                  <option value="SUB_UPGRADE">SUB_UPGRADE</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>From Tier</label>
                  <input
                    type="text"
                    value={newPayment.from_tier}
                    onChange={e => setNewPayment({ ...newPayment, from_tier: e.target.value })}
                    placeholder="e.g., TIER 1"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>To Tier</label>
                  <input
                    type="text"
                    value={newPayment.to_tier}
                    onChange={e => setNewPayment({ ...newPayment, to_tier: e.target.value })}
                    placeholder="e.g., TIER 2"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Prorata</label>
                  <input
                    type="number"
                    value={newPayment.prorata_amount}
                    onChange={e => setNewPayment({ ...newPayment, prorata_amount: e.target.value })}
                    placeholder="0"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Amount</label>
                  <input
                    type="number"
                    value={newPayment.amount}
                    onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                    placeholder="0"
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Until Date</label>
                  <input
                    type="date"
                    value={newPayment.until_date}
                    onChange={e => setNewPayment({ ...newPayment, until_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Date</label>
                <input
                  type="date"
                  value={newPayment.date}
                  onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#888' }}>Notes</label>
                <input
                  type="text"
                  value={newPayment.notes}
                  onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Optional notes"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#0f0f0f', color: '#fff', border: '1px solid #333' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#3B82F6', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {loading ? 'Adding...' : 'Add Entry'}
                </button>
                <button type="button" onClick={() => setShowAddPayment(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
