import { NextResponse } from 'next/server';
import { all, run, get } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

// Normalise un nom client pour la comparaison (même logique que csvImport.js)
function normalizeClientName(name) {
  return (name || '')
    .replace(/^[🟢🔴🟡⚠️📌👑🥇]+\s*/g, '')
    .replace(/^\[(DC|ENT-\d+)\]\s*/gi, '')
    .replace(/\s*:\s*Tele\s*[-:\s]*\d+[A-Z]?\s*$/gi, '')
    .replace(/\s*\(Tele\s*[-:\s]*\d+[A-Z]?\)\s*$/gi, '')
    .replace(/\s*X\s+Prime\s+circle\s*$/gi, '')
    .replace(/\s*×\s+Prime\s+circle\s*$/gi, '')
    .replace(/x\s+Prime\s+circle\s*:\s*/gi, '')
    .toLowerCase()
    .trim();
}

/**
 * POST /api/admin/import-clients
 *
 * Body: { clients: SimulatedClient[] }
 * Chaque SimulatedClient est le résultat direct de buildSimulatedClients()
 */
export async function POST(req) {
  const auth = requirePermission(req, 'create_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { clients } = body;
  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: 'No clients provided' }, { status: 400 });
  }

  // Charger tous les clients existants en mémoire pour comparaison rapide
  const existingClients = all('SELECT id, name, telegram_group_id, tele_id, status FROM clients');
  const existingMap = new Map(); // normalized_name => client row
  existingClients.forEach(c => {
    const norm = normalizeClientName(c.name);
    if (norm) existingMap.set(norm, c);
  });

  const logs = [];
  let importedCount = 0;
  let errorCount = 0;

  for (const simClient of clients) {
    const clientLog = {
      nom: simClient.nom,
      status: 'pending',
      action: null,          // 'created' | 'updated'
      client_id: null,
      renewalsImported: 0,
      warnings: [],
      error: null,
    };

    try {
      const rawName = (simClient.nom || '').trim();
      if (!rawName) {
        clientLog.status = 'error';
        clientLog.error = 'Nom de client vide — ignoré';
        errorCount++;
        logs.push(clientLog);
        continue;
      }

      const normName = normalizeClientName(rawName);
      const existing = existingMap.get(normName);

      // ── Données client de base ────────────────────────────────────────────
      const clientData = simClient.client || {};
      const newStatus = clientData.status || (simClient.statut === 'Active' ? 'Actif' : 'inactif');
      const newEmail = clientData.email || '';
      const newAddress = clientData.address || '';
      const newFirstName = clientData.first_name || '';
      const newLastName = clientData.last_name || '';

      let clientId;

      if (existing) {
        // ── UPDATE ─────────────────────────────────────────────────────────
        // Préserver telegram_group_id et tele_id s'ils existent déjà en DB
        const preservedTelegramGroupId = existing.telegram_group_id || null;
        const preservedTeleId = existing.tele_id || null;

        run(
          `UPDATE clients SET
            name = ?,
            status = ?,
            email = ?,
            address = ?,
            first_name = ?,
            last_name = ?
          WHERE id = ?`,
          [
            rawName,
            newStatus,
            newEmail,
            newAddress,
            newFirstName,
            newLastName,
            existing.id,
          ]
        );

        clientId = existing.id;
        clientLog.action = 'updated';
        clientLog.client_id = clientId;

        if (preservedTelegramGroupId) {
          clientLog.warnings.push(`telegram_group_id préservé: ${preservedTelegramGroupId}`);
        }
        if (preservedTeleId) {
          clientLog.warnings.push(`tele_id préservé: ${preservedTeleId}`);
        }

        if (preservedTeleId) {
          const teleIdConflicts = existingClients.filter(
            c => c.tele_id === preservedTeleId && c.id !== existing.id
          );
          if (teleIdConflicts.length > 0) {
            clientLog.warnings.push(
              `⚠️ TeleID "${preservedTeleId}" partagé avec: ${teleIdConflicts.map(c => c.name).join(', ')}`
            );
          }
        }
      } else {
        // ── INSERT ─────────────────────────────────────────────────────────
        const result = run(
          `INSERT INTO clients (name, status, email, address, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)`,
          [rawName, newStatus, newEmail, newAddress, newFirstName, newLastName]
        );
        clientId = result.lastInsertRowid;
        clientLog.action = 'created';
        clientLog.client_id = clientId;

        existingMap.set(normName, { id: clientId, name: rawName, telegram_group_id: null, tele_id: null });
      }

      // ── Vider TOUTES les anciennes entrées de produits & paiements du client ───────
      run('DELETE FROM renewals WHERE client_id = ?', [clientId]);
      try { run('DELETE FROM client_products WHERE client_id = ?', [clientId]); } catch (e) {}
      try { run('DELETE FROM payments WHERE client_id = ?', [clientId]); } catch (e) {}
      try { run('DELETE FROM payment_history WHERE client_id = ?', [clientId]); } catch (e) {}

      // Dans simClient, history correspond à la liste exacte des produits simulés !
      const products = simClient.history || [];
      let productIdx = 0;

      for (const product of products) {
        productIdx++;
        const srNo = `${clientId}.${productIdx}`;

        const subFee = parseFloat(product.subscription_fee || '0') || 0;
        const setupFee = parseFloat(product.setup_fee || '0') || 0;
        const totalFee = subFee + setupFee;

        const amtReceived = (product.amount_received !== undefined && product.amount_received !== null)
          ? product.amount_received.toString()
          : totalFee.toString();

        const visualStatus = product.visual_status === 'Active' ? 'Active' : 'Inactive';

        // 1. Insérer dans renewals (architecture classique)
        run(
          `INSERT OR REPLACE INTO renewals (
            sr_no, client_id, client_name, tier, setup_type,
            subscription_fee, setup_fee, discount, cl_amount,
            ad_id_number, client_ad_id_name, ad_account_type,
            ad_spend_limit, start_date, valid_stopped_date,
            visual_status, client_status_history,
            referral_partner_name, month,
            bank_name, amount_received, is_trial
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            srNo,
            clientId,
            rawName,
            product.tier || '',
            product.setup_type || '',
            (product.subscription_fee || '0').toString(),
            (product.setup_fee || '0').toString(),
            (product.discount || '0').toString(),
            (product.cl_amount || '0').toString(),
            product.ad_id_number || '',
            product.client_ad_id_name || '',
            product.ad_account_type || '',
            (product.ad_spend_limit || '0').toString(),
            product.start_date || null,
            product.valid_stopped_date || null,
            visualStatus,
            product.client_status_history || '',
            product.referral_partner_name || '',
            product.month || '',
            product.bank_name || '',
            amtReceived,
            product.is_trial ? 1 : 0,
          ]
        );
        clientLog.renewalsImported++;

        // 2. Insérer une entrée de paiement dans payments pour que le statut soit comptabilisé comme PAID
        run(
          `INSERT INTO payments (
            client_id, renewal_sr_no, amount_received, payment_received_date,
            reference_no, bank_name, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            clientId,
            srNo,
            amtReceived,
            product.start_date || new Date().toISOString().split('T')[0],
            `IMPORT_${srNo}`,
            product.bank_name || 'CSV Import',
            `Initial import payment for ${product.tier || product.setup_type || 'product'}`,
          ]
        );

        // 3. Insérer les paiements historiques s'il y a des lignes spécifiques
        const paymentHistory = product.history || [];
        for (const ph of paymentHistory) {
          if (ph.payment_date && ph.amount_received > 0) {
            run(
              `INSERT INTO payments (
                client_id, renewal_sr_no, amount_received, payment_received_date,
                reference_no, bank_name, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                clientId,
                srNo,
                (ph.amount_received || 0).toString(),
                ph.payment_date || null,
                ph.reference_no || '',
                ph.bank_name || '',
                ph.month ? `Month: ${ph.month}` : '',
              ]
            );
          }
        }
      }

      clientLog.status = 'success';
      importedCount++;

      logActivity(
        auth.user?.id,
        auth.user?.username || 'system',
        clientLog.action === 'created' ? 'CREATE' : 'UPDATE',
        'clients',
        clientId,
        rawName,
        `CSV Import: ${products.length} produits enregistrés avec succès`
      );

    } catch (err) {
      clientLog.status = 'error';
      clientLog.error = err.message || 'Erreur inconnue';
      errorCount++;
      console.error(`[import-clients] Error for "${simClient.nom}":`, err);
    }

    logs.push(clientLog);
  }

  return NextResponse.json({
    ok: true,
    imported: importedCount,
    errors: errorCount,
    total: clients.length,
    logs,
  });
}
