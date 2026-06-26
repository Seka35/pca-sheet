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

  // Get client's renewals
  const renewals = all(`
    SELECT r.*
    FROM renewals r
    WHERE r.client_id = ?
    ORDER BY r.month DESC, r.sr_no DESC
  `, [user.client_id]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatted = renewals.map(r => {
    const sub = parseFloat(String(r.subscription_fee || '0').replace(/[^0-9.-]+/g, '')) || 0;
    const setup = parseFloat(String(r.setup_fee || '0').replace(/[^0-9.-]+/g, '')) || 0;
    const disc = parseFloat(String(r.discount || '0').replace(/[^0-9.-]+/g, '')) || 0;
    const received = parseFloat(String(r.amount_received || '0').replace(/[^0-9.-]+/g, '')) || 0;
    const due = (sub + setup) - disc - received;
    const isPaid = r.reference_no && r.reference_no.trim() !== '';

    let diffDays = null;
    let renewalDate = null;
    if (r.valid_stopped_date) {
      const dueDate = new Date(r.valid_stopped_date);
      dueDate.setHours(0, 0, 0, 0);
      diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      renewalDate = r.valid_stopped_date;
    }

    return {
      sr_no: r.sr_no,
      tier: r.tier,
      setup_type: r.setup_type,
      month: r.month,
      subscription_fee: r.subscription_fee,
      setup_fee: r.setup_fee,
      discount: r.discount,
      amount_received: r.amount_received,
      total_due: due,
      is_paid: isPaid,
      valid_stopped_date: renewalDate,
      diff_days: diffDays,
      is_trial: r.is_trial === 1,
      visual_status: r.visual_status,
      start_date: r.start_date,
      reference_no: r.reference_no,
    };
  });

  return NextResponse.json(formatted);
}
