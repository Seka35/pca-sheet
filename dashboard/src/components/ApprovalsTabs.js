"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ApprovalsTabs({ pendingCount = 0, telegramCount = 0 }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)' }}>
      <Link href="/approvals" style={{
        padding: '10px 20px',
        textDecoration: 'none',
        color: pathname === '/approvals' ? 'var(--primary-accent)' : 'var(--text-secondary)',
        borderBottom: pathname === '/approvals' ? '2px solid var(--primary-accent)' : '2px solid transparent',
        fontWeight: pathname === '/approvals' ? '600' : '400',
      }}>
        📄 Sync {pendingCount > 0 && <span style={{ background: 'var(--primary-accent)', color: '#fff', borderRadius: '10px', padding: '2px 6px', fontSize: '11px', marginLeft: '6px' }}>{pendingCount}</span>}
      </Link>
      <Link href="/approvals/payment" style={{
        padding: '10px 20px',
        textDecoration: 'none',
        color: pathname === '/approvals/payment' ? 'var(--primary-accent)' : 'var(--text-secondary)',
        borderBottom: pathname === '/approvals/payment' ? '2px solid var(--primary-accent)' : '2px solid transparent',
        fontWeight: pathname === '/approvals/payment' ? '600' : '400',
      }}>
        💳 Payments
      </Link>
      <Link href="/approvals/telegram" style={{
        padding: '10px 20px',
        textDecoration: 'none',
        color: pathname === '/approvals/telegram' ? 'var(--primary-accent)' : 'var(--text-secondary)',
        borderBottom: pathname === '/approvals/telegram' ? '2px solid var(--primary-accent)' : '2px solid transparent',
        fontWeight: pathname === '/approvals/telegram' ? '600' : '400',
      }}>
        📱 Telegram {telegramCount > 0 && <span style={{ background: '#F87171', color: '#fff', borderRadius: '10px', padding: '2px 6px', fontSize: '11px', marginLeft: '6px' }}>{telegramCount}</span>}
      </Link>
    </div>
  );
}
