// WHOP Payment Links Configuration
// Organized by Referral Partner and Product Type
// Used by: Bank Details UI, Invoice Generation, Telegram Bot Reminders

export const WHOP_REFERRAL_PARTNERS = ['N.A.', 'Chris', 'No Limit', '8 Labs', 'Master'];

// Discount percentage given to the CLIENT (applied on subscription + setup)
export const WHOP_DISCOUNT_BY_PARTNER = {
  'N.A.': 0,
  'Chris': 0,
  'No Limit': 15,   // 15% discount on (tier + setup) for client
  '8 Labs': 15,
  'Master': 15,
};

// Referral commission rates for partners (percentage of each payment to reverse to partner)
// Chris: 10% only on month 1
// No Limit: 2.5% every month (cumulative)
// 8 Labs: 2.5% every month (cumulative)
// Master: 5% every month (cumulative)
export const WHOP_REFERRAL_COMMISSION_RATES = {
  'N.A.': 0,
  'Chris': { rate: 10, duration: 1 },         // 10% month 1 only
  'No Limit': { rate: 2.5, duration: 'all' }, // 2.5% every month
  '8 Labs': { rate: 2.5, duration: 'all' },   // 2.5% every month
  'Master': { rate: 5, duration: 'all' },     // 5% every month
};

export const WHOP_PARTNER_WEBSITE = {
  'N.A.': null,
  'Chris': 'https://primecircle-agency.com/chris',
  'No Limit': 'https://primecircle-agency.com/nolimit',
  '8 Labs': null,
  'Master': 'https://primecircle-agency.com/master',
};

// Setup Price Links
export const WHOP_SETUP_LINKS = {
  oldSetup: 'https://whop.com/wcaftm-llc/setup-pca/',
  newClient: {
    starter: 'https://whop.com/wcaftm-llc/pca-set-up-starter',
    premium: 'https://whop.com/wcaftm-llc/pca-set-up-premium',
    vip: 'https://whop.com/wcaftm-llc/pca-set-up-premium-4a',
  },
  otherProducts: {
    onlyProfile: 'https://whop.com/wcaftm-llc/pca-1-extra-fb-profile',
    onlyPage: 'https://whop.com/wcaftm-llc/1-extra-fb-page',
    extraBM: 'https://whop.com/wcaftm-llc/1-extra-bm/',
  },
};

// Tier Links by Referral Partner
// N.A. and Chris share the same links (0% discount)
const WHOP_TIER_LINKS_NA_CHRIS = {
  tier1: 'https://whop.com/wcaftm-llc/pca-tier1/',
  tier2: 'https://whop.com/wcaftm-llc/tier-2-6b-db7c/',
  tier3: 'https://whop.com/wcaftm-llc/pca-tier-3/',
  tier4: 'https://whop.com/wcaftm-llc/pca-tier-4/',
  tier5: 'https://whop.com/wcaftm-llc/pca-tier-5/',
  tier6: 'https://whop.com/wcaftm-llc/pca-tier6/',
  tier1_7d_free: 'https://whop.com/wcaftm-llc/pca-tier-1-7-days-free',
  tier2_7d_free: 'https://whop.com/wcaftm-llc/pca-tier-2-7-days-free-trial',
  tier3_7d_free: 'https://whop.com/wcaftm-llc/pca-tier-3-7-days-free-trial',
  tier4_7d_free: 'https://whop.com/wcaftm-llc/pca-tier-4-7-days-free-trial',
  tier5_7d_free: 'https://whop.com/wcaftm-llc/pca-tier-5-7-days-free-trial',
  tier6_7d_free: 'https://whop.com/wcaftm-llc/pca-tier-6-7-days-free-trial',
};

