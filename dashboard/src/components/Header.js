"use client";

export default function Header(props) {
  return (
    <header style={{
      height: '70px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      backgroundColor: 'rgba(11, 17, 26, 0.8)',
      backdropFilter: 'blur(10px)',
      zIndex: 100
    }}>
      <button
        onClick={props.onMenuClick}
        className="mobile-menu-btn"
        style={{
          display: 'none',
          color: 'var(--text-primary)',
          padding: '8px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)'
        }}
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
