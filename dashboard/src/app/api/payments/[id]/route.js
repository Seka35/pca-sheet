import { NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// PUT: update an existing payment
export async function PUT(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
    }

    const body = await req.json();
    const { amount_received, payment_received_date, payment_received_month, reference_no, bank_name } = body;

    const payment = get('SELECT * FROM payments WHERE id = ?', [id]);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    run(`
      UPDATE payments SET
        amount_received = ?,
        payment_received_date = ?,
        payment_received_month = ?,
        reference_no = ?,
        bank_name = ?
      WHERE id = ?
    `, [
      amount_received || '0',
      payment_received_date || '',
      payment_received_month || '',
      reference_no || '',
      bank_name || '',
      id
    ]);

    // Recalculate the renewal's amount_received from all its payments
    if (payment.renewal_sr_no) {
      const paymentSum = get(`
        SELECT SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)) as total
        FROM payments WHERE renewal_sr_no = ?
      `, [payment.renewal_sr_no]);
      const totalAmount = paymentSum?.total || 0;

      const latestPayment = get(`
        SELECT payment_received_date, payment_received_month, reference_no, bank_name
        FROM payments
        WHERE renewal_sr_no = ?
        ORDER BY COALESCE(payment_received_date, '1900-01-01') DESC, id DESC
        LIMIT 1
      `, [payment.renewal_sr_no]);

      if (latestPayment) {
        run(`
          UPDATE renewals SET
            amount_received = ?,
            payment_received_date = ?,
            payment_received_month = ?,
            reference_no = ?,
            bank_name = ?
          WHERE sr_no = ?
        `, [
          totalAmount.toString(),
          latestPayment.payment_received_date,
          latestPayment.payment_received_month,
          latestPayment.reference_no || '',
          latestPayment.bank_name || '',
          payment.renewal_sr_no
        ]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/payments/[id]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Get ID from URL path - more reliable in Next.js 16
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const id = segments[segments.length - 1];
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
    }

    // Get the payment to find its renewal_sr_no
    const payment = get('SELECT * FROM payments WHERE id = ?', [id]);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Delete the payment
    run('DELETE FROM payments WHERE id = ?', [id]);

    // Recalculate the renewal's amount_received from remaining payments
    if (payment.renewal_sr_no) {
      const paymentSum = get(`
        SELECT SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)) as total
        FROM payments WHERE renewal_sr_no = ?
      `, [payment.renewal_sr_no]);
      const totalAmount = paymentSum?.total || 0;

      // Get the most recent payment for date/reference/bank info
      const latestPayment = get(`
        SELECT payment_received_date, payment_received_month, reference_no, bank_name
        FROM payments
        WHERE renewal_sr_no = ?
        ORDER BY COALESCE(payment_received_date, '1900-01-01') DESC, id DESC
        LIMIT 1
      `, [payment.renewal_sr_no]);

      if (latestPayment) {
        run(`
          UPDATE renewals SET
            amount_received = ?,
            payment_received_date = ?,
            payment_received_month = ?,
            reference_no = ?,
            bank_name = ?
          WHERE sr_no = ?
        `, [
          totalAmount.toString(),
          latestPayment.payment_received_date,
          latestPayment.payment_received_month,
          latestPayment.reference_no || '',
          latestPayment.bank_name || '',
          payment.renewal_sr_no
        ]);
      } else {
        // No more payments - reset to 0
        run(`
          UPDATE renewals SET
            amount_received = '0',
            payment_received_date = '',
            payment_received_month = '',
            reference_no = '',
            bank_name = ''
          WHERE sr_no = ?
        `, [payment.renewal_sr_no]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/payments/[id]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
