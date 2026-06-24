"use client";

import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading analytics...</div>;

  const { summary, churnHistory, revenueHistory, topClients, monthlyAcquisition } = data;
  const formatCurrency = (val) => '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const tiers = ['TIER 1', 'TIER 2', 'TIER 3', 'TIER 4', 'TIER 5', 'TIER 6'];
  const tierColors = {
    'TIER 1': '#A78BFA', 'TIER 2': '#38BDF8', 'TIER 3': '#34D399',
    'TIER 4': '#FBBF24', 'TIER 5': '#F87171', 'TIER 6': '#E879F9'
  };
  const confidenceColors = { high: '#34D399', medium: '#FBBF24', low: '#F87171' };

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Executive overview of your agency performance</p>
      </div>

      <div className="grid-metrics" style={{ marginBottom: '32px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.totalClients}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.activeClients}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm11 0l-4 4m0-4l4 4" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stopped</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.inactiveClients}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Global Churn</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.globalChurn}%</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Month Churn</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.lastMonthChurn} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>({summary.lastMonthChurnRate.toFixed(0)}%)</span></div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Churn</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.churnRate.toFixed(0)}%</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MRR</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{formatCurrency(summary.mrr)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', border: '1px solid rgba(52, 211, 153, 0.3)', backgroundColor: 'rgba(52, 211, 153, 0.02)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stabilized MRR</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#34D399' }}>{formatCurrency(summary.mrrStabilized)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Due</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#F87171' }}>{formatCurrency(summary.totalDue)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Basket</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{formatCurrency(summary.averageBasket)}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Churned Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{summary.churned}</div>
          </div>
        </div>
      </div>

      {forecast && (
        <div className="card" style={{ marginBottom: '32px', border: '1px solid rgba(52, 211, 153, 0.3)', backgroundColor: 'rgba(52, 211, 153, 0.02)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(52, 211, 153, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Revenue Forecast</h2>
            <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 12px', borderRadius: '100px', backgroundColor: `${confidenceColors[forecast.confidenceLevel] || '#34D399'}20`, color: confidenceColors[forecast.confidenceLevel] || '#34D399' }}>
              {forecast.confidenceLevel.toUpperCase()} CONFIDENCE
            </span>
          </div>
          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', textAlign: 'center' }}>
            <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>Estimated MRR</div><div style={{ fontSize: '28px', fontWeight: '800', color: '#34D399' }}>{formatCurrency(forecast.estimatedMRR)}</div></div>
            <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>Avg Churn Rate</div><div style={{ fontSize: '28px', fontWeight: '800' }}>{forecast.churnRate}%</div></div>
            <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>Stable Clients</div><div style={{ fontSize: '28px', fontWeight: '800' }}>{forecast.stableClientsCount}</div></div>
            <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>Projected New Revenue</div><div style={{ fontSize: '28px', fontWeight: '800' }}>{formatCurrency(forecast.projectedNewRevenue)}</div></div>
          </div>
        </div>
      )}

      <div className="flex-mobile-column" style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Active Clients by Tier</h2>
          </div>
          <div style={{ padding: '24px' }}>
            {tiers.map(tier => (
              <div key={tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ width: '80px' }}>
                  <span style={{ color: tierColors[tier], border: `1px solid ${tierColors[tier]}50`, backgroundColor: `${tierColors[tier]}10`, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{tier}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, marginLeft: '24px' }}>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ width: `${summary.activeByTier[tier] ? Math.max((summary.activeByTier[tier] / Math.max(summary.activeClients, 1)) * 100, 4) : 0}%`, height: '100%', backgroundColor: tierColors[tier], borderRadius: '5px', transition: 'width 0.5s ease-in-out' }} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', width: '32px', textAlign: 'right' }}>{summary.activeByTier[tier] || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Monthly Acquisition</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Month</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>New Clients</th>
                </tr>
              </thead>
              <tbody>
                {(monthlyAcquisition || []).slice(-12).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 24px', fontWeight: '600' }}>{row.month}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '800', color: 'var(--primary-accent)', textAlign: 'right', fontSize: '14px' }}>+{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex-mobile-column" style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ flex: 1.2, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Monthly Churn Analysis</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '500px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Month</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'center' }}>Present</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'center' }}>Churned</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {churnHistory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 24px', fontWeight: '600' }}>{row.month}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'center' }}>{row.presents}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'center' }}>{row.actifs}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'center' }}>{row.churned}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '800', textAlign: 'right', color: row.rate < 5 ? '#34D399' : row.rate < 10 ? '#FBBF24' : '#F87171', fontSize: '14px' }}>{row.rate.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Monthly Revenue</h2>
          </div>
          <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '400px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Month</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Gross</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Fees</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {revenueHistory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 24px', fontWeight: '600' }}>{row.month}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'right' }}>{formatCurrency(row.brut)}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', textAlign: 'right' }}>{formatCurrency(row.frais)}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '800', color: '#34D399', textAlign: 'right', fontSize: '14px' }}>{formatCurrency(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Top 10 Clients (Lifetime Value)</h2>
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '800px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', width: '40px' }}>#</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Client</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Channel</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Tags</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', textAlign: 'right' }}>Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((client, i) => (
                <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '14px' }}>{i + 1}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', fontSize: '14px' }}>{client.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{client.email || 'No email'}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ color: client.status === 'Actif' ? '#34D399' : '#F87171', padding: '4px 10px', borderRadius: '6px', backgroundColor: client.status === 'Actif' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                      {client.status === 'Actif' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {client.canal ? <span style={{ color: '#A78BFA', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(139, 92, 246, 0.1)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>{client.canal}</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {client.tags.length > 0 ? client.tags.map((tag, idx) => (
                        <span key={idx} style={{ color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{tag}</span>
                      )) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '800', color: 'var(--primary-accent)', fontSize: '15px' }}>{formatCurrency(client.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
