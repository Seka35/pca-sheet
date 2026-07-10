export default function ProductBadge({ tier, setup_type, is_trial, is_ponctual, original_tier, original_setup, showUpgradeBadge, upgradedTier }) {
  const getColors = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('top-up') || t.includes('topup')) return { bg: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', label: 'Top-up' };
    if (t.includes('invincible')) return { bg: 'rgba(249, 115, 22, 0.15)', color: '#FB923C', label: 'Invincible set up' };
    if (t.includes('starter')) return { bg: 'rgba(20, 184, 166, 0.15)', color: '#2DD4BF', label: 'Starter' };
    if (t.includes('premium')) return { bg: 'rgba(234, 179, 8, 0.15)', color: '#FACC15', label: 'Premium' };
    if (t.includes('vip')) return { bg: 'rgba(236, 72, 153, 0.15)', color: '#F472B6', label: 'VIP' };
    // Tier colors - distinct colors for each tier
    if (t.includes('tier 1')) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', label: 'TIER 1' };
    if (t.includes('tier 2')) return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399', label: 'TIER 2' };
    if (t.includes('tier 3')) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', label: 'TIER 3' };
    if (t.includes('tier 4')) return { bg: 'rgba(249, 115, 22, 0.15)', color: '#FB923C', label: 'TIER 4' };
    if (t.includes('tier 5')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', label: 'TIER 5' };
    if (t.includes('tier 6')) return { bg: 'rgba(168, 85, 247, 0.15)', color: '#C084FC', label: 'TIER 6' };
    return { bg: 'var(--border-color)', color: 'var(--text-primary)', label: type };
  };

  const badges = [];
  // For ponctual upgrades: show ORIGINAL tier/setup as main, upgraded tier/setup as "TIER X SETUP PONCTUAL" badge
  if (is_ponctual && original_tier && tier !== original_tier) {
    // Product tab: shows original as main, upgraded as golden badge
    badges.push(getColors(original_tier));
    if (original_setup && setup_type && setup_type !== original_setup) {
      badges.push({ bg: 'rgba(251, 191, 36, 0.2)', color: '#FBBF36', label: `⭐ ${tier} + ${setup_type} PONCTUAL` });
    } else {
      badges.push({ bg: 'rgba(251, 191, 36, 0.2)', color: '#FBBF36', label: `⭐ ${tier} PONCTUAL` });
    }
  } else if (showUpgradeBadge && upgradedTier) {
    // Payment history UPGRADE: show original tier as main badge + golden "TIER X PONCTUAL" for the UPGRADED tier
    badges.push(getColors(tier));
    badges.push({ bg: 'rgba(251, 191, 36, 0.2)', color: '#FBBF36', label: `⭐ ${upgradedTier} PONCTUAL` });
  } else {
    if (tier && tier.trim() !== '') badges.push(getColors(tier));
    if (setup_type && setup_type.trim() !== '' && setup_type.toLowerCase() !== (tier || '').toLowerCase()) badges.push(getColors(setup_type));
  }

  if (badges.length === 0) return <span>—</span>;

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {badges.map((b, i) => (
        <span key={i} style={{ backgroundColor: b.bg, color: b.color, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          {b.label}
        </span>
      ))}
      {is_trial && !is_ponctual && (
        <span style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#FBBF24', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
          TRIAL
        </span>
      )}
    </div>
  );
}
