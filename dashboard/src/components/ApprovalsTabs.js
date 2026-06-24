"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// SVG Icons matching sidebar style
const IconPayments = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const IconTelegram = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

export default function ApprovalsTabs({ pendingCount = 0, telegramCount = 0 }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)' }}>
      <Link href="/approvals/payment" style={{
        padding: '10px 20px',
        textDecoration: 'none',
        color: pathname === '/approvals/payment' ? 'var(--primary-accent)' : 'var(--text-secondary)',
        borderBottom: pathname === '/approvals/payment' ? '2px solid var(--primary-accent)' : '2px solid transparent',
        fontWeight: pathname === '/approvals/payment' ? '600' : '400',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <IconPayments size={14} color={pathname === '/approvals/payment' ? 'var(--primary-accent)' : 'var(--text-secondary)'} />
        Payments {pendingCount > 0 && <span style={{ background: 'var(--primary-accent)', color: '#000', borderRadius: '10px', padding: '2px 6px', fontSize: '11px' }}>{pendingCount}</span>}
      </Link>
      <Link href="/approvals/telegram" style={{
        padding: '10px 20px',
        textDecoration: 'none',
        color: pathname === '/approvals/telegram' ? 'var(--primary-accent)' : 'var(--text-secondary)',
        borderBottom: pathname === '/approvals/telegram' ? '2px solid var(--primary-accent)' : '2px solid transparent',
        fontWeight: pathname === '/approvals/telegram' ? '600' : '400',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <IconTelegram size={14} color={pathname === '/approvals/telegram' ? 'var(--primary-accent)' : 'var(--text-secondary)'} />
        Telegram {telegramCount > 0 && <span style={{ background: '#F87171', color: '#fff', borderRadius: '10px', padding: '2px 6px', fontSize: '11px' }}>{telegramCount}</span>}
      </Link>
    </div>
  );
}
