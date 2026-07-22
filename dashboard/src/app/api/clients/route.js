import { NextResponse } from 'next/server';
import { all } from '@/lib/db';
import { validateAddClientPayload } from '@/lib/clientValidation';
import { createClient } from '@/lib/clientCreator';
import { extractTeleId } from '@/lib/teleIdParser';
import { requirePermission } from '@/lib/apiAuth';
import { logActivity } from '@/lib/db';

function parseAmount(val) {
  if (!val) return 0;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// --- GET: list all clients (existing handler, unchanged) --------------------

export async function GET(req) {
  try {
    const clients = await all("SELECT * FROM clients ORDER BY CASE WHEN status = 'Actif' THEN 0 ELSE 1 END, id DESC");
    const history = await all('SELECT * FROM renewals ORDER BY sr_no ASC');
    const clientProducts = await all('SELECT * FROM client_products WHERE is_active = 1 ORDER BY id DESC');

    const clientHistory = {};
    history.forEach(row => {
      if (!clientHistory[row.client_id]) clientHistory[row.client_id] = [];
      clientHistory[row.client_id].push(row);
    });

    // Build a lookup of client_products by client_id (new architecture)
    const clientNewProducts = {};
    clientProducts.forEach(cp => {
      if (!clientNewProducts[cp.client_id]) clientNewProducts[cp.client_id] = [];
      clientNewProducts[cp.client_id].push(cp);
    });

    const now = new Date();

    const formattedClients = clients.map(client => {
      // Filter out renewals entries with CP_ prefix — those are from new architecture, not real renewals
      const h = (clientHistory[client.id] || []).filter(r => !r.sr_no || !r.sr_no.startsWith('CP_'));

      let earliestDate = null;
      let latestMonth = null;
      let activeProducts = [];

      h.forEach(row => {
        if (row.start_date) {
          const d = new Date(row.start_date);
          if (!earliestDate || d < earliestDate) earliestDate = d;
        }
        latestMonth = row.month;
      });

      if (latestMonth) {
        activeProducts = h.filter(r => r.month === latestMonth);
      }

      let mrr = 0;
      let produits = [];
      let productDetails = [];
      let canal = null;
      let renewalDay = null;

      // Collect product details from ALL history entries, not just latest month
      h.forEach(p => {
        mrr += parseAmount(p.subscription_fee) + parseAmount(p.setup_fee);

        // Use tier as primary product name; append setup_type if present and different
        let pName = p.tier || '';
        if (p.setup_type && p.setup_type.trim() !== '' && p.setup_type !== p.tier) {
          pName = pName ? pName + ' - ' + p.setup_type : p.setup_type;
        }
        if (pName && !produits.includes(pName)) {
          produits.push(pName);
        }

        // Collect product details for colored badges (from all products)
        if (p.tier || p.setup_type) {
          productDetails.push({
            tier: p.tier,
            setup_type: p.setup_type,
            is_trial: p.is_trial === 1,
            current_spend: p.current_spend || '0',
            ad_spend_limit: p.ad_spend_limit || '0',
          });
        }

        if (!canal && p.bank_name) canal = p.bank_name;

        if (!renewalDay && p.start_date) {
          const d = new Date(p.start_date);
          if (!isNaN(d.getTime())) {
            renewalDay = `J${d.getDate()}`;
          }
        }
      });

      // Also collect products from client_products (new architecture)
      const newProds = clientNewProducts[client.id] || [];
      newProds.forEach(cp => {
        mrr += parseAmount(cp.subscription_fee) + parseAmount(cp.setup_fee);

        let pName = cp.tier || '';
        if (cp.setup_type && cp.setup_type.trim() !== '' && cp.setup_type !== cp.tier) {
          pName = pName ? pName + ' - ' + cp.setup_type : cp.setup_type;
        }
        if (pName && !produits.includes(pName)) {
          produits.push(pName);
        }

        if (cp.tier || cp.setup_type) {
          productDetails.push({
            tier: cp.tier,
            setup_type: cp.setup_type,
            is_trial: false,
            current_spend: '0',
            ad_spend_limit: cp.ad_spend_limit || '0',
          });
        }

        if (!renewalDay && cp.start_date) {
          const d = new Date(cp.start_date);
          if (!isNaN(d.getTime())) {
            renewalDay = `J${d.getDate()}`;
          }
        }
      });

      let anciennete = '—';
      if (earliestDate) {
        let months = (now.getFullYear() - earliestDate.getFullYear()) * 12;
        months -= earliestDate.getMonth();
        months += now.getMonth();

        if (months <= 0) {
          anciennete = 'New';
        } else {
          const years = Math.floor(months / 12);
          const remainingMonths = months % 12;
          if (years > 0) {
            anciennete = `${years}y ${remainingMonths > 0 ? remainingMonths + 'm' : ''}`.trim();
          } else {
            anciennete = `${months}m`;
          }
        }
      }

      const parsedTeleId = extractTeleId(client.name);
      const teleIdConflict = !client.tele_id && !!parsedTeleId;

      return {
        id: client.id,
        pd_id: client.id + 1000,
        nom: client.name,
        email: client.telegram_group_id || 'No contact',
        telegram_group_id: client.telegram_group_id || null,
        tele_id: client.tele_id || null,
        parsed_tele_id: parsedTeleId,
        tele_id_conflict: teleIdConflict,
        produits: produits.length > 0 ? produits.join(', ') : '—',
        productDetails: productDetails,
        mensuel: mrr,
        statut: client.status === 'Actif' ? 'Active' : 'Inactive',
        canal: canal || '—',
        renouvellement: renewalDay || '—',
        anciennete: anciennete,
      };
    });

    return NextResponse.json(formattedClients);
  } catch (error) {
    console.error('Erreur API /clients:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- POST: create a new client (writes to Sheet first, then DB) ------------

export async function POST(req) {
  const auth = requirePermission(req, 'create_clients');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const validation = validateAddClientPayload(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { name, telegram_group_id, products } = validation.cleaned;

    const result = await createClient({
      name,
      telegramGroupId: telegram_group_id,
      products,
      source: 'dashboard-add',
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || 'Internal Server Error',
          code: result.code || 'INTERNAL',
          client_id: result.client_id,
          sr_nos: result.sr_nos || [],
          backup: result.backup,
        },
        { status: 500 }
      );
    }

    logActivity(auth.user?.id, auth.user?.username || 'system', 'CREATE', 'clients', result.client_id, name, null);

    return NextResponse.json({
      ok: true,
      client_id: result.client_id,
      sr_nos: result.sr_nos,
      backup: result.backup,
    });
  } catch (error) {
    console.error('[POST /api/clients] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error', code: 'INTERNAL' },
      { status: 500 }
    );
  }
}
