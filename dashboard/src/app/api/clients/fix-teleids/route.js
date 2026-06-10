import { NextResponse } from 'next/server';
import { backfillTeleIds, all } from '@/lib/db';

export async function POST() {
  try {
    const before = all(
      'SELECT id, name, tele_id FROM clients ORDER BY id'
    );

    backfillTeleIds();

    const after = all(
      'SELECT id, name, tele_id FROM clients ORDER BY id'
    );

    const beforeWithTele = before.filter(c => c.tele_id);
    const afterWithTele = after.filter(c => c.tele_id);
    const afterWithoutTele = after.filter(c => !c.tele_id);

    return NextResponse.json({
      success: true,
      totalClients: after.length,
      clientsWithTeleId: afterWithTele.length,
      clientsWithoutTeleId: afterWithoutTele.length,
      newlyFixed: afterWithTele.length - beforeWithTele.length,
      withoutTeleIds: afterWithoutTele.map(c => ({ id: c.id, name: c.name })),
    });
  } catch (error) {
    console.error('[fix-teleids] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}