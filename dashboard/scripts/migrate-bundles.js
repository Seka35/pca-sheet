// Script de migration pour séparer les bundles existants dans client_products et renewals
const { db } = require('../src/lib/db.js');

console.log('=== Début de la migration des bundles ===');

const transaction = db.transaction(() => {
  // 1. Trouver les client_products qui ont à la fois un tier et un setup_type
  const clientBundles = db.prepare(`
    SELECT * FROM client_products 
    WHERE tier IS NOT NULL AND tier != '' 
      AND setup_type IS NOT NULL AND setup_type != ''
  `).all();

  console.log(`Trouvé ${clientBundles.length} produits bundles dans client_products.`);

  let splitClientProducts = 0;
  for (const item of clientBundles) {
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
      item.setup_type,
      item.setup_type,
      item.setup_fee || '0',
      item.discount || '0',
      item.is_active !== undefined ? item.is_active : 1,
      item.start_date || new Date().toISOString().split('T')[0],
      item.created_at || new Date().toISOString()
    );

    splitClientProducts++;
  }

  // 2. Traiter également les lignes dans renewals
  const renewalBundles = db.prepare(`
    SELECT * FROM renewals
    WHERE tier IS NOT NULL AND tier != ''
      AND setup_type IS NOT NULL AND setup_type != ''
  `).all();

  console.log(`Trouvé ${renewalBundles.length} bundles dans renewals.`);

  let splitRenewals = 0;
  for (const r of renewalBundles) {
    // On met à jour la ligne originale pour être le Tier uniquement
    db.prepare(`
      UPDATE renewals
      SET setup_type = '', setup_fee = '0'
      WHERE sr_no = ?
    `).run(r.sr_no);

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
        r.setup_type,
        r.setup_fee || '0',
        r.discount || '',
        r.referral_partner_name || '',
        r.valid_stopped_date || '',
        r.payment_name || '',
        r.bank_name || '',
        r.setup_fee || '0',
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
