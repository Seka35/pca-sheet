"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const getLinkStyle = (path) => {
    const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
    
    return {
      padding: '10px 12px', 
      borderRadius: '8px', 
      display: 'flex', 
      gap: '12px', 
      alignItems: 'center', 
      color: isActive ? 'var(--primary-accent)' : 'var(--text-secondary)',
      backgroundColor: isActive ? 'var(--status-active-bg)' : 'transparent',
      transition: 'background-color 0.2s, color 0.2s',
      fontWeight: isActive ? '600' : '400'
    };
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>
          PCA <span style={{ color: 'var(--primary-accent)' }}>TRACKING</span>
        </span>
      </div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '0 8px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Navigation</div>
        
        <Link href="/" style={getLinkStyle('/')}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span>Dashboard</span>
        </Link>
        <Link href="/clients" style={getLinkStyle('/clients')}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <span>Clients</span>
        </Link>
        <Link href="/renewals" style={getLinkStyle('/renewals')}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span>Renewals</span>
        </Link>
        <Link href="/approvals" style={getLinkStyle('/approvals')}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Approvals (Sync)</span>
        </Link>
        <Link href="/payments" style={getLinkStyle('/payments')}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          <span>Payments</span>
        </Link>
        <Link href="#" style={getLinkStyle('/catalog')}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span>Catalog</span>
        </Link>
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
        <button 
          onClick={handleLogout}
          style={{ 
            width: '100%', padding: '10px 12px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center',
            color: '#F87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: '500', transition: 'background-color 0.2s'
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
