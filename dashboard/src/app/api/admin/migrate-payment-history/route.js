import { NextResponse } from 'next/server';
import { run, all, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// POST /api/admin/migrate-payment-history
// Runs the migration to populate client_products and payment_history from renewals
export async function POST(req) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const results = {
      client_products_created: 0,
      payment_history_created: 0,
      valid_until_updated: 0,
      errors: []
    };

    // STEP 1: Create client_products from renewals
    try {
      const insertProducts = run(`
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
          AND NOT EXISTS (
            SELECT 1 FROM client_products cp
            WHERE cp.client_id = r.client_id
            AND cp.tier = r.tier
            AND cp.start_date = r.start_date
          )
        GROUP BY r.client_id, r.tier, r.setup_type, r.start_date,
                 r.original_tier, r.original_setup, r.is_ponctual_upgrade,
                 r.subscription_fee, r.setup_fee, r.discount, r.ad_spend_limit, r.visual_status
      `);
      results.client_products_created = insertProducts.changes;
    } catch (e) {
      results.errors.push(`Step 1 (client_products): ${e.message}`);
    }

    // STEP 2: Create payment_history from renewals (old-style payments)
    try {
      const insertPayments = run(`
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
           )
      `);
      results.payment_history_created = insertPayments.changes;
    } catch (e) {
      results.errors.push(`Step 2 (payment_history from renewals): ${e.message}`);
    }

    // STEP 3: Create payment_history from payment_transactions
    try {
      const insertTxPayments = run(`
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
           )
      `);
      results.payment_history_created += insertTxPayments.changes;
    } catch (e) {
      results.errors.push(`Step 3 (payment_history from transactions): ${e.message}`);
    }

    // STEP 4: Recalculate valid_until
    try {
      const updateValidUntil = run(`
        UPDATE client_products cp
        SET valid_until = (
          SELECT MAX(ph.until_date)
          FROM payment_history ph
          WHERE ph.product_id = cp.id
        )
        WHERE EXISTS (
          SELECT 1 FROM payment_history ph WHERE ph.product_id = cp.id
        )
      `);
      results.valid_until_updated = updateValidUntil.changes;
    } catch (e) {
      results.errors.push(`Step 4 (valid_until update): ${e.message}`);
    }

    // STEP 5: Fix original_* for ponctual products
    try {
      run(`
        UPDATE client_products cp
        SET
          original_tier = tier,
          original_setup = setup_type
        WHERE is_ponctual = 1
          AND (original_tier IS NULL OR original_tier = '')
      `);
    } catch (e) {
      results.errors.push(`Step 5 (original_* fix): ${e.message}`);
    }

    // Get summary counts
    const productCount = get('SELECT COUNT(*) as cnt FROM client_products');
    const historyCount = get('SELECT COUNT(*) as cnt FROM payment_history');

    return NextResponse.json({
      ok: true,
      results,
      summary: {
        total_client_products: productCount?.cnt || 0,
        total_payment_history: historyCount?.cnt || 0
      }
    });
  } catch (e) {
    console.error('[POST /api/admin/migrate-payment-history]', e);
    return NextResponse.json({ error: 'Migration failed: ' + e.message }, { status: 500 });
  }
}

// GET /api/admin/migrate-payment-history
// Returns migration status / counts
export async function GET(req) {
  const auth = requirePermission(req, 'view_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const productCount = get('SELECT COUNT(*) as cnt FROM client_products');
    const historyCount = get('SELECT COUNT(*) as cnt FROM payment_history');
    const renewalCount = get('SELECT COUNT(*) as cnt FROM renewals');

    // Check if already migrated (rough check)
    const migratedClients = get(`
      SELECT COUNT(DISTINCT client_id) as cnt FROM client_products
    `);

    return NextResponse.json({
      status: {
        client_products: productCount?.cnt || 0,
        payment_history: historyCount?.cnt || 0,
        renewals: renewalCount?.cnt || 0,
        clients_with_products: migratedClients?.cnt || 0
      }
    });
  } catch (e) {
    console.error('[GET /api/admin/migrate-payment-history]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
