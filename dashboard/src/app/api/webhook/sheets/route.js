import { NextResponse } from 'next/server';
import { run, all } from '@/lib/db';

const WEBHOOK_SECRET = "TON_SECRET_ICI";

export async function POST(req) {
  try {
    const payload = await req.json();

    // Verify secret
    if (payload.secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sheet, row, range, changedValue, rowData, timestamp } = payload;
    
    // On ne traite que la "Master sheet"
    if (sheet !== 'Master sheet') {
      return NextResponse.json({ message: 'Ignored sheet' }, { status: 200 });
    }

    // Récupérer le Sr No. (on suppose que c'est la première colonne ou qu'elle s'appelle 'Sr No.')
    // L'Apps Script a envoyé rowData avec les headers de la ligne 1 comme clés.
    const keys = Object.keys(rowData);
    const srNoKey = keys.find(k => k.toLowerCase().includes('sr no'));
    const srNo = rowData[srNoKey || keys[0]];

    if (!srNo || isNaN(parseFloat(srNo))) {
      return NextResponse.json({ message: 'Invalid or missing Sr No.' }, { status: 200 });
    }

    const clientId = Math.floor(parseFloat(srNo));
    const isClientHeader = parseFloat(srNo) % 1 === 0;

    // Check if client exists
    const existingClient = await all('SELECT * FROM clients WHERE id = ?', [clientId]);
    
    if (existingClient.length === 0) {
      // NOUVEAU CLIENT : Insertion automatique comme demandé
      console.log(`Nouveau client détecté: ID ${clientId}`);
      
      const clientName = rowData[keys[1]] || '';
      const telegramGroup = rowData[keys[2]] || '';
      
      await run('INSERT INTO clients (id, name, telegram_group_id, status) VALUES (?, ?, ?, ?)', [
        clientId, clientName, telegramGroup, 'inactif'
      ]);

      // Si ce n'est pas juste l'en-tête, on insère la ligne d'abonnement
      if (!isClientHeader) {
         // Insertion de la ligne (on fait un mapping simple pour l'instant)
         await run(`INSERT INTO renewals (sr_no, client_id, client_name) VALUES (?, ?, ?)`, [
           srNo, clientId, clientName
         ]);
      }
      
      return NextResponse.json({ message: 'New client created successfully' }, { status: 201 });
    } else {
      // CLIENT EXISTANT : On ajoute la modification dans pending_updates
      console.log(`Modification d'un client existant détectée: ID ${clientId}, ligne ${srNo}`);
      
      // On loggue simplement la modif en attente pour approbation via le Dashboard
      // Pour une vraie diff, il faudrait comparer chaque champ, mais l'Apps Script nous donne changedValue et range
      await run(`
        INSERT INTO pending_updates (sr_no, client_id, field_name, old_value, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [
        srNo, 
        clientId, 
        range, // on utilise le range pour identifier la case modifiée (ex: C5)
        '', // On pourrait aller chercher l'ancienne valeur en base
        changedValue
      ]);

      return NextResponse.json({ message: 'Update queued for approval' }, { status: 202 });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
