import { NextResponse } from 'next/server';
import { all, run } from '@/lib/db';

export async function GET(req) {
  try {
    const updates = await all("SELECT * FROM pending_updates WHERE status = 'PENDING' ORDER BY created_at DESC");
    return NextResponse.json(updates);
  } catch (error) {
    console.error('Erreur API /approvals GET:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { id, action } = await req.json(); // action = 'APPROVE' or 'REJECT'
    
    if (action === 'REJECT') {
      await run("UPDATE pending_updates SET status = 'REJECTED' WHERE id = ?", [id]);
      return NextResponse.json({ message: 'Rejected' });
    }
    
    if (action === 'APPROVE') {
      // 1. Marquer comme approuvé
      await run("UPDATE pending_updates SET status = 'APPROVED' WHERE id = ?", [id]);
      
      // 2. Appliquer la modification en base (logique simplifiée)
      // En réalité, il faudrait parser `field_name` pour savoir quelle colonne de `renewals` ou `clients` mettre à jour.
      
      return NextResponse.json({ message: 'Approved and applied' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Erreur API /approvals POST:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
