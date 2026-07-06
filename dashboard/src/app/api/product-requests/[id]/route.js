import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function GET(req, { params }) {
  const user = getUserFromRequest(req);

  if (!user || (user.role !== 'admin' && user.role !== 'custom')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const row = get('SELECT * FROM product_requests WHERE id = ?', [id]);

    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...row,
      products: JSON.parse(row.products_json || '[]')
    });
  } catch (e) {
    console.error('GET /api/product-requests/[id]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
