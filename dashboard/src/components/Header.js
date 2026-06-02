"use client";

import { useState, useEffect, useRef } from 'react';
import ClientModal from './ClientModal';

export default function Header(props) {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [selectedClient, setSelectedClient] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    // Fetch all clients to allow fast local searching
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => setClients(data))
      .catch(err => console.error(err));
      
    // Handle click outside to close dropdown
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length > 0) {
      const q = query.toLowerCase();
      const filtered = clients.filter(c => c.name.toLowerCase().includes(q));
      setResults(filtered);
      setShowDropdown(true);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query, clients]);

  const handleSelect = async (clientId) => {
    setShowDropdown(false);
    setQuery('');
    
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      setSelectedClient(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
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

        <div ref={searchRef} className="search-container" style={{ position: 'relative', width: '400px' }}>
          <input 
            type="text" 
            placeholder="Search for a client..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if(query.length > 0) setShowDropdown(true); }}
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '16px', opacity: 0.5 }}>🔍</span>
          
          {/* Dropdown Results */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 200
            }}>
              {results.length > 0 ? results.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => handleSelect(r.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontWeight: '500' }}>{r.name}</span>
                  <span className="badge" style={{ 
                    backgroundColor: r.status === 'Actif' ? 'var(--status-active-bg)' : 'var(--status-cut-bg)', 
                    color: r.status === 'Actif' ? 'var(--status-active)' : 'var(--status-cut)',
                    fontSize: '10px'
                  }}>
                    {r.status === 'Actif' ? 'Active' : 'Archive'}
                  </span>
                </div>
              )) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No clients found</div>
              )}
            </div>
          )}
        </div>
      </header>
      
      {/* Search Result Modal */}
      <ClientModal selectedClient={selectedClient} onClose={() => setSelectedClient(null)} />
    </>
  );
}
