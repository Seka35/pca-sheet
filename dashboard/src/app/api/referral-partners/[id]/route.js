import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

// PUT - Update a referral partner
export async function PUT(req, { params }) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const { name, commission_percentage, client_discount_percentage, status } = await req.json();

    const existing = get('SELECT * FROM referral_partners WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Referral partner not found' }, { status: 404 });
    }

    run(
      `UPDATE referral_partners SET name = ?, commission_percentage = ?, client_discount_percentage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        name ?? existing.name,
        commission_percentage ?? existing.commission_percentage,
        client_discount_percentage ?? existing.client_discount_percentage,
        status ?? existing.status,
        id
      ]
    );

    const updated = get('SELECT * FROM referral_partners WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (e) {
    console.error('PUT /api/referral-partners/[id]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Delete a referral partner
export async function DELETE(req, { params }) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    const existing = get('SELECT * FROM referral_partners WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Referral partner not found' }, { status: 404 });
    }

    run('DELETE FROM referral_partners WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/referral-partners/[id]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
