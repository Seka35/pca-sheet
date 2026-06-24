import { NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// DELETE: clear payment fields from a renewal row (for old payments stored directly in renewals)
export async function DELETE(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const srNo = segments[segments.length - 1];

    if (!srNo) {
      return NextResponse.json({ error: 'Invalid sr_no' }, { status: 400 });
    }

    const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [srNo]);
    if (!renewal) {
      return NextResponse.json({ error: 'Renewal not found' }, { status: 404 });
    }

    // Clear the payment fields - effectively "unpaying" this renewal
    run(`
      UPDATE renewals SET
        amount_received = '',
        payment_received_date = '',
        payment_received_month = '',
        reference_no = '',
        bank_name = '',
        visual_status = 'Active'
      WHERE sr_no = ?
    `, [srNo]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/renewals/[sr_no]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
