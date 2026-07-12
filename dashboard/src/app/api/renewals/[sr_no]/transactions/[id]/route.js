import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

// PUT /api/renewals/[sr_no]/transactions/[id]
// Update a transaction
export async function PUT(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { type, from_tier, to_tier, from_setup, to_setup, prorata_amount, amount, date, until_date, notes, reference_no, bank_name } = body;

    const transaction = get('SELECT * FROM payment_transactions WHERE id = ?', [id]);
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const updates = [];
    const values = [];

    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (from_tier !== undefined) { updates.push('from_tier = ?'); values.push(from_tier); }
    if (to_tier !== undefined) { updates.push('to_tier = ?'); values.push(to_tier); }
    if (from_setup !== undefined) { updates.push('from_setup = ?'); values.push(from_setup); }
    if (to_setup !== undefined) { updates.push('to_setup = ?'); values.push(to_setup); }
    if (prorata_amount !== undefined) { updates.push('prorata_amount = ?'); values.push(prorata_amount); }
    if (amount !== undefined) { updates.push('amount = ?'); values.push(amount); }
    if (date !== undefined) { updates.push('date = ?'); values.push(date); }
    if (until_date !== undefined) { updates.push('until_date = ?'); values.push(until_date); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (reference_no !== undefined) { updates.push('reference_no = ?'); values.push(reference_no); }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); values.push(bank_name); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    run(`UPDATE payment_transactions SET ${updates.join(', ')} WHERE id = ?`, values);

    // If this is an UPGRADE transaction, update the upgrade_chain_json and recalculate amount_received
    if (transaction.type === 'UPGRADE' || transaction.type === 'SUB_UPGRADE') {
      const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [transaction.renewal_sr_no]);
      if (renewal) {
        // Parse existing chain
        let chain = JSON.parse(renewal.upgrade_chain_json || '[]');

        // Find and update the corresponding entry by date
        const txDate = date || transaction.date;
        const chainIndex = chain.findIndex(e => e.date === txDate);
        if (chainIndex !== -1) {
          chain[chainIndex] = {
            from_tier: from_tier !== undefined ? from_tier : chain[chainIndex].from_tier,
            from_setup: from_setup !== undefined ? from_setup : chain[chainIndex].from_setup,
            to_tier: to_tier !== undefined ? to_tier : chain[chainIndex].to_tier,
            to_setup: to_setup !== undefined ? to_setup : chain[chainIndex].to_setup,
            date: txDate,
            prorata: prorata_amount !== undefined ? prorata_amount : chain[chainIndex].prorata
          };
        }

        // Recalculate cumulative amount: sum of all UPGRADE transaction amounts
        const txSum = get(`SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total FROM payment_transactions WHERE renewal_sr_no = ? AND type IN ('UPGRADE', 'SUB_UPGRADE')`, [transaction.renewal_sr_no]);
        const totalUpgradeAmount = txSum?.total || 0;

        // Get base amount from original tier
        const { TIER_PRICING } = await import('@/lib/whopLinks');
        const baseTier = renewal.original_tier || renewal.tier;
        const basePrice = parseFloat(TIER_PRICING[baseTier] || 0) || 0;

        // amount_received = base price + all upgrade proratas
        const newAmountReceived = basePrice + totalUpgradeAmount;

        run('UPDATE renewals SET upgrade_chain_json = ?, amount_received = ? WHERE sr_no = ?',
          [JSON.stringify(chain), newAmountReceived.toFixed(2), transaction.renewal_sr_no]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[PUT /api/renewals/[sr_no]/transactions/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/renewals/[sr_no]/transactions/[id]
// Delete a transaction
export async function DELETE(req, { params }) {
  const auth = requirePermission(req, 'update_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Get the transaction before deleting
    const transaction = get('SELECT * FROM payment_transactions WHERE id = ?', [id]);
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Delete the transaction
    run('DELETE FROM payment_transactions WHERE id = ?', [id]);

    // If this was an UPGRADE transaction, update the upgrade_chain_json and recalculate amount_received
    if (transaction.type === 'UPGRADE' || transaction.type === 'SUB_UPGRADE') {
      const renewal = get('SELECT * FROM renewals WHERE sr_no = ?', [transaction.renewal_sr_no]);
      if (renewal) {
        // Parse existing chain and remove entry by date
        let chain = JSON.parse(renewal.upgrade_chain_json || '[]');
        chain = chain.filter(e => e.date !== transaction.date);

        // Recalculate cumulative amount: sum of remaining UPGRADE transaction amounts
        const txSum = get(`SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total FROM payment_transactions WHERE renewal_sr_no = ? AND type IN ('UPGRADE', 'SUB_UPGRADE')`, [transaction.renewal_sr_no]);
        const totalUpgradeAmount = txSum?.total || 0;

        // Get base amount from original tier
        const { TIER_PRICING } = await import('@/lib/whopLinks');
        const baseTier = renewal.original_tier || renewal.tier;
        const basePrice = parseFloat(TIER_PRICING[baseTier] || 0) || 0;

        // amount_received = base price + all upgrade proratas
        const newAmountReceived = basePrice + totalUpgradeAmount;

        // If chain is empty, reset to original tier and clear ponctual upgrade flag
        if (chain.length === 0) {
          run(`UPDATE renewals SET
            tier = COALESCE(original_tier, tier),
            setup_type = COALESCE(original_setup, setup_type),
            is_ponctual_upgrade = 0,
            upgrade_chain_json = '[]',
            amount_received = ?
            WHERE sr_no = ?`,
            [newAmountReceived.toFixed(2), transaction.renewal_sr_no]);
        } else {
          run('UPDATE renewals SET upgrade_chain_json = ?, amount_received = ? WHERE sr_no = ?',
            [JSON.stringify(chain), newAmountReceived.toFixed(2), transaction.renewal_sr_no]);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/renewals/[sr_no]/transactions/[id]]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
