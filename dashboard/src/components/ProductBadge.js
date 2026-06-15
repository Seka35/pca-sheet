export default function ProductBadge({ tier, setup_type }) {
  const getColors = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('top-up') || t.includes('topup')) return { bg: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', label: 'Top-up' };
    if (t.includes('invincible')) return { bg: 'rgba(249, 115, 22, 0.15)', color: '#FB923C', label: 'Invincible set up' };
    if (t.includes('starter')) return { bg: 'rgba(20, 184, 166, 0.15)', color: '#2DD4BF', label: 'Starter' };
    if (t.includes('premium')) return { bg: 'rgba(234, 179, 8, 0.15)', color: '#FACC15', label: 'Premium' };
    if (t.includes('vip')) return { bg: 'rgba(236, 72, 153, 0.15)', color: '#F472B6', label: 'VIP' };
    return { bg: 'var(--border-color)', color: 'var(--text-primary)', label: type };
  };

  const badges = [];
  if (tier && tier.trim() !== '') badges.push(getColors(tier));
  if (setup_type && setup_type.trim() !== '' && setup_type.toLowerCase() !== (tier || '').toLowerCase()) badges.push(getColors(setup_type));

  if (badges.length === 0) return <span>—</span>;

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {badges.map((b, i) => (
        <span key={i} style={{ backgroundColor: b.bg, color: b.color, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          {b.label}
        </span>
      ))}
    </div>
  );
}
