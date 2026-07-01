import { NextResponse } from 'next/server';
import { db, all, get, run } from '@/lib/db';

// GET /api/admin/whop-products?page=1&search=xxx
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const search = (searchParams.get('search') || '').trim();
    const perPage = 20;
    const offset = (page - 1) * perPage;

    let where = 'WHERE deleted = 0';
    const params = [];

    if (search) {
      where += ` AND (
        name LIKE ? OR
        product_id LIKE ? OR
        price LIKE ? OR
        product LIKE ? OR
        referral_partner LIKE ?
      )`;
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
    }

    // Total count
    const totalResult = get(`SELECT COUNT(*) as cnt FROM whop_products ${where}`, params);
    const total = totalResult?.cnt || 0;

    // Paginated rows
    const rows = all(
      `SELECT id, product_id, name, price, payment_url, created_at, product, referral_partner
       FROM whop_products ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    return NextResponse.json({
      products: rows,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error('[whop-products GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET /api/admin/whop-products/options — tiers, setups, referral partners
export async function HEAD(request) {
  try {
    const tiers = all(`SELECT DISTINCT tier as value FROM renewals WHERE tier IS NOT NULL AND tier != '' ORDER BY tier`);
    const setups = all(`SELECT DISTINCT setup_type as value FROM renewals WHERE setup_type IS NOT NULL AND setup_type != '' ORDER BY setup_type`);
    const refs = all(`SELECT DISTINCT referral_partner_name as value FROM renewals WHERE referral_partner_name IS NOT NULL AND referral_partner_name != '' ORDER BY referral_partner_name`);

    return NextResponse.json({
      tiers: tiers.map(r => r.value),
      setups: setups.map(r => r.value),
      referralPartners: refs.map(r => r.value),
    });
  } catch (err) {
    console.error('[whop-products HEAD]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PUT /api/admin/whop-products — update a product
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, price, payment_url, product, referral_partner } = body;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    run(
      `UPDATE whop_products
       SET name = ?, price = ?, payment_url = ?, product = ?, referral_partner = ?
       WHERE id = ?`,
      [name, price, payment_url, product, referral_partner, id]
    );

    const updated = get('SELECT * FROM whop_products WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[whop-products PUT]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/admin/whop-products — soft delete
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    run('UPDATE whop_products SET deleted = 1 WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[whop-products DELETE]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/admin/whop-products/sync — sync from JSON file to DB
export async function POST(request) {
  try {
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(process.cwd(), '..', 'whop_products_clean.json');

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ error: 'whop_products_clean.json not found' }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const products = data.products || [];

    let imported = 0;
    let skipped = 0;

    const insertOrUpdate = db.prepare(`
      INSERT INTO whop_products (product_id, name, price, payment_url, created_at, deleted)
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(product_id) DO UPDATE SET
        name = excluded.name,
        price = excluded.price,
        payment_url = excluded.payment_url,
        created_at = excluded.created_at,
        deleted = 0
    `);

    const insertMany = db.transaction((items) => {
      for (const p of items) {
        const result = insertOrUpdate.run(
          p.product_id,
          p.name,
          p.price || '',
          p.payment_url,
          p.created_at
        );
        if (result.changes > 0) imported++;
        else skipped++;
      }
    });

    insertMany(products);

    return NextResponse.json({
      success: true,
      total: products.length,
      imported,
      skipped
    });
  } catch (err) {
    console.error('[whop-products sync POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
