"use client";

import { useEffect, useState, useMemo } from 'react';
import ProductBadge from './ProductBadge';
import TelegramBadge from './TelegramBadge';
import TeleIdBadge from './TeleIdBadge';
import ClientFormFields from './ClientFormFields';
import { extractTeleId } from '@/lib/teleIdParser';
import { WHOP_DISCOUNT_BY_PARTNER } from '@/lib/whopLinks';

// Constants for dropdowns
const TIER_OPTIONS = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
const SETUP_OPTIONS = ['Top-up', 'Invincible set up (old)', 'Starter', 'Premium', 'VIP'];
const BANK_OPTIONS = ['Airxalex', 'Crypto', 'Slash Bank', 'Revolut', 'WHOP'];
const MONTH_OPTIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_OPTIONS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
const REFERRAL_OPTIONS = ['N.A.', 'Chris', 'No Limit', '8 Labs', 'Master', 'Mathias'];

// Tier pricing - auto-fills subscription_fee
const TIER_PRICING = {
  'TIER 1': '199',
  'TIER 2': '299',
  'TIER 3': '499',
  'TIER 4': '799',
  'TIER 5': '1399',
  'TIER 6': '1999',
};

// Setup pricing - auto-fills setup_fee
const SETUP_PRICING = {
  'Top-up': '0',
  'Invincible set up (old)': '299',
  'Starter': '399',
  'Premium': '499',
  'VIP': '699',
};

function emptyProduct() {
  return {
    tier: '', setup_type: '', month: '',
    subscription_fee: '', setup_fee: '', discount: '', cl_amount: '',
    start_date: '', valid_stopped_date: '',
    client_ad_id_name: '', ad_id_number: '', ad_account_type: '', ad_spend_limit: '',
    referral_partner_name: '', referral_amount: '',
    bank_name: '', payment_name: '', amount_received: '',
    payment_received_date: '', payment_received_month: '',
    reference_no: '', actual_balance_difference: '',
    client_status_history: '', notes: '',
    active: true,
  };
}

