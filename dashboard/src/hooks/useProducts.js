"use client";

import { useState, useEffect, useMemo } from 'react';

// Default fallback products (same as database seed)
const DEFAULT_TIER_PRODUCTS = [
  { id: 1, name: 'TIER 1', category: 'tier', billing_cycle: 'monthly', price: '199', ad_spend_limit: '2500' },
  { id: 2, name: 'TIER 2', category: 'tier', billing_cycle: 'monthly', price: '299', ad_spend_limit: '5000' },
  { id: 3, name: 'TIER 3', category: 'tier', billing_cycle: 'monthly', price: '499', ad_spend_limit: '10000' },
  { id: 4, name: 'TIER 4', category: 'tier', billing_cycle: 'monthly', price: '799', ad_spend_limit: '20000' },
  { id: 5, name: 'TIER 5', category: 'tier', billing_cycle: 'monthly', price: '1399', ad_spend_limit: '40000' },
  { id: 6, name: 'TIER 6', category: 'tier', billing_cycle: 'monthly', price: '1999', ad_spend_limit: 'Unlimited' },
];

const DEFAULT_SETUP_PRODUCTS = [
  { id: 10, name: 'Invincible set up (old)', category: 'setup', billing_cycle: 'oneshot', price: '299', ad_spend_limit: '' },
  { id: 11, name: 'Starter', category: 'setup', billing_cycle: 'oneshot', price: '399', ad_spend_limit: '' },
  { id: 12, name: 'Premium', category: 'setup', billing_cycle: 'oneshot', price: '499', ad_spend_limit: '' },
  { id: 13, name: 'VIP', category: 'setup', billing_cycle: 'oneshot', price: '699', ad_spend_limit: '' },
];

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      // Only set products if we got valid data
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Memoize the filtered products to prevent unnecessary re-renders
  const { tierProducts, setupProducts } = useMemo(() => {
    const tiers = products.filter(p => p.category === 'tier');
    const setups = products.filter(p => p.category === 'setup');
    return {
      tierProducts: tiers.length > 0 ? tiers : DEFAULT_TIER_PRODUCTS,
      setupProducts: setups.length > 0 ? setups : DEFAULT_SETUP_PRODUCTS,
    };
  }, [products]);

  const getProductByName = (name) => products.find(p => p.name === name);

  return {
    products,
    tierProducts,
    setupProducts,
    loading,
    refetch: fetchProducts,
    getProductByName,
  };
}
