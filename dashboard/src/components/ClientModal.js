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
const BANK_OPTIONS = ['Crypto', 'LHV', 'Slash Bank', 'WHOP'];
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
    is_trial: false,
  };
}

export default function ClientModal({ selectedClient, onClose, onSaved }) {
  if (!selectedClient) return null;

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Calculate total amount due: subscription_fee + setup_fee - discount
  const calcTotalDue = (row) => {
    const sub = parseFloat(String(row.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
    const setup = parseFloat(String(row.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
    const disc = parseFloat(String(row.discount || '0').replace(/[^0-9.]/g, '')) || 0;
    return Math.max(0, sub + setup - disc);
  };

  const { client, history } = selectedClient;
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'products' | 'payments'

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
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceToast, setInvoiceToast] = useState(null); // { type: 'success'|'error', message: '' }
  const [sendingRowSrNo, setSendingRowSrNo] = useState(null); // tracks which row is sending
  const [deletedPaymentSrNos, setDeletedPaymentSrNos] = useState([]); // tracks deleted payments for display

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

  // Reset deletedPaymentSrNos when selectedClient changes (e.g. after parent refetch)
  useEffect(() => {
    setDeletedPaymentSrNos([]);
  }, [selectedClient?.client?.id]);

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
        is_trial: Boolean(h.is_trial),
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
    // Trial products have $0 due
    if (p.is_trial === true || p.is_trial === 1) return 0;
    const sub = parseAmount(p.subscription_fee);
    const setup = parseAmount(p.setup_fee);
    const disc = parseAmount(p.discount);
    const received = parseAmount(p.amount_received);
    const due = (sub + setup) - disc - received;
    return Math.max(0, due);
  };

  // Deduplicate products by tier + setup_type combination (one card per unique product)
  // Use formProducts when in edit mode (has latest saved data), otherwise use history
  const productSource = mode === 'edit' ? formProducts : (history || []);
  const uniqueProductsMap = {};
  productSource.forEach(p => {
    const key = `${p.tier || ''}|${p.setup_type || ''}|${p.sr_no || ''}`;
    if (key !== '||' && !uniqueProductsMap[key]) {
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
        is_trial: Boolean(h.is_trial),
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

  const deletePayment = async (row) => {
    if (!window.confirm(`Delete payment for ${row.month}?`)) return;
    // Optimistically remove from display
    setDeletedPaymentSrNos(prev => [...prev, row.sr_no]);
    // Mark for removal in API call
    setRemovedSrNos(prev => [...prev, row.sr_no]);
    setFormProducts(prev => prev.filter(p => p.sr_no !== row.sr_no));
    // Trigger parent refetch
    onSaved && onSaved();
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
        // Auto-generate month from payment_received_date if not set
        const monthFromDate = manualPaymentForm.month || (manualPaymentForm.payment_received_date
          ? new Date(manualPaymentForm.payment_received_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-')
          : '');
        // If linked to existing product, update that product
        if (selectedProductSrNo && selectedProductSrNo !== 'new') {
          updatedProducts = formProducts.map((p) => {
            if (p.sr_no === selectedProductSrNo) {
              return {
                ...p,
                month: monthFromDate,
                bank_name: manualPaymentForm.bank_name,
                amount_received: manualPaymentForm.amount_received,
                payment_received_date: manualPaymentForm.payment_received_date,
                payment_received_month: monthFromDate,
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
        } else {
          // Create new product for manual entry
          const newProduct = {
            tier: manualPaymentForm.tier || '',
            setup_type: manualPaymentForm.setup_type || '',
            month: monthFromDate,
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
            payment_received_month: monthFromDate,
            reference_no: manualPaymentForm.reference_no,
            actual_balance_difference: '',
            client_status_history: '',
            notes: 'MANUAL_ENTRY',
            active: true,
          };
          updatedProducts = [...formProducts, newProduct];
        }
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
              tier: manualPaymentForm.tier,
              setup_type: manualPaymentForm.setup_type,
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
      // Re-fetch client to refresh modal
      try {
        const refetch = await fetch(`/api/clients/${client.id}`);
        if (refetch.ok) {
          const fresh = await refetch.json();
          // Update local state with fresh data FIRST
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
          // Then notify parent (triggers re-render with fresh history)
          setDeletedPaymentSrNos([]); // reset deleted tracking
          onSaved && onSaved();
        }
      } catch {
        // If refetch fails, still notify parent
        onSaved && onSaved();
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  // Send invoice via Telegram to the linked group
  const sendInvoiceViaTelegram = async (row) => {
    if (invoiceSending) return;
    setInvoiceSending(true);
    setInvoiceToast(null);
    setSendingRowSrNo(row.sr_no);

    try {
      const chatId = client.telegram_group_id;
      if (!chatId) {
        setInvoiceToast({ type: 'error', message: 'No Telegram group linked to this client.' });
        return;
      }

      const billing = getBillingInfo(row);

      // Amount = subscription + setup - discount
      const subAmt = parseFloat(String(row.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
      const setupAmt = parseFloat(String(row.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
      const discAmt = parseFloat(String(row.discount || '0').replace(/[^0-9.]/g, '')) || 0;
      const totalAmt = (subAmt + setupAmt - discAmt).toFixed(2);

      const res = await fetch('/api/bot/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          srNo: row.sr_no,
          clientId: client.id,
          clientName: client.name,
          bankName: row.bank_name || 'crypto',
          productName: row.tier ? row.tier + (row.setup_type ? ' - ' + row.setup_type : '') : 'Service',
          subtotal: totalAmt,
          discount: '0',
          invoiceDate: row.valid_stopped_date || new Date().toISOString().split('T')[0],
          invoiceNo: row.sr_no ? row.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001',
          billing,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInvoiceToast({ type: 'error', message: data.error || 'Failed to send invoice.' });
      } else {
        setInvoiceToast({ type: 'success', message: 'Invoice sent to Telegram group!' });
      }
    } catch (e) {
      setInvoiceToast({ type: 'error', message: e.message || 'Network error.' });
    } finally {
      setInvoiceSending(false);
      setSendingRowSrNo(null);
      setTimeout(() => setInvoiceToast(null), 4000);
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
      // formProducts already contains the saved data - no need to update
      // Just stay in edit mode and let user continue
      setRemovedSrNos([]);
      setSaving(false);
      setError(null);
      // Don't call onSaved or onClose - stay in modal to allow more edits
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
      const fTrial = f.is_trial === true;
      const oTrial = o.is_trial === 1;
      if (fTrial !== oTrial) return true;
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
        <div style={{ paddingRight: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>{client.name}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge" style={{ backgroundColor: client.status === 'Actif' ? 'var(--status-active-bg)' : 'var(--status-cut-bg)', color: client.status === 'Actif' ? 'var(--status-active)' : 'var(--status-cut)', fontSize: '11px', fontWeight: '700' }}>
                  {client.status === 'Actif' ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <TeleIdBadge
                  teleId={client.tele_id}
                  parsedTeleId={parsedTeleId}
                  conflict={teleIdConflict}
                />
                <TelegramBadge chatId={client.telegram_group_id} title="Primary linked group" />
                {computedData?.healthStatus && (
                  <span style={{
                    padding: '2px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: '800',
                    backgroundColor: computedData.healthStatus === 'healthy' ? 'rgba(52, 211, 153, 0.15)' : computedData.healthStatus === 'at_risk' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: computedData.healthStatus === 'healthy' ? '#34D399' : computedData.healthStatus === 'at_risk' ? '#FBBF24' : '#F87171',
                    border: `1px solid ${computedData.healthStatus === 'healthy' ? 'rgba(52, 211, 153, 0.3)' : computedData.healthStatus === 'at_risk' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    textTransform: 'uppercase'
                  }}>
                    {computedData.healthStatus === 'healthy' ? 'Healthy' : computedData.healthStatus === 'at_risk' ? 'At Risk' : 'Critical'}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {mode === 'view' ? (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  style={{
                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                    color: '#14b8a6',
                    border: '1px solid rgba(20, 184, 166, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(20, 184, 166, 0.2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(20, 184, 166, 0.1)'; }}
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'products', label: 'Products' },
              { id: 'payments', label: 'Payments' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: activeTab === tab.id ? 'var(--primary-accent)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--primary-accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {/* Modal Content */}
        <div style={{ flex: 1 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {mode === 'view' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {/* Billing Info Card */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Billing Information
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Full Name</span>
                          <span style={{ fontWeight: '600', fontSize: '13px' }}>{client.first_name} {client.last_name || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Email</span>
                          <span style={{ fontWeight: '600', fontSize: '13px' }}>{client.email || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Address</span>
                          <span style={{ fontWeight: '600', fontSize: '13px', lineHeight: '1.4' }}>{client.address || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Trustpilot</span>
                          <span>{client.trustpilot_reviewed ? '✅ Reviewed' : '❌ Not reviewed'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Insights Card */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Performance Insights
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Total Revenue</span>
                          <span style={{ fontWeight: '700', fontSize: '18px', color: 'var(--primary-accent)' }}>{formatCurrency((history || []).reduce((sum, h) => sum + (parseFloat(String(h.amount_received || '0').replace(/[^0-9.]/g, '')) || 0), 0))}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Total Spend (CL)</span>
                          <span style={{ fontWeight: '700', fontSize: '18px' }}>{formatCurrency(computedData?.totalSpend)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Renewals</span>
                          <span style={{ fontWeight: '700', fontSize: '18px' }}>{computedData?.renewalCount}x</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Stable Client</span>
                          <span style={{ fontWeight: '700', fontSize: '18px' }}>{computedData?.isStable ? '✅ Yes' : '❌ No'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>Relationship Dates</span>
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>Started: <span style={{ fontWeight: '600' }}>{computedData?.earliestStartDate || '—'}</span></div>
                        <div>Next Renewal: <span style={{ fontWeight: '600' }}>{computedData?.latestRenewalDate || '—'}</span></div>
                      </div>
                    </div>
                    {client.status !== 'Actif' && client.churn_reason && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ color: '#F87171', fontSize: '12px', fontWeight: '600' }}>Churn Reason</span>
                        <div style={{ fontSize: '13px', fontWeight: '600', padding: '8px 12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                          {client.churn_reason}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>Contract</span>
                        <label style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', 
                          backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', 
                          fontWeight: '600', cursor: uploadingContract ? 'not-allowed' : 'pointer', border: '1px solid var(--border-color)'
                        }}>
                          {uploadingContract ? 'Uploading...' : 'Upload'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { if (e.target.files?.[0]) uploadContract(e.target.files[0]); }} disabled={uploadingContract} style={{ display: 'none' }} />
                        </label>
                      </div>
                      {client.contract_file_path ? (
                        <a href={client.contract_file_path} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary-accent)', fontWeight: '600', textDecoration: 'none', fontSize: '13px' }}>
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          View Signed Contract
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No contract uploaded</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Overview Tab - Edit Mode */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>
                        Group Name <span style={{ color: 'var(--status-cut)' }}>*</span>
                      </label>
                      <input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        disabled={saving}
                        style={{
                          width: '100%', backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)', borderRadius: '8px',
                          padding: '12px', color: 'var(--text-primary)',
                          outline: 'none', fontSize: '14px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Telegram Group ID</label>
                      <input
                        value={formTelegramGroupId}
                        onChange={(e) => setFormTelegramGroupId(e.target.value)}
                        placeholder="-100..."
                        disabled={saving}
                        style={{
                          width: '100%', backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)', borderRadius: '8px',
                          padding: '12px', color: 'var(--text-primary)',
                          outline: 'none', fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>First Name</label>
                      <input value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} disabled={saving} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Last Name</label>
                      <input value={formLastName} onChange={(e) => setFormLastName(e.target.value)} disabled={saving} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Email</label>
                      <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} disabled={saving} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        disabled={saving}
                        style={{
                          width: '100%', backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)', borderRadius: '8px',
                          padding: '12px', color: 'var(--text-primary)', outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="Actif">Active</option>
                        <option value="inactif">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Address</label>
                    <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} disabled={saving} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formTrustpilotReviewed} onChange={(e) => setFormTrustpilotReviewed(e.target.checked)} disabled={saving} />
                      Trustpilot Reviewed
                    </label>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Churn Reason (if inactive)</label>
                      <input value={formChurnReason} onChange={(e) => setFormChurnReason(e.target.value)} disabled={saving} placeholder="e.g. Price too high" style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Active Products</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Debt</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: totalDue > 0 ? 'var(--status-cut)' : 'var(--status-active)' }}>{formatCurrency(totalDue)}</div>
                  </div>
                  {mode === 'edit' && (
                    <button
                      type="button"
                      onClick={addProduct}
                      disabled={saving}
                      style={{
                        backgroundColor: 'var(--primary-accent)', color: '#000',
                        padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Product
                    </button>
                  )}
                </div>
              </div>

              {mode === 'view' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  {displayProducts.length > 0 ? displayProducts.map((product, idx) => {
                    const productDue = calculateProductDue(product);
                    const isPaid = product.reference_no && product.reference_no.trim() !== '';
                    return (
                      <div key={idx} style={{ 
                        backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '16px', 
                        border: '1px solid var(--border-color)', borderLeft: `6px solid ${isPaid ? 'var(--status-active)' : 'var(--status-cut)'}`,
                        display: 'flex', flexDirection: 'column', gap: '24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                      }}>
                        {/* Top Row: Product Identity & Main Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700' }}>Product Bundle</div>
                            <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} />
                          </div>
                          <div style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: '700' }}>Billing Status</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: productDue > 0 ? 'var(--status-cut)' : 'var(--status-active)' }}>
                              {isPaid ? '✅ Fully Paid' : `⚠️ Due: ${formatCurrency(productDue)}`}
                            </div>
                          </div>
                        </div>

                        {/* Middle Row: Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                          
                          {/* Financial Breakdown */}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💰 Financials</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Subscription</span>
                                <span style={{ fontWeight: '600' }}>{formatCurrency(parseAmount(product.subscription_fee))}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Setup Fee</span>
                                <span style={{ fontWeight: '600' }}>{formatCurrency(parseAmount(product.setup_fee))}</span>
                              </div>
                              {(product.discount || product.cl_amount) && (
                                <>
                                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                                    <span style={{ fontWeight: '600', color: 'var(--status-active)' }}>{product.discount || '—'}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>CL Amount</span>
                                    <span style={{ fontWeight: '600' }}>{product.cl_amount || '—'}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Ad Account */}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📈 Ad Account</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>ID</span>
                                <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{product.ad_id_number || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                                <span style={{ fontWeight: '600' }}>{product.ad_account_type || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Limit</span>
                                <span style={{ fontWeight: '600', color: 'var(--primary-accent)' }}>{product.ad_spend_limit || '—'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Lifecycle & Referral */}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📅 Lifecycle & Referral</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Start Date</span>
                                <span style={{ fontWeight: '600' }}>{product.start_date || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Valid Until</span>
                                <span style={{ fontWeight: '600' }}>{product.valid_stopped_date || '—'}</span>
                              </div>
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Partner</span>
                                <span style={{ fontWeight: '600', color: '#A855F7' }}>{product.referral_partner_name || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Ref. Amount</span>
                                <span style={{ fontWeight: '600' }}>{product.referral_amount || '—'}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                      No active products found for this client.
                    </div>
                  )}
                </div>
              ) : (
                /* Products Tab - Edit Mode */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {formProducts.map((p, idx) => (
                    <ClientFormFields
                      key={idx}
                      product={p}
                      onChange={(next) => updateProduct(idx, next)}
                      onRemove={() => removeProductAt(idx)}
                      index={idx}
                      isFirst={idx === 0}
                      disabled={saving}
                      headerLabel={`Product #${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Payment History</h3>
                <button
                  type="button"
                  onClick={startAddPayment}
                  disabled={saving}
                  style={{
                    backgroundColor: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6',
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(20, 184, 166, 0.2)',
                    fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  + Record Payment
                </button>
              </div>

              {invoiceToast && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: invoiceToast.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: invoiceToast.type === 'success' ? '#34D399' : '#F87171',
                  fontWeight: '500',
                  fontSize: '13px',
                }}>
                  {invoiceToast.message}
                </div>
              )}

              {editingPayment && (
                <div style={{ backgroundColor: 'rgba(0, 242, 181, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(0, 242, 181, 0.2)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--primary-accent)' }}>
                    {editingPayment === 'new' ? 'New Payment Entry' : 'Edit Payment Entry'}
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                    <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Link to product</label>
                      <select value={selectedProductSrNo} onChange={(e) => handleProductSelect(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                        <option value="new">Manual Entry</option>
                        {activeProducts.map(p => (
                          <option key={p.sr_no} value={p.sr_no}>{p.tier} {p.setup_type} ({p.month}) - {p.reference_no ? 'Paid' : 'Unpaid'}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Period</label>
                      <input
                        type="date"
                        value={manualPaymentForm.payment_received_date}
                        onChange={(e) => setManualPaymentForm(prev => ({ ...prev, payment_received_date: e.target.value, month: e.target.value ? new Date(e.target.value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-') : prev.month }))}
                        style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>TIER</label>
                      <select value={manualPaymentForm.tier} onChange={(e) => handlePaymentTierChange(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                        <option value="">Select TIER</option>
                        {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>SETUP</label>
                      <select value={manualPaymentForm.setup_type} onChange={(e) => handlePaymentSetupTypeChange(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                        <option value="">Select SETUP</option>
                        {SETUP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Bank</label>
                      <select value={manualPaymentForm.bank_name} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, bank_name: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                        <option value="">Select Bank</option>
                        {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Amount Received</label>
                      <input type="text" value={manualPaymentForm.amount_received} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, amount_received: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Reference</label>
                      <input type="text" value={manualPaymentForm.reference_no} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, reference_no: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Subscription Fee</label>
                      <input type="text" value={manualPaymentForm.subscription_fee} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, subscription_fee: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Setup Fee</label>
                      <input type="text" value={manualPaymentForm.setup_fee} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, setup_fee: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Discount</label>
                      <input type="text" value={manualPaymentForm.discount} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, discount: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Valid Until</label>
                      <input type="date" value={manualPaymentForm.valid_stopped_date} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, valid_stopped_date: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                    <button type="button" onClick={cancelPaymentEdit} style={{ padding: '8px 16px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>Cancel</button>
                    <button type="button" onClick={saveManualPayment} style={{ padding: '8px 16px', backgroundColor: 'var(--primary-accent)', color: '#000', borderRadius: '8px', fontWeight: '600' }}>Save Payment</button>
                  </div>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 8px' }}>Period</th>
                      <th style={{ padding: '12px 8px' }}>Product</th>
                      <th style={{ padding: '12px 8px' }}>Fees & Disc.</th>
                      <th style={{ padding: '12px 8px' }}>Bank</th>
                      <th style={{ padding: '12px 8px' }}>Amount</th>
                      <th style={{ padding: '12px 8px' }}>Valid Until</th>
                      <th style={{ padding: '12px 8px' }}>Reference</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Invoice</th>
                      <th style={{ padding: '12px 8px', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formProducts.length > 0 ? formProducts : history || []).filter(row => !removedSrNos.includes(row.sr_no) && !deletedPaymentSrNos.includes(row.sr_no)).map((row) => {
                      const billing = getBillingInfo(row);
                      return (
                        <tr key={row.sr_no} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '16px 8px', fontWeight: '600' }}>{row.month}</td>
                          <td style={{ padding: '16px 8px' }}><ProductBadge tier={row.tier} setup_type={row.setup_type} is_trial={row.is_trial} /></td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>Sub: {row.subscription_fee || '0'}</span>
                              {row.setup_fee && <span>Setup: {row.setup_fee}</span>}
                              {row.discount && <span>Disc: {row.discount}</span>}
                            </div>
                          </td>
                          <td style={{ padding: '16px 8px' }}>{row.bank_name || '—'}</td>
                          <td style={{ padding: '16px 8px', color: 'var(--primary-accent)', fontWeight: '700' }}>{row.amount_received}</td>
                          <td style={{ padding: '16px 8px' }}>{row.valid_stopped_date || '—'}</td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{row.reference_no || '—'}</td>
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            <a
                              href={`/api/invoice/generate?sr_no=${encodeURIComponent(row.sr_no || '')}&client_id=${client.id}&client_name=${encodeURIComponent(client.name || '')}&bank_name=${encodeURIComponent(row.bank_name || 'crypto')}&product_name=${encodeURIComponent(row.tier ? row.tier + (row.setup_type ? ' - ' + row.setup_type : '') : 'Service')}&subtotal=${encodeURIComponent((parseFloat(String(row.subscription_fee||'0').replace(/[^0-9.]/g,''))||0 + parseFloat(String(row.setup_fee||'0').replace(/[^0-9.]/g,''))||0).toFixed(2))}&discount=${encodeURIComponent(row.discount || '0')}&invoice_date=${encodeURIComponent(row.valid_stopped_date || new Date().toISOString().split('T')[0])}&invoice_no=${encodeURIComponent(row.sr_no ? row.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001')}&first_name=${encodeURIComponent(billing.firstName)}&last_name=${encodeURIComponent(billing.lastName)}&email=${encodeURIComponent(billing.email)}&address=${encodeURIComponent(billing.address)}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '11px', fontWeight: '600' }}
                            >
                              PDF
                            </a>
                            <button
                              onClick={() => sendInvoiceViaTelegram(row)}
                              disabled={sendingRowSrNo === row.sr_no}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', backgroundColor: sendingRowSrNo === row.sr_no ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.1)', color: sendingRowSrNo === row.sr_no ? '#14b8a6' : '#14b8a6', fontSize: '11px', fontWeight: '600', border: 'none', cursor: sendingRowSrNo === row.sr_no ? 'not-allowed' : 'pointer', marginLeft: '4px' }}
                              title="Send invoice to linked Telegram group"
                            >
                              {sendingRowSrNo === row.sr_no ? '⏳ Sending…' : 'Send'}
                            </button>
                          </td>
                          <td style={{ padding: '16px 8px' }}>
                            <button onClick={() => startEditPayment(row)} style={{ color: 'var(--primary-accent)', cursor: 'pointer', background: 'transparent', marginRight: '8px' }}>✏️</button>
                            <button onClick={() => deletePayment(row)} style={{ color: 'var(--status-cut)', cursor: 'pointer', background: 'transparent' }}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
