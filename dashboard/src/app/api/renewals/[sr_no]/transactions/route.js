import { NextResponse } from 'next/server';
import { get, run, all } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// GET /api/renewals/[sr_no]/transactions
// Returns all payment transactions for a renewal chain
export async function GET(req, { params }) {
  // Await params in Next.js 15+
  const resolvedParams = await params;
  const auth = requirePermission(req, 'view_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;

    // Get the renewal to find its chain
    const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Find all related renewals in this chain
    let chainSrNos = [sr_no];

    // If this is a ponctual upgrade, find siblings and parent
    if (renewal.is_ponctual_upgrade) {
      // Get all children of this renewal
      const children = all(
        'SELECT sr_no FROM renewals WHERE parent_sr_no = ?',
        [sr_no]
      );
      chainSrNos.push(...children.map(c => c.sr_no));

      // Get parent if exists
      if (renewal.parent_sr_no) {
        // Get all siblings (other upgrades from same parent)
        const siblings = all(
          'SELECT sr_no FROM renewals WHERE parent_sr_no = ? AND sr_no != ?',
          [renewal.parent_sr_no, sr_no]
        );
        chainSrNos.push(...siblings.map(s => s.sr_no));

        // Add parent
        chainSrNos.push(renewal.parent_sr_no);
      }
    } else {
      // This is an original product, find all its ponctual children
      const children = all(
        'SELECT sr_no FROM renewals WHERE parent_sr_no = ?',
        [sr_no]
      );
      chainSrNos.push(...children.map(c => c.sr_no));
    }

    // Get all transactions for this chain
    const placeholders = chainSrNos.map(() => '?').join(',');
    const transactions = all(
      `SELECT * FROM payment_transactions
       WHERE renewal_sr_no IN (${placeholders})
       ORDER BY date ASC`,
      chainSrNos
    );

    return NextResponse.json({
      renewal,
      chain_sr_nos: chainSrNos,
      transactions
    });
  } catch (e) {
    console.error('[GET /api/renewals/[sr_no]/transactions]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/renewals/[sr_no]/transactions
// Manually add a historical transaction (for data migration)
export async function POST(req, { params }) {
  // Await params in Next.js 15+
  const resolvedParams = await params;
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sr_no } = resolvedParams;
    const {
      type,
      client_id,
      from_tier, to_tier,
      from_setup, to_setup,
      prorata_amount,
      amount,
      date,
      until_date,
      notes
    } = await req.json();

    if (!type || !date) {
      return NextResponse.json({ error: 'type and date are required' }, { status: 400 });
    }

    const validTypes = ['MONTHLY', 'TOPUP', 'UPGRADE', 'UPGRADE_PERMANENT', 'SUB_UPGRADE', 'RENEWAL_PONCTUAL', 'RETURN', 'PROMOTION'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Get the renewal
    const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [sr_no]);
    if (!renewal) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const result = run(
      `INSERT INTO payment_transactions (
        renewal_sr_no, client_id, type,
        from_tier, to_tier, from_setup, to_setup,
        prorata_amount, amount, date, until_date, notes,
        is_manual_entry
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        sr_no,
        client_id || renewal.client_id,
        type,
        from_tier || null,
        to_tier || null,
        from_setup || null,
        to_setup || null,
        prorata_amount || null,
        amount || null,
        date,
        until_date || null,
        notes || null
      ]
    );

    const newTx = get('SELECT * FROM payment_transactions WHERE id = ?', [result.lastInsertRowid]);
    return NextResponse.json(newTx);
  } catch (e) {
    console.error('[POST /api/renewals/[sr_no]/transactions]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
