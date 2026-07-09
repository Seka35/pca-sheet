import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

// GET - List all referral partners
export async function GET(req) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'custom' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const partners = all('SELECT * FROM referral_partners ORDER BY name ASC');
    return NextResponse.json(partners);
  } catch (e) {
    console.error('GET /api/referral-partners', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Create a new referral partner
export async function POST(req) {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, commission_percentage, client_discount_percentage } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check if name already exists
    const existing = get('SELECT id FROM referral_partners WHERE name = ?', [name]);
    if (existing) {
      return NextResponse.json({ error: 'Referral partner already exists' }, { status: 400 });
    }

    const result = run(
      `INSERT INTO referral_partners (name, commission_percentage, client_discount_percentage) VALUES (?, ?, ?)`,
      [name, commission_percentage || 0, client_discount_percentage || 0]
    );

    const newPartner = get('SELECT * FROM referral_partners WHERE id = ?', [result.lastInsertRowid]);
    return NextResponse.json(newPartner);
  } catch (e) {
    console.error('POST /api/referral-partners', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
