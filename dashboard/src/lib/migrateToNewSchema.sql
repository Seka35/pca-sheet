-- Migration Script: Populate client_products and payment_history from renewals
-- This migration is idempotent - safe to run multiple times
-- WARNING: This migration creates NEW records in client_products and payment_history
-- It does NOT modify existing renewals data

-- =============================================================================
-- STEP 1: Create client_products from renewals
-- For each unique (client_id, tier, start_date), create one product
-- =============================================================================

-- Insert new client_products (skip if already migrated - check by start_date + client_id + tier)
INSERT INTO client_products (
  client_id, tier, setup_type, original_tier, original_setup,
  is_ponctual, start_date, valid_until, subscription_fee,
  setup_fee, discount, ad_spend_limit, is_active
)
SELECT
  r.client_id,
  r.tier,
  r.setup_type,
  COALESCE(NULLIF(r.original_tier, ''), r.tier) as original_tier,
  COALESCE(NULLIF(r.original_setup, ''), r.setup_type) as original_setup,
  COALESCE(r.is_ponctual_upgrade, 0) as is_ponctual,
  r.start_date,
  MAX(r.valid_stopped_date) as valid_until,
  r.subscription_fee,
  r.setup_fee,
  r.discount,
  r.ad_spend_limit,
  CASE WHEN r.visual_status = 'Active' THEN 1 ELSE 0 END as is_active
FROM renewals r
WHERE r.tier IS NOT NULL
  AND r.tier != ''
  -- Only insert if not already migrated (check by start_date + client_id + tier)
  AND NOT EXISTS (
    SELECT 1 FROM client_products cp
    WHERE cp.client_id = r.client_id
    AND cp.tier = r.tier
    AND cp.start_date = r.start_date
  )
GROUP BY r.client_id, r.tier, r.setup_type, r.start_date,
         r.original_tier, r.original_setup, r.is_ponctual_upgrade,
         r.subscription_fee, r.setup_fee, r.discount, r.ad_spend_limit, r.visual_status;

-- =============================================================================
-- STEP 2: Create payment_history from renewals (old-style payments)
-- For renewals with reference_no or amount_received
-- =============================================================================

-- Insert MONTHLY payment history for renewals with payments
INSERT INTO payment_history (
  client_id, product_id, type,
  from_tier, to_tier, from_setup, to_setup,
  amount, date, until_date,
  is_manual_entry
)
SELECT
  r.client_id,
  (SELECT cp.id FROM client_products cp
   WHERE cp.client_id = r.client_id
   AND cp.tier = r.tier
   AND cp.start_date = r.start_date
   LIMIT 1) as product_id,
  'MONTHLY',
  r.tier, r.tier, r.setup_type, r.setup_type,
  r.amount_received,
  COALESCE(r.payment_received_date, r.valid_stopped_date),
  r.valid_stopped_date,
  0
FROM renewals r
WHERE (r.amount_received IS NOT NULL AND r.amount_received != '' AND r.amount_received != '0')
   OR (r.reference_no IS NOT NULL AND r.reference_no != '')
   -- Only insert if not already migrated
   AND NOT EXISTS (
    SELECT 1 FROM payment_history ph
    WHERE ph.product_id = (
      SELECT cp.id FROM client_products cp
      WHERE cp.client_id = r.client_id
      AND cp.tier = r.tier
      AND cp.start_date = r.start_date
      LIMIT 1
    )
    AND ph.type = 'MONTHLY'
    AND ph.date = COALESCE(r.payment_received_date, r.valid_stopped_date)
   );

-- =============================================================================
-- STEP 3: Create payment_history from payment_transactions
-- For UPGRADE, RETURN, PROMOTION, etc.
-- =============================================================================

-- Insert upgrade transactions
INSERT INTO payment_history (
  client_id, product_id, type,
  from_tier, to_tier, from_setup, to_setup,
  prorata_amount, amount, date, until_date,
  notes, is_manual_entry
)
SELECT
  pt.client_id,
  (SELECT cp.id FROM client_products cp
   WHERE cp.client_id = pt.client_id
   AND cp.tier = pt.to_tier
   LIMIT 1) as product_id,
  pt.type,
  pt.from_tier, pt.to_tier, pt.from_setup, pt.to_setup,
  pt.prorata_amount, pt.amount, pt.date, pt.until_date,
  pt.notes,
  COALESCE(pt.is_manual_entry, 0)
FROM payment_transactions pt
WHERE pt.type IN ('UPGRADE', 'UPGRADE_PERMANENT', 'SUB_UPGRADE', 'RETURN', 'PROMOTION', 'RENEWAL_PONCTUAL')
  -- Only insert if not already migrated
  AND NOT EXISTS (
    SELECT 1 FROM payment_history ph
    WHERE ph.product_id = (
      SELECT cp.id FROM client_products cp
      WHERE cp.client_id = pt.client_id
      AND cp.tier = pt.to_tier
      LIMIT 1
    )
    AND ph.type = pt.type
    AND ph.date = pt.date
   );

-- =============================================================================
-- STEP 4: Recalculate valid_until for all products based on MAX of payment_history
-- =============================================================================

UPDATE client_products cp
SET valid_until = (
  SELECT MAX(ph.until_date)
  FROM payment_history ph
  WHERE ph.product_id = cp.id
)
WHERE EXISTS (
  SELECT 1 FROM payment_history ph WHERE ph.product_id = cp.id
);

-- =============================================================================
-- STEP 5: For products with ponctual upgrades, ensure original_* is set
-- =============================================================================

UPDATE client_products cp
SET
  original_tier = tier,
  original_setup = setup_type
WHERE is_ponctual = 1
  AND (original_tier IS NULL OR original_tier = '');

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Summary query to verify migration
SELECT
  'client_products' as table_name,
  COUNT(*) as record_count
FROM client_products
UNION ALL
SELECT
  'payment_history' as table_name,
  COUNT(*) as record_count
FROM payment_history;
