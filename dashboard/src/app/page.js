"use client";

import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/revenue-forecast').then(r => r.json()).catch(() => null)
    ]).then(([d, f]) => {
      setData(d);
      setForecast(f);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) loadData();
      else alert('Sync failed.');
    } catch (err) {
      alert('Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading analytics...</div>;

  const { summary, churnHistory, revenueHistory, topClients, monthlyAcquisition } = data;
  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Active by tier for display
  const tiers = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
  const tierColors = {
    'TIER 1': '#A78BFA', 'TIER 2': '#38BDF8', 'TIER 3': '#34D399',
    'TIER 4': '#FBBF24', 'TIER 5': '#F87171', 'TIER 6': '#E879F9'
  };

  // Confidence badge
  const confidenceColors = { high: '#34D399', medium: '#FBBF24', low: '#F87171' };

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Overview of your activity</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          style={{
            backgroundColor: 'var(--primary-accent)', color: '#0B111A', padding: '10px 16px',
            borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px', cursor: isSyncing ? 'not-allowed' : 'pointer', opacity: isSyncing ? 0.7 : 1
          }}
        >
          {isSyncing ? (
            <svg className="spinner" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeDashoffset="10" strokeLinecap="round" opacity="0.5" /></svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          )}
          <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
        </button>
      </div>

      {/* Primary metrics row */}
      <div className="grid-metrics" style={{ marginBottom: '32px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Clients</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.totalClients}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Clients</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.activeClients}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm11 0l-4 4m0-4l4 4" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Stopped</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.inactiveClients}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Global Churn</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.globalChurn}%</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Last Month Churn</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.lastMonthChurn} <span style={{ fontSize: '14px', fontWeight: '400', color: 'var(--text-secondary)' }}>({summary.lastMonthChurnRate.toFixed(0)}%)</span></div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>MRR</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{formatCurrency(summary.mrr)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>MRR Stabilisé</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{formatCurrency(summary.mrrStabilized)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Due</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#F87171' }}>{formatCurrency(summary.totalDue)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Basket</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{formatCurrency(summary.averageBasket)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Churned</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.churned}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Monthly Churn</div>
            <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.churnRate.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Revenue Forecast */}
      {forecast && (
        <div className="card" style={{ marginBottom: '32px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Revenue Forecast</h2>
            <span style={{
              fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '100px',
              backgroundColor: `${confidenceColors[forecast.confidenceLevel] || '#34D399'}20`,
              color: confidenceColors[forecast.confidenceLevel] || '#34D399'
            }}>
              {forecast.confidenceLevel.toUpperCase()} CONFIDENCE
            </span>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Estimated MRR</div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: '#34D399' }}>{formatCurrency(forecast.estimatedMRR)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Churn Rate</div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>{forecast.churnRate}%</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Stable Clients</div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>{forecast.stableClientsCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Projected New Revenue</div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>{formatCurrency(forecast.projectedNewRevenue)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Active by Tier + Monthly Acquisition */}
      <div className="flex-mobile-column" style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Active Clients by Tier</h2>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {tiers.map(tier => (
              <div key={tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    color: tierColors[tier],
                    border: `1px solid ${tierColors[tier]}50`,
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600'
                  }}>{tier}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '60%' }}>
                  <div style={{ flex: 1, height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${summary.activeByTier[tier] ? Math.max((summary.activeByTier[tier] / Math.max(summary.activeClients, 1)) * 100, 4) : 0}%`,
                      height: '100%', backgroundColor: tierColors[tier], borderRadius: '4px', transition: 'width 0.3s'
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '24px', textAlign: 'right' }}>
                    {summary.activeByTier[tier] || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Monthly Acquisition</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '500' }}>Month</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>New Clients</th>
                </tr>
              </thead>
              <tbody>
                {(monthlyAcquisition || []).slice(-12).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 24px', textAlign: 'left' }}>{row.month}</td>
                    <td style={{ padding: '12px 24px', fontWeight: '600', color: '#34D399' }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly Churn + Monthly Revenue */}
      <div className="flex-mobile-column" style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Monthly Churn</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', minWidth: '500px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '500' }}>Month</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Present</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Active</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Churned</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {churnHistory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 24px', textAlign: 'left' }}>{row.month}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{row.presents}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{row.actifs}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{row.churned}</td>
                    <td style={{ padding: '12px 24px', fontWeight: '600', color: row.rate < 5 ? '#34D399' : row.rate < 10 ? '#FBBF24' : '#F87171' }}>{row.rate.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Monthly Revenue</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', minWidth: '500px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '500' }}>Month</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Gross</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Fees</th>
                  <th style={{ padding: '12px 24px', fontWeight: '500' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {revenueHistory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 24px', textAlign: 'left' }}>{row.month}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{formatCurrency(row.brut)}</td>
                    <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{formatCurrency(row.frais)}</td>
                    <td style={{ padding: '12px 24px', fontWeight: '600', color: '#34D399' }}>{formatCurrency(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top 10 Clients */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Top 10 Clients (Lifetime)</h2>
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '800px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '500', width: '40px' }}>#</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Channel</th>
                <th style={{ padding: '16px 24px', fontWeight: '500' }}>Tags</th>
                <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((client, i) => (
                <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{client.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{client.email}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ color: client.status === 'Actif' ? '#34D399' : '#F87171', padding: '4px 10px', borderRadius: '100px', backgroundColor: client.status === 'Actif' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', fontSize: '11px', fontWeight: '600' }}>
                      {client.status === 'Actif' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {client.canal ? <span style={{ color: '#A78BFA', padding: '4px 10px', borderRadius: '100px', backgroundColor: 'rgba(139, 92, 246, 0.1)', fontSize: '11px', fontWeight: '600' }}>{client.canal}</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {client.tags.map((tag, idx) => (
                        <span key={idx} style={{ color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(client.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
