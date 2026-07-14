import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all products
export async function GET() {
  try {
    const products = db.prepare(`
      SELECT * FROM products
      WHERE is_active = 1
      ORDER BY category, sort_order, name
    `).all();

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST - Create a new product
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, category, billing_cycle, price, ad_spend_limit } = body;

    if (!name || !category || !price) {
      return NextResponse.json({ error: 'Name, category, and price are required' }, { status: 400 });
    }

    if (!['tier', 'setup'].includes(category)) {
      return NextResponse.json({ error: 'Category must be "tier" or "setup"' }, { status: 400 });
    }

    if (!['monthly', 'oneshot', 'annually'].includes(billing_cycle || 'monthly')) {
      return NextResponse.json({ error: 'Billing cycle must be "monthly", "oneshot", or "annually"' }, { status: 400 });
    }

    // Get max sort_order for this category
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM products WHERE category = ?').get(category);
    const newSortOrder = (maxOrder?.max_order || 0) + 1;

    const result = db.prepare(`
      INSERT INTO products (name, category, billing_cycle, price, ad_spend_limit, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, category, billing_cycle || 'monthly', price, ad_spend_limit || '', newSortOrder);

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

// PUT - Update a product
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, category, billing_cycle, price, ad_spend_limit, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Check if product exists
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE products
      SET name = ?, category = ?, billing_cycle = ?, price = ?, ad_spend_limit = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? existing.name,
      category ?? existing.category,
      billing_cycle ?? existing.billing_cycle,
      price ?? existing.price,
      ad_spend_limit ?? existing.ad_spend_limit,
      is_active ?? existing.is_active,
      id
    );

    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE - Soft delete a product (set is_active = 0)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Check if product exists
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Soft delete - just set is_active to 0
    db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
