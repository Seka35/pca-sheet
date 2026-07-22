import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

// PUT /api/payment-history/[id] - Update a payment history entry
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
      from_tier, to_tier, from_setup, to_setup,
      prorata_amount, amount, date, until_date,
      reference_no, bank_name, notes
    } = body;

    const entry = get('SELECT * FROM payment_history WHERE id = ?', [id]);
    if (!entry) {
      return NextResponse.json({ error: 'Payment history entry not found' }, { status: 404 });
    }

    // Build notes from reference_no and bank_name if provided
    let finalNotes = notes;
    if (reference_no !== undefined || bank_name !== undefined) {
      const parts = [];
      if (reference_no) parts.push(`Ref: ${reference_no}`);
      if (bank_name) parts.push(`Bank: ${bank_name}`);
      if (notes) parts.push(notes);
      finalNotes = parts.join(' | ');
    }

    // Update the entry
    run(`
      UPDATE payment_history SET
        from_tier = COALESCE(?, from_tier),
        to_tier = COALESCE(?, to_tier),
        from_setup = COALESCE(?, from_setup),
        to_setup = COALESCE(?, to_setup),
        prorata_amount = COALESCE(?, prorata_amount),
        amount = COALESCE(?, amount),
        date = COALESCE(?, date),
        until_date = COALESCE(?, until_date),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [
      from_tier, to_tier, from_setup, to_setup,
      prorata_amount, amount, date, until_date, finalNotes,
      id
    ]);

    // Update product valid_until if until_date changed
    if (until_date) {
      const maxUntilDate = get(`
        SELECT MAX(until_date) as max_date FROM payment_history WHERE product_id = ?
      `, [entry.product_id]);

      if (maxUntilDate && maxUntilDate.max_date) {
        run('UPDATE client_products SET valid_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [maxUntilDate.max_date, entry.product_id]);
      }
    }

    logActivity(auth.user?.id, auth.user?.username, 'UPDATE', 'payment_history', id, `Updated manual payment entry`);

    const updated = get('SELECT * FROM payment_history WHERE id = ?', [id]);
    return NextResponse.json({ ok: true, entry: updated });
  } catch (e) {
    console.error('[PUT /api/payment-history/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/payment-history/[id] - Delete a payment history entry
export async function DELETE(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const entry = get('SELECT * FROM payment_history WHERE id = ?', [id]);
    if (!entry) {
      return NextResponse.json({ error: 'Payment history entry not found' }, { status: 404 });
    }

    // Only allow deletion of manual entries
    if (!entry.is_manual_entry) {
      return NextResponse.json({ error: 'Only manual entries can be deleted' }, { status: 403 });
    }

    const productId = entry.product_id;

    // Delete the entry
    run('DELETE FROM payment_history WHERE id = ?', [id]);

    // Recalculate valid_until for the product
    const maxUntilDate = get(`
      SELECT MAX(until_date) as max_date FROM payment_history WHERE product_id = ?
    `, [productId]);

    if (maxUntilDate && maxUntilDate.max_date) {
      run('UPDATE client_products SET valid_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [maxUntilDate.max_date, productId]);
    } else {
      // No more payment history, set valid_until to start_date + 1 month
      const product = get('SELECT start_date FROM client_products WHERE id = ?', [productId]);
      if (product && product.start_date) {
        const d = new Date(product.start_date);
        d.setMonth(d.getMonth() + 1);
        const newValidUntil = d.toISOString().split('T')[0];
        run('UPDATE client_products SET valid_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newValidUntil, productId]);
      }
    }

    logActivity(auth.user?.id, auth.user?.username, 'DELETE', 'payment_history', id, `Deleted manual payment entry`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/payment-history/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
