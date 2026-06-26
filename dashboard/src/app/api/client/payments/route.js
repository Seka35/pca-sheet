import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/auth';
import { all } from '@/lib/db';

export async function GET(req) {
  const userId = req.cookies.get('pca_user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserById(parseInt(userId, 10));

  if (!user || user.role !== 'client' || !user.client_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payments = all(`
    SELECT p.*, r.tier, r.setup_type, r.month as product_month
    FROM payments p
    LEFT JOIN renewals r ON p.renewal_sr_no = r.sr_no
    WHERE p.client_id = ?
    ORDER BY p.payment_received_date DESC, p.id DESC
  `, [user.client_id]);

  const totalPaid = payments.reduce((sum, p) => {
    return sum + (parseFloat(String(p.amount_received || '0').replace(/[^0-9.-]+/g, '')) || 0);
  }, 0);

  return NextResponse.json({
    payments: payments.map(p => ({
      id: p.id,
      date: p.payment_received_date,
      amount: p.amount_received,
      method: p.bank_name,
      reference: p.reference_no,
      notes: p.notes,
      is_topup: p.is_topup === 1,
      product: p.tier && p.setup_type ? `${p.tier} - ${p.setup_type}` : (p.tier || p.product_month || 'N/A'),
    })),
    total_paid: totalPaid,
  });
}
