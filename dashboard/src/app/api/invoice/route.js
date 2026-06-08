import { NextResponse } from 'next/server';
import { all, get, run } from '@/lib/db';

export async function GET() {
  try {
    const row = get('SELECT data_json, updated_at FROM invoice_settings WHERE id = 1');
    if (!row) {
      // Return default structure if no data exists
      return NextResponse.json({
        logo: { src: 'PCA.png', alt: 'Prime Circle Agency' },
        company: {
          name: 'Prime Circle Agency',
          addressLines: ['1507 Lampman Ct ,', 'Cheyenne, WY 82007-3341, USA']
        },
        meta: [
          { label: '', value: 'WCATFM LLC' },
          { label: 'Tax Identification Number:', value: '39-2440278' },
          { label: 'INVOICE NO #', value: '001' },
          { label: 'INVOICE DATE:', value: new Date().toISOString().split('T')[0] }
        ],
        billTo: {
          name: '',
          lines: ['']
        },
        items: [
          { description: '', qty: 1, unitPrice: 0 }
        ],
        padRows: 1,
        currency: '$',
        locale: 'en-US',
        adjustments: {
          discount: 0,
          taxRate: 0,
          shipping: 0
        },
        paymentInstructions: {
          title: 'Payment Instructions:',
          paragraphs: ['']
        }
      });
    }
    return NextResponse.json(JSON.parse(row.data_json));
  } catch (error) {
    console.error('Error fetching invoice settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();

    // Ensure the table has the row
    run(`
      INSERT OR REPLACE INTO invoice_settings (id, data_json, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `, [JSON.stringify(body)]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving invoice settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}