export default function ProductBadge({ tier, setup_type }) {
  const getColors = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('top-up') || t.includes('topup')) return { bg: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', label: 'Top-up' };
    if (t.includes('tier 1')) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', label: 'Tier 1' };
    if (t.includes('tier 2')) return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399', label: 'Tier 2' };
    if (t.includes('tier 3')) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', label: 'Tier 3' };
    if (t.includes('tier 4')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', label: 'Tier 4' };
    if (t.includes('tier 5')) return { bg: 'rgba(236, 72, 153, 0.15)', color: '#F472B6', label: 'Tier 5' };
    if (t.includes('ad account') || t.includes('setup')) return { bg: 'rgba(14, 165, 233, 0.15)', color: '#38BDF8', label: type };
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
