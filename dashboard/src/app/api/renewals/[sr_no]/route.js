import { NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import { requirePermission, getUserFromRequest } from '@/lib/apiAuth';

// PATCH: update client_ad_id_name (for client dashboard users)
export async function PATCH(req, { params }) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const body = await req.json();

    // Clients can only update client_ad_id_name for their own renewals
    if (user.role === 'client') {
      if (String(renewal.client_id) !== String(user.client_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      run(`UPDATE renewals SET client_ad_id_name = ? WHERE sr_no = ?`, [
        body.client_ad_id_name || '',
        srNo
      ]);
      return NextResponse.json({ ok: true });
    }

    // Admins with permission can update additional fields
    const auth = requirePermission(req, 'update_clients');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    run(`UPDATE renewals SET client_ad_id_name = ? WHERE sr_no = ?`, [
      body.client_ad_id_name || '',
      srNo
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PATCH /api/renewals/[sr_no]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: update payment fields on a renewal (for old payments stored directly in renewals)

// PUT: update payment fields on a renewal (for old payments stored directly in renewals)
export async function PUT(req, { params }) {
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

    const body = await req.json();

    // Update payment fields on the renewal
    run(`
      UPDATE renewals SET
        amount_received = ?,
        payment_received_date = ?,
        payment_received_month = ?,
        reference_no = ?,
        bank_name = ?,
        notes = ?
      WHERE sr_no = ?
    `, [
      body.amount_received || '0',
      body.payment_received_date || '',
      body.payment_received_month || '',
      body.reference_no || '',
      body.bank_name || '',
      body.notes || '',
      srNo
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUT /api/renewals/[sr_no]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: clear payment fields from a renewal row (for old payments stored directly in renewals)

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
        visual_status = COALESCE(NULLIF(visual_status, ''), 'Active')
      WHERE sr_no = ?
    `, [srNo]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/renewals/[sr_no]] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
