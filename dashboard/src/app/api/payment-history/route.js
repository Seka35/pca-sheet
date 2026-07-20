import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

// POST /api/payment-history - Add a new payment history entry
export async function POST(req) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      client_id, product_id, type,
      from_tier, to_tier, from_setup, to_setup,
      prorata_amount, amount, date, until_date, notes,
      is_manual_entry
    } = body;

    if (!client_id || !product_id || !type || !date) {
      return NextResponse.json({ error: 'client_id, product_id, type, and date are required' }, { status: 400 });
    }

    // Verify product exists
    const product = get('SELECT * FROM client_products WHERE id = ?', [product_id]);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Validate type
    const validTypes = ['MONTHLY', 'UPGRADE_PONCTUAL', 'UPGRADE_PERMANENT', 'RETURN', 'TOPUP', 'PROMOTION', 'SUB_UPGRADE'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Insert the payment history entry
    const result = run(`
      INSERT INTO payment_history (
        client_id, product_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date, notes, is_manual_entry
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id,
      product_id,
      type,
      from_tier || null,
      to_tier || null,
      from_setup || null,
      to_setup || null,
      prorata_amount || null,
      amount || '0',
      date,
      until_date || null,
      notes || null,
      is_manual_entry ? 1 : 0
    ]);

    // Update product valid_until to MAX of all payment_history until_dates
    if (until_date) {
      const maxUntilDate = get(`
        SELECT MAX(until_date) as max_date FROM payment_history WHERE product_id = ?
      `, [product_id]);

      if (maxUntilDate && maxUntilDate.max_date) {
        run('UPDATE client_products SET valid_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [maxUntilDate.max_date, product_id]);
      }
    }

    // Apply side effects based on type
    if (type === 'UPGRADE_PONCTUAL') {
      // Mark product as ponctual and store original tier/setup
      const originalTier = product.original_tier || product.tier;
      const originalSetup = product.original_setup || product.setup_type;

      run(`
        UPDATE client_products SET
          is_ponctual = 1,
          original_tier = ?,
          original_setup = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [originalTier, originalSetup, product_id]);
    }
    else if (type === 'RETURN') {
      // Restore original tier/setup
      run(`
        UPDATE client_products SET
          tier = COALESCE(?, tier),
          setup_type = COALESCE(?, setup_type),
          is_ponctual = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [to_tier, to_setup, product_id]);
    }
    else if (type === 'PROMOTION') {
      // Clear original_*, set is_ponctual=0
      run(`
        UPDATE client_products SET
          is_ponctual = 0,
          original_tier = tier,
          original_setup = setup_type,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [product_id]);
    }

    const entry = get('SELECT * FROM payment_history WHERE id = ?', [result.lastInsertRowid]);
    logActivity(auth.user?.id, auth.user?.username, 'CREATE', 'payment_history', entry.id, `Payment ${type} for product ${product_id}`);

    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/payment-history]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/payment-history - Get payment history entries
export async function GET(req) {
  const auth = requirePermission(req, 'view_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('client_id');
    const productId = searchParams.get('product_id');

    let query = 'SELECT ph.*, cp.tier as current_tier, cp.setup_type as current_setup_type FROM payment_history ph';
    query += ' LEFT JOIN client_products cp ON ph.product_id = cp.id';
    const conditions = [];
    const values = [];

    if (clientId) {
      conditions.push('ph.client_id = ?');
      values.push(clientId);
    }
    if (productId) {
      conditions.push('ph.product_id = ?');
      values.push(productId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY ph.date DESC, ph.id DESC';

    const payments = all(query, values);

    return NextResponse.json({ payments });
  } catch (e) {
    console.error('[GET /api/payment-history]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
