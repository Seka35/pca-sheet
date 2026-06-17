"use client";

import { useEffect, useState } from 'react';

const tierColors = {
  'TIER 1': '#A78BFA', 'TIER 2': '#38BDF8', 'TIER 3': '#34D399',
  'TIER 4': '#FBBF24', 'TIER 5': '#F87171', 'TIER 6': '#E879F9'
};

export default function LoyaltyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/loyalty')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>;
  if (!data) return null;

  const { byRenewalCount, bySpend, byTier, invincibleCount, tierSelfRanking } = data;
  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const renderRankTable = (rows, rankKey, label, valueKey, valueFormatter) => (
    <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{label}</h2>
      </div>
      <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '400px' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
            <tr style={{ color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 24px', fontWeight: '500', width: '40px' }}>#</th>
              <th style={{ padding: '12px 24px', fontWeight: '500' }}>Client</th>
              <th style={{ padding: '12px 24px', fontWeight: '500' }}>Tier</th>
              <th style={{ padding: '12px 24px', fontWeight: '500', textAlign: 'right' }}>{valueKey}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((r, i) => (
              <tr key={r.client_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 24px', color: i < 3 ? '#FBBF24' : 'var(--text-secondary)', fontWeight: i < 3 ? '700' : '400' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td style={{ padding: '12px 24px', fontWeight: '500' }}>{r.name}</td>
                <td style={{ padding: '12px 24px' }}>
                  {r.tier && tierColors[r.tier] ? (
                    <span style={{ color: tierColors[r.tier], fontSize: '11px', fontWeight: '600', border: `1px solid ${tierColors[r.tier]}50`, padding: '2px 8px', borderRadius: '4px' }}>{r.tier}</span>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
                <td style={{ padding: '12px 24px', textAlign: 'right', fontWeight: '600' }}>
                  {valueFormatter(r[valueKey])}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Client Loyalty</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Rankings and tier distribution of your client base</p>
      </div>

      {/* Summary cards */}
      <div className="grid-metrics" style={{ marginBottom: '32px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Invincible Setups</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{invincibleCount}</div>
          </div>
        </div>
        {Object.entries(byTier).sort(([a], [b]) => {
          const order = ['TIER 1','TIER 2','TIER 3','TIER 4','TIER 5','TIER 6','Invincible set up'];
          const ia = order.indexOf(a);
          const ib = order.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        }).map(([tier, count]) => (
          <div key={tier} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: `${tierColors[tier]}15`, color: tierColors[tier], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tier}</div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: tierColors[tier] }}>{count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ranking tables */}
      <div className="flex-mobile-column" style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        {renderRankTable(bySpend, 'client_id', 'Top Spenders (CA)', 'total_spend', formatCurrency)}
        {renderRankTable(byRenewalCount, 'client_id', 'Most Loyal (Renewals)', 'renewal_count', v => `${v}x`)}
      </div>

      {/* Tier breakdown */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Tier Breakdown</h2>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {tierSelfRanking.map(t => {
            const maxCount = Math.max(...tierSelfRanking.map(x => x.count), 1);
            return (
              <div key={t.tier} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: tierColors[t.tier], fontSize: '11px', fontWeight: '600', border: `1px solid ${tierColors[t.tier]}50`, padding: '2px 8px', borderRadius: '4px' }}>{t.tier}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{t.count} client{t.count !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: '10px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(t.count / maxCount) * 100}%`,
                    height: '100%',
                    backgroundColor: tierColors[t.tier] || '#8B9AB0',
                    borderRadius: '5px'
                  }} />
                </div>
              </div>
            );
          })}
          {tierSelfRanking.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No tier data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
