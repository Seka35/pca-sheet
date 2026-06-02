"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
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

  return (
    <div className="layout-wrapper">
      <div className={`sidebar-container ${isSidebarOpen ? 'sidebar-mobile-visible' : ''}`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 900
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="main-content" style={{ padding: 0 }}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </main>
      
      <style jsx>{`
        .sidebar-container {
          display: block;
        }
        @media (max-width: 768px) {
          .sidebar-container {
            display: none;
          }
          .sidebar-mobile-visible {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
