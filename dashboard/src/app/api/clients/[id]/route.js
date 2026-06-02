import { NextResponse } from 'next/server';
import { all } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    
    // 1. Récupérer le client
    const clientRes = await all('SELECT * FROM clients WHERE id = ?', [id]);
    if (clientRes.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clientRes[0];
    
    // 2. Récupérer son historique de renouvellements
    const history = await all('SELECT * FROM renewals WHERE client_id = ? ORDER BY sr_no DESC', [id]);
    
    return NextResponse.json({ client, history });
  } catch (error) {
    console.error(`Erreur API /clients/${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
