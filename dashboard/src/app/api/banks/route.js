import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';

export async function GET() {
  try {
    const banks = all('SELECT bank_key, bank_name, data_json, updated_at FROM bank_details ORDER BY id ASC');
    const result = banks.map(b => ({
      bank_key: b.bank_key,
      bank_name: b.bank_name,
      data: JSON.parse(b.data_json || '{}'),
      updated_at: b.updated_at
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching banks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { bank_key, data } = body;

    if (!bank_key || !data) {
      return NextResponse.json({ error: 'bank_key and data are required' }, { status: 400 });
    }

    const existing = get('SELECT id FROM bank_details WHERE bank_key = ?', [bank_key]);
    if (!existing) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    }

    run(
      'UPDATE bank_details SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE bank_key = ?',
      [JSON.stringify(data), bank_key]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating bank:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}