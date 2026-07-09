"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

const navItems = [
  { path: '/', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, label: 'Dashboard', permission: null },
  { path: '/clients', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>, label: 'Clients', permission: 'read_clients' },
  { path: '/renewals', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, label: 'Renewals', permission: 'read_renewals' },
  { path: '/churn', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>, label: 'Churn Analysis', permission: 'read_payments' },
  { path: '/loyalty', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>, label: 'Loyalty', permission: 'read_payments' },
  { path: '/approvals', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: 'Approvals', permission: 'read_approvals' },
  { path: '/payments', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>, label: 'Payments', permission: 'read_payments' },
  { path: '/admin', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>, label: 'Admin', permission: 'read_users' },
  { path: '/admin/referral-partners', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, label: 'Referral Partners', permission: 'read_users' },
];

export default function ClientsLayout({ children }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const hasPermission = (perm) => {
    if (user?.role === 'super_admin' || user?.role === 'admin') return true;
    return user?.permissions?.includes(perm);
  };

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
      fontWeight: isActive ? '600' : '400',
      textDecoration: 'none',
    };
  };

  return (
    <div className="layout-wrapper">
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 900
          }}
        />
      )}

      <div className={`sidebar-container ${isSidebarOpen ? 'sidebar-mobile-visible' : ''}`}>
        <aside style={{
          width: '260px',
          height: '100vh',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 901,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
            <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>
              PCA <span style={{ color: 'var(--primary-accent)' }}>TRACKING</span>
            </span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '0 8px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Navigation
            </div>
            {navItems.map(item => (
              (!item.permission || hasPermission(item.permission)) && (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  style={getLinkStyle(item.path)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            ))}
          </nav>
        </aside>
      </div>

      <main className="main-content" style={{ marginLeft: '260px', padding: 0 }}>
        <header style={{
          height: '70px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(11, 17, 26, 0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 100,
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>Clients</span>
        </header>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </main>

      <style jsx>{`
        .sidebar-container { display: block; }
        @media (max-width: 768px) {
          .sidebar-container { display: none; }
          .sidebar-mobile-visible { display: block !important; }
        }
      `}</style>
    </div>
  );
}
