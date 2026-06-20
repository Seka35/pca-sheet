import { NextResponse } from 'next/server';
import { all, run, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// GET /api/payments - list payments, optionally filtered by client_id or renewal_sr_no
// When client_id is provided, returns from payments table (new schema)
// Otherwise returns from renewals table (legacy/broad view)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const renewalSrNo = searchParams.get('renewal_sr_no');

  try {
    // If client_id provided, use the new payments table
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

    // If renewal_sr_no provided, get payments for that specific product
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

    // No filter - try payments table first, fall back to renewals
    // Check if payments table has data
    const paymentsDataCheck = all('SELECT COUNT(*) as cnt FROM payments');
    const hasPaymentsData = paymentsDataCheck[0]?.cnt > 0;

    if (hasPaymentsData) {
      // Use payments table aggregated with renewals info
      const records = all(`
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

      let totalCollected = 0;
      let failedPaymentsCount = 0;
      let totalRefunds = 0;
      const collectedByChannel = {};

      const payments = records.map(r => {
        const amount = parseAmount(r.amount_received);
        const isFailed = amount <= 0;
        const channel = r.bank_name && r.bank_name.trim() !== '' ? r.bank_name : 'Unknown';

        if (isFailed) {
          failedPaymentsCount++;
        } else {
          totalCollected += amount;
          if (!collectedByChannel[channel]) collectedByChannel[channel] = 0;
          collectedByChannel[channel] += amount;
        }

        let dateStr = r.payment_received_date || '';
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
          }
        }

        return {
          id: r.payment_id,
          client_id: r.client_id,
          renewal_sr_no: r.renewal_sr_no,
          date: dateStr || '—',
          period: r.payment_received_month || r.product_month || '—',
          client_name: r.client_name || 'Unknown',
          client_email: r.client_email || 'No contact',
          tier: r.tier,
          setup_type: r.setup_type,
          is_trial: false,
          amount: amount,
          channel: channel,
          status: isFailed ? 'Failed' : 'Paid',
          link: r.reference_no || '—'
        };
      });

      return NextResponse.json({
        summary: {
          totalCollected,
          failedPaymentsCount,
          totalRefunds,
          collectedByChannel
        },
        payments
      });
    }

    // Fall back to renewals table (legacy behavior)
    const query = `
      SELECT r.*, c.name as client_name, c.telegram_group_id as client_email
      FROM renewals r
      LEFT JOIN clients c ON c.id = r.client_id
      ORDER BY r.sr_no DESC
    `;
    const records = await all(query);

    let totalCollected = 0;
    let failedPaymentsCount = 0;
    let totalRefunds = 0;
    const collectedByChannel = {};

    const payments = records.map(r => {
      const amount = parseAmount(r.amount_received);
      const isFailed = amount <= 0;

      const channel = r.bank_name && r.bank_name.trim() !== '' ? r.bank_name : 'Unknown';

      if (isFailed) {
        failedPaymentsCount++;
      } else {
        totalCollected += amount;
        if (!collectedByChannel[channel]) collectedByChannel[channel] = 0;
        collectedByChannel[channel] += amount;
      }

      let dateStr = r.payment_received_date || r.start_date || '';
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
      }

      return {
        id: r.sr_no,
        client_id: r.client_id,
        date: dateStr || '—',
        period: r.month || '—',
        client_name: r.client_name || 'Unknown',
        client_email: r.client_email || 'No contact',
        tier: r.tier,
        setup_type: r.setup_type,
        is_trial: r.is_trial === 1,
        amount: amount,
        channel: channel,
        status: isFailed ? 'Failed' : 'Paid',
        link: r.reference_no || '—'
      };
    });

    return NextResponse.json({
      summary: {
        totalCollected,
        failedPaymentsCount,
        totalRefunds,
        collectedByChannel
      },
      payments
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
    const { client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, notes } = body;

    if (!client_id || !renewal_sr_no) {
      return NextResponse.json({ error: 'client_id and renewal_sr_no are required' }, { status: 400 });
    }

    const result = run(`
      INSERT INTO payments (client_id, renewal_sr_no, amount_received, payment_received_date, payment_received_month, reference_no, bank_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id,
      renewal_sr_no,
      amount_received || '',
      payment_received_date || '',
      payment_received_month || '',
      reference_no || '',
      bank_name || '',
      notes || ''
    ]);

    // Update the renewal row's payment fields for backward compatibility
    // - amount_received = SUM of all payments for this renewal
    // - payment_received_date, reference_no, bank_name = from the MOST RECENT payment
    const existingRenewal = get('SELECT * FROM renewals WHERE sr_no = ?', [renewal_sr_no]);
    if (existingRenewal) {
      // Sum all payments for this renewal
      const paymentSum = get(`
        SELECT SUM(CAST(REPLACE(REPLACE(COALESCE(amount_received, '0'), ',', ''), ' ', '') AS REAL)) as total
        FROM payments WHERE renewal_sr_no = ?
      `, [renewal_sr_no]);
      const totalAmount = paymentSum?.total || 0;

      // Get the most recent payment for date/reference/bank info
      const latestPayment = get(`
        SELECT payment_received_date, payment_received_month, reference_no, bank_name
        FROM payments
        WHERE renewal_sr_no = ?
        ORDER BY COALESCE(payment_received_date, '1900-01-01') DESC, id DESC
        LIMIT 1
      `, [renewal_sr_no]);

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
        latestPayment?.payment_received_date || existingRenewal.payment_received_date,
        latestPayment?.payment_received_month || existingRenewal.payment_received_month,
        latestPayment?.reference_no || existingRenewal.reference_no,
        latestPayment?.bank_name || existingRenewal.bank_name,
        renewal_sr_no
      ]);
    }

    logActivity(auth.user?.id, auth.user?.username || 'system', 'CREATE', 'payments', result.lastInsertRowid, `Payment for renewal ${renewal_sr_no}`);

    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('[POST /api/payments] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
