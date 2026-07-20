import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

// POST /api/client-products - Create a new product for a client
export async function POST(req) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      client_id, tier, setup_type, subscription_fee, setup_fee,
      discount, ad_spend_limit, start_date, is_ponctual, notes
    } = body;

    if (!client_id || !tier || !start_date) {
      return NextResponse.json({ error: 'client_id, tier, and start_date are required' }, { status: 400 });
    }

    // Verify client exists
    const client = get('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Calculate valid_until = start_date + 1 month
    const validUntil = (() => {
      const d = new Date(start_date);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Insert the new product
    const result = run(`
      INSERT INTO client_products (
        client_id, tier, setup_type, original_tier, original_setup,
        is_ponctual, start_date, valid_until, subscription_fee,
        setup_fee, discount, ad_spend_limit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      client_id,
      tier,
      setup_type || null,
      tier, // original_tier = current tier
      setup_type || null, // original_setup = current setup
      is_ponctual ? 1 : 0,
      start_date,
      validUntil,
      subscription_fee || '0',
      setup_fee || '0',
      discount || '0',
      ad_spend_limit || null
    ]);

    const productId = result.lastInsertRowid;

    // Record initial MONTHLY payment history
    run(`
      INSERT INTO payment_history (
        client_id, product_id, type,
        from_tier, to_tier, from_setup, to_setup,
        amount, date, until_date, notes, is_manual_entry
      ) VALUES (?, ?, 'MONTHLY', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id,
      productId,
      tier, tier,
      setup_type || null,
      setup_type || null,
      subscription_fee || '0',
      start_date,
      validUntil,
      notes || null,
      0 // is_manual_entry
    ]);

    const product = get('SELECT * FROM client_products WHERE id = ?', [productId]);
    logActivity(auth.user?.id, auth.user?.username, 'CREATE', 'client_products', productId, `Product ${tier} for client ${client_id}`);

    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/client-products]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/client-products - Get all products for a client
export async function GET(req) {
  const auth = requirePermission(req, 'view_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('client_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    let query = 'SELECT * FROM client_products WHERE client_id = ?';
    if (!includeInactive) {
      query += ' AND is_active = 1';
    }
    query += ' ORDER BY start_date DESC';

    const products = all(query, [clientId]);

    return NextResponse.json({ products });
  } catch (e) {
    console.error('[GET /api/client-products]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