// No Limit (15% discount)
const WHOP_TIER_LINKS_NO_LIMIT = {
  tier1: 'https://whop.com/checkout/plan_vsgVy32aS6wEE',
  tier2: 'https://whop.com/checkout/plan_acFXSJ5bVnNzs',
  tier3: 'https://whop.com/checkout/plan_rOEka7oXYmOMU',
  tier4: 'https://whop.com/checkout/plan_4eQs8tCjLIQR9',
  tier5: 'https://whop.com/checkout/plan_jIUlPyX1f4FjR',
  tier6: 'https://whop.com/checkout/plan_wP93g0lz9nETb',
  tier1_7d_free: 'https://whop.com/checkout/plan_vZLv2nfs9FULn',
  tier2_7d_free: 'https://whop.com/checkout/plan_2MvSTl0715cWS',
  tier3_7d_free: 'https://whop.com/checkout/plan_g5Cm67QgfGXrN',
  tier4_7d_free: 'https://whop.com/checkout/plan_0uqz2MuD6Y27J',
  tier5_7d_free: 'https://whop.com/checkout/plan_wJjXJ9qhCqtv5',
  tier6_7d_free: 'https://whop.com/checkout/plan_opAeK2mpPo6oL',
  tier1_50_off: 'https://whop.com/checkout/plan_zFaL6KSREVUKQ',
  tier2_50_off: 'https://whop.com/checkout/plan_hzG20DO2ZJm70',
  tier3_50_off: 'https://whop.com/checkout/plan_6rXVn26Djhv16',
  tier4_50_off: 'https://whop.com/checkout/plan_VuhNYrdI2qT0y',
  tier5_50_off: 'https://whop.com/checkout/plan_L6bCf7daNhotp',
};

// 8 Labs (15% discount)
const WHOP_TIER_LINKS_8_LABS = {
  tier1: 'https://whop.com/checkout/plan_MB5ypBKPo4Mju',
  tier2: 'https://whop.com/checkout/plan_eRpxa5AE58GUi',
  tier3: 'https://whop.com/checkout/plan_ccQSyqumJX4At',
  tier4: 'https://whop.com/checkout/plan_kPlaUCznNuryl',
  tier5: 'https://whop.com/checkout/plan_GSrspTkxAq9Mu',
  tier6: 'https://whop.com/checkout/plan_t7wiVg7LNaKyW',
  tier1_7d_free: 'https://whop.com/checkout/plan_E5ANG8cV1JVti',
  tier2_7d_free: 'https://whop.com/checkout/plan_GtZLLNcNrPUQU',
  tier3_7d_free: 'https://whop.com/checkout/plan_zVdvQOLeoPFjh',
  tier4_7d_free: 'https://whop.com/checkout/plan_K1ZfxzwaERPwg',
  tier5_7d_free: 'https://whop.com/checkout/plan_vWjNIDuaJO8OR',
  tier6_7d_free: 'https://whop.com/checkout/plan_2frxQQcxfs4GJ',
  tier1_50_off: 'https://whop.com/checkout/plan_u99HUbo9bIhMr',
  tier2_50_off: 'https://whop.com/checkout/plan_d1CEd06ipWkRC',
  tier3_50_off: 'https://whop.com/checkout/plan_7OZYFylR2Vy6B',
  tier4_50_off: 'https://whop.com/checkout/plan_CkBCFsHsLFjsT',
  tier5_50_off: 'https://whop.com/checkout/plan_K0ChWLanYUIoO',
};

// Master (15% discount)
const WHOP_TIER_LINKS_MASTER = {
  tier1: 'https://whop.com/checkout/plan_8cKJWTDvYoYY3',
  tier2: 'https://whop.com/checkout/plan_8LWFPXD1tXGW2',
  tier3: 'https://whop.com/checkout/plan_yq4RA2jYK8uVc',
  tier4: 'https://whop.com/checkout/plan_43WWp5g3wnqq4',
  tier5: 'https://whop.com/checkout/plan_qLSenRDjbo1r5',
  tier6: 'https://whop.com/checkout/plan_iiyTrJXslbRLi',
  tier1_7d_free: 'https://whop.com/checkout/plan_MBIA1S0yr5Aai',
  tier2_7d_free: 'https://whop.com/checkout/plan_FxYvJauOxQw5e',
  tier3_7d_free: 'https://whop.com/checkout/plan_USYDWICLbtvFf',
  tier4_7d_free: 'https://whop.com/checkout/plan_IW9MZazAIzLld',
  tier5_7d_free: 'https://whop.com/checkout/plan_NeK79MMR7zkOd',
  tier6_7d_free: 'https://whop.com/checkout/plan_Rc7SDnawZY9Kf',
  tier1_50_off: 'https://whop.com/checkout/plan_hoD1QUYcQ1muy',
  tier2_50_off: 'https://whop.com/checkout/plan_EMQWpw5zeG4cx',
  tier3_50_off: 'https://whop.com/checkout/plan_vlsvWKvdQ8DkD',
  tier4_50_off: 'https://whop.com/checkout/plan_aFEqtwExwwJwW',
  tier5_50_off: 'https://whop.com/checkout/plan_i0VEWM05VAlXa',
};

