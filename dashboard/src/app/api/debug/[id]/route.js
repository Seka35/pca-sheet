import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const history = await all('SELECT * FROM renewals WHERE client_id = ?', [id]);
    const periods = await all('SELECT * FROM renewal_periods WHERE client_id = ?', [id]);
    const events = await all('SELECT * FROM renewal_events WHERE client_id = ?', [id]);

    const eventsByPeriod = {};
    events.forEach(ev => {
      if (!eventsByPeriod[ev.period_sr_no]) eventsByPeriod[ev.period_sr_no] = [];
      eventsByPeriod[ev.period_sr_no].push(ev);
    });

    const parentMap = {};
    history.forEach(r => { parentMap[r.sr_no] = r; });

    const periodHistory = periods.map(period => {
      const periodEvents = eventsByPeriod[period.sr_no] || [];
      const latestEvent = periodEvents.length > 0 ? periodEvents[periodEvents.length - 1] : null;
      const parent = parentMap[period.renewal_parent_sr_no] || {};
      return {
        sr_no: period.sr_no,
        tier: latestEvent ? (latestEvent.to_tier || latestEvent.tier) : (period.tier || ''),
        month: period.month_label || '',
        subscription_fee: parent.subscription_fee || period.subscription_fee || '',
        discount: parent.discount || '',
        is_period_entry: true,
      };
    });

    const combined = [...history, ...periodHistory];

    return NextResponse.json({
      history_count: history.length,
      periods_count: periods.length,
      events_count: events.length,
      combined_count: combined.length,
      entries: combined.map(h => ({
        sr_no: h.sr_no,
        month: h.month,
        subscription_fee: h.subscription_fee,
        discount: h.discount,
        is_period_entry: h.is_period_entry || false,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
