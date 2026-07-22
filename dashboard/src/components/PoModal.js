"use client";

import { useEffect, useState, useMemo } from 'react';
import ProductBadge from './ProductBadge';
import TelegramBadge from './TelegramBadge';
import TeleIdBadge from './TeleIdBadge';
import ClientFormFields from './ClientFormFields';
import ChatTab from './ChatTab';
import SpendProgressBar from './SpendProgressBar';
import PonctualUpgradeModal from './PonctualUpgradeModal';
import { extractTeleId } from '@/lib/teleIdParser';
import { WHOP_DISCOUNT_BY_PARTNER, getPartnerDiscount, calculateClientDiscount, calculateReferralCommission } from '@/lib/whopLinks';

// Sub-reason labels for churn reason display
const CHURN_SUB_REASON_LABELS = {
  'customer_service-refund': 'Customer service issue - Refund',
  'customer_service-restriction': 'Customer service issue - Restriction',
  'customer_service-performance': 'Customer service issue - Performance',
  'customer_service-other': 'Customer service issue - Other',
  'client_decision-pause': 'Client decision - Pause',
  'client_decision-silence': 'Client decision - Silence',
  'client_decision-cancellation': 'Client decision - Cancellation',
  'client_decision-contract_end': 'Client decision - Contract end',
  'client_decision-project_stopped': 'Client decision - Project stopped',
  'technical-setup': 'Technical issue - Setup',
  'technical-meta': 'Technical issue - Meta',
  'technical-bm': 'Technical issue - BM',
  'technical-pixel': 'Technical issue - Pixel',
  'technical-other': 'Technical issue - Other',
  'other': 'Other'
};

// SVG Icons in sidebar style (stroke-based, 20x20)
const IconDownload = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
  </svg>
);

const IconTelegram = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const IconEdit = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconRemove = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const IconPlus = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconSend = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

// Section header icons
const IconDollar = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const IconChart = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
);

const IconCalendar = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconCheck = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const IconWarning = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
  </svg>
);

const IconGift = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z" />
  </svg>
);

// Reusable action button component
const ActionBtn = ({ onClick, href, title, icon, color, bgColor, borderColor, asLink = false }) => {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: bgColor || 'transparent',
    color: color || 'var(--text-primary)',
    border: borderColor ? `1px solid ${borderColor}` : 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '0',
  };

  if (asLink) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} style={style}>
        {icon}
      </a>
    );
  }

  return (
    <button onClick={onClick} title={title} style={style}>
      {icon}
    </button>
  );
};

// Constants for dropdowns
const TIER_OPTIONS = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
const SETUP_OPTIONS = ['Invincible set up (old)', 'Starter', 'Premium', 'VIP'];
const BANK_OPTIONS = ['Crypto - USDT TRC20', 'Crypto - USDT ERC20', 'Crypto - BTC', 'LHV', 'Slash Bank', 'WHOP'];
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