export const WHOP_TIER_LINKS = {
  'N.A.': WHOP_TIER_LINKS_NA_CHRIS,
  'Chris': WHOP_TIER_LINKS_NA_CHRIS,
  'No Limit': WHOP_TIER_LINKS_NO_LIMIT,
  '8 Labs': WHOP_TIER_LINKS_8_LABS,
  'Master': WHOP_TIER_LINKS_MASTER,
};

/**
 * Get the appropriate WHOP payment link based on client info
 * @param {Object} params - Client parameters
 * @param {string} params.referralPartner - Referral partner name (N.A., Chris, No Limit, 8 Labs, Master)
 * @param {string} params.tier - Tier level (tier1, TIER 1, etc.) or full key like tier1_7d_free
 * @param {string} params.linkType - Type of link (tier, 7d_free, 50_off) - appended to tier if provided
 * @returns {string|null} The payment link or null if not found
 */
export function getWhopLink({ referralPartner, tier, linkType }) {
  const partner = referralPartner || 'N.A.';
  const tierLinks = WHOP_TIER_LINKS[partner];

  if (!tierLinks) {
    return null;
  }

  // Normalize tier: "TIER 1" -> "tier1", "Tier 1" -> "tier1"
  let normalizedTier = tier ? tier.toUpperCase().replace(/\s+/g, '').replace(/^TIER/, 'tier') : 'tier1';

  // If linkType is provided, append it to the tier key
  if (linkType && linkType !== 'tier') {
    normalizedTier = `${normalizedTier}_${linkType}`;
  }

  return tierLinks[normalizedTier] || null;
}

/**
 * Get all WHOP links for a specific partner
 * @param {string} referralPartner - Referral partner name
 * @returns {Object} All links for the partner
 */
export function getWhopLinksByPartner(referralPartner) {
  return WHOP_TIER_LINKS[referralPartner] || WHOP_TIER_LINKS['N.A.'];
}

/**
 * Get the discount percentage for a partner
 * @param {string} referralPartner - Referral partner name
 * @returns {number} Discount percentage (0 or negative)
 */
export function getWhopDiscount(referralPartner) {
  return WHOP_DISCOUNT_BY_PARTNER[referralPartner] || 0;
}

/**
 * Calculate the discount amount for a client based on referral partner
 * Discount is 15% of (subscription + setup)
 * @param {string} referralPartner - Referral partner name
 * @param {number} subscriptionFee - The subscription/tier fee
 * @param {number} setupFee - The setup fee
 * @returns {number} The discount amount in dollars
 */
export function calculateClientDiscount(referralPartner, subscriptionFee, setupFee) {
  const discountPct = WHOP_DISCOUNT_BY_PARTNER[referralPartner] || 0;
  if (discountPct <= 0) return 0;
  const subtotal = (parseFloat(subscriptionFee) || 0) + (parseFloat(setupFee) || 0);
  return Math.round(subtotal * discountPct / 100);
}

/**
 * Calculate the cumulative referral commission owed to a partner
 * Based on all payments made by the client
 * @param {string} referralPartner - Referral partner name
 * @param {Array<{amount_received: string|number, month: string}>} payments - Array of payments (must have amount_received and month)
 * @returns {number} The cumulative commission amount
 */
export function calculateReferralCommission(referralPartner, payments) {
  const commissionConfig = WHOP_REFERRAL_COMMISSION_RATES[referralPartner];
  if (!commissionConfig || commissionConfig.rate === 0) return 0;

  const { rate, duration } = commissionConfig;

  // Sort payments by month (chronological) to handle Chris's month-1-only rule
  // Filter out top-up payments (they don't generate commission)
  const sortedPayments = [...(payments || [])]
    .filter(p => !p.is_topup)
    .sort((a, b) => {
      if (!a.month || !b.month) return 0;
      return new Date(a.month) - new Date(b.month);
    });

  let totalCommission = 0;

  if (duration === 1) {
    // Chris: 10% only on first payment
    if (sortedPayments.length > 0) {
      const firstPayment = parseFloat(sortedPayments[0].amount_received) || 0;
      totalCommission = Math.round(firstPayment * rate / 100);
    }
  } else {
    // All other partners: rate% of every payment (cumulative)
    for (const payment of sortedPayments) {
      const amount = parseFloat(payment.amount_received) || 0;
      totalCommission += Math.round(amount * rate / 100);
    }
  }

  return totalCommission;
}
