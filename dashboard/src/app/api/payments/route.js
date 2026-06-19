import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export async function GET(req) {
  try {
    const query = `
      SELECT r.*, c.name as client_name, c.telegram_group_id as client_email
      FROM renewals r
      LEFT JOIN clients c ON c.id = r.client_id
      ORDER BY r.sr_no DESC
    `;
    const records = await all(query);

    let totalCollected = 0;
    let failedPaymentsCount = 0;
    let totalRefunds = 0; // Not explicitly tracked in this schema
    const collectedByChannel = {};

    const payments = records.map(r => {
      const amount = parseAmount(r.amount_received);
      const isFailed = amount <= 0;
      
      const channel = r.bank_name && r.bank_name.trim() !== '' ? r.bank_name : 'Unknown';

      if (isFailed) {
        failedPaymentsCount++;
      } else {
        totalCollected += amount;
        if (!collectedByChannel[channel]) collectedByChannel[channel] = 0;
        collectedByChannel[channel] += amount;
      }

      // Handle date formatting
      let dateStr = r.payment_received_date || r.start_date || '';
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
      }

      return {
        id: r.sr_no,
        client_id: r.client_id,
        date: dateStr || '—',
        period: r.month || '—',
        client_name: r.client_name || 'Unknown',
        client_email: r.client_email || 'No contact',
        tier: r.tier,
        setup_type: r.setup_type,
        is_trial: r.is_trial === 1,
        amount: amount,
        channel: channel,
        status: isFailed ? 'Failed' : 'Paid',
        link: r.reference_no || '—'
      };
    });

    return NextResponse.json({
      summary: {
        totalCollected,
        failedPaymentsCount,
        totalRefunds,
        collectedByChannel
      },
      payments
    });

  } catch (error) {
    console.error('Erreur API /payments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