export default function ClientModal({ selectedClient, onClose, onSaved, tierProducts = [], setupProducts = [] }) {
  if (!selectedClient) return null;

  const { client, history } = selectedClient;

  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const parseAmount = (val) => {
    if (!val) return 0;
    const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Calculate total amount due: subscription_fee + setup_fee - discount
  const calcTotalDue = (row) => {
    const sub = parseFloat(String(row.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
    const setup = parseFloat(String(row.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
    const disc = parseFloat(String(row.discount || '0').replace(/[^0-9.]/g, '')) || 0;
    return Math.max(0, sub + setup - disc);
  };

  const [linkedGroups, setLinkedGroups] = useState([]);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'products' | 'payments'

  // Ponctual upgrade modal
  const [showPonctualUpgradeModal, setShowPonctualUpgradeModal] = useState(false);
  const [ponctualUpgradeProduct, setPonctualUpgradeProduct] = useState(null);

  // Helper to build invoice URL for a payment
  const buildInvoiceUrl = (payment, product, billing) => {
    const isTopup = payment.is_topup === 1;
    const productName = isTopup ? 'Top-Up' : (payment.tier ? payment.tier + (payment.setup_type ? ' - ' + payment.setup_type : '') : 'Service');
    const parseMoney = (val) => parseFloat(String(val || '0').replace(/[^0-9.]/g, '')) || 0;
    const subTotal = isTopup
      ? parseMoney(payment.amount_received)
      : parseMoney(product?.subscription_fee) + parseMoney(product?.setup_fee);
    const disc = isTopup ? 0 : parseMoney(product?.discount);
    const params = new URLSearchParams({
      sr_no: isTopup ? '' : (payment.renewal_sr_no || ''),
      client_id: client.id || '',
      client_name: client.name || '',
      bank_name: payment.bank_name || 'crypto',
      product_name: productName,
      subtotal: subTotal.toFixed(2),
      discount: disc.toFixed(2),
      invoice_date: product?.valid_stopped_date || new Date().toISOString().split('T')[0],
      invoice_no: payment.renewal_sr_no ? String(payment.renewal_sr_no).replace(/\D/g, '').slice(-4) || '001' : '001',
      first_name: billing.firstName || '',
      last_name: billing.lastName || '',
      email: billing.email || '',
      address: billing.address || '',
      amount_received: payment.amount_received || '0',
    });
    return '/api/invoice/generate?' + params.toString();
  };

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
  const [formReferralPartner, setFormReferralPartner] = useState(client?.referral_partner_name || 'N.A.');
  const [uploadingContract, setUploadingContract] = useState(false);
  const [computedData, setComputedData] = useState(selectedClient?.computed || null);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceToast, setInvoiceToast] = useState(null); // { type: 'success'|'error', message: '' }
  const [sendingRowSrNo, setSendingRowSrNo] = useState(null); // tracks which row is sending
  const [deletedPaymentSrNos, setDeletedPaymentSrNos] = useState([]); // tracks deleted payments for display

  // New client enrichment fields
  const [formCompanyName, setFormCompanyName] = useState(client?.company_name || '');
  const [formCompanyNumber, setFormCompanyNumber] = useState(client?.company_number || '');
  const [formLandingPages, setFormLandingPages] = useState(client?.landing_pages ? (typeof client.landing_pages === 'string' ? JSON.parse(client.landing_pages) : client.landing_pages) : []);
  const [formCreativeUrl, setFormCreativeUrl] = useState(client?.creative_url || '');
  const [formCreativeFiles, setFormCreativeFiles] = useState(client?.creative_files ? (typeof client.creative_files === 'string' ? JSON.parse(client.creative_files) : client.creative_files) : []);
  const [formClientOwner, setFormClientOwner] = useState(client?.client_owner || '');
  const [formNotes, setFormNotes] = useState(client?.notes || '');
  const [uploadingCreative, setUploadingCreative] = useState(false);

  // Refetch client detail to get fresh history (especially for ponctual upgrade badges) when modal opens
  useEffect(() => {
    if (!client?.id) return;
    fetch(`/api/clients/${client.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.computed) setComputedData(data.computed);
        // Update formProducts with fresh history data (includes is_ponctual_upgrade, original_tier, etc.)
        if (data.history) {
          setFormProducts(
            data.history.map((h) => ({
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
              is_ponctual_upgrade: h.is_ponctual_upgrade,
              original_tier: h.original_tier || '',
              original_setup: h.original_setup || '',
              upgrade_chain_json: h.upgrade_chain_json || '',
            }))
          );
        }
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
        onSaved && onSaved(client.id);
      }
    } catch {}
    finally { setUploadingContract(false); }
  };

  const uploadCreative = async (file) => {
    if (!file || saving) return;
    setUploadingCreative(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/clients/${client.id}/creative`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        setFormCreativeFiles(data.files);
        onSaved && onSaved();
      }
    } catch {}
    finally { setUploadingCreative(false); }
  };

  const deleteCreative = async (path) => {
    try {
      const res = await fetch(`/api/clients/${client.id}/creative?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setFormCreativeFiles(data.files);
        onSaved && onSaved();
      }
    } catch {}
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
    whop_product_payments_json: '[]',
    transaction_type: 'MONTHLY', // MONTHLY, UPGRADE, SUB_UPGRADE, RENEWAL_PONCTUAL, RETURN, PROMOTION
    from_tier: '',
    to_tier: '',
    to_setup: '',
    prorata_amount: '',
  });

  // Active products from history for dropdown selection
  const activeProducts = (history || []).filter(p => p.visual_status === 'Active' || p.active !== false);

  // Individual payments for Payment History tab (from payments table)
  const [clientPayments, setClientPayments] = useState([]);

  // Fetch individual payments when payments/products tab is active or client changes
  useEffect(() => {
    if ((activeTab === 'payments' || activeTab === 'products') && client?.id) {
      setClientPayments([]); // clear first to avoid showing stale data
      // Add cache-bust to prevent stale data
      const cacheBust = Date.now();
      fetch(`/api/payments?client_id=${client.id}&_cb=${cacheBust}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setClientPayments(data);
          }
        })
        .catch(err => console.error('Error fetching payments:', err));
    }
  }, [activeTab, client?.id]);

  // Build unified payment list: new payments table + old renewals payments + transactions
  // Both sources combined for complete payment history
  const allDisplayPayments = useMemo(() => {
    const rows = [];

    // 1. New payments from payments table
    clientPayments.forEach(p => {
      rows.push({
        key: `new-${p.id}`,
        id: p.id,
        renewal_sr_no: p.renewal_sr_no,
        month: p.payment_received_month || p.period || '',
        tier: p.tier || '',
        setup_type: p.setup_type || '',
        subscription_fee: p.subscription_fee || '',
        setup_fee: p.setup_fee || '',
        discount: p.discount || '',
        valid_stopped_date: p.valid_stopped_date || '',
        bank_name: p.bank_name || '',
        amount_received: p.amount_received || '',
        reference_no: p.reference_no || '',
        payment_received_date: p.payment_received_date || '',
        is_topup: p.is_topup || 0,
        source: 'new',
      });
    });

    // 2. Old payments from renewals (no entry in payments table but has ref or amount)
    const newPaymentSrNos = new Set(clientPayments.map(p => p.renewal_sr_no));
    (history || []).forEach(h => {
      const amt = h.amount_received ? parseFloat(h.amount_received.toString().replace(/[^0-9.-]+/g, '')) || 0 : 0;
      const hasOldPayment = (h.reference_no && h.reference_no.trim() !== '') || amt > 0;
      if (hasOldPayment && !newPaymentSrNos.has(h.sr_no)) {
        rows.push({
          key: `old-${h.sr_no}`,
          id: null,
          renewal_sr_no: h.sr_no,
          month: h.month || '',
          tier: h.tier || '',
          setup_type: h.setup_type || '',
          subscription_fee: h.subscription_fee || '',
          setup_fee: h.setup_fee || '',
          discount: h.discount || '',
          valid_stopped_date: h.valid_stopped_date || '',
          bank_name: h.bank_name || '',
          amount_received: h.amount_received || '',
          reference_no: h.reference_no || '',
          payment_received_date: h.payment_received_date || '',
          is_topup: 0,
          source: 'old',
        });
      }
    });

    // Sort by payment date descending
    rows.sort((a, b) => {
      const da = a.payment_received_date ? new Date(a.payment_received_date) : new Date(0);
      const db = b.payment_received_date ? new Date(b.payment_received_date) : new Date(0);
      return db - da;
    });

    return rows;
  }, [clientPayments, history]);

  // Calculate total referral commission: sum of per-product commissions
  const totalReferralCommission = useMemo(() => {
    const rates = { 'Chris': 10, 'No Limit': 2.5, '8 Labs': 2.5, 'Master': 5 };
    let total = 0;
    (history || []).forEach(r => {
      const partner = r.referral_partner_name;
      if (!partner || partner === 'N.A.') return;
      const rate = rates[partner] || 0;
      if (rate === 0) return;
      const base = (parseFloat(r.subscription_fee) || 0) + (parseFloat(r.setup_fee) || 0);
      total += Math.round(base * rate / 100);
    });
    return total;
  }, [history]);

  // Selected product filter for payment history view
  const [selectedPaymentProduct, setSelectedPaymentProduct] = useState(null); // null = all products

  // Unpaid products - for linking payments
  // A product is paid if it has BOTH a reference_no AND amount_received > 0
  const unpaidProducts = (history || []).filter(p => {
    const hasRef = p.reference_no && p.reference_no.trim() !== '';
    const hasAmount = parseAmount(p.amount_received) > 0;
    const isPaid = hasRef || hasAmount;
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
    setFormReferralPartner(client.referral_partner_name || 'N.A.');
    setFormCompanyName(client.company_name || '');
    setFormCompanyNumber(client.company_number || '');
    setFormLandingPages(client.landing_pages ? (typeof client.landing_pages === 'string' ? JSON.parse(client.landing_pages) : client.landing_pages) : []);
    setFormCreativeUrl(client.creative_url || '');
    setFormCreativeFiles(client.creative_files ? (typeof client.creative_files === 'string' ? JSON.parse(client.creative_files) : client.creative_files) : []);
    setFormClientOwner(client.client_owner || '');
    setFormNotes(client.notes || '');
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
        current_spend: h.current_spend || '0',
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
  }, [client?.id, client?.name, client?.first_name, client?.last_name, client?.email, client?.address, client?.telegram_group_id, client?.status, client?.company_name, client?.company_number, client?.landing_pages, client?.creative_url, client?.creative_files, client?.client_owner, client?.notes, history]);

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

  const calculateProductDue = (p) => {
    // Trial products have $0 due
    if (p.is_trial === true || p.is_trial === 1) return 0;
    const sub = parseAmount(p.subscription_fee);
    const setup = parseAmount(p.setup_fee);
    const disc = parseAmount(p.discount);
    const received = parseAmount(p.amount_received);
    let totalDue = (sub + setup) - disc;
    // For ponctual upgrades: expected payment is the prorata (difference from original tier), not full price
    if (p.is_ponctual_upgrade == 1 && p.original_tier) {
      const originalSub = parseAmount(TIER_PRICING[p.original_tier] || '0');
      const prorata = Math.max(0, sub - originalSub);
      totalDue = prorata; // Only the prorata is due, not the full subscription
    }
    // If received >= total due, it's fully paid
    if (received >= totalDue) return 0;
    // Otherwise return what's still due
    return Math.max(0, totalDue - received);
  };

  // Get billing status for a product
  const getProductBillingStatus = (p) => {
    if (p.is_trial === true || p.is_trial === 1) return { status: 'TRIAL', color: '#A78BFA' };
    const sub = parseAmount(p.subscription_fee);
    const setup = parseAmount(p.setup_fee);
    const disc = parseAmount(p.discount);
    const received = parseAmount(p.amount_received);
    const totalDue = (sub + setup) - disc;
    // For ponctual upgrades: prorata is the expected amount for month 1, not the full subscription
    if (p.is_ponctual_upgrade == 1) {
      // If received equals the prorata (approximated as difference from original tier), consider it PAID
      const originalSub = parseAmount(p.original_tier ? TIER_PRICING[p.original_tier] || 0 : 0);
      const prorataExpected = Math.max(0, sub - originalSub);
      if (received >= prorataExpected && prorataExpected > 0) return { status: 'FULLY PAID', color: '#10B981' };
      if (received > 0) return { status: 'PARTIALLY PAID', color: '#F59E0B' };
      return { status: 'UNPAID', color: '#EF4444' };
    }
    if (received >= totalDue) return { status: 'FULLY PAID', color: '#10B981' };
    if (received > 0) return { status: 'PARTIALLY PAID', color: '#F59E0B' };
    return { status: 'UNPAID', color: '#EF4444' };
  };

  // Deduplicate products by tier + setup_type combination (one card per unique product)
  // Always prefer formProducts (has latest saved data), fall back to history only if empty
  const productSource = formProducts.length > 0 ? formProducts : (history || []);
  const uniqueProductsMap = {};
  productSource.forEach(p => {
    const key = `${p.tier || ''}|${p.setup_type || ''}|${p.sr_no || ''}`;
    if (key !== '||' && !uniqueProductsMap[key]) {
      uniqueProductsMap[key] = p;
    }
  });
  const displayProducts = Object.values(uniqueProductsMap).sort((a, b) => {
    // Sort by start_date descending (most recent first)
    // Products with no start_date (new/unsaved) go to the top
    if (!a.start_date && b.start_date) return -1;
    if (a.start_date && !b.start_date) return 1;
    const dateA = a.start_date ? new Date(a.start_date) : new Date(9999, 11, 31);
    const dateB = b.start_date ? new Date(b.start_date) : new Date(9999, 11, 31);
    return dateB - dateA;
  });


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
    setFormProducts((prev) => [emptyProduct(), ...prev]);
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
    setFormReferralPartner(client?.referral_partner_name || 'N.A.');
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
        is_ponctual_upgrade: h.is_ponctual_upgrade,
        original_tier: h.original_tier || '',
        original_setup: h.original_setup || '',
        upgrade_chain_json: h.upgrade_chain_json || '',
      }))
    );
  };

  // Manual payment entry handlers
  const startAddPayment = () => {
    setEditingPayment('new');
    setSelectedProductSrNo('');
    // Prefill partner from first active product
    const firstActive = activeProducts[0] || {};
    const prefilledPartner = firstActive.referral_partner_name || '';
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
      referral_partner_name: prefilledPartner,
      valid_stopped_date: '',
      is_topup: false,
      whop_product_payments_json: '[]',
    });
  };

  // Handle tier change - auto-fill subscription_fee and recalculate discount on (sub + setup)
  const handlePaymentTierChange = (val) => {
    const updates = { tier: val };
    if (TIER_PRICING[val]) {
      updates.subscription_fee = TIER_PRICING[val];
    }
    // Recalculate discount if referral partner is set: 15% of (subscription + setup)
    const currentForm = manualPaymentForm;
    const newSub = updates.subscription_fee || currentForm.subscription_fee;
    const currentSetup = currentForm.setup_fee;
    if (currentForm.referral_partner_name) {
      updates.discount = String(calculateClientDiscount(currentForm.referral_partner_name, newSub, currentSetup));
      // Also recalculate referral_amount
      const rates = { 'Chris': 10, 'No Limit': 2.5, '8 Labs': 2.5, 'Master': 5 };
      const rate = rates[currentForm.referral_partner_name] || 0;
      if (rate > 0) {
        const baseAmount = (parseFloat(newSub) || 0) + (parseFloat(currentSetup) || 0) - (parseFloat(updates.discount) || 0);
        updates.referral_amount = String(Math.round(baseAmount * rate / 100));
      }
    }
    setManualPaymentForm(prev => ({ ...prev, ...updates }));
  };

  // Handle setup type change - auto-fill setup_fee and recalculate discount
  const handlePaymentSetupTypeChange = (val) => {
    const updates = { setup_type: val };
    if (SETUP_PRICING[val]) {
      updates.setup_fee = SETUP_PRICING[val];
    }
    // Recalculate discount if referral partner is set: 15% of (subscription + setup)
    const currentForm = manualPaymentForm;
    if (currentForm.referral_partner_name) {
      const currentSub = currentForm.subscription_fee;
      const newSetup = updates.setup_fee || currentForm.setup_fee;
      updates.discount = String(calculateClientDiscount(currentForm.referral_partner_name, currentSub, newSetup));
      // Also recalculate referral_amount
      const rates = { 'Chris': 10, 'No Limit': 2.5, '8 Labs': 2.5, 'Master': 5 };
      const rate = rates[currentForm.referral_partner_name] || 0;
      if (rate > 0) {
        const baseAmount = (parseFloat(currentSub) || 0) + (parseFloat(newSetup) || 0) - (parseFloat(updates.discount) || 0);
        updates.referral_amount = String(Math.round(baseAmount * rate / 100));
      }
    }
    setManualPaymentForm(prev => ({ ...prev, ...updates }));
  };

  // Handle referral partner change - auto-fill discount as 15% of (subscription + setup)
  // and referral_amount as (subscription + setup - discount) × rate
  const handlePaymentReferralPartnerChange = (val) => {
    const updates = { referral_partner_name: val };
    const currentSub = manualPaymentForm.subscription_fee;
    const currentSetup = manualPaymentForm.setup_fee;
    updates.discount = String(calculateClientDiscount(val, currentSub, currentSetup));
    // Auto-calculate referral_amount for partners with commission
    const rates = { 'Chris': 10, 'No Limit': 2.5, '8 Labs': 2.5, 'Master': 5 };
    const rate = rates[val] || 0;
    if (rate > 0) {
      const baseAmount = (parseFloat(currentSub) || 0) + (parseFloat(currentSetup) || 0) - (parseFloat(updates.discount) || 0);
      updates.referral_amount = String(Math.round(baseAmount * rate / 100));
    } else {
      updates.referral_amount = '';
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
        whop_product_payments_json: '[]',
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
          referral_partner_name: product.referral_partner_name || '',
          referral_amount: product.referral_amount || '',
          whop_product_payments_json: product.whop_product_payments_json || '[]',
        });
      }
    }
  };

  // Ponctual upgrade handlers
  const handleRenewPonctual = async (srNo) => {
    if (!window.confirm('Renew this ponctual upgrade for 1 more month?')) return;
    try {
      const res = await fetch(`/api/renewals/${encodeURIComponent(srNo)}/renewal-ponctual`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to renew');
      // Refresh client data
      onClientUpdated && onClientUpdated();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleReturnToOriginal = async (srNo) => {
    if (!window.confirm('Return to the original monthly product? This will end the ponctual upgrade.')) return;
    try {
      const res = await fetch(`/api/renewals/${encodeURIComponent(srNo)}/return-to-original`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to return');
      // Refresh client data
      onClientUpdated && onClientUpdated();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handlePromotePonctual = async (srNo) => {
    if (!window.confirm('Make this ponctual upgrade permanent? The new tier will become the client\'s regular subscription.')) return;
    try {
      const res = await fetch(`/api/renewals/${encodeURIComponent(srNo)}/promote-ponctual`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to promote');
      // Refresh client data
      onClientUpdated && onClientUpdated();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const startEditPayment = (payment) => {
    // Find the linked product to get full product details
    const product = history?.find(h => h.sr_no === payment.renewal_sr_no);
    setEditingPayment({ srNo: payment.renewal_sr_no, row: payment });
    setSelectedProductSrNo(payment.renewal_sr_no || '');
    setManualPaymentForm({
      transaction_type: payment.type || 'MONTHLY',
      month: payment.payment_received_month || payment.period || '',
      bank_name: payment.bank_name || '',
      amount_received: payment.amount_received || '',
      payment_received_date: payment.payment_received_date || '',
      reference_no: payment.reference_no || '',
      tier: payment.from_tier || product?.tier || payment.tier || '',
      setup_type: payment.from_setup || product?.setup_type || payment.setup_type || '',
      to_tier: payment.to_tier || '',
      to_setup: payment.to_setup || '',
      prorata_amount: payment.prorata_amount || '',
      subscription_fee: product?.subscription_fee || '',
      setup_fee: product?.setup_fee || '',
      discount: product?.discount || '',
      valid_stopped_date: payment.valid_until_date || product?.valid_stopped_date || '',
      whop_product_payments_json: payment.whop_product_payments_json || product?.whop_product_payments_json || '[]',
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

  // Delete a payment entry from the payments table
  const deletePaymentEntry = async (payment) => {
    if (!window.confirm('Delete this payment entry?')) return;
    try {
      // Determine if this is a transaction or a regular payment
      const isTransaction = payment.type && payment.type !== 'MONTHLY' && payment.is_transaction;
      const id = payment.id;

      console.log('DEBUG deletePaymentEntry:', {
        isTransaction,
        id,
        paymentId: payment.id,
        paymentType: payment.type,
        isTransactionFlag: payment.is_transaction,
        renewal_sr_no: payment.renewal_sr_no,
        url: isTransaction ? `/api/renewals/${encodeURIComponent(payment.renewal_sr_no)}/transactions/${id}` : `/api/payments/${id}`
      });

      let res;
      if (isTransaction) {
        // Delete from payment_transactions
        res = await fetch(`/api/renewals/${encodeURIComponent(payment.renewal_sr_no)}/transactions/${id}`, {
          method: 'DELETE',
        });
      } else {
        // Delete from payments table
        res = await fetch(`/api/payments/${id}`, {
          method: 'DELETE',
        });
      }

      if (res.ok) {
        // Optimistically remove from clientPayments state
        setClientPayments(prev => prev.filter(p => p.id !== payment.id));
        // Refresh client data
        onSaved && onSaved(client.id);
      }
    } catch (err) {
      console.error('Error deleting payment:', err);
    }
  };

  // Delete an old payment stored directly in renewals table
  const deleteOldRenewalPayment = async (srNo) => {
    if (!window.confirm('Delete this payment? This will mark the product as unpaid.')) return;
    try {
      const res = await fetch(`/api/renewals/${encodeURIComponent(srNo)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        // Mark this sr_no as deleted so it disappears from the list
        setDeletedPaymentSrNos(prev => [...prev, srNo]);
        // Also refresh the client data to update totals
        onSaved && onSaved(client.id);
      }
    } catch (err) {
      console.error('Error deleting old payment:', err);
    }
  };

  const cancelPaymentEdit = () => {
    setEditingPayment(null);
    setSelectedProductSrNo('');
    setManualPaymentForm(prev => ({
      ...prev,
      whop_product_payments_json: '[]',
    }));
  };

  const saveManualPayment = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);

    try {
      // Auto-generate month from payment_received_date if not set
      const monthFromDate = manualPaymentForm.month || (manualPaymentForm.payment_received_date
        ? new Date(manualPaymentForm.payment_received_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-')
        : '');

      // Determine the renewal_sr_no to link the payment to
      let renewalSrNo = selectedProductSrNo;

      if (!renewalSrNo || renewalSrNo === 'new') {
        setError('Please select a product to link this payment to, or create a product first.');
        setSaving(false);
        return;
      }

      const isEditing = editingPayment && editingPayment !== 'new' && (editingPayment.row?.id || editingPayment.row?.renewal_sr_no);
      const isTransaction = editingPayment?.row?.type && editingPayment.row.type !== 'MONTHLY' && editingPayment.row?.id;

      // DEBUG
      console.log('DEBUG saveManualPayment:', {
        isEditing,
        isTransaction,
        rowId: editingPayment?.row?.id,
        rowType: editingPayment?.row?.type,
        renewalSrNo
      });

      // For UPGRADE (Ponctual), we don't create a payment entry - the upgrade-ponctual API creates the new renewal
      // For other types (MONTHLY, TOPUP, RETURN, etc.), we create a payment entry
      if (manualPaymentForm.transaction_type !== 'UPGRADE' && manualPaymentForm.transaction_type !== 'UPGRADE_PERMANENT') {
        if (isEditing && isTransaction) {
          // Editing a transaction - use the transactions API
          const res = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions/${editingPayment.row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: manualPaymentForm.transaction_type,
              from_tier: manualPaymentForm.tier || null,
              from_setup: manualPaymentForm.setup_type || null,
              to_tier: manualPaymentForm.to_tier || null,
              to_setup: manualPaymentForm.to_setup || null,
              prorata_amount: manualPaymentForm.prorata_amount || null,
              amount: manualPaymentForm.amount_received || null,
              date: manualPaymentForm.payment_received_date || '',
              until_date: manualPaymentForm.valid_stopped_date || null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || `Request failed (${res.status})`);
            setSaving(false);
            return;
          }
        } else {
          // Use PUT for editing, POST for creating regular payments
          const url = isEditing ? `/api/payments/${editingPayment.row.id}` : '/api/payments';
          const method = isEditing ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: client.id,
              renewal_sr_no: renewalSrNo,
              amount_received: manualPaymentForm.amount_received || '0',
              payment_received_date: manualPaymentForm.payment_received_date || '',
              payment_received_month: monthFromDate,
              reference_no: manualPaymentForm.reference_no || '',
              bank_name: manualPaymentForm.bank_name || '',
              notes: 'MANUAL_ENTRY',
              is_topup: manualPaymentForm.transaction_type === 'TOPUP' ? 1 : 0,
              whop_product_payments_json: manualPaymentForm.whop_product_payments_json,
            }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || `Request failed (${res.status})`);
            setSaving(false);
            return;
          }
        }
      }

      // Handle transaction types
      if (manualPaymentForm.transaction_type === 'UPGRADE') {
        console.log('DEBUG UPGRADE block: isEditing && isTransaction =', isEditing && isTransaction, { isEditing, isTransaction });
        if (isEditing && isTransaction) {
          // Editing existing UPGRADE transaction - use transactions API
          const res = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions/${editingPayment.row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'UPGRADE',
              from_tier: manualPaymentForm.tier || null,
              from_setup: manualPaymentForm.setup_type || null,
              to_tier: manualPaymentForm.to_tier || null,
              to_setup: manualPaymentForm.to_setup || null,
              prorata_amount: manualPaymentForm.prorata_amount || null,
              amount: manualPaymentForm.amount_received || null,
              date: manualPaymentForm.payment_received_date || '',
              until_date: manualPaymentForm.valid_stopped_date || null,
              reference_no: manualPaymentForm.reference_no || null,
              bank_name: manualPaymentForm.bank_name || null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || `Request failed (${res.status})`);
            setSaving(false);
            return;
          }
        } else {
          // Creating NEW UPGRADE (Ponctual)
          const upgradeRes = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/upgrade-ponctual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_tier: manualPaymentForm.to_tier || null,
              to_setup: manualPaymentForm.to_setup || null,
              expires_at: manualPaymentForm.valid_stopped_date || null,
              amount_received: manualPaymentForm.amount_received || null,
            }),
          });
          const upgradeData = await upgradeRes.json();
          if (!upgradeRes.ok) {
            setError(upgradeData.error || 'Failed to create upgrade');
            setSaving(false);
            return;
          }
          alert(`Upgrade applied: ${upgradeData.new_sr_no}, Prorata: \$${upgradeData.prorata_amount}`);
        }
      } else if (manualPaymentForm.transaction_type === 'RETURN') {
        if (isEditing && isTransaction) {
          // Editing existing RETURN - use transactions API
          const res = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions/${editingPayment.row.id}`,
            { method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'RETURN',
                from_tier: manualPaymentForm.tier || null,
                from_setup: manualPaymentForm.setup_type || null,
                to_tier: null,
                to_setup: null,
                prorata_amount: null,
                amount: manualPaymentForm.amount_received || null,
                date: manualPaymentForm.payment_received_date || '',
                until_date: manualPaymentForm.valid_stopped_date || null,
              }),
            });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || `Request failed (${res.status})`);
            setSaving(false);
            return;
          }
        } else {
          // Creating NEW RETURN
          const returnRes = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions`,
            { method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'RETURN',
                from_tier: manualPaymentForm.tier || null,
                from_setup: manualPaymentForm.setup_type || null,
                to_tier: null,
                to_setup: null,
                prorata_amount: null,
                amount: manualPaymentForm.amount_received || null,
                date: manualPaymentForm.payment_received_date || '',
                until_date: manualPaymentForm.valid_stopped_date || null,
                client_id: client.id,
              }),
            });
          const returnData = await returnRes.json().catch(() => ({}));
          if (!returnRes.ok) {
            setError(returnData.error || 'Failed to create return');
            setSaving(false);
            return;
          }
        }
      } else if (manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') {
        if (isEditing && isTransaction) {
          // Editing existing UPGRADE_PERMANENT transaction - use transactions API
          const res = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions/${editingPayment.row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'UPGRADE_PERMANENT',
              from_tier: manualPaymentForm.tier || null,
              from_setup: manualPaymentForm.setup_type || null,
              to_tier: manualPaymentForm.to_tier || null,
              to_setup: manualPaymentForm.to_setup || null,
              prorata_amount: manualPaymentForm.prorata_amount || null,
              amount: manualPaymentForm.amount_received || null,
              date: manualPaymentForm.payment_received_date || '',
              until_date: manualPaymentForm.valid_stopped_date || null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || `Request failed (${res.status})`);
            setSaving(false);
            return;
          }
        } else {
          // Creating NEW UPGRADE_PERMANENT
          const upgradeRes = await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/upgrade-permanent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_tier: manualPaymentForm.to_tier || null,
              to_setup: manualPaymentForm.to_setup || null,
              subscription_fee: manualPaymentForm.subscription_fee || null,
              setup_fee: manualPaymentForm.setup_fee || null,
              discount: manualPaymentForm.discount || null,
              amount_received: manualPaymentForm.amount_received || null,
              bank_name: manualPaymentForm.bank_name || null,
              whop_product_payments_json: manualPaymentForm.whop_product_payments_json || null,
              valid_stopped_date: manualPaymentForm.valid_stopped_date || null,
              payment_received_date: manualPaymentForm.payment_received_date || null,
              reference_no: manualPaymentForm.reference_no || null,
            }),
          });
          const upgradeData = await upgradeRes.json();
          if (!upgradeRes.ok) {
            setError(upgradeData.error || 'Failed to apply permanent upgrade');
            setSaving(false);
            return;
          }
          // Then record the transaction
          await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: manualPaymentForm.transaction_type,
              from_tier: manualPaymentForm.tier || null,
              from_setup: manualPaymentForm.setup_type || null,
              to_tier: manualPaymentForm.to_tier || null,
              to_setup: manualPaymentForm.to_setup || null,
              prorata_amount: manualPaymentForm.prorata_amount || null,
              amount: manualPaymentForm.amount_received || null,
              date: manualPaymentForm.payment_received_date || '',
              until_date: manualPaymentForm.valid_stopped_date || null,
              client_id: client.id,
            }),
          });
          alert(`Permanent upgrade applied: ${manualPaymentForm.tier} → ${manualPaymentForm.to_tier || manualPaymentForm.tier}`);
        }
      } else if (manualPaymentForm.transaction_type !== 'MONTHLY') {
        // TOPUP, etc.: Just create a transaction record
        await fetch(`/api/renewals/${encodeURIComponent(renewalSrNo)}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: manualPaymentForm.transaction_type,
            from_tier: manualPaymentForm.tier || null,
            from_setup: manualPaymentForm.setup_type || null,
            to_tier: manualPaymentForm.to_tier || null,
            to_setup: manualPaymentForm.to_setup || null,
            prorata_amount: manualPaymentForm.prorata_amount || null,
            amount: manualPaymentForm.amount_received || null,
            date: manualPaymentForm.payment_received_date || '',
            until_date: manualPaymentForm.valid_stopped_date || null,
            client_id: client.id,
          }),
        });
      }

      setEditingPayment(null);
      setSelectedProductSrNo('');

      // Re-fetch client to refresh modal data
      try {
        const refetch = await fetch(`/api/clients/${client.id}`);
        if (refetch.ok) {
          const fresh = await refetch.json();
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
              is_trial: Boolean(h.is_trial),
              is_ponctual_upgrade: h.is_ponctual_upgrade,
              original_tier: h.original_tier || '',
              original_setup: h.original_setup || '',
              upgrade_chain_json: h.upgrade_chain_json || '',
            }))
          );
          setDeletedPaymentSrNos([]);
          // Also refresh the individual payments list
          try {
            const paymentsRes = await fetch(`/api/payments?client_id=${client.id}`);
            const paymentsData = await paymentsRes.json();
            if (Array.isArray(paymentsData)) {
              setClientPayments(paymentsData);
            }
          } catch {}
        }
      } catch {
        // Refetch failed but payment was saved
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  // Send invoice via Telegram to the linked group (just the Pay Now message, NO PDF)
  // PDF will only be sent after admin approval
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

      // Amount = subscription + setup - discount
      const subAmt = parseFloat(String(row.subscription_fee || '0').replace(/[^0-9.]/g, '')) || 0;
      const setupAmt = parseFloat(String(row.setup_fee || '0').replace(/[^0-9.]/g, '')) || 0;
      const discAmt = parseFloat(String(row.discount || '0').replace(/[^0-9.]/g, '')) || 0;
      const totalAmt = (subAmt + setupAmt - discAmt).toFixed(2);

      // Amount already received for this product
      const receivedAmt = parseFloat(String(row.amount_received || '0').replace(/[^0-9.]/g, '')) || 0;
      const dueAmt = Math.max(0, parseFloat(totalAmt) - receivedAmt).toFixed(2);

      const res = await fetch('/api/bot/send-invoice-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          srNo: row.sr_no,
          clientName: client.name,
          productName: row.tier ? row.tier + (row.setup_type ? ' - ' + row.setup_type : '') : 'Service',
          subtotal: totalAmt,
          discount: '0',
          invoiceDate: row.valid_stopped_date || new Date().toISOString().split('T')[0],
          receivedAmt: receivedAmt.toString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInvoiceToast({ type: 'error', message: data.error || 'Failed to send invoice.' });
      } else {
        setInvoiceToast({ type: 'success', message: 'Invoice sent! Client can now pay. PDF will be sent after approval.' });
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
          referral_partner_name: formReferralPartner,
          company_name: formCompanyName.trim(),
          company_number: formCompanyNumber.trim(),
          landing_pages: formLandingPages,
          creative_url: formCreativeUrl.trim(),
          creative_files: formCreativeFiles,
          client_owner: formClientOwner.trim(),
          notes: formNotes,
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
      // Re-fetch client to refresh modal data, then switch to view mode
      try {
        const refetch = await fetch(`/api/clients/${client.id}`);
        if (refetch.ok) {
          const fresh = await refetch.json();
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
              is_trial: Boolean(h.is_trial),
              is_ponctual_upgrade: h.is_ponctual_upgrade,
              original_tier: h.original_tier || '',
              original_setup: h.original_setup || '',
              upgrade_chain_json: h.upgrade_chain_json || '',
            }))
          );
          setDeletedPaymentSrNos([]);
          // Also update computed data (for Overview totals)
          if (fresh.computed) {
            setComputedData(fresh.computed);
          }
        }
      } catch {}
      // Clear edit state and switch to view mode after successful save
      setMode('view');
      setRemovedSrNos([]);
      setError(null);
      // Refresh parent data with this client's fresh data
      onSaved && onSaved(client.id);
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
    if ((formReferralPartner || '') !== (client?.referral_partner_name || '')) return true;
    if ((formCompanyName || '') !== (client?.company_name || '')) return true;
    if ((formCompanyNumber || '') !== (client?.company_number || '')) return true;
    const clientLP = client?.landing_pages ? (typeof client.landing_pages === 'string' ? JSON.parse(client.landing_pages) : client.landing_pages) : [];
    if (JSON.stringify(formLandingPages) !== JSON.stringify(clientLP)) return true;
    if ((formCreativeUrl || '') !== (client?.creative_url || '')) return true;
    const clientCF = client?.creative_files ? (typeof client.creative_files === 'string' ? JSON.parse(client.creative_files) : client.creative_files) : [];
    if (JSON.stringify(formCreativeFiles) !== JSON.stringify(clientCF)) return true;
    if ((formClientOwner || '') !== (client?.client_owner || '')) return true;
    if ((formNotes || '') !== (client?.notes || '')) return true;
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
  }, [mode, formName, formFirstName, formLastName, formEmail, formAddress, formTelegramGroupId, formStatus, formTrustpilotReviewed, formChurnReason, formReferralPartner, formCompanyName, formCompanyNumber, formLandingPages, formCreativeUrl, formCreativeFiles, formClientOwner, formNotes, formProducts, removedSrNos, client, history]);

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
      <div className="card" style={{ width: '100%', maxWidth: '100%', height: '90vh', maxHeight: '90vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
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
              { id: 'payments', label: 'Payments' },
              { id: 'chat', label: '💬 Chat' }
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
                          <span style={{ color: client.trustpilot_reviewed ? 'var(--status-active)' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {client.trustpilot_reviewed ? <IconCheck size={14} color="var(--status-active)" /> : <IconRemove size={14} color="#f87171" />}
                            {client.trustpilot_reviewed ? 'Reviewed' : 'Not reviewed'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Referral Partner</span>
                          <span style={{ fontWeight: '600', fontSize: '13px', color: '#A78BFA' }}>{client.referral_partner_name || 'N.A.'}</span>
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
                          <span style={{ fontWeight: '700', fontSize: '18px', color: 'var(--primary-accent)' }}>{formatCurrency(computedData?.totalCA || 0)}</span>
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
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Referral Commission</span>
                          <span style={{ fontWeight: '700', fontSize: '18px', color: '#A855F7' }}>{totalReferralCommission > 0 ? `$${totalReferralCommission}` : '—'}</span>
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
                        <div>Next Renewal: <span style={{ fontWeight: '600' }}>{computedData?.nextRenewalDate || '—'}</span></div>
                      </div>
                    </div>
                    {client.status !== 'Actif' && client.churn_reason && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ color: '#F87171', fontSize: '12px', fontWeight: '600' }}>Churn Reason</span>
                        <div style={{ fontSize: '13px', fontWeight: '600', padding: '8px 12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                          {CHURN_SUB_REASON_LABELS[client.churn_reason] || client.churn_reason}
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

                  {/* Company & Owner Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {(client.company_name || client.company_number || client.client_owner) && (
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          Company Information
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {client.company_name && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Company Name</span>
                              <span style={{ fontWeight: '600', fontSize: '13px' }}>{client.company_name}</span>
                            </div>
                          )}
                          {client.company_number && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Company Number</span>
                              <span style={{ fontWeight: '600', fontSize: '13px' }}>{client.company_number}</span>
                            </div>
                          )}
                          {client.client_owner && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Client Owner</span>
                              <span style={{ fontWeight: '600', fontSize: '13px', color: '#A78BFA' }}>{client.client_owner}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(client.landing_pages?.length > 0 || client.creative_url) && (
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          Landing Pages & Creatives
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {client.landing_pages?.length > 0 && (
                            <div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Landing Pages</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                {(Array.isArray(client.landing_pages) ? client.landing_pages : JSON.parse(client.landing_pages || '[]')).map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-accent)', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    {url.length > 40 ? url.substring(0, 40) + '...' : url}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {client.creative_url && (
                            <div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Creative Folder</span>
                              <a href={client.creative_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-accent)', fontSize: '13px', fontWeight: '600', textDecoration: 'none', marginTop: '6px' }}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Open Creative Folder
                              </a>
                            </div>
                          )}
                          {client.creative_files?.length > 0 && (
                            <div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Uploaded Creatives ({Array.isArray(client.creative_files) ? client.creative_files.length : JSON.parse(client.creative_files || '[]').length})</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                {(Array.isArray(client.creative_files) ? client.creative_files : JSON.parse(client.creative_files || '[]')).map((f, i) => (
                                  <a key={i} href={f.path} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    {f.name?.substring(0, 15) || 'Image'}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {client.notes && (
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Notes
                        </h4>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{client.notes}</div>
                      </div>
                    )}
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
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Referral Partner</label>
                      <select
                        value={formReferralPartner}
                        onChange={(e) => {
                          const newPartner = e.target.value;
                          setFormReferralPartner(newPartner);
                          // Apply discount and commission to all products
                          setFormProducts(prev => prev.map(p => {
                            const newDiscount = calculateClientDiscount(newPartner, p.subscription_fee, p.setup_fee);
                            // Calculate referral_amount based on partner rate
                            const rates = { 'Chris': 10, 'No Limit': 2.5, '8 Labs': 2.5, 'Master': 5 };
                            const rate = rates[newPartner] || 0;
                            const baseAmount = (parseFloat(p.subscription_fee) || 0) + (parseFloat(p.setup_fee) || 0) - newDiscount;
                            const newReferralAmount = rate > 0 ? Math.round(baseAmount * rate / 100) : 0;
                            return {
                              ...p,
                              referral_partner_name: newPartner,
                              discount: String(newDiscount),
                              referral_amount: String(newReferralAmount),
                            };
                          }));
                        }}
                        disabled={saving}
                        style={{
                          width: '100%', backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)', borderRadius: '8px',
                          padding: '12px', color: 'var(--text-primary)', outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {REFERRAL_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
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
                      <select
                        value={formChurnReason}
                        onChange={(e) => setFormChurnReason(e.target.value)}
                        disabled={saving}
                        style={{
                          width: '100%', backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)', borderRadius: '8px',
                          padding: '12px', color: 'var(--text-primary)', outline: 'none',
                          cursor: 'pointer', fontSize: '14px'
                        }}
                      >
                        <option value="">Select a reason...</option>
                        <optgroup label="Customer service issue">
                          <option value="customer_service-refund">Refund</option>
                          <option value="customer_service-restriction">Restriction</option>
                          <option value="customer_service-performance">Performance issues</option>
                          <option value="customer_service-other">Other</option>
                        </optgroup>
                        <optgroup label="Client decision">
                          <option value="client_decision-pause">Pause</option>
                          <option value="client_decision-silence">Silence (no response)</option>
                          <option value="client_decision-cancellation">Cancellation</option>
                          <option value="client_decision-contract_end">Contract end</option>
                          <option value="client_decision-project_stopped">Project stopped</option>
                        </optgroup>
                        <optgroup label="Technical issue">
                          <option value="technical-setup">Setup</option>
                          <option value="technical-meta">Meta</option>
                          <option value="technical-bm">BM (Business Manager)</option>
                          <option value="technical-pixel">Pixel</option>
                          <option value="technical-other">Other</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option value="other">Other</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* New fields: Company, Landing Pages, Creatives, Owner, Notes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Company Name</label>
                      <input value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} disabled={saving} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Company Number</label>
                      <input value={formCompanyNumber} onChange={(e) => setFormCompanyNumber(e.target.value)} disabled={saving} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Client Owner</label>
                      <input value={formClientOwner} onChange={(e) => setFormClientOwner(e.target.value)} disabled={saving} placeholder="e.g. Chris, Sarah..." style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Creative Folder URL (Google Drive, Dropbox, etc.)</label>
                      <input value={formCreativeUrl} onChange={(e) => setFormCreativeUrl(e.target.value)} disabled={saving} placeholder="https://drive.google.com/..." style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }} />
                    </div>
                  </div>

                  {/* Landing Pages */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Landing Pages</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {formLandingPages.map((url, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            value={url}
                            onChange={(e) => {
                              const updated = [...formLandingPages];
                              updated[i] = e.target.value;
                              setFormLandingPages(updated);
                            }}
                            disabled={saving}
                            placeholder="https://..."
                            style={{ flex: 1, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}
                          />
                          <button
                            onClick={() => setFormLandingPages(formLandingPages.filter((_, idx) => idx !== i))}
                            disabled={saving}
                            style={{ padding: '8px', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '6px', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormLandingPages([...formLandingPages, ''])}
                        disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        <IconPlus size={12} /> Add Landing Page URL
                      </button>
                    </div>
                  </div>

                  {/* Uploaded Creative Files */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Uploaded Creatives</label>
                    {formCreativeFiles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {formCreativeFiles.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                            <a href={f.path} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-accent)', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>{f.name?.substring(0, 20) || 'Image'}</a>
                            <button onClick={() => deleteCreative(f.path)} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0', display: 'flex', alignItems: 'center' }}>
                              <IconTrash size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600', cursor: uploadingCreative ? 'not-allowed' : 'pointer', border: '1px solid var(--border-color)' }}>
                      {uploadingCreative ? 'Uploading...' : 'Upload Creative'}
                      <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) uploadCreative(e.target.files[0]); }} disabled={uploadingCreative} style={{ display: 'none' }} />
                    </label>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>Notes</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      disabled={saving}
                      rows={4}
                      placeholder="Important notes for the team..."
                      style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px', resize: 'vertical', lineHeight: '1.5' }}
                    />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '16px' }}>
                  {displayProducts.length > 0 ? displayProducts.map((product, idx) => {
                    const productDue = calculateProductDue(product);
                    const billingStatus = getProductBillingStatus(product);
                    const isPaid = billingStatus.status === 'FULLY PAID';
                    return (
                      <div key={idx} style={{
                        backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '12px',
                        border: '1px solid var(--border-color)', borderLeft: `5px solid ${billingStatus.color}`,
                        display: 'flex', flexDirection: 'column', gap: '16px',
                      }}>
                        {/* Top Row: Product Identity & Main Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: '700' }}>Product Bundle</div>
                            <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} is_ponctual={product.is_ponctual_upgrade == 1} original_tier={product.original_tier} original_setup={product.original_setup} />
                          </div>
                          <div style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.02)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px', fontWeight: '700' }}>Billing Status</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: billingStatus.color }}>
                              {billingStatus.status === 'FULLY PAID' ? <><IconCheck size={14} color={billingStatus.color} /> Fully Paid</> : billingStatus.status === 'PARTIALLY PAID' ? <><IconWarning size={14} color={billingStatus.color} /> {billingStatus.status}</> : billingStatus.status === 'TRIAL' ? <><IconGift size={14} color={billingStatus.color} /> Trial</> : <><IconWarning size={14} color={billingStatus.color} /> Due: {formatCurrency(productDue)}</>}
                            </div>
                          </div>
                        </div>

                        {/* Middle Row: Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>

                          {/* Financial Breakdown */}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <IconDollar size={14} /> Financials
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
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
                                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '2px 0' }}></div>
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
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '2px 0' }}></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Received</span>
                                <span style={{ fontWeight: '600', color: 'var(--primary-accent)' }}>{formatCurrency(parseAmount(product.amount_received))}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Due</span>
                                <span style={{ fontWeight: '700', color: productDue > 0 ? '#EF4444' : 'var(--status-active)' }}>{formatCurrency(productDue)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Ad Account */}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <IconChart size={14} /> Ad Account
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>ID</span>
                                <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{product.ad_id_number || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Name</span>
                                <span style={{ fontWeight: '600' }}>{product.client_ad_id_name || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                                <span style={{ fontWeight: '600' }}>{product.ad_account_type || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Limit</span>
                                <span style={{ fontWeight: '600', color: 'var(--primary-accent)' }}>{product.ad_spend_limit || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Spend</span>
                                <span style={{ fontWeight: '600' }}>{(() => {
                                  const spend = parseFloat(String(product.current_spend || '0').replace(/[^0-9.-]+/g, '')) || 0;
                                  return '$' + spend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                                })()}</span>
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <SpendProgressBar
                                  current={product.current_spend || 0}
                                  limit={product.ad_spend_limit || 0}
                                  showAmount={true}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Lifecycle & Referral */}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <IconCalendar size={14} /> Lifecycle
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Start Date</span>
                                <span style={{ fontWeight: '600' }}>{product.start_date || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Valid Until</span>
                                <span style={{ fontWeight: '600' }}>{product.valid_stopped_date || '—'}</span>
                              </div>
                              {product.is_ponctual_upgrade == 1 && product.upgrade_chain_json && (() => {
                                const chain = JSON.parse(product.upgrade_chain_json);
                                if (chain && chain.length > 0) {
                                  return (
                                    <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Upgrade Chain:</span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                        {chain.map((step, i) => (
                                          <div key={i} style={{ fontSize: '11px', color: 'var(--primary-accent)' }}>
                                            {step.from_tier} → {step.to_tier} ({step.date})
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {product.is_ponctual_upgrade == 1 && product.parent_sr_no && (
                                <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>From:</span>
                                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}> {product.original_tier || 'Original'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Action Buttons for Ponctual Upgrades */}
                        {product.is_ponctual_upgrade == 1 && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleRenewPonctual(product.sr_no)}
                              style={{
                                flex: 1, minWidth: '120px',
                                padding: '8px 12px',
                                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                                color: '#14b8a6',
                                border: '1px solid rgba(20, 184, 166, 0.3)',
                                borderRadius: '8px',
                                fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              🔄 Renew Ponctual
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReturnToOriginal(product.sr_no)}
                              style={{
                                flex: 1, minWidth: '120px',
                                padding: '8px 12px',
                                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                                color: '#FB923C',
                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                borderRadius: '8px',
                                fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              ← Return {product.original_tier || 'Original'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromotePonctual(product.sr_no)}
                              style={{
                                flex: 1, minWidth: '120px',
                                padding: '8px 12px',
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                color: '#C084FC',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: '8px',
                                fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              ⭐ Make Permanent
                            </button>
                          </div>
                        )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '16px' }}>
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
                      compact={true}
                      tierProducts={tierProducts}
                      setupProducts={setupProducts}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <ChatTab clientId={client?.id} linkedGroups={linkedGroups} />
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

                    <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Transaction Type</label>
                      <select value={manualPaymentForm.transaction_type || 'MONTHLY'} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, transaction_type: e.target.value, to_tier: '', to_setup: '', prorata_amount: '' }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                        <option value="MONTHLY">Monthly Payment</option>
                        <option value="TOPUP">Top-up</option>
                        <option value="UPGRADE_PERMANENT">Upgrade Monthly (Permanent)</option>
                        <option value="UPGRADE">Upgrade Ponctual (Temp)</option>
                        <option value="RETURN">Return to Original</option>
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

                    {/* TIER - show for MONTHLY (read-only if product selected) or any UPGRADE type */}
                    {(manualPaymentForm.transaction_type === 'MONTHLY' || manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                          {(manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') ? 'From Tier' : 'TIER'}
                        </label>
                        {(manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') ? (
                          <select value={manualPaymentForm.tier} disabled style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff', opacity: 0.7 }}>
                            <option value={manualPaymentForm.tier}>{manualPaymentForm.tier || 'N/A'}</option>
                          </select>
                        ) : (
                          // MONTHLY: read-only if a product is already linked (selectedProductSrNo is set)
                          <select
                            value={manualPaymentForm.tier}
                            onChange={(e) => handlePaymentTierChange(e.target.value)}
                            disabled={!!selectedProductSrNo && selectedProductSrNo !== 'new'}
                            style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff', opacity: selectedProductSrNo && selectedProductSrNo !== 'new' ? 0.7 : 1 }}
                          >
                            <option value="">Select TIER</option>
                            {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    {/* To Tier - for UPGRADE and UPGRADE_PERMANENT (optional - can keep same tier) */}
                    {(manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>To Tier (optional)</label>
                        <select value={manualPaymentForm.to_tier || manualPaymentForm.tier} onChange={(e) => {
                          const toTier = e.target.value;
                          setManualPaymentForm(prev => {
                            // Auto-calculate prorata for tier + setup (with partner discount)
                            const discount = getPartnerDiscount(client?.referral_partner_name || 'N.A.');
                            const discountFactor = 1 - (discount / 100);
                            const fromTierPrice = parseFloat(TIER_PRICING[prev.tier] || 0) * discountFactor;
                            const toTierPrice = parseFloat(TIER_PRICING[toTier] || 0) * discountFactor;
                            const fromSetupPrice = parseFloat(SETUP_PRICING[prev.setup_type] || 0) * discountFactor;
                            const toSetupPrice = parseFloat(SETUP_PRICING[prev.to_setup || prev.setup_type] || 0) * discountFactor;
                            const prorata = Math.max(0, (toTierPrice - fromTierPrice) + (toSetupPrice - fromSetupPrice));
                            return { ...prev, to_tier: toTier, prorata_amount: prorata > 0 ? prorata.toFixed(2) : '' };
                          });
                        }} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                          <option value={manualPaymentForm.tier}>Same (keep {manualPaymentForm.tier})</option>
                          {TIER_OPTIONS.filter(t => t !== manualPaymentForm.tier).map(t => <option key={t} value={t}>{t} (+${((parseFloat(TIER_PRICING[t] || 0) - parseFloat(TIER_PRICING[manualPaymentForm.tier] || 0)) * (1 - getPartnerDiscount(client?.referral_partner_name || 'N.A.') / 100)).toFixed(2)})</option>)}
                        </select>
                      </div>
                    )}

                    {/* To Setup - for UPGRADE and UPGRADE_PERMANENT (optional - can keep same setup) */}
                    {(manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>To Setup (optional)</label>
                        <select value={manualPaymentForm.to_setup || manualPaymentForm.setup_type} onChange={(e) => {
                          const toSetup = e.target.value;
                          setManualPaymentForm(prev => {
                            // Auto-calculate prorata for tier + setup (with partner discount)
                            const discount = getPartnerDiscount(client?.referral_partner_name || 'N.A.');
                            const discountFactor = 1 - (discount / 100);
                            const fromTierPrice = parseFloat(TIER_PRICING[prev.tier] || 0) * discountFactor;
                            const toTierPrice = parseFloat(TIER_PRICING[prev.to_tier || prev.tier] || 0) * discountFactor;
                            const fromSetupPrice = parseFloat(SETUP_PRICING[prev.setup_type] || 0) * discountFactor;
                            const toSetupPrice = parseFloat(SETUP_PRICING[toSetup] || 0) * discountFactor;
                            const prorata = Math.max(0, (toTierPrice - fromTierPrice) + (toSetupPrice - fromSetupPrice));
                            return { ...prev, to_setup: toSetup, prorata_amount: prorata > 0 ? prorata.toFixed(2) : '' };
                          });
                        }} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                          <option value={manualPaymentForm.setup_type}>Same (keep {manualPaymentForm.setup_type})</option>
                          {SETUP_OPTIONS.filter(s => s !== manualPaymentForm.setup_type).map(s => <option key={s} value={s}>{s} (+${((parseFloat(SETUP_PRICING[s] || 0) - parseFloat(SETUP_PRICING[manualPaymentForm.setup_type] || 0)) * (1 - getPartnerDiscount(client?.referral_partner_name || 'N.A.') / 100)).toFixed(2)})</option>)}
                        </select>
                      </div>
                    )}

                    {/* SETUP - show only for MONTHLY (read-only if product is already linked) */}
                    {manualPaymentForm.transaction_type === 'MONTHLY' && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>SETUP</label>
                        <select
                          value={manualPaymentForm.setup_type}
                          onChange={(e) => handlePaymentSetupTypeChange(e.target.value)}
                          disabled={!!selectedProductSrNo && selectedProductSrNo !== 'new'}
                          style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff', opacity: selectedProductSrNo && selectedProductSrNo !== 'new' ? 0.7 : 1 }}
                        >
                          <option value="">Select SETUP</option>
                          {SETUP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Bank</label>
                      <select value={manualPaymentForm.bank_name} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, bank_name: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }}>
                        <option value="">Select Bank</option>
                        {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    {/* WHOP details - for MONTHLY, UPGRADE, UPGRADE_PERMANENT, and RETURN */}
                    {manualPaymentForm.bank_name === 'WHOP' && (manualPaymentForm.transaction_type === 'MONTHLY' || manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT' || manualPaymentForm.transaction_type === 'RETURN') && (() => {
                      const whopPayments = JSON.parse(manualPaymentForm.whop_product_payments_json || '[]');
                      const hasTier = manualPaymentForm.tier;
                      const hasSetup = manualPaymentForm.setup_type;
                      return (
                        <div style={{ gridColumn: '1 / -1', backgroundColor: 'rgba(34, 197, 94, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: '#22c55e', marginBottom: '12px' }}>WHOP Payment Details</p>
                          {hasTier && (
                            <div style={{ marginBottom: '12px' }}>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{manualPaymentForm.tier} - Email & Reference</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <input
                                  type="email"
                                  placeholder="WHOP email for TIER"
                                  value={whopPayments.find(p => p.product_type === 'tier')?.whop_email || ''}
                                  onChange={(e) => {
                                    const updated = whopPayments.filter(p => p.product_type !== 'tier');
                                    updated.push({ product_type: 'tier', product_name: manualPaymentForm.tier, whop_email: e.target.value, whop_payment_reference: whopPayments.find(p => p.product_type === 'tier')?.whop_payment_reference || '' });
                                    setManualPaymentForm(prev => ({ ...prev, whop_product_payments_json: JSON.stringify(updated) }));
                                  }}
                                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px' }}
                                />
                                <input
                                  type="text"
                                  placeholder="WHOP reference (optional)"
                                  value={whopPayments.find(p => p.product_type === 'tier')?.whop_payment_reference || ''}
                                  onChange={(e) => {
                                    const updated = whopPayments.filter(p => p.product_type !== 'tier');
                                    updated.push({ product_type: 'tier', product_name: manualPaymentForm.tier, whop_email: whopPayments.find(p => p.product_type === 'tier')?.whop_email || '', whop_payment_reference: e.target.value });
                                    setManualPaymentForm(prev => ({ ...prev, whop_product_payments_json: JSON.stringify(updated) }));
                                  }}
                                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px' }}
                                />
                              </div>
                            </div>
                          )}
                          {hasSetup && (
                            <div>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{manualPaymentForm.setup_type} Setup - Email & Reference</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <input
                                  type="email"
                                  placeholder="WHOP email for SETUP"
                                  value={whopPayments.find(p => p.product_type === 'setup')?.whop_email || ''}
                                  onChange={(e) => {
                                    const updated = whopPayments.filter(p => p.product_type !== 'setup');
                                    updated.push({ product_type: 'setup', product_name: manualPaymentForm.setup_type, whop_email: e.target.value, whop_payment_reference: whopPayments.find(p => p.product_type === 'setup')?.whop_payment_reference || '' });
                                    setManualPaymentForm(prev => ({ ...prev, whop_product_payments_json: JSON.stringify(updated) }));
                                  }}
                                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px' }}
                                />
                                <input
                                  type="text"
                                  placeholder="WHOP reference (optional)"
                                  value={whopPayments.find(p => p.product_type === 'setup')?.whop_payment_reference || ''}
                                  onChange={(e) => {
                                    const updated = whopPayments.filter(p => p.product_type !== 'setup');
                                    updated.push({ product_type: 'setup', product_name: manualPaymentForm.setup_type, whop_email: whopPayments.find(p => p.product_type === 'setup')?.whop_email || '', whop_payment_reference: e.target.value });
                                    setManualPaymentForm(prev => ({ ...prev, whop_product_payments_json: JSON.stringify(updated) }));
                                  }}
                                  style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Amount Received</label>
                      <input type="text" value={manualPaymentForm.amount_received} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, amount_received: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                    </div>

                    {/* Reference - hidden for WHOP (has its own field in the WHOP section above) */}
                    {manualPaymentForm.bank_name !== 'WHOP' && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Reference</label>
                        <input type="text" value={manualPaymentForm.reference_no} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, reference_no: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                      </div>
                    )}

                    {/* Subscription/Setup/Discount - only for MONTHLY */}
                    {manualPaymentForm.transaction_type === 'MONTHLY' && (
                      <>
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
                      </>
                    )}

                    {/* Prorata - only for UPGRADE (auto-calculated) */}
                    {(manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT') && manualPaymentForm.prorata_amount && (
                      <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Prorata (Auto)</label>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#C084FC' }}>${parseFloat(manualPaymentForm.prorata_amount).toFixed(2)}</div>
                      </div>
                    )}

                    {/* Valid Until - for MONTHLY, UPGRADE, UPGRADE_PERMANENT and RETURN */}
                    {(manualPaymentForm.transaction_type === 'MONTHLY' || manualPaymentForm.transaction_type === 'UPGRADE' || manualPaymentForm.transaction_type === 'UPGRADE_PERMANENT' || manualPaymentForm.transaction_type === 'RETURN') && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Valid Until</label>
                        <input type="date" value={manualPaymentForm.valid_stopped_date} onChange={(e) => setManualPaymentForm(prev => ({ ...prev, valid_stopped_date: e.target.value }))} style={{ width: '100%', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: '#fff' }} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                    <button type="button" onClick={cancelPaymentEdit} style={{ padding: '8px 16px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>Cancel</button>
                    <button type="button" onClick={saveManualPayment} disabled={saving} style={{ padding: '8px 16px', backgroundColor: saving ? 'var(--border-color)' : 'var(--primary-accent)', color: '#000', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
                      {saving ? 'Saving...' : 'Save Payment'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 8px' }}>Status</th>
                      <th style={{ padding: '12px 8px' }}>Period</th>
                      <th style={{ padding: '12px 8px' }}>Type</th>
                      <th style={{ padding: '12px 8px' }}>Product</th>
                      <th style={{ padding: '12px 8px' }}>From</th>
                      <th style={{ padding: '12px 8px' }}>To</th>
                      <th style={{ padding: '12px 8px' }}>Prorata</th>
                      <th style={{ padding: '12px 8px' }}>Fees & Disc.</th>
                      <th style={{ padding: '12px 8px' }}>Bank</th>
                      <th style={{ padding: '12px 8px' }}>Amount</th>
                      <th style={{ padding: '12px 8px' }}>Valid Until</th>
                      <th style={{ padding: '12px 8px' }}>Reference</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* First: show all products that have payments - each payment as a separate row */}
                    {clientPayments.length > 0 && clientPayments.map((payment) => {
                      const product = history?.find(h => h.sr_no === payment.renewal_sr_no);
                      const billing = getBillingInfo(product || {});
                      // Calculate billing status for this payment entry
                      let paymentBillingStatus = 'UNPAID';
                      let isUpgradePonctual = false;
                      if (payment.is_transaction) {
                        if (payment.type === 'UPGRADE' || payment.type === 'SUB_UPGRADE') {
                          // UPGRADE: show prorata as the paid amount, status = PAID
                          paymentBillingStatus = 'PAID';
                          isUpgradePonctual = true;
                        } else if (payment.type === 'RETURN') {
                          paymentBillingStatus = 'RETURN';
                        } else if (payment.type === 'PROMOTION') {
                          paymentBillingStatus = 'PROMOTED';
                        } else {
                          paymentBillingStatus = payment.type || 'TRANSACTION';
                        }
                      } else {
                        // For regular payments
                        const sub = parseAmount(product?.subscription_fee);
                        const setup = parseAmount(product?.setup_fee);
                        const disc = parseAmount(product?.discount);
                        const received = parseAmount(payment.amount_received);
                        const totalDue = (sub + setup) - disc;
                        const isZeroOrEmpty = !payment.amount_received || payment.amount_received === '0' || payment.amount_received === '';
                        if (payment.is_topup === 1) {
                          paymentBillingStatus = 'TOPUP';
                        } else if (isZeroOrEmpty) {
                          paymentBillingStatus = 'UNPAID';
                        } else if (received >= totalDue && totalDue > 0) {
                          paymentBillingStatus = 'PAID';
                        } else if (received > 0) {
                          paymentBillingStatus = 'PARTIAL';
                        }
                      }
                      // For ponctual upgrades in payment history: show ORIGINAL tier as main badge, UPGRADED tier as golden PONCTUAL badge
                      // badgeTier = what client originally had (from_tier for UPGRADE, product.tier otherwise)
                      // badgeOriginalTier = undefined for UPGRADE (since badgeTier already = original), use to_tier for RENEWAL_PONCTUAL
                      const isUpgradeTx = payment.type === 'UPGRADE' || payment.type === 'SUB_UPGRADE';
                      const badgeTier = isUpgradeTx ? (payment.from_tier || payment.to_tier) : (payment.tier || product?.tier);
                      const badgeSetup = isUpgradeTx ? (payment.from_setup || payment.to_setup) : (payment.setup_type || product?.setup_type);
                      const showPonctualBadge = isUpgradePonctual || payment.type === 'RENEWAL_PONCTUAL';
                      // For UPGRADE: badgeTier = original, so no separate original_tier needed
                      // For RENEWAL_PONCTUAL: use to_tier as the "upgraded" tier for the PONCTUAL badge
                      const badgeOriginalTier = payment.type === 'RENEWAL_PONCTUAL' ? (payment.to_tier) : undefined;
                      // Period: for transactions show until_date, otherwise payment_received_month
                      const periodDisplay = payment.is_transaction ? (payment.until_date || '—') : (payment.payment_received_month || payment.period || '—');
                      return (
                        <tr key={`payment-${payment.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: paymentBillingStatus === 'UNPAID' ? 'rgba(239, 68, 68, 0.03)' : paymentBillingStatus === 'PARTIAL' ? 'rgba(245, 158, 11, 0.03)' : 'rgba(16, 185, 129, 0.03)' }}>
                          <td style={{ padding: '16px 8px' }}>
                            {paymentBillingStatus === 'TOPUP' ? (
                              <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', fontWeight: '700', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>TOP-UP</span>
                            ) : paymentBillingStatus === 'PAID' ? (
                              <span style={{ color: '#10B981', fontWeight: '700', fontSize: '11px' }}>{isUpgradePonctual ? 'PONCTUAL' : 'PAID'}</span>
                            ) : (
                              <span style={{ color: paymentBillingStatus === 'PARTIAL' ? '#F59E0B' : '#EF4444', fontWeight: '700', fontSize: '11px' }}>{paymentBillingStatus}</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 8px', fontWeight: '600' }}>{periodDisplay}</td>
                          <td style={{ padding: '16px 8px' }}>
                            {payment.type ? (
                              <span style={{
                                backgroundColor: payment.type === 'MONTHLY' ? 'rgba(59, 130, 246, 0.15)' :
                                  payment.type === 'UPGRADE' || payment.type === 'SUB_UPGRADE' ? 'rgba(168, 85, 247, 0.15)' :
                                  payment.type === 'RENEWAL_PONCTUAL' ? 'rgba(20, 184, 166, 0.15)' :
                                  payment.type === 'RETURN' ? 'rgba(249, 115, 22, 0.15)' :
                                  payment.type === 'PROMOTION' ? 'rgba(236, 72, 153, 0.15)' :
                                  'rgba(255,255,255,0.05)',
                                color: payment.type === 'MONTHLY' ? '#60A5FA' :
                                  payment.type === 'UPGRADE' || payment.type === 'SUB_UPGRADE' ? '#C084FC' :
                                  payment.type === 'RENEWAL_PONCTUAL' ? '#2DD4BF' :
                                  payment.type === 'RETURN' ? '#FB923C' :
                                  payment.type === 'PROMOTION' ? '#F472B6' :
                                  'var(--text-primary)',
                                padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700'
                              }}>
                                {payment.type.replace('_', ' ')}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '16px 8px' }}>
                            <ProductBadge tier={badgeTier} setup_type={badgeSetup} is_trial={false} is_ponctual={showPonctualBadge} original_tier={badgeOriginalTier} showUpgradeBadge={isUpgradeTx && showPonctualBadge} upgradedTier={isUpgradeTx ? payment.to_tier : undefined} />
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {payment.from_tier || payment.from_setup ? (
                              <span>{payment.from_tier || '—'}{payment.from_setup ? ` + ${payment.from_setup}` : ''}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--primary-accent)' }}>
                            {payment.to_tier || payment.to_setup ? (
                              <span>{payment.to_tier || '—'}{payment.to_setup ? ` + ${payment.to_setup}` : ''}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: payment.prorata_amount ? '#C084FC' : 'var(--text-secondary)' }}>
                            {payment.prorata_amount ? `+$${payment.prorata_amount}` : '—'}
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {product && <>
                                <span>Sub: {product.subscription_fee || '0'}</span>
                                {product.setup_fee && <span>Setup: {product.setup_fee}</span>}
                                {product.discount && <span>Disc: {product.discount}</span>}
                              </>}
                            </div>
                          </td>
                          <td style={{ padding: '16px 8px' }}>{payment.bank_name || '—'}</td>
                          <td style={{ padding: '16px 8px', color: 'var(--primary-accent)', fontWeight: '700' }}>{payment.amount_received}</td>
                          <td style={{ padding: '16px 8px' }}>{product?.valid_stopped_date || '—'}</td>
                          <td style={{ padding: '16px 8px' }}>
                            {payment.bank_name === 'WHOP' && payment.whop_product_payments_json ? (
                              (() => {
                                try {
                                  const whopPayments = JSON.parse(payment.whop_product_payments_json);
                                  if (whopPayments.length === 0) return <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>—</span>;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {whopPayments.map((wp, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{
                                            fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px',
                                            backgroundColor: wp.product_type === 'tier' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                            color: wp.product_type === 'tier' ? '#A78BFA' : '#22c55e',
                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                          }}>
                                            {wp.product_type === 'tier' ? 'T' : 'S'}
                                          </span>
                                          {wp.whop_payment_reference ? (
                                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)' }}>{wp.whop_payment_reference}</span>
                                          ) : (
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No ref</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                } catch { return <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>—</span>; }
                              })()
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{payment.reference_no || '—'}</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                              {/* Send invoice button - only for UNPAID and PARTIAL (not TOPUP, not PAID) */}
                              {paymentBillingStatus !== 'TOPUP' && paymentBillingStatus !== 'PAID' && (
                                <button
                                  onClick={() => sendInvoiceViaTelegram(product || { ...payment, sr_no: payment.renewal_sr_no, tier: payment.tier, setup_type: payment.setup_type, subscription_fee: payment.subscription_fee, setup_fee: payment.setup_fee, discount: payment.discount, amount_received: payment.amount_received, valid_stopped_date: payment.valid_stopped_date })}
                                  disabled={sendingRowSrNo === product?.sr_no}
                                  title="Send invoice via Telegram"
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: sendingRowSrNo === product?.sr_no ? 'rgba(20, 184, 166, 0.3)' : 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.4)', cursor: sendingRowSrNo === product?.sr_no ? 'not-allowed' : 'pointer' }}
                                >
                                  {sendingRowSrNo === product?.sr_no ? <IconTelegram size={16} color="#14b8a6" /> : <IconSend size={16} color="#14b8a6" />}
                                </button>
                              )}
                              <a
                                href={buildInvoiceUrl(payment, product, billing)}
                                target="_blank" rel="noopener noreferrer"
                                title="Download invoice PDF"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none' }}
                              >
                                <IconDownload size={16} color="#fff" />
                              </a>
                              <button
                                onClick={() => startEditPayment(payment)}
                                title="Edit payment"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'transparent', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.4)', cursor: 'pointer' }}
                              >
                                <IconEdit size={16} color="#14b8a6" />
                              </button>
                              <button
                                onClick={() => deletePaymentEntry(payment)}
                                title="Delete payment"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer' }}
                              >
                                <IconTrash size={16} color="#f87171" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Then: show old paid products (have reference_no or amount_received in renewals, but NOT in payments table) */}
                    {(history || []).filter(product => {
                      const hasPaymentsInTable = clientPayments.some(p => p.renewal_sr_no === product.sr_no);
                      const hasOldPayment = (product.reference_no && product.reference_no.trim() !== '') || parseAmount(product.amount_received) > 0;
                      return !hasPaymentsInTable && hasOldPayment && !removedSrNos.includes(product.sr_no) && !deletedPaymentSrNos.includes(product.sr_no);
                    }).map((product) => {
                      const billing = getBillingInfo(product);
                      const billingStatus = getProductBillingStatus(product);
                      return (
                        <tr key={`oldpaid-${product.sr_no}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: 'rgba(16, 185, 129, 0.03)' }}>
                          <td style={{ padding: '16px 8px' }}>
                            <span style={{ color: billingStatus.color, fontWeight: '700', fontSize: '11px' }}>{billingStatus.status === 'FULLY PAID' ? 'PAID' : billingStatus.status}</span>
                          </td>
                          <td style={{ padding: '16px 8px', fontWeight: '600' }}>{product.month || '—'}</td>
                          <td style={{ padding: '16px 8px' }}>
                            {product.is_ponctual_upgrade == 1 ? (
                              <span style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#FBBF36', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>UPGRADE</span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>MONTHLY</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 8px' }}>
                            <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} is_ponctual={product.is_ponctual_upgrade == 1} original_tier={product.original_tier} original_setup={product.original_setup} />
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{product.original_tier || '—'}</td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--primary-accent)' }}>{product.is_ponctual_upgrade == 1 ? product.tier : '—'}</td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>—</td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>Sub: {product.subscription_fee || '0'}</span>
                              {product.setup_fee && <span>Setup: {product.setup_fee}</span>}
                              {product.discount && <span>Disc: {product.discount}</span>}
                            </div>
                          </td>
                          <td style={{ padding: '16px 8px' }}>{product.bank_name || '—'}</td>
                          <td style={{ padding: '16px 8px', color: billingStatus.color, fontWeight: '700' }}>{product.amount_received || '—'}</td>
                          <td style={{ padding: '16px 8px' }}>{product.valid_stopped_date || '—'}</td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{product.reference_no || '—'}</td>
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                              <a
                                href={`/api/invoice/generate?sr_no=${encodeURIComponent(product.sr_no || '')}&client_id=${client.id}&client_name=${encodeURIComponent(client.name || '')}&bank_name=${encodeURIComponent(product.bank_name || 'crypto')}&product_name=${encodeURIComponent(product.tier ? product.tier + (product.setup_type ? ' - ' + product.setup_type : '') : 'Service')}&subtotal=${encodeURIComponent((parseFloat(String(product.subscription_fee||'0').replace(/[^0-9.]/g,''))||0 + parseFloat(String(product.setup_fee||'0').replace(/[^0-9.]/g,''))||0).toFixed(2))}&discount=${encodeURIComponent(product.discount || '0')}&invoice_date=${encodeURIComponent(product.valid_stopped_date || new Date().toISOString().split('T')[0])}&invoice_no=${encodeURIComponent(product.sr_no ? product.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001')}&first_name=${encodeURIComponent(billing.firstName)}&last_name=${encodeURIComponent(billing.lastName)}&email=${encodeURIComponent(billing.email)}&address=${encodeURIComponent(billing.address)}&amount_received=${encodeURIComponent(product.amount_received || '0')}`}
                                target="_blank" rel="noopener noreferrer"
                                title="Download invoice PDF"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none' }}
                              >
                                <IconDownload size={16} color="#fff" />
                              </a>
                              <button
                                onClick={() => startEditPayment({ ...product, renewal_sr_no: product.sr_no, id: null })}
                                title="Edit payment"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'transparent', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.4)', cursor: 'pointer' }}
                              >
                                <IconEdit size={16} color="#14b8a6" />
                              </button>
                              <button
                                onClick={() => deleteOldRenewalPayment(product.sr_no)}
                                title="Delete payment"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer' }}
                              >
                                <IconTrash size={16} color="#f87171" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Then: show unpaid products (products with no entries in payments table AND no/partial payment in renewals) */}
                    {(history || []).filter(product => {
                      // Check if this product has entries in the payments table
                      const hasPaymentsInTable = clientPayments.some(p => p.renewal_sr_no === product.sr_no);
                      // Also skip if it has reference + amount (paid via old method)
                      const hasOldPayment = (product.reference_no && product.reference_no.trim() !== '') || parseAmount(product.amount_received) > 0;
                      return !hasPaymentsInTable && !hasOldPayment && !removedSrNos.includes(product.sr_no) && !deletedPaymentSrNos.includes(product.sr_no);
                    }).map((product) => {
                      const billing = getBillingInfo(product);
                      return (
                        <tr key={`unpaid-${product.sr_no}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                          <td style={{ padding: '16px 8px' }}>
                            <span style={{ color: '#EF4444', fontWeight: '700', fontSize: '11px' }}>UNPAID</span>
                          </td>
                          <td style={{ padding: '16px 8px', fontWeight: '600' }}>{product.month || '—'}</td>
                          <td style={{ padding: '16px 8px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>—</span>
                          </td>
                          <td style={{ padding: '16px 8px' }}>
                            <ProductBadge tier={product.tier} setup_type={product.setup_type} is_trial={product.is_trial} is_ponctual={product.is_ponctual_upgrade == 1} original_tier={product.original_tier} original_setup={product.original_setup} />
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>—</td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>—</td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>—</td>
                          <td style={{ padding: '16px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>Sub: {product.subscription_fee || '0'}</span>
                              {product.setup_fee && <span>Setup: {product.setup_fee}</span>}
                              {product.discount && <span>Disc: {product.discount}</span>}
                            </div>
                          </td>
                          <td style={{ padding: '16px 8px' }}>{product.bank_name || '—'}</td>
                          <td style={{ padding: '16px 8px', color: '#EF4444', fontWeight: '700' }}>{(parseFloat(String(product.subscription_fee || '0').replace(/[^0-9.]/g, '')) + parseFloat(String(product.setup_fee || '0').replace(/[^0-9.]/g, '')) - parseFloat(String(product.discount || '0').replace(/[^0-9.]/g, ''))).toFixed(2)}</td>
                          <td style={{ padding: '16px 8px' }}>{product.valid_stopped_date || '—'}</td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{product.reference_no || '—'}</td>
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                              <a
                                href={`/api/invoice/generate?sr_no=${encodeURIComponent(product.sr_no || '')}&client_id=${client.id}&client_name=${encodeURIComponent(client.name || '')}&bank_name=${encodeURIComponent(product.bank_name || 'crypto')}&product_name=${encodeURIComponent(product.tier ? product.tier + (product.setup_type ? ' - ' + product.setup_type : '') : 'Service')}&subtotal=${encodeURIComponent((parseFloat(String(product.subscription_fee||'0').replace(/[^0-9.]/g,''))||0 + parseFloat(String(product.setup_fee||'0').replace(/[^0-9.]/g,''))||0).toFixed(2))}&discount=${encodeURIComponent(product.discount || '0')}&invoice_date=${encodeURIComponent(product.valid_stopped_date || new Date().toISOString().split('T')[0])}&invoice_no=${encodeURIComponent(product.sr_no ? product.sr_no.replace(/\D/g, '').slice(-4) || '001' : '001')}&first_name=${encodeURIComponent(billing.firstName)}&last_name=${encodeURIComponent(billing.lastName)}&email=${encodeURIComponent(billing.email)}&address=${encodeURIComponent(billing.address)}&amount_received=${encodeURIComponent(product.amount_received || '0')}`}
                                target="_blank" rel="noopener noreferrer"
                                title="Download invoice PDF"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none' }}
                              >
                                <IconDownload size={16} color="#fff" />
                              </a>
                              <button
                                onClick={() => sendInvoiceViaTelegram(product)}
                                disabled={sendingRowSrNo === product.sr_no}
                                title="Send invoice via Telegram"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: sendingRowSrNo === product.sr_no ? 'rgba(20, 184, 166, 0.3)' : 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.4)', cursor: sendingRowSrNo === product.sr_no ? 'not-allowed' : 'pointer' }}
                              >
                                {sendingRowSrNo === product.sr_no ? <IconTelegram size={16} color="#14b8a6" /> : <IconSend size={16} color="#14b8a6" />}
                              </button>
                              <button
                                onClick={() => startEditPayment({ ...product, renewal_sr_no: product.sr_no, id: null })}
                                title="Edit payment"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'transparent', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.4)', cursor: 'pointer' }}
                              >
                                <IconEdit size={16} color="#14b8a6" />
                              </button>
                              <button
                                onClick={() => removeProductAt(history.indexOf(product))}
                                title="Remove product"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer' }}
                              >
                                <IconTrash size={16} color="#f87171" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {clientPayments.length === 0 && (history || []).filter(p => !removedSrNos.includes(p.sr_no) && !deletedPaymentSrNos.includes(p.sr_no)).length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No payments recorded yet. Click "Record Payment" to add a payment.
                        </td>
                      </tr>
                    )}
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

      {/* Ponctual Upgrade Modal */}
      {showPonctualUpgradeModal && (
        <PonctualUpgradeModal
          clientId={client?.id}
          products={displayProducts}
          currentProduct={ponctualUpgradeProduct}
          onClose={() => { setShowPonctualUpgradeModal(false); setPonctualUpgradeProduct(null); }}
          onUpgraded={() => { setShowPonctualUpgradeModal(false); setPonctualUpgradeProduct(null); onClientUpdated && onClientUpdated(); }}
        />
      )}
    </div>
  );
}
