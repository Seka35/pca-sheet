"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ApprovalsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to payment approvals (sync tab removed - Google Sheet disabled)
    router.replace('/approvals/payment');
  }, [router]);

  return (
    <div style={{ padding: '64px', textAlign: 'center' }}>
      <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-accent)', borderRadius: '50%', margin: '0 auto 16px' }}></div>
      <p style={{ color: 'var(--text-secondary)' }}>Redirecting...</p>
    </div>
  );
}
