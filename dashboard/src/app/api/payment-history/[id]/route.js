import { NextResponse } from 'next/server';
import { run, get, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

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
