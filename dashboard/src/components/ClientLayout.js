"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isLoginPage = pathname === "/login";

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
    { path: '/', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { path: '/clients', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { path: '/renewals', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
    { path: '/payments', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
    { path: '/approvals', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
  ];

  return (
    <div className="layout-wrapper">
      <div className={`sidebar-container ${isSidebarOpen ? 'sidebar-mobile-visible' : ''}`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 900
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="main-content" style={{ padding: 0 }}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <div style={{ padding: '24px' }}>
          {children}
        </div>
        
        {/* Bottom Nav for Mobile */}
        <nav className="bottom-nav" style={{ display: 'none' }}>
          {navItems.map(item => (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`bottom-nav-item ${pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
            </Link>
          ))}
        </nav>
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

