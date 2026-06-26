"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

const LogoIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="58" stroke="#00F5A0" strokeWidth="4"/>
    <circle cx="60" cy="60" r="40" stroke="#00F5A0" strokeWidth="2" strokeDasharray="8 4"/>
    <path d="M40 60 L55 75 L80 45" stroke="#00F5A0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const navItems = [
  {
    path: '/client/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    path: '/client/profile',
    label: 'My Profile',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    path: '/client/products',
    label: 'My Products',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    path: '/client/upcoming',
    label: 'Upcoming Renewals',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    path: '/client/payments',
    label: 'Payment History',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    path: '/client/pay',
    label: 'Pay',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
];

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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login/client';
  };

  if (isLoginPage) {
    return (
      <div className="layout-wrapper" style={{ display: 'block' }}>
        <main className="main-content" style={{ padding: 0 }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900
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
        display: 'flex',
        flexDirection: 'column',
        zIndex: 901,
        transition: 'left 0.3s ease',
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{
          padding: '28px 20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <circle cx="60" cy="60" r="58" stroke="#00F5A0" strokeWidth="4" fill="none"/>
            <circle cx="60" cy="60" r="40" stroke="#00F5A0" strokeWidth="2" strokeDasharray="8 4" fill="none"/>
            <path d="M40 60 L55 75 L80 45" stroke="#00F5A0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>

        {/* Client info */}
        {clientData && (
          <div style={{
            margin: '16px 12px',
            backgroundColor: 'var(--bg-main)',
            borderRadius: '10px',
            padding: '14px',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <p style={{
              color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px',
              marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {clientData.name}
            </p>
            <p style={{
              color: 'var(--text-secondary)', fontSize: '11px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {clientData.email || 'No email'}
            </p>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: clientData.status === 'Actif' ? '#22c55e' : '#ef4444'
              }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                {clientData.status === 'Actif' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  color: isActive ? 'var(--primary-accent)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(0, 245, 160, 0.1)' : 'transparent',
                  fontWeight: isActive ? '600' : '400',
                  fontSize: '13px',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  border: isActive ? '1px solid rgba(0, 245, 160, 0.2)' : '1px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-main)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s'
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: 0,
        padding: 0,
        minHeight: '100vh',
        width: '100%'
      }}>
        {/* Mobile top bar */}
        <header style={{
          height: '64px',
          borderBottom: '1px solid var(--border-color)',
          display: 'none',
          alignItems: 'center',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(11, 17, 26, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 100
        }}
        className="mobile-header"
        >
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{
              color: 'var(--text-primary)',
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span style={{ marginLeft: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {navItems.find(n => n.path === pathname)?.label || 'Client Portal'}
          </span>
        </header>

        {/* Page content */}
        <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
          {children}
        </div>
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          main { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
