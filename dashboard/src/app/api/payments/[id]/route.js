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
    const { amount_received, payment_received_date, payment_received_month, reference_no, bank_name, whop_product_payments_json } = body;

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
        bank_name = ?,
        is_topup = ?,
        whop_product_payments_json = ?
      WHERE id = ?
    `, [
      amount_received || '0',
      payment_received_date || '',
      payment_received_month || '',
      reference_no || '',
      bank_name || '',
      body.is_topup ? 1 : 0,
      whop_product_payments_json || null,
      id
    ]);

    // Also update WHOP product payments table if WHOP bank selected
    if (whop_product_payments_json && bank_name === 'WHOP') {
      try {
        const whopPayments = JSON.parse(whop_product_payments_json);
        run(`DELETE FROM whop_product_payments WHERE renewal_sr_no = ?`, [payment.renewal_sr_no]);
        for (const p of whopPayments) {
          run(
            `INSERT INTO whop_product_payments (renewal_sr_no, product_type, product_name, whop_email, whop_payment_reference) VALUES (?, ?, ?, ?, ?)`,
            [payment.renewal_sr_no, p.product_type, p.product_name, p.whop_email || '', p.whop_payment_reference || '']
          );
        }
      } catch (e) {
        console.error('[PUT /api/payments/[id]] whop_product_payments error:', e.message);
      }
    }

    // Recalculate the renewal based on payment type (top-up vs regular)
    const isTopUp = payment.is_topup === 1;
    if (payment.renewal_sr_no) {
      const linkedRenewal = get('SELECT * FROM renewals WHERE sr_no = ?', [payment.renewal_sr_no]);

      if (isTopUp) {
        // Top-up: recalculate cl_amount = SUM of all payments for this renewal
        const paymentSum = get(`
          SELECT SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)) as total
          FROM payments WHERE renewal_sr_no = ?
        `, [payment.renewal_sr_no]);
        const totalCl = paymentSum?.total || 0;
        run(`UPDATE renewals SET cl_amount = ? WHERE sr_no = ?`, [totalCl.toString(), payment.renewal_sr_no]);
      } else {
        // Regular payment: recalculate amount_received = SUM of all payments
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

    // Recalculate the renewal based on payment type (top-up vs regular)
    const isTopUp = payment.is_topup === 1;
    if (payment.renewal_sr_no) {

      if (isTopUp) {
        // Top-up: recalculate cl_amount = SUM of remaining payments
        const paymentSum = get(`
          SELECT SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)) as total
          FROM payments WHERE renewal_sr_no = ?
        `, [payment.renewal_sr_no]);
        const totalCl = paymentSum?.total || 0;
        run(`UPDATE renewals SET cl_amount = ? WHERE sr_no = ?`, [totalCl.toString(), payment.renewal_sr_no]);
      } else {
        // Regular payment: recalculate amount_received = SUM of remaining payments
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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/payments/[id]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
