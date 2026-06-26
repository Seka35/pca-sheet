"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductBadge from '@/components/ProductBadge';

const IconArrowLeft = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconDownload = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconDocument = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

export default function PaymentsPage() {
  const [client, setClient] = useState(null);
  const [paymentsData, setPaymentsData] = useState({ payments: [], total_paid: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/client/me').then(r => r.json()),
      fetch('/api/client/payments').then(r => r.json()),
    ]).then(([clientData, payments]) => {
      setClient(clientData.client);
      setPaymentsData(payments);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  const { payments, total_paid } = paymentsData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500', alignSelf: 'flex-start' }}>
        <IconArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Payment History</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Total paid card */}
      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Paid</p>
        <p style={{ fontSize: '40px', fontWeight: '800', color: 'var(--primary-accent)' }}>{fmtUSD(total_paid)}</p>
      </div>

      {payments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: 'var(--text-secondary)' }}><IconDocument size={40} /></div>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No payments yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your payment history will appear here.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Method</TableHeader>
                  <TableHeader>Product</TableHeader>
                  <TableHeader>Reference</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Invoice</TableHeader>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <TableCell style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.date || '—'}</TableCell>
                    <TableCell style={{ fontWeight: '700', color: '#22c55e', whiteSpace: 'nowrap' }}>{p.amount ? fmtUSD(p.amount) : '—'}</TableCell>
                    <TableCell style={{ whiteSpace: 'nowrap' }}>{p.method || '—'}</TableCell>
                    <TableCell><span style={{ fontSize: '12px', fontWeight: '500' }}>{p.product}</span></TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reference || '—'}</TableCell>
                    <TableCell>
                      {p.is_topup ? (
                        <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>TOP-UP</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Renewal</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.reference ? (
                        <a
                          href={`/api/invoice/generate?sr_no=${encodeURIComponent(p.reference || '')}&client_id=${client?.id || ''}&client_name=${encodeURIComponent(client?.name || '')}&bank_name=${encodeURIComponent(p.method || 'crypto')}&product_name=${encodeURIComponent(p.product || 'Service')}&subtotal=${encodeURIComponent(p.amount || '0')}&discount=0&invoice_date=${encodeURIComponent(p.date || '')}&invoice_no=${encodeURIComponent((p.reference || '').replace(/\D/g, '').slice(-4) || '001')}&first_name=${encodeURIComponent(client?.first_name || '')}&last_name=${encodeURIComponent(client?.last_name || '')}&email=${encodeURIComponent(client?.email || '')}&address=${encodeURIComponent(client?.address || '')}&amount_received=${encodeURIComponent(p.amount || '0')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download Invoice PDF"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(0, 245, 160, 0.08)', color: 'var(--primary-accent)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', border: '1px solid rgba(0, 245, 160, 0.15)' }}
                        >
                          <IconDownload size={14} /> PDF
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                      )}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => router.push('/client/pay')} style={{ padding: '12px 32px', backgroundColor: 'var(--primary-accent)', color: '#0B111A', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
          + Add New Payment
        </button>
      </div>
    </div>
  );
}

function TableHeader({ children }) {
  return (
    <th style={{ padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function TableCell({ children, style }) {
  return (
    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
      {children}
    </td>
  );
}
