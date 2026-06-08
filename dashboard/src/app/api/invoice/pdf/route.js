import { NextResponse } from 'next/server';
import { generateInvoicePdfBuffer } from '@/lib/invoicePdf';
import { all } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sr_no = searchParams.get('sr_no') || '';
    const client_id = searchParams.get('client_id') || '';
    const client_name = searchParams.get('client_name') || '';
    const bank_name = searchParams.get('bank_name') || '';
    const product_name = searchParams.get('product_name') || 'Service';
    const amount = searchParams.get('amount') || 0;
    const invoice_date = searchParams.get('invoice_date') || new Date().toISOString().split('T')[0];
    const invoice_no = searchParams.get('invoice_no') || '001';

    // Get bank data
    let bankData = {};
    const bankInput = (bank_name || '').toLowerCase().trim();
    const banks = all('SELECT bank_key, data_json FROM bank_details');
    for (const bank of banks) {
      if (bankInput === bank.bank_key.toLowerCase()) {
        bankData = JSON.parse(bank.data_json || '{}');
        break;
      }
    }

    const pdfBuffer = await generateInvoicePdfBuffer({
      sr_no,
      client_id,
      client_name,
      bank_name,
      product_name,
      amount: Number(amount),
      invoice_date,
      invoice_no,
      bankData,
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice_no || sr_no || '001'}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating PDF invoice:', error);
    return new NextResponse('Error generating PDF invoice', { status: 500 });
  }
}