export default function ClientModal({ selectedClient, onClose, onSaved }) {
  if (!selectedClient) return null;

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const { client, history } = selectedClient;
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'

  // Edit-mode form state.
  const [formName, setFormName] = useState(client?.name || '');
  const [formFirstName, setFormFirstName] = useState(client?.first_name || '');
  const [formLastName, setFormLastName] = useState(client?.last_name || '');
  const [formEmail, setFormEmail] = useState(client?.email || '');
  const [formAddress, setFormAddress] = useState(client?.address || '');
  const [formTelegramGroupId, setFormTelegramGroupId] = useState(client?.telegram_group_id || '');
  const [formStatus, setFormStatus] = useState(client?.status || 'inactif');
  const [formProducts, setFormProducts] = useState([]);
  const [removedSrNos, setRemovedSrNos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formTrustpilotReviewed, setFormTrustpilotReviewed] = useState(client?.trustpilot_reviewed ? true : false);
  const [formChurnReason, setFormChurnReason] = useState(client?.churn_reason || '');
  const [uploadingContract, setUploadingContract] = useState(false);
  const [computedData, setComputedData] = useState(selectedClient?.computed || null);

  // Refetch client detail to get computed fields when modal opens
  useEffect(() => {
    if (!client?.id) return;
    fetch(`/api/clients/${client.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.computed) setComputedData(data.computed);
      })
      .catch(() => {});
  }, [client?.id]);

  const uploadContract = async (file) => {
    if (!file || saving) return;
    setUploadingContract(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/clients/${client.id}/contract`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        setComputedData(prev => ({ ...prev, contract_file_path: data.path }));
        onSaved && onSaved();
      }
    } catch {}
    finally { setUploadingContract(false); }
  };

  // Manual payment entry state
  const [editingPayment, setEditingPayment] = useState(null); // null | { srNo, row } | 'new'
  const [selectedProductSrNo, setSelectedProductSrNo] = useState(''); // sr_no of selected existing product
  const [manualPaymentForm, setManualPaymentForm] = useState({
    month: '',
    bank_name: '',
    amount_received: '',
    payment_received_date: '',
    reference_no: '',
    tier: '',
    setup_type: '',
    subscription_fee: '',
    setup_fee: '',
    discount: '',
    valid_stopped_date: '',
  });

  // Active products from history for dropdown selection
  const activeProducts = (history || []).filter(p => p.visual_status === 'Active' || p.active !== false);

  // Selected product filter for payment history view
  const [selectedPaymentProduct, setSelectedPaymentProduct] = useState(null); // null = all products

  // Unpaid products - for linking payments
  const unpaidProducts = (history || []).filter(p => {
    const isPaid = p.reference_no && p.reference_no.trim() !== '';
    const isActive = p.visual_status === 'Active' || p.active !== false;
    return !isPaid && isActive;
  });

  // Unique values for dropdowns extracted from history
  const uniqueTiers = useMemo(() => {
    const tiers = new Set();
    (history || []).forEach(h => { if (h.tier) tiers.add(h.tier); });
    return Array.from(tiers).sort();
  }, [history]);

  const uniqueBanks = useMemo(() => {
    const banks = new Set();
    (history || []).forEach(h => { if (h.bank_name) banks.add(h.bank_name); });
    return Array.from(banks).sort();
  }, [history]);

  const uniqueSetupTypes = useMemo(() => {
    const types = new Set();
    (history || []).forEach(h => { if (h.setup_type) types.add(h.setup_type); });
    return Array.from(types).sort();
  }, [history]);

  const uniqueMonths = useMemo(() => {
    const months = new Set();
    (history || []).forEach(h => { if (h.month) months.add(h.month); });
    return Array.from(months).sort().reverse(); // most recent first
  }, [history]);

  // Re-init form state whenever a fresh client is loaded.
  useEffect(() => {
    if (!client?.id) return;
    setMode('view');
    setError(null);
    setRemovedSrNos([]);
    setSelectedPaymentProduct(null);
    setFormName(client.name || '');
    setFormFirstName(client.first_name || '');
    setFormLastName(client.last_name || '');
    setFormEmail(client.email || '');
    setFormAddress(client.address || '');
    setFormTelegramGroupId(client.telegram_group_id || '');
    setFormStatus(client.status || 'inactif');
    setFormProducts(
      (history || []).map((h) => ({
        sr_no: h.sr_no,
        tier: h.tier || '',
        setup_type: h.setup_type || '',
        month: h.month || '',
        subscription_fee: h.subscription_fee || '',
        setup_fee: h.setup_fee || '',
        discount: h.discount || '',
        cl_amount: h.cl_amount || '',
        start_date: h.start_date || '',
        valid_stopped_date: h.valid_stopped_date || '',
        client_ad_id_name: h.client_ad_id_name || '',
        ad_id_number: h.ad_id_number || '',
        ad_account_type: h.ad_account_type || '',
        ad_spend_limit: h.ad_spend_limit || '',
        referral_partner_name: h.referral_partner_name || '',
        referral_amount: h.referral_amount || '',
        bank_name: h.bank_name || '',
        payment_name: h.payment_name || '',
        amount_received: h.amount_received || '',
        payment_received_date: h.payment_received_date || '',
        payment_received_month: h.payment_received_month || '',
        reference_no: h.reference_no || '',
        actual_balance_difference: h.actual_balance_difference || '',
        client_status_history: h.client_status_history || '',
        notes: h.notes || '',
        active: h.visual_status === 'Active',
      }))
    );
  }, [client?.id, client?.name, client?.first_name, client?.last_name, client?.email, client?.address, client?.telegram_group_id, client?.status, history]);

  useEffect(() => {
    if (!client?.id) return;
    fetch(`/api/bot/groups?client_id=${client.id}`)
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setLinkedGroups(rows.filter((g) => g.status === 'linked'));
      })
      .catch(() => {});
  }, [client?.id]);

  // Esc closes (only in view mode, or when not saving).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const parseAmount = (val) => {
    if (!val) return 0;
    const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateProductDue = (p) => {
    const isPaid = p.reference_no && p.reference_no.trim() !== '';
    if (isPaid) return 0;
    const sub = parseAmount(p.subscription_fee);
    const setup = parseAmount(p.setup_fee);
    const disc = parseAmount(p.discount);
    const received = parseAmount(p.amount_received);
    const due = (sub + setup) - disc - received;
    return Math.max(0, due);
  };

  // Deduplicate products by tier + setup_type combination (one card per unique product)
  const uniqueProductsMap = {};
  (history || []).forEach(p => {
    const key = `${p.tier || ''}|${p.setup_type || ''}`;
    if (key !== '|' && !uniqueProductsMap[key]) {
      uniqueProductsMap[key] = p;
    }
  });
  const displayProducts = Object.values(uniqueProductsMap);

  const totalDue = displayProducts.reduce((acc, p) => acc + calculateProductDue(p), 0);

  // Tele ID derived from the (possibly edited) name.
  const parsedTeleId = useMemo(() => extractTeleId(mode === 'edit' ? formName : client?.name), [mode, formName, client?.name]);
  const teleIdConflict = !client?.tele_id && !!parsedTeleId;

  // Edit-mode handlers.
  const updateProduct = (idx, next) => {
    setFormProducts((prev) => prev.map((p, i) => (i === idx ? next : p)));
  };
  const removeProductAt = (idx) => {
    const removed = formProducts[idx];
    setFormProducts((prev) => prev.filter((_, i) => i !== idx));
    if (removed && removed.sr_no) {
      setRemovedSrNos((prev) => (prev.includes(removed.sr_no) ? prev : [...prev, removed.sr_no]));
    }
  };
  const addProduct = () => {
    setFormProducts((prev) => [...prev, emptyProduct()]);
  };

  const cancelEdit = () => {
    setError(null);
    setMode('view');
    setEditingPayment(null);
    setSelectedProductSrNo('');
    // Reset form state.
    setFormName(client.name || '');
    setFormFirstName(client.first_name || '');
    setFormLastName(client.last_name || '');
    setFormEmail(client.email || '');
    setFormAddress(client.address || '');
    setFormTelegramGroupId(client.telegram_group_id || '');
    setFormStatus(client.status || 'inactif');
    setRemovedSrNos([]);
    setFormTrustpilotReviewed(client?.trustpilot_reviewed ? true : false);
    setFormChurnReason(client?.churn_reason || '');
    setComputedData(selectedClient?.computed || {});
    setFormProducts(
      (history || []).map((h) => ({
        sr_no: h.sr_no,
        tier: h.tier || '', setup_type: h.setup_type || '',
        month: h.month || '',
        subscription_fee: h.subscription_fee || '', setup_fee: h.setup_fee || '',
        discount: h.discount || '', cl_amount: h.cl_amount || '',
        start_date: h.start_date || '', valid_stopped_date: h.valid_stopped_date || '',
        client_ad_id_name: h.client_ad_id_name || '', ad_id_number: h.ad_id_number || '',
        ad_account_type: h.ad_account_type || '', ad_spend_limit: h.ad_spend_limit || '',
        referral_partner_name: h.referral_partner_name || '', referral_amount: h.referral_amount || '',
        bank_name: h.bank_name || '', payment_name: h.payment_name || '',
        amount_received: h.amount_received || '',
        payment_received_date: h.payment_received_date || '', payment_received_month: h.payment_received_month || '',
        reference_no: h.reference_no || '', actual_balance_difference: h.actual_balance_difference || '',
        client_status_history: h.client_status_history || '', notes: h.notes || '',
        active: h.visual_status === 'Active',
      }))
    );
  };

  // Manual payment entry handlers
  const startAddPayment = () => {
    setEditingPayment('new');
    setSelectedProductSrNo('');
    setManualPaymentForm({
      month: '',
      bank_name: '',
      amount_received: '',
      payment_received_date: new Date().toISOString().split('T')[0],
      reference_no: '',
      tier: '',
      setup_type: '',
      subscription_fee: '',
      setup_fee: '',
      discount: '',
      referral_partner_name: '',
      valid_stopped_date: '',
    });
  };

  // Handle tier change - auto-fill subscription_fee
  const handlePaymentTierChange = (val) => {
    const updates = { tier: val };
    if (TIER_PRICING[val]) {
      updates.subscription_fee = TIER_PRICING[val];
    }
    // Recalculate discount if referral partner is set
    const currentForm = manualPaymentForm;
    const newSub = TIER_PRICING[val] || currentForm.subscription_fee;
    if (currentForm.referral_partner_name && WHOP_DISCOUNT_BY_PARTNER[currentForm.referral_partner_name]) {
      const discountPct = Math.abs(WHOP_DISCOUNT_BY_PARTNER[currentForm.referral_partner_name]);
      updates.discount = String(Math.round(newSub * discountPct / 100));
    }
    setManualPaymentForm(prev => ({ ...prev, ...updates }));
  };

  // Handle setup type change - auto-fill setup_fee
  const handlePaymentSetupTypeChange = (val) => {
    const updates = { setup_type: val };
    if (SETUP_PRICING[val]) {
      updates.setup_fee = SETUP_PRICING[val];
    }
    setManualPaymentForm(prev => ({ ...prev, ...updates }));
  };

  // Handle referral partner change - auto-fill discount as percentage of subscription
  const handlePaymentReferralPartnerChange = (val) => {
    const updates = { referral_partner_name: val };
    if (val && manualPaymentForm.subscription_fee) {
      const discountPct = Math.abs(WHOP_DISCOUNT_BY_PARTNER[val] || 0);
      if (discountPct > 0) {
        updates.discount = String(Math.round(parseFloat(manualPaymentForm.subscription_fee) * discountPct / 100));
      } else {
        updates.discount = '0';
      }
    }
    setManualPaymentForm(prev => ({ ...prev, ...updates }));
  };

  // When user selects an existing product from dropdown, auto-fill the form
  const handleProductSelect = (srNo) => {
    setSelectedProductSrNo(srNo);
    if (srNo === 'new') {
      // Free-form entry - reset to defaults
      setManualPaymentForm({
        month: '',
        bank_name: '',
        amount_received: '',
        payment_received_date: new Date().toISOString().split('T')[0],
        reference_no: '',
        tier: '',
        setup_type: '',
        subscription_fee: '',
        setup_fee: '',
        discount: '',
        valid_stopped_date: '',
      });
    } else {
      // Pre-fill from selected product
      const product = history.find(h => h.sr_no === srNo);
      if (product) {
        setManualPaymentForm({
          month: product.month || '',
          bank_name: product.bank_name || '',
          amount_received: product.amount_received || '',
          payment_received_date: product.payment_received_date || new Date().toISOString().split('T')[0],
          reference_no: product.reference_no || '',
          tier: product.tier || '',
          setup_type: product.setup_type || '',
          subscription_fee: product.subscription_fee || '',
          setup_fee: product.setup_fee || '',
          discount: product.discount || '',
          valid_stopped_date: product.valid_stopped_date || '',
        });
      }
    }
  };

  const startEditPayment = (row) => {
    setEditingPayment({ srNo: row.sr_no, row });
    setSelectedProductSrNo(row.sr_no || '');
    setManualPaymentForm({
      month: row.month || '',
      bank_name: row.bank_name || '',
      amount_received: row.amount_received || '',
      payment_received_date: row.payment_received_date || '',
      reference_no: row.reference_no || '',
      tier: row.tier || '',
      setup_type: row.setup_type || '',
      subscription_fee: row.subscription_fee || '',
      setup_fee: row.setup_fee || '',
      discount: row.discount || '',
      valid_stopped_date: row.valid_stopped_date || '',
    });
  };

  const cancelPaymentEdit = () => {
    setEditingPayment(null);
    setSelectedProductSrNo('');
    setManualPaymentForm({
      month: '',
      bank_name: '',
      amount_received: '',
      payment_received_date: '',
      reference_no: '',
      tier: '',
      setup_type: '',
      subscription_fee: '',
      setup_fee: '',
      discount: '',
      valid_stopped_date: '',
    });
  };

  const saveManualPayment = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);

    try {
      let updatedProducts;
      if (editingPayment === 'new') {
        // Add new payment entry as a new product
        const newProduct = {
          tier: manualPaymentForm.tier || 'Standard',
          setup_type: manualPaymentForm.setup_type || 'Monthly',
          month: manualPaymentForm.month,
          subscription_fee: manualPaymentForm.subscription_fee || '0',
          setup_fee: manualPaymentForm.setup_fee || '0',
          discount: manualPaymentForm.discount || '0',
          cl_amount: '',
          start_date: '',
          valid_stopped_date: manualPaymentForm.valid_stopped_date || '',
          client_ad_id_name: '',
          ad_id_number: '',
          ad_account_type: '',
          ad_spend_limit: '',
          referral_partner_name: '',
          referral_amount: '',
          bank_name: manualPaymentForm.bank_name,
          payment_name: '',
          amount_received: manualPaymentForm.amount_received,
          payment_received_date: manualPaymentForm.payment_received_date,
          payment_received_month: manualPaymentForm.month,
          reference_no: manualPaymentForm.reference_no,
          actual_balance_difference: '',
          client_status_history: '',
          notes: 'MANUAL_ENTRY',
          active: true,
        };
        updatedProducts = [...formProducts, newProduct];
      } else {
        // Update existing payment entry - match by sr_no
        updatedProducts = formProducts.map((p) => {
          if (p.sr_no === editingPayment.srNo) {
            return {
              ...p,
              month: manualPaymentForm.month,
              bank_name: manualPaymentForm.bank_name,
              amount_received: manualPaymentForm.amount_received,
              payment_received_date: manualPaymentForm.payment_received_date,
              payment_received_month: manualPaymentForm.month,
              reference_no: manualPaymentForm.reference_no,
              tier: manualPaymentForm.tier || p.tier,
              setup_type: manualPaymentForm.setup_type || p.setup_type,
              subscription_fee: manualPaymentForm.subscription_fee || p.subscription_fee,
              setup_fee: manualPaymentForm.setup_fee || p.setup_fee,
              discount: manualPaymentForm.discount || p.discount,
              valid_stopped_date: manualPaymentForm.valid_stopped_date || p.valid_stopped_date,
            };
          }
          return p;
        });
      }

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          email: formEmail.trim(),
          address: formAddress.trim(),
          telegram_group_id: formTelegramGroupId.trim(),
          status: formStatus,
          products: updatedProducts,
          removed_sr_nos: removedSrNos,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      setEditingPayment(null);
      setSelectedProductSrNo('');
      onSaved && onSaved();
      // Re-fetch client to refresh modal
      try {
        const refetch = await fetch(`/api/clients/${client.id}`);
        if (refetch.ok) {
          const fresh = await refetch.json();
          // Update local state with fresh data
          setFormProducts(
            (fresh.history || []).map((h) => ({
              sr_no: h.sr_no,
              tier: h.tier || '',
              setup_type: h.setup_type || '',
              month: h.month || '',
              subscription_fee: h.subscription_fee || '',
              setup_fee: h.setup_fee || '',
              discount: h.discount || '',
              cl_amount: h.cl_amount || '',
              start_date: h.start_date || '',
              valid_stopped_date: h.valid_stopped_date || '',
              client_ad_id_name: h.client_ad_id_name || '',
              ad_id_number: h.ad_id_number || '',
              ad_account_type: h.ad_account_type || '',
              ad_spend_limit: h.ad_spend_limit || '',
              referral_partner_name: h.referral_partner_name || '',
              referral_amount: h.referral_amount || '',
              bank_name: h.bank_name || '',
              payment_name: h.payment_name || '',
              amount_received: h.amount_received || '',
              payment_received_date: h.payment_received_date || '',
              payment_received_month: h.payment_received_month || '',
              reference_no: h.reference_no || '',
              actual_balance_difference: h.actual_balance_difference || '',
              client_status_history: h.client_status_history || '',
              notes: h.notes || '',
              active: h.visual_status === 'Active',
            }))
          );
        }
      } catch {}
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          email: formEmail.trim(),
          address: formAddress.trim(),
          telegram_group_id: formTelegramGroupId.trim(),
          status: formStatus,
          products: formProducts,
          removed_sr_nos: removedSrNos,
          trustpilot_reviewed: formTrustpilotReviewed ? 1 : 0,
          churn_reason: formChurnReason || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'SHEETS_OK_DB_FAIL') {
          setError(
            'Saved to Google Sheet but local DB write failed. ' +
            'A full sync will be triggered to reconcile.'
          );
          try { await fetch('/api/sync', { method: 'POST' }); } catch {}
          setTimeout(() => {
            onSaved && onSaved();
            onClose();
          }, 1800);
          return;
        }
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = useMemo(() => {
    if (mode !== 'edit') return false;
    if ((formName || '').trim() !== (client?.name || '')) return true;
    if ((formFirstName || '').trim() !== (client?.first_name || '')) return true;
    if ((formLastName || '').trim() !== (client?.last_name || '')) return true;
    if ((formEmail || '').trim() !== (client?.email || '')) return true;
    if ((formAddress || '').trim() !== (client?.address || '')) return true;
    if ((formTelegramGroupId || '').trim() !== (client?.telegram_group_id || '')) return true;
    if ((formStatus || '') !== (client?.status || 'inactif')) return true;
    if ((formTrustpilotReviewed ? 1 : 0) !== (client?.trustpilot_reviewed || 0)) return true;
    if ((formChurnReason || '') !== (client?.churn_reason || '')) return true;
    if (removedSrNos.length > 0) return true;
    const original = history || [];
    if (formProducts.length !== original.length) return true;
    for (let i = 0; i < formProducts.length; i++) {
      const f = formProducts[i];
      const o = original.find((h) => h.sr_no === f.sr_no);
      if (!o) return true; // new product
      const fields = ['tier', 'setup_type', 'month', 'subscription_fee', 'setup_fee',
        'discount', 'cl_amount', 'start_date', 'valid_stopped_date',
        'client_ad_id_name', 'ad_id_number', 'ad_account_type', 'ad_spend_limit',
        'referral_partner_name', 'referral_amount', 'bank_name', 'payment_name',
        'amount_received', 'payment_received_date', 'payment_received_month',
        'reference_no', 'actual_balance_difference', 'client_status_history', 'notes'];
      for (const fld of fields) {
        if ((f[fld] || '') !== (o[fld] || '')) return true;
      }
      const fActive = f.active !== false;
      const oActive = o.visual_status === 'Active';
      if (fActive !== oActive) return true;
    }
    return false;
  }, [mode, formName, formFirstName, formLastName, formEmail, formAddress, formTelegramGroupId, formStatus, formTrustpilotReviewed, formChurnReason, formProducts, removedSrNos, client, history]);

  const primaryBtn = {
    backgroundColor: '#14b8a6', color: '#fff', padding: '8px 16px',
    borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
  };
  const secondaryBtn = {
    backgroundColor: 'transparent', color: 'var(--text-primary)',
    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
    fontWeight: '500', fontSize: '13px', cursor: 'pointer',
  };

  // Build billing info for invoice - prefer client personal info, fallback to product info
  const getBillingInfo = (row) => {
    const firstName = client?.first_name || '';
    const lastName = client?.last_name || '';
    const email = client?.email || '';
    const address = client?.address || '';
    return { firstName, lastName, email, address };
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px',
    }} onClick={() => { if (!saving) onClose(); }}>
      <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => { if (!saving) onClose(); }}
          style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-secondary)', fontSize: '20px', cursor: saving ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', zIndex: 10 }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ paddingRight: '100px' }}>
          {mode === 'view' ? (
            <>
              <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>{client.name}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge" style={{ backgroundColor: client.status === 'Actif' ? 'var(--status-active-bg)' : 'var(--status-cut-bg)', color: client.status === 'Actif' ? 'var(--status-active)' : 'var(--status-cut)' }}>
                  {client.status === 'Actif' ? 'Active' : 'Inactive'}
                </span>
                <TeleIdBadge
                  teleId={client.tele_id}
                  parsedTeleId={parsedTeleId}
                  conflict={teleIdConflict}
                />
                <TelegramBadge chatId={client.telegram_group_id} title="Primary linked group" />
                {client.trustpilot_reviewed ? (
                  <span title="Trustpilot reviewed" style={{ color: '#34D399', fontSize: '16px' }}>✅</span>
                ) : (
                  <span title="Trustpilot not reviewed" style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>❌</span>
                )}
                {computedData?.healthStatus && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '700',
                    backgroundColor: computedData.healthStatus === 'healthy' ? 'rgba(52, 211, 153, 0.15)' : computedData.healthStatus === 'at_risk' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: computedData.healthStatus === 'healthy' ? '#34D399' : computedData.healthStatus === 'at_risk' ? '#FBBF24' : '#F87171',
                    border: `1px solid ${computedData.healthStatus === 'healthy' ? 'rgba(52, 211, 153, 0.3)' : computedData.healthStatus === 'at_risk' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}>
                    {computedData.healthStatus === 'healthy' ? '🟢 HEALTHY' : computedData.healthStatus === 'at_risk' ? '🟡 AT RISK' : '🔴 CRITICAL'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  style={{
                    marginLeft: 'auto',
                    backgroundColor: 'transparent',
                    color: '#14b8a6',
                    border: '1px solid #14b8a6',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
              {/* Personal info - visible in view mode */}
              {(client.first_name || client.last_name || client.email || client.address) && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Billing Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '13px' }}>
                    {client.first_name || client.last_name ? (
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Name: </span>
                        <span style={{ fontWeight: '500' }}>{client.first_name} {client.last_name}</span>
                      </div>
                    ) : null}
                    {client.email ? (
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Email: </span>
                        <span style={{ fontWeight: '500' }}>{client.email}</span>
                      </div>
                    ) : null}
                    {client.address ? (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Address: </span>
                        <span style={{ fontWeight: '500' }}>{client.address}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Client Insights - computed data */}
              {computedData && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Client Insights
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '13px' }}>
                    {computedData.earliestStartDate && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Start Date: </span>
                        <span style={{ fontWeight: '500' }}>{computedData.earliestStartDate}</span>
                      </div>
                    )}
                    {computedData.latestRenewalDate && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Renewal Date: </span>
                        <span style={{ fontWeight: '500' }}>{computedData.latestRenewalDate}</span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Renewals: </span>
                      <span style={{ fontWeight: '500' }}>{computedData.renewalCount}x</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Tier: </span>
                      {computedData.latestTier ? (
                        <span style={{ color: '#A78BFA', fontWeight: '600', fontSize: '11px' }}>{computedData.latestTier}{computedData.isInvincible ? ' ⚡' : ''}</span>
                      ) : <span style={{ fontWeight: '500' }}>—</span>}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Spend (CL): </span>
                      <span style={{ fontWeight: '500' }}>{formatCurrency(computedData.totalSpend)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>CA: </span>
                      <span style={{ fontWeight: '600', color: '#34D399' }}>{formatCurrency(computedData.totalCA)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Stable: </span>
                      <span style={{ fontWeight: '500' }}>{computedData.isStable ? '✅ Yes' : '❌ No'}</span>
                    </div>
                    {client.contract_file_path && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Contrat: </span>
                        <a href={client.contract_file_path} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', fontWeight: '500', textDecoration: 'none' }}>📄 View</a>
                      </div>
                    )}
                    {!client.contract_file_path && mode === 'edit' && (
                      <div>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Upload Contrat: </label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => { if (e.target.files?.[0]) uploadContract(e.target.files[0]); }}
                          disabled={uploadingContract}
                          style={{ fontSize: '11px', color: 'var(--text-primary)' }}
                        />
                      </div>
                    )}
                  </div>
                  {client.status !== 'Actif' && client.churn_reason && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Raison de la perte: </span>
                      <span style={{ fontWeight: '600', color: '#F87171' }}>{client.churn_reason}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', marginBottom: 0 }}>Edit Client</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Name (Telegram Group) <span style={{ color: 'var(--status-cut)' }}>*</span>
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Telegram group ID</label>
                  <input
                    value={formTelegramGroupId}
                    onChange={(e) => setFormTelegramGroupId(e.target.value)}
                    placeholder="-1001234567890"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
              </div>
              {/* Personal info fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>First Name</label>
                  <input
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="John"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Last Name</label>
                  <input
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Doe"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Email</label>
                  <input
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="john@example.com"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Address</label>
                  <input
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="123 Main St"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  disabled={saving}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)', borderRadius: '6px',
                    padding: '6px 10px', color: 'var(--text-primary)', outline: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="Actif" style={{ color: '#000' }}>Active</option>
                  <option value="inactif" style={{ color: '#000' }}>Inactive</option>
                </select>
                <TeleIdBadge
                  teleId={client.tele_id}
                  parsedTeleId={parsedTeleId}
                  conflict={teleIdConflict}
                />
                {/* Trustpilot toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formTrustpilotReviewed}
                    onChange={(e) => setFormTrustpilotReviewed(e.target.checked)}
                    disabled={saving}
                    style={{ cursor: 'pointer' }}
                  />
                  Trustpilot
                </label>
                {/* Churn reason — only relevant when inactive */}
                <input
                  list="churn-reason-suggestions"
                  value={formChurnReason}
                  onChange={(e) => setFormChurnReason(e.target.value)}
                  placeholder="Churn reason (optional)"
                  disabled={saving}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)', borderRadius: '6px',
                    padding: '6px 10px', color: 'var(--text-primary)', outline: 'none',
                    fontSize: '11px', minWidth: '160px',
                  }}
                />
                <datalist id="churn-reason-suggestions">
                  <option value="Price" />
                  <option value="Not seeing results" />
                  <option value="Poor service" />
                  <option value="Competitor" />
                  <option value="Internal decision" />
                  <option value="Unknown" />
                </datalist>
              </div>
            </div>
          )}

          {linkedGroups.length > 1 && (
            <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                All linked Telegram groups ({linkedGroups.length})
              </div>
              {linkedGroups.map((g) => (
                <div key={g.chat_id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                  <TelegramBadge chatId={g.chat_id} title={g.chat_title} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{g.chat_title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products section */}
        <div>
          {mode === 'view' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', margin: 0 }}>Outstanding & Latest Products</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {displayProducts.length > 0 && (
                    <div style={{ fontSize: '15px', fontWeight: '600', color: totalDue > 0 ? 'var(--status-cut)' : 'var(--status-active)' }}>
                      Total Debt: {formatCurrency(totalDue)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#14b8a6',
                      border: '1px solid #14b8a6',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    + Add Product
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayProducts.length > 0 ? displayProducts.map((product, idx) => {
                  const productDue = calculateProductDue(product);
                  const isPaid = product.reference_no && product.reference_no.trim() !== '';
                  const productKey = `${product.tier || ''}-${product.setup_type || ''}-${idx}`;
                  return (
                    <div key={productKey} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', position: 'relative', border: isPaid ? 'none' : '1px solid var(--status-cut)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Product Type ({product.month})</div>
                          <span className="badge" style={{ backgroundColor: product.visual_status === 'Active' || product.active !== false ? 'var(--status-active-bg)' : 'var(--status-cut-bg)', color: product.visual_status === 'Active' || product.active !== false ? 'var(--status-active)' : 'var(--status-cut)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                            {product.visual_status === 'Active' || product.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <ProductBadge tier={product.tier} setup_type={product.setup_type} />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Amount Due</div>
                        <div style={{ fontWeight: '700', color: productDue > 0 ? 'var(--status-cut)' : 'var(--status-active)', fontSize: '16px' }}>
                          {isPaid ? 'PAID' : formatCurrency(productDue)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          (Sub: {product.subscription_fee ? formatCurrency(parseAmount(product.subscription_fee)) : '$0'} / Setup: {product.setup_fee ? formatCurrency(parseAmount(product.setup_fee)) : '$0'})
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
                    </div>
                  );
                }) : (
                  <div style={{ color: 'var(--text-secondary)' }}>No active products found.</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', margin: 0 }}>Products ({formProducts.length})</h3>
                <button
                  type="button"
                  onClick={addProduct}
                  disabled={saving}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#14b8a6',
                    border: '1px solid #14b8a6',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  + Add product
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formProducts.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', padding: '16px' }}>
                    No products. Click "Add product" to add one.
                  </div>
                ) : (
                  formProducts.map((p, idx) => (
                    <ClientFormFields
                      key={p.sr_no || `new-${idx}`}
                      product={p}
                      onChange={(next) => updateProduct(idx, next)}
                      onRemove={() => removeProductAt(idx)}
                      index={idx}
                      isFirst={idx === 0}
                      disabled={saving}
                      headerLabel={`Product #${idx + 1}${p.sr_no ? '' : ' (new)'}`}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Payment history (always read-only) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '16px', margin: 0 }}>Payment History</h3>
            {editingPayment === 'new' ? (
              <button
                type="button"
                onClick={cancelPaymentEdit}
                disabled={saving}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={startAddPayment}
                disabled={saving}
                style={{
                  backgroundColor: 'transparent',
                  color: '#14b8a6',
                  border: '1px solid #14b8a6',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                + Add Manual Payment
              </button>
            )}
          </div>

          {/* Product filter buttons for payment history */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setSelectedPaymentProduct(null)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: selectedPaymentProduct === null ? 'var(--primary-accent)' : 'var(--border-color)',
                backgroundColor: selectedPaymentProduct === null ? 'var(--primary-accent)' : 'transparent',
                color: selectedPaymentProduct === null ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              All Products
            </button>
            {displayProducts.map((product, idx) => {
              const key = `${product.tier || ''}|${product.setup_type || ''}`;
              const isSelected = selectedPaymentProduct === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedPaymentProduct(isSelected ? null : key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--primary-accent)' : 'var(--border-color)',
                    backgroundColor: isSelected ? 'var(--primary-accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  {product.tier || 'Unknown'} {product.setup_type || ''}
                </button>
              );
            })}
          </div>

          {/* Inline payment edit form */}
          {editingPayment && (
            <div style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--primary-accent)' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--primary-accent)' }}>
                {editingPayment === 'new' ? 'Add Manual Payment' : 'Edit Payment Entry'}
              </h4>

              {/* Product selector dropdown */}
              {editingPayment === 'new' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>
                    Link to existing product
                  </label>
                  <select
                    value={selectedProductSrNo}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="new">— New free-form entry —</option>
                    {unpaidProducts.length > 0 && (
                      <>
                        <optgroup label="— Unpaid products (link payment) —">
                          {unpaidProducts.map(p => (
                            <option key={p.sr_no} value={p.sr_no}>
                              {p.tier || 'Unknown'} {p.setup_type || ''} ({p.month || 'No period'}) - Due: {p.subscription_fee || '0'}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                    <optgroup label="— All products —">
                      {activeProducts.map(p => (
                        <option key={p.sr_no} value={p.sr_no}>
                          {p.tier || 'Unknown'} {p.setup_type || ''} ({p.month || 'No period'}) - {p.reference_no ? '✓ Paid' : '○ Unpaid'}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Period *</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={manualPaymentForm.month?.split('-')[0] || ''}
                      onChange={(e) => setManualPaymentForm(prev => ({ ...prev, month: `${e.target.value}-${prev.month?.split('-')[1] || '2026'}` }))}
                      disabled={saving}
                      style={{
                        flex: 1, backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)', borderRadius: '6px',
                        padding: '8px 10px', color: 'var(--text-primary)',
                        outline: 'none', fontSize: '13px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">Month</option>
                      {MONTH_OPTIONS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={manualPaymentForm.month?.split('-')[1] || ''}
                      onChange={(e) => setManualPaymentForm(prev => ({ ...prev, month: `${prev.month?.split('-')[0] || 'Jun'}-${e.target.value}` }))}
                      disabled={saving}
                      style={{
                        flex: 1, backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)', borderRadius: '6px',
                        padding: '8px 10px', color: 'var(--text-primary)',
                        outline: 'none', fontSize: '13px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">Year</option>
                      {YEAR_OPTIONS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Product Tier</label>
                  <select
                    value={manualPaymentForm.tier}
                    onChange={handlePaymentTierChange}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">— Select tier —</option>
                    {TIER_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Setup Type</label>
                  <select
                    value={manualPaymentForm.setup_type}
                    onChange={handlePaymentSetupTypeChange}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">— Select type —</option>
                    {SETUP_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Referral Partner</label>
                  <select
                    value={manualPaymentForm.referral_partner_name || ''}
                    onChange={handlePaymentReferralPartnerChange}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">— Select partner —</option>
                    {REFERRAL_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Subscription Fee</label>
                  <input
                    type="text"
                    value={manualPaymentForm.subscription_fee}
                    onChange={(e) => {
                      const newSub = e.target.value;
                      const updates = { subscription_fee: newSub };
                      // Recalculate discount if referral partner is set
                      if (manualPaymentForm.referral_partner_name && newSub) {
                        const discountPct = Math.abs(WHOP_DISCOUNT_BY_PARTNER[manualPaymentForm.referral_partner_name] || 0);
                        if (discountPct > 0) {
                          updates.discount = String(Math.round(parseFloat(newSub) * discountPct / 100));
                        }
                      }
                      setManualPaymentForm(prev => ({ ...prev, ...updates }));
                    }}
                    placeholder="e.g. 100"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Setup Fee</label>
                  <input
                    type="text"
                    value={manualPaymentForm.setup_fee || ''}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, setup_fee: e.target.value }))}
                    placeholder="e.g. 0"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Discount</label>
                  <input
                    type="text"
                    value={manualPaymentForm.discount || ''}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, discount: e.target.value }))}
                    placeholder="e.g. 0"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Bank</label>
                  <select
                    value={manualPaymentForm.bank_name}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, bank_name: e.target.value }))}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">— Select bank —</option>
                    {BANK_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Amount Received</label>
                  <input
                    type="text"
                    value={manualPaymentForm.amount_received}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, amount_received: e.target.value }))}
                    placeholder="e.g. 100"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Payment Date</label>
                  <input
                    type="date"
                    value={manualPaymentForm.payment_received_date}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, payment_received_date: e.target.value }))}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Reference No.</label>
                  <input
                    type="text"
                    value={manualPaymentForm.reference_no}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, reference_no: e.target.value }))}
                    placeholder="e.g. TRX-12345"
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>Valid Until</label>
                  <input
                    type="date"
                    value={manualPaymentForm.valid_stopped_date}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, valid_stopped_date: e.target.value }))}
                    disabled={saving}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      padding: '8px 10px', color: 'var(--text-primary)',
                      outline: 'none', fontSize: '13px',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={cancelPaymentEdit}
                  disabled={saving}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveManualPayment}
                  disabled={saving || !manualPaymentForm.month}
                  style={{
                    backgroundColor: '#14b8a6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: (saving || !manualPaymentForm.month) ? 'not-allowed' : 'pointer',
                    opacity: (saving || !manualPaymentForm.month) ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px' }}>Period</th>
                <th style={{ padding: '8px' }}>Product</th>
                <th style={{ padding: '8px' }}>Bank</th>
                <th style={{ padding: '8px' }}>Valid Until</th>
                <th style={{ padding: '8px' }}>Amount Received</th>
                <th style={{ padding: '8px' }}>Ref.</th>
                <th style={{ padding: '8px' }}>Invoice</th>
                <th style={{ padding: '8px', width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {(selectedPaymentProduct ? (history || []).filter(row => `${row.tier || ''}|${row.setup_type || ''}` === selectedPaymentProduct) : (history || [])).map((row) => {
                const billing = getBillingInfo(row);
                return (
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
                    <td style={{ padding: '12px 8px' }}>
                      <a
                        href={`/api/invoice/generate?sr_no=${encodeURIComponent(row.sr_no || '')}&client_id=${client.id}&client_name=${encodeURIComponent(client.name || '')}&bank_name=${encodeURIComponent(row.bank_name || 'crypto')}&product_name=${encodeURIComponent(row.tier ? row.tier + (row.setup_type ? ' - ' + row.setup_type : '') : 'Service')}&subtotal=${encodeURIComponent(row.subscription_fee ? row.subscription_fee.replace(/[^0-9.]/g, '') : '0')}&discount=${encodeURIComponent(row.discount ? row.discount.replace(/[^0-9.]/g, '') : '0')}&invoice_date=${encodeURIComponent(row.payment_received_date || new Date().toISOString().split('T')[0])}&invoice_no=${encodeURIComponent(row.sr_no ? row.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001')}&first_name=${encodeURIComponent(billing.firstName)}&last_name=${encodeURIComponent(billing.lastName)}&email=${encodeURIComponent(billing.email)}&address=${encodeURIComponent(billing.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px', borderRadius: '4px', border: 'none',
                          backgroundColor: 'var(--primary-accent)', color: '#fff',
                          fontSize: '11px', fontWeight: '500', textDecoration: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        📥 PDF
                      </a>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <button
                        type="button"
                        onClick={() => startEditPayment(row)}
                        disabled={saving || editingPayment !== null}
                        title="Edit payment"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#14b8a6',
                          border: '1px solid #14b8a6',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          cursor: (saving || editingPayment !== null) ? 'not-allowed' : 'pointer',
                          opacity: (saving || editingPayment !== null) ? 0.5 : 1,
                        }}
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Edit-mode footer: error + Save/Cancel */}
        {mode === 'edit' && (
          <>
            {error && (
              <div style={{
                backgroundColor: 'var(--status-cut-bg)',
                color: 'var(--status-cut)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
              }}>
                {error}
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '12px',
              borderTop: '1px solid var(--border-color)', paddingTop: '16px',
            }}>
              <button type="button" onClick={cancelEdit} disabled={saving} style={secondaryBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving || !isDirty}
                style={{
                  ...primaryBtn,
                  opacity: (saving || !isDirty) ? 0.5 : 1,
                  cursor: (saving || !isDirty) ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
