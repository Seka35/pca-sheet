import { NextResponse } from 'next/server';
import { all, run, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// GET /api/payments - list payments, optionally filtered by client_id or renewal_sr_no
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const renewalSrNo = searchParams.get('renewal_sr_no');

  try {
    // With client_id: return from payments table
    if (clientId) {
      const payments = all(`
        SELECT p.*, r.tier, r.setup_type, r.month as product_month, r.client_name
        FROM payments p
        LEFT JOIN renewals r ON p.renewal_sr_no = r.sr_no
        WHERE p.client_id = ?
        ORDER BY p.payment_received_date DESC, p.id DESC
      `, [clientId]);
      return NextResponse.json(payments);
    }

    // With renewal_sr_no: return payments for that specific product
    if (renewalSrNo) {
      const payments = all(`
        SELECT p.*, r.tier, r.setup_type, r.month as product_month
        FROM payments p
        LEFT JOIN renewals r ON p.renewal_sr_no = r.sr_no
        WHERE p.renewal_sr_no = ?
        ORDER BY p.payment_received_date DESC, p.id DESC
      `, [renewalSrNo]);
      return NextResponse.json(payments);
    }

    // No filter: COMBINE payments table + renewals (old payments with ref/amount)
    const allPayments = [];

    // 1. New payments from payments table
    const newPayments = all(`
      SELECT
        p.id as payment_id,
        p.client_id,
        p.renewal_sr_no,
        p.amount_received,
        p.payment_received_date,
        p.payment_received_month,
        p.reference_no,
        p.bank_name,
        p.notes,
        p.created_at,
        r.tier,
        r.setup_type,
        r.month as product_month,
        r.client_name,
        c.telegram_group_id as client_email
      FROM payments p
      LEFT JOIN renewals r ON p.renewal_sr_no = r.sr_no
      LEFT JOIN clients c ON p.client_id = c.id
      ORDER BY p.payment_received_date DESC, p.id DESC
    `);

    // 2. Old payments from renewals (has reference_no or amount, not in payments table)
    const oldPayments = all(`
      SELECT
        r.sr_no,
        r.client_id,
        r.month,
        r.start_date,
        r.tier,
        r.setup_type,
        r.amount_received,
        r.payment_received_date,
        r.payment_received_month,
        r.reference_no,
        r.bank_name,
        r.is_trial,
        c.name as client_name,
        c.telegram_group_id as client_email
      FROM renewals r
      LEFT JOIN clients c ON c.id = r.client_id
      WHERE (r.reference_no IS NOT NULL AND r.reference_no != '')
         OR (r.amount_received IS NOT NULL AND r.amount_received != '' AND r.amount_received != '0')
      ORDER BY r.payment_received_date DESC, r.sr_no DESC
    `);

    let totalCollected = 0;
    let failedPaymentsCount = 0;
    const collectedByChannel = {};

    // Process new payments
    newPayments.forEach(r => {
      const amount = parseAmount(r.amount_received);
      const isFailed = amount <= 0;
      const channel = r.bank_name && r.bank_name.trim() !== '' ? r.bank_name : 'Unknown';
      if (isFailed) { failedPaymentsCount++; }
      else {
        totalCollected += amount;
        if (!collectedByChannel[channel]) collectedByChannel[channel] = 0;
        collectedByChannel[channel] += amount;
      }
      allPayments.push({
        id: r.payment_id,
        client_id: r.client_id,
        date: formatDate(r.payment_received_date),
        period: r.payment_received_month || r.product_month || '—',
        client_name: r.client_name || 'Unknown',
        client_email: r.client_email || 'No contact',
        tier: r.tier,
        setup_type: r.setup_type,
        is_trial: false,
        amount,
        channel,
        status: isFailed ? 'Failed' : 'Paid',
        link: r.reference_no || '—'
      });
    });

    // Process old payments from renewals
    oldPayments.forEach(r => {
      // Skip if already in new payments
      if (newPayments.some(np => np.renewal_sr_no === r.sr_no && np.client_id === r.client_id)) return;
      const amount = parseAmount(r.amount_received);
      const isFailed = amount <= 0;
      const channel = r.bank_name && r.bank_name.trim() !== '' ? r.bank_name : 'Unknown';
      if (isFailed) { failedPaymentsCount++; }
      else {
        totalCollected += amount;
        if (!collectedByChannel[channel]) collectedByChannel[channel] = 0;
        collectedByChannel[channel] += amount;
      }
      allPayments.push({
        id: r.sr_no,
        client_id: r.client_id,
        date: formatDate(r.payment_received_date || r.start_date),
        period: r.month || '—',
        client_name: r.client_name || 'Unknown',
        client_email: r.client_email || 'No contact',
        tier: r.tier,
        setup_type: r.setup_type,
        is_trial: r.is_trial === 1,
        amount,
        channel,
        status: isFailed ? 'Failed' : 'Paid',
        link: r.reference_no || '—'
      });
    });

    // Sort by date descending, but put future dates at the end
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    allPayments.sort((a, b) => {
      const parseSortDate = (str) => {
        if (!str || str === '—') return new Date(0);
        const d = new Date(str.split('/').reverse().join('-'));
        return isNaN(d.getTime()) ? new Date(0) : d;
      };
      const da = parseSortDate(a.date);
      const db = parseSortDate(b.date);
      const aIsFuture = da > today;
      const bIsFuture = db > today;
      if (aIsFuture && !bIsFuture) return 1;
      if (!aIsFuture && bIsFuture) return -1;
      return db - da;
    });

    return NextResponse.json({
      summary: { totalCollected, failedPaymentsCount, totalRefunds: 0, collectedByChannel },
      payments: allPayments
    });

  } catch (error) {
    console.error('[GET /api/payments] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/payments - add a new payment to the payments table
export async function POST(req) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, notes, is_topup } = body;

    if (!client_id || !renewal_sr_no) {
      return NextResponse.json({ error: 'client_id and renewal_sr_no are required' }, { status: 400 });
    }

    // Determine if this is a top-up payment
    const isTopUp = is_topup === 1 || is_topup === true;

    const result = run(`
      INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, notes, is_topup)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id, renewal_sr_no,
      amount_received || '',
      payment_received_date || '',
      payment_received_month || '',
      reference_no || '',
      bank_name || '',
      notes || '',
      isTopUp ? 1 : 0
    ]);

    // Update renewal: top-up payments accumulate in cl_amount, regular payments update amount_received
    const existingRenewal = get('SELECT * FROM renewals WHERE sr_no = ?', [renewal_sr_no]);
    if (existingRenewal) {
      if (isTopUp) {
        // Top-up: accumulate payment into cl_amount
        const currentCl = parseAmount(existingRenewal.cl_amount);
        const paymentAmt = parseAmount(amount_received);
        run(`UPDATE renewals SET cl_amount = ? WHERE sr_no = ?`, [
          (currentCl + paymentAmt).toString(),
          renewal_sr_no
        ]);
      } else {
        // Regular payment: amount_received = SUM of all payments
        const paymentSum = get(`
          SELECT SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)) as total
          FROM payments WHERE renewal_sr_no = ?
        `, [renewal_sr_no]);
        const totalAmount = paymentSum?.total || 0;

        const latestPayment = get(`
          SELECT payment_received_date, payment_received_month, reference_no, bank_name
          FROM payments WHERE renewal_sr_no = ?
          ORDER BY COALESCE(payment_received_date, '1900-01-01') DESC, id DESC LIMIT 1
        `, [renewal_sr_no]);

        run(`UPDATE renewals SET amount_received = ?, payment_received_date = ?, payment_received_month = ?, reference_no = ?, bank_name = ? WHERE sr_no = ?`, [
          totalAmount.toString(),
          latestPayment?.payment_received_date || existingRenewal.payment_received_date,
          latestPayment?.payment_received_month || existingRenewal.payment_received_month,
          latestPayment?.reference_no || existingRenewal.reference_no,
          latestPayment?.bank_name || existingRenewal.bank_name,
          renewal_sr_no
        ]);
      }
    }

    logActivity(auth.user?.id, auth.user?.username || 'system', 'CREATE', 'payments', result.lastInsertRowid, `Payment for renewal ${renewal_sr_no}`);

    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('[POST /api/payments] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
