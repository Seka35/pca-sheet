import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

// GET /api/client-products/[id] - Get a single product
export async function GET(req, { params }) {
  const auth = requirePermission(req, 'view_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const product = get('SELECT * FROM client_products WHERE id = ?', [id]);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get payment history for this product
    const payments = all(`
      SELECT * FROM payment_history
      WHERE product_id = ?
      ORDER BY date DESC
    `, [id]);

    return NextResponse.json({ product, payments });
  } catch (e) {
    console.error('[GET /api/client-products/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/client-products/[id] - Update a product
export async function PUT(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const {
      tier, setup_type, subscription_fee, setup_fee,
      discount, ad_spend_limit, valid_until, is_ponctual, is_active
    } = body;

    const existing = get('SELECT * FROM client_products WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Build update query dynamically - only update provided fields
    const updates = [];
    const values = [];

    if (tier !== undefined) { updates.push('tier = ?'); values.push(tier); }
    if (setup_type !== undefined) { updates.push('setup_type = ?'); values.push(setup_type); }
    if (subscription_fee !== undefined) { updates.push('subscription_fee = ?'); values.push(subscription_fee); }
    if (setup_fee !== undefined) { updates.push('setup_fee = ?'); values.push(setup_fee); }
    if (discount !== undefined) { updates.push('discount = ?'); values.push(discount); }
    if (ad_spend_limit !== undefined) { updates.push('ad_spend_limit = ?'); values.push(ad_spend_limit); }
    if (valid_until !== undefined) { updates.push('valid_until = ?'); values.push(valid_until); }
    if (is_ponctual !== undefined) { updates.push('is_ponctual = ?'); values.push(is_ponctual ? 1 : 0); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`UPDATE client_products SET ${updates.join(', ')} WHERE id = ?`, values);

    const updated = get('SELECT * FROM client_products WHERE id = ?', [id]);
    logActivity(auth.user?.id, auth.user?.username, 'UPDATE', 'client_products', id, `Updated product`);

    return NextResponse.json({ ok: true, product: updated });
  } catch (e) {
    console.error('[PUT /api/client-products/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/client-products/[id] - Soft delete a product
export async function DELETE(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const existing = get('SELECT * FROM client_products WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Soft delete
    run('UPDATE client_products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    logActivity(auth.user?.id, auth.user?.username, 'DELETE', 'client_products', id, `Deactivated product`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/client-products/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
