// Script de migration pour séparer les bundles existants dans client_products et renewals
const { db } = require('../src/lib/db.js');

console.log('=== Début de la migration des bundles ===');

const transaction = db.transaction(() => {
  // 1. Normaliser d'abord les setup_type dont le prix est 199 (ou contenant invincible avec 199) vers 'old setup'
  db.prepare(`
    UPDATE client_products
    SET setup_type = 'old setup'
    WHERE (setup_type LIKE '%invincible%' OR setup_type LIKE '%account%' OR setup_type IS NULL OR setup_type = '')
      AND (setup_fee = '199' OR setup_fee = '199.00' OR setup_fee = 199)
  `).run();

  db.prepare(`
    UPDATE renewals
    SET setup_type = 'old setup'
    WHERE (setup_type LIKE '%invincible%' OR setup_type LIKE '%account%' OR setup_type IS NULL OR setup_type = '')
      AND (setup_fee = '199' OR setup_fee = '199.00' OR setup_fee = 199)
  `).run();

  // 2. Trouver les client_products qui ont à la fois un tier et un setup_type
  const clientBundles = db.prepare(`
    SELECT * FROM client_products 
    WHERE tier IS NOT NULL AND tier != '' 
      AND setup_type IS NOT NULL AND setup_type != ''
  `).all();

  console.log(`Trouvé ${clientBundles.length} produits bundles dans client_products.`);

  let splitClientProducts = 0;
  for (const item of clientBundles) {
    let resolvedSetup = item.setup_type;
    if ((parseFloat(item.setup_fee) === 199 || item.setup_fee === '199') && (resolvedSetup.includes('invincible') || resolvedSetup.includes('account'))) {
      resolvedSetup = 'old setup';
    }

    // Modifier l'entrée actuelle pour qu'elle devienne le Produit Tier uniquement (setup_type = '', setup_fee = '0')
    db.prepare(`
      UPDATE client_products 
      SET setup_type = '', setup_fee = '0', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(item.id);

    // Créer une nouvelle entrée distincte pour le Setup (tier = '', subscription_fee = '0')
    db.prepare(`
      INSERT INTO client_products (
        client_id, tier, setup_type, original_tier, original_setup,
        subscription_fee, setup_fee, discount, ad_spend_limit, is_active, start_date, created_at
      ) VALUES (?, '', ?, '', ?, '0', ?, ?, '', ?, ?, ?)
    `).run(
      item.client_id,
      resolvedSetup,
      resolvedSetup,
      item.setup_fee || '0',
      item.discount || '0',
      item.is_active !== undefined ? item.is_active : 1,
      item.start_date || new Date().toISOString().split('T')[0],
      item.created_at || new Date().toISOString()
    );

    splitClientProducts++;
  }

  // 3. Traiter également les lignes dans renewals
  const renewalBundles = db.prepare(`
    SELECT * FROM renewals
    WHERE tier IS NOT NULL AND tier != ''
      AND setup_type IS NOT NULL AND setup_type != ''
  `).all();

  console.log(`Trouvé ${renewalBundles.length} bundles dans renewals.`);

  let splitRenewals = 0;
  for (const r of renewalBundles) {
    let resolvedSetup = r.setup_type;
    if ((parseFloat(r.setup_fee) === 199 || r.setup_fee === '199') && (resolvedSetup.includes('invincible') || resolvedSetup.includes('account'))) {
      resolvedSetup = 'old setup';
    }

    const subFee = parseFloat(r.subscription_fee || 0);
    const setFee = parseFloat(r.setup_fee || 0);
    const totalAmt = parseFloat(r.amount_received || 0);

    const tierAmount = totalAmt >= (subFee + setFee) ? subFee : Math.min(totalAmt, subFee);
    const setupAmount = totalAmt >= (subFee + setFee) ? setFee : Math.max(0, totalAmt - subFee);

    // On met à jour la ligne originale pour être le Tier uniquement
    db.prepare(`
      UPDATE renewals
      SET setup_type = '', setup_fee = '0', amount_received = ?
      WHERE sr_no = ?
    `).run(tierAmount.toString(), r.sr_no);

    // Et on insère la ligne Setup dédiée si elle n'existe pas déjà
    const setupSrNo = `${r.sr_no}_SETUP`;
    const existingSetup = db.prepare('SELECT sr_no FROM renewals WHERE sr_no = ?').get(setupSrNo);
    if (!existingSetup) {
      db.prepare(`
        INSERT INTO renewals (
          sr_no, client_id, client_name, client_status_history, month, start_date,
          tier, setup_type, subscription_fee, setup_fee, discount, referral_partner_name,
          valid_stopped_date, payment_name, bank_name, amount_received, payment_received_date,
          payment_received_month, reference_no, notes, visual_status
        ) VALUES (?, ?, ?, 'New', ?, ?, '', ?, '0', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        setupSrNo,
        r.client_id,
        r.client_name,
        r.month,
        r.start_date,
        resolvedSetup,
        (setFee || 199).toString(),
        r.discount || '',
        r.referral_partner_name || '',
        r.valid_stopped_date || '',
        r.payment_name || '',
        r.bank_name || '',
        setupAmount.toString(),
        r.payment_received_date || '',
        r.payment_received_month || '',
        r.reference_no || '',
        `Setup pour ${r.sr_no}`,
        r.visual_status || 'Active'
      );
      splitRenewals++;
    }
  }

  return { splitClientProducts, splitRenewals };
});

try {
  const result = transaction();
  console.log(`✅ Migration réussie : ${result.splitClientProducts} client_products séparés, ${result.splitRenewals} renewals séparés.`);
} catch (e) {
  console.error('❌ Échec de la migration :', e);
}
