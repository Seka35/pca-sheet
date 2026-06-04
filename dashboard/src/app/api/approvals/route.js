import { NextResponse } from 'next/server';
import { all, run } from '@/lib/db';

// Whitelist des colonnes qu'on accepte de mettre à jour (anti SQL-injection)
const RENEWAL_COLUMNS = [
  'sr_no', 'client_name', 'client_status_history', 'month', 'start_date',
  'client_ad_id_name', 'ad_id_number', 'ad_account_type', 'tier', 'ad_spend_limit',
  'setup_type', 'subscription_fee', 'setup_fee', 'discount', 'cl_amount',
  'referral_partner_name', 'referral_amount', 'valid_stopped_date',
  'payment_name', 'bank_name', 'amount_received', 'payment_received_date',
  'payment_received_month', 'reference_no', 'actual_balance_difference',
  'notes', 'visual_status',
];

export async function GET(req) {
  try {
    const updates = await all(
      "SELECT * FROM pending_updates WHERE status = 'PENDING' ORDER BY created_at DESC"
    );
    return NextResponse.json(updates);
  } catch (error) {
    console.error('Erreur API /approvals GET:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { id, action } = await req.json();

    if (action === 'REJECT') {
      await run("UPDATE pending_updates SET status = 'REJECTED' WHERE id = ?", [id]);
      return NextResponse.json({ message: 'Rejected' });
    }

    if (action === 'APPROVE') {
      const rows = await all('SELECT * FROM pending_updates WHERE id = ?', [id]);
      const pending = rows[0];

      if (!pending) {
        return NextResponse.json({ error: 'Pending update not found' }, { status: 404 });
      }
      if (pending.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Cannot approve: status is ${pending.status}` },
          { status: 400 }
        );
      }

      const { field_name, new_value, sr_no, client_id } = pending;

      if (!RENEWAL_COLUMNS.includes(field_name)) {
        return NextResponse.json(
          { error: `Field "${field_name}" is not updatable` },
          { status: 400 }
        );
      }

      const updateResult = await run(
        `UPDATE renewals SET ${field_name} = ? WHERE sr_no = ?`,
        [new_value, sr_no]
      );

      if (updateResult.changes === 0) {
        return NextResponse.json(
          { error: `No renewal row found for sr_no ${sr_no}` },
          { status: 404 }
        );
      }

      await run("UPDATE pending_updates SET status = 'APPROVED' WHERE id = ?", [id]);

      return NextResponse.json({ message: 'Approved and applied', field: field_name, sr_no });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Erreur API /approvals POST:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
