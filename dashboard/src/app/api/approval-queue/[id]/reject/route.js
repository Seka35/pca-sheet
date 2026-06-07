import { NextResponse } from 'next/server';
import { get, run, all } from '@/lib/db';

export async function POST(req) {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2];

  try {
    let reject_reason = 'admin';
    let reviewed_by = 'admin';

    try {
      const body = await req.json().catch(() => ({}));
      reject_reason = body.reject_reason || '';
      reviewed_by = body.reviewed_by || 'admin';
    } catch (e) { }

    if (!reject_reason || !reject_reason.trim()) {
      return NextResponse.json({ error: 'reject_reason is required' }, { status: 400 });
    }

    const entry = get('SELECT * FROM approval_queue WHERE id = ?', [id]);

    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (entry.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });
    }

    run(
      `UPDATE approval_queue SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, reject_reason = ? WHERE id = ?`,
      [reviewed_by, reject_reason.trim(), id]
    );

    run(
      `UPDATE payment_proofs SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reject_reason = ? WHERE id = ?`,
      [reject_reason.trim(), entry.proof_id]
    );

    // Clear pending payment so client can resubmit
    run(`DELETE FROM pending_payments WHERE sr_no = ? AND chat_id = (SELECT chat_id FROM bot_group_links WHERE client_id = ?)`, [entry.sr_no, entry.client_id]);

    // Try to send Telegram notification to the group
    try {
      const link = get(`SELECT chat_id FROM bot_group_links WHERE client_id = ? AND status = 'linked' LIMIT 1`, [entry.client_id]);
      if (link) {
        // Dynamic import to avoid circular deps - get bot from globalThis
        const bot = globalThis.__pcaBot;
        if (bot) {
          await bot.sendMessage(
            link.chat_id,
            `❌ <b>Payment Rejected</b>\n\n` +
            `<b>${entry.client_name}</b>, your payment of <b>${entry.amount_due}</b> has been <b>rejected</b>.\n\n` +
            `Reason: <i>${reject_reason.trim()}</i>\n\n` +
            `Please submit a new proof of payment using the /pay command or wait for a new reminder.`,
            { parse_mode: 'HTML' }
          );
        }
      }
    } catch (e) {
      console.error('[REJECT] Telegram notification failed:', e.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[REJECT] ERROR:', e.message);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}