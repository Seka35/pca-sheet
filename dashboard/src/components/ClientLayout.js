"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clientData, setClientData] = useState(null);
  const isLoginPage = pathname === "/login" || pathname === "/login/setup" || pathname === "/login/client";

  useEffect(() => {
    if (!isLoginPage) {
      fetch('/api/client/me')
        .then(res => res.json())
        .then(data => {
          if (data.client) setClientData(data.client);
        })
        .catch(() => {});
    }
  }, [isLoginPage]);

  if (isLoginPage) {
    return (
      <div className="layout-wrapper" style={{ display: 'block' }}>
        <main className="main-content" style={{ padding: 0 }}>
          {children}
        </main>
      </div>
    );
  }

  const navItems = [
    { path: '/client/dashboard', label: 'Dashboard' },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login/client';
  };

  return (
    <div className="layout-wrapper">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 900
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: isSidebarOpen ? 0 : '-280px',
        width: '280px',
        height: '100vh',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-color)',
        padding: '24px 16px',
        zIndex: 901,
        transition: 'left 0.3s ease',
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px', padding: '0 8px' }}>
          <img src="/PCA-white.png" alt="PCA" style={{ height: '48px', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Client Portal</p>
        </div>

        {/* Client info */}
        {clientData && (
          <div style={{
            backgroundColor: 'var(--bg-main)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
            border: '1px solid var(--border-color)'
          }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
              {clientData.name}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {clientData.email || 'No email'}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setIsSidebarOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                color: pathname === item.path ? 'var(--primary-accent)' : 'var(--text-primary)',
                backgroundColor: pathname === item.path ? 'rgba(0, 245, 160, 0.1)' : 'transparent',
                fontWeight: pathname === item.path ? '600' : '400',
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Logout button */}
        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{
        marginLeft: 0,
        padding: 0,
        minHeight: '100vh'
      }}>
        {/* Top header */}
        <header style={{
          height: '70px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '16px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(11, 17, 26, 0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 100
        }}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{
              display: 'block',
              color: 'var(--text-primary)',
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {clientData?.name || 'Client Portal'}
          </span>
        </header>

        {/* Page content */}
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </main>

      <style jsx>{`
        .layout-wrapper { display: flex; min-height: 100vh; }
        .main-content { flex: 1; margin-left: 0; }
        @media (min-width: 769px) {
          .main-content { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
