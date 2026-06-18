"use client";

import { useEffect, useState } from 'react';

const CHURN_CATEGORIES = [
  { value: 'price', label: 'Price' },
  { value: 'results', label: 'Not seeing results' },
  { value: 'service', label: 'Poor service' },
  { value: 'competitor', label: 'Competitor' },
  { value: 'internal', label: 'Internal decision' },
  { value: 'unknown', label: 'Unknown' }
];

const categoryColors = {
  price: '#F87171', results: '#FBBF24', service: '#A78BFA',
  competitor: '#38BDF8', internal: '#34D399', unknown: '#8B9AB0'
};

const tierColors = {
  'TIER 1': '#A78BFA', 'TIER 2': '#38BDF8', 'TIER 3': '#34D399',
  'TIER 4': '#FBBF24', 'TIER 5': '#F87171', 'TIER 6': '#E879F9'
};

export default function ChurnPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/churn')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>;

  if (!data) return null;

  const { totalChurned, byMonth, byTier, byCategory, details } = data;
  const latestMonth = byMonth[0] || {};

  // Churn categories that have data
  const activeCategories = byCategory.filter(c => c.count > 0);

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Churn Analysis</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Understand why and when clients are leaving</p>
      </div>

      {/* Metric cards */}
      <div className="grid-metrics" style={{ marginBottom: '32px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', padding: '32px 24px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Churned</div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#F87171' }}>{totalChurned}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', padding: '32px 24px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month</div>
            <div style={{ fontSize: '36px', fontWeight: '800' }}>{latestMonth.churned || 0} <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-secondary)' }}>({latestMonth.rate || 0}%)</span></div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', padding: '32px 24px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(167, 139, 250, 0.1)', color: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>By Category</div>
            <div style={{ fontSize: '36px', fontWeight: '800' }}>{activeCategories.length}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', padding: '32px 24px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>By Tier</div>
            <div style={{ fontSize: '36px', fontWeight: '800' }}>{byTier.filter(t => t.churned_count > 0).length}</div>
          </div>
        </div>
      </div>

      <div className="flex-mobile-column" style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        {/* Monthly Churn Table */}
        <div className="card" style={{ flex: 1.5, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Churn by Month</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', minWidth: '450px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Month</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'center' }}>Present</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'center' }}>Churned</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600' }}>{row.month}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'center' }}>{row.presents}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '800', color: '#F87171', textAlign: 'center', fontSize: '14px' }}>{row.churned}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '800', textAlign: 'right', color: row.rate < 5 ? '#34D399' : row.rate < 10 ? '#FBBF24' : '#F87171', fontSize: '14px' }}>{row.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Churn by Category & Tier */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>By Reason</h2>
          </div>
          <div style={{ padding: '24px', flex: 1 }}>
            {activeCategories.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                No churn reason data yet
              </div>
            )}
            {activeCategories.map(cat => {
              const catInfo = CHURN_CATEGORIES.find(c => c.value === cat.category) || { label: cat.category, value: cat.category };
              const maxCount = Math.max(...byCategory.map(c => c.count), 1);
              return (
                <div key={cat.category} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{catInfo.label}</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: categoryColors[cat.category] || '#8B9AB0' }}>{cat.count}</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(cat.count / maxCount) * 100}%`,
                      height: '100%',
                      backgroundColor: categoryColors[cat.category] || '#8B9AB0',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-in-out'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Churn by Tier */}
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>By Tier</h3>
            {byTier.filter(t => t.churned_count > 0).map(t => (
              <div key={t.tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ 
                  color: tierColors[t.tier] || '#8B9AB0', 
                  fontSize: '11px', fontWeight: '700', 
                  border: `1px solid ${tierColors[t.tier]}50`, backgroundColor: `${tierColors[t.tier]}10`,
                  padding: '4px 8px', borderRadius: '6px' 
                }}>{t.tier}</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{t.churned_count}</span>
              </div>
            ))}
            {byTier.filter(t => t.churned_count > 0).length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Details table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Churn Details</h2>
        </div>
        <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '700px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Client</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Tier</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Reason</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Churn Month</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '16px 24px', fontWeight: '600' }}>{d.name}</td>
                  <td style={{ padding: '16px 24px' }}>
                    {d.tier && tierColors[d.tier] ? (
                      <span style={{ color: tierColors[d.tier], fontSize: '11px', fontWeight: '700', border: `1px solid ${tierColors[d.tier]}50`, backgroundColor: `${tierColors[d.tier]}10`, padding: '4px 8px', borderRadius: '6px' }}>{d.tier}</span>
                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {d.churn_reason ? (
                      <span style={{ color: categoryColors[d.churn_reason] || '#8B9AB0', fontSize: '12px', fontWeight: '700' }}>
                        {CHURN_CATEGORIES.find(c => c.value === d.churn_reason)?.label || d.churn_reason}
                      </span>
                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{d.churn_month || '—'}</td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No churn data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
