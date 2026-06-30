"use client";

import { useEffect, useState, useRef } from 'react';

function AvatarCircle({ name, userId, clientId, isBot }) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!userId || isBot) return;
    let cancelled = false;
    async function fetchAvatar() {
      try {
        const res = await fetch(`/api/clients/${clientId}/avatar?user_id=${encodeURIComponent(userId)}`);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setAvatarUrl(url);
      } catch {
        // silently ignore — fallback to initials
      } finally {
        if (!cancelled) setFetched(true);
      }
    }
    fetchAvatar();
    return () => { cancelled = true; };
  }, [userId, clientId, isBot]);

  if (isBot) {
    return (
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        backgroundColor: 'rgba(20,184,166,0.2)', border: '1px solid rgba(20,184,166,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '14px',
      }}>
        🤖
      </div>
    );
  }

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  if (!fetched) {
    return (
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
      }} />
    );
  }

  // Fallback: initials
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const id = parseInt(String(userId || '0').replace(/\D/g, '').slice(-6)) || 0;
  const colors = ['rgba(244,114,182,0.3)', 'rgba(167,139,250,0.3)', 'rgba(96,165,250,0.3)', 'rgba(52,211,153,0.3)', 'rgba(245,158,11,0.3)', 'rgba(248,113,113,0.3)'];
  const borderColors = ['rgba(244,114,182,0.5)', 'rgba(167,139,250,0.5)', 'rgba(96,165,250,0.5)', 'rgba(52,211,153,0.5)', 'rgba(245,158,11,0.5)', 'rgba(248,113,113,0.5)'];
  const textColors = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#f87171'];

  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%',
      backgroundColor: colors[id % colors.length],
      border: `1px solid ${borderColors[id % borderColors.length]}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: '11px', fontWeight: '700',
      color: textColors[id % textColors.length],
    }}>
      {initials}
    </div>
  );
}

export default function ChatTab({ clientId, linkedGroups }) {
  const [messages, setMessages] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const linkedGroup = linkedGroups?.[0];

  useEffect(() => {
    if (!linkedGroup?.chat_id) {
      setTimeout(() => setMessages([]), 0);
    }
  }, [linkedGroup?.chat_id]);

  useEffect(() => {
    if (!linkedGroup?.chat_id) return;

    async function load() {
      try {
        const res = await fetch(`/api/clients/${clientId}/messages`);
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
      } catch (e) {
        console.error('fetch messages error:', e);
      } finally {
        setInitialLoading(false);
      }
    }
    load();

    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [linkedGroup?.chat_id, clientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setInputText('');
      const res2 = await fetch(`/api/clients/${clientId}/messages`);
      const data2 = await res2.json();
      if (data2.messages) setMessages(data2.messages);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateTs) {
    if (!dateTs) return '';
    const d = new Date(dateTs * 1000);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateTs) {
    if (!dateTs) return '';
    const d = new Date(dateTs * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getSenderDisplayName(msg) {
    if (msg.is_bot) return 'Bot';
    const parts = [];
    if (msg.username) parts.push(`@${msg.username}`);
    if (msg.first_name) {
      const full = msg.last_name ? `${msg.first_name} ${msg.last_name}` : msg.first_name;
      if (!msg.username) parts.push(full);
      else parts.push(full);
    }
    return parts.slice(0, 2).join(' · ') || `User ${String(msg.user_id || '').slice(-4)}`;
  }

  function getSenderColor(msg) {
    if (msg.is_bot) return '#14b8a6';
    // Generate a consistent color from user_id
    const id = parseInt(String(msg.user_id || '0').replace(/\D/g, '').slice(-6)) || 0;
    const colors = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#f87171', '#38bdf8', '#4ade80'];
    return colors[id % colors.length];
  }

  function renderFile(msg) {
    if (!msg.file_id) return null;

    if (msg.file_type === 'photo') {
      return (
        <div style={{ marginTop: '8px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/clients/${clientId}/files/${msg.file_id}`}
            alt={msg.file_caption || 'Photo'}
            style={{ maxWidth: '280px', maxHeight: '200px', borderRadius: '8px', cursor: 'pointer', display: 'block' }}
            onClick={() => window.open(`/api/clients/${clientId}/files/${msg.file_id}`, '_blank')}
          />
          {msg.file_caption && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{msg.file_caption}</p>
          )}
        </div>
      );
    }

    if (msg.file_type === 'document') {
      return (
        <div
          style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }}
          onClick={() => window.open(`/api/clients/${clientId}/files/${msg.file_id}`, '_blank')}
        >
          <span style={{ fontSize: '12px' }}>📄</span>
          <span style={{ fontSize: '13px', color: '#fff' }}>{msg.file_caption || 'Document'}</span>
        </div>
      );
    }

    return null;
  }

  if (!linkedGroup?.chat_id) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
        <p style={{ fontWeight: '600' }}>No Telegram group linked</p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>
          The client must first send /start in a group with the bot to establish a link.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💬</span>
            {linkedGroup.chat_title || 'Telegram Group'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
            {linkedGroup.chat_id}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {linkedGroup.client_tele_id && (
            <span style={{ backgroundColor: 'rgba(20,184,166,0.1)', color: '#14b8a6', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
              {linkedGroup.client_tele_id}
            </span>
          )}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Live</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--bg-main)' }}>
        {initialLoading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
            <p>No messages yet.</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Messages will appear here once the group starts chatting.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prevMsg = messages[idx - 1];
            const showDateHeader = idx === 0 || formatDate(msg.date) !== formatDate(prevMsg?.date);
            const isBot = !!msg.is_bot;
            const senderColor = getSenderColor(msg);

            // Group consecutive messages from same sender
            const prevSameSender = prevMsg && !isBot && prevMsg.user_id === msg.user_id && !prevMsg.is_bot;

            return (
              <div key={msg.id}>
                {showDateHeader && (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', margin: '12px 0 8px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '12px', display: 'inline-block', alignSelf: 'center' }}>
                    {formatDate(msg.date)}
                  </div>
                )}

                {/* Single message row: avatar + bubble */}
                <div style={{
                  display: 'flex',
                  flexDirection: isBot ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: '8px',
                  marginBottom: prevSameSender ? '2px' : '8px',
                  marginLeft: isBot ? 'auto' : '0',
                  maxWidth: '85%',
                  alignSelf: isBot ? 'flex-end' : 'flex-start',
                }}>
                  {/* Avatar — shown only when name is shown (first in a group) */}
                  {!isBot && !prevSameSender && (
                    <AvatarCircle
                      name={getSenderDisplayName(msg)}
                      userId={msg.user_id}
                      clientId={clientId}
                      isBot={false}
                    />
                  )}
                  {!isBot && prevSameSender && (
                    <div style={{ width: '32px', flexShrink: 0 }} />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                    {/* Sender name — shown only when first in a group */}
                    {!isBot && !prevSameSender && (
                      <div style={{ fontSize: '11px', color: senderColor, fontWeight: '600', paddingLeft: '4px' }}>
                        {getSenderDisplayName(msg)}
                        {msg.is_edited && (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontStyle: 'italic' }}> (edited)</span>
                        )}
                      </div>
                    )}

                    {/* Bubble */}
                    <div style={{
                      backgroundColor: isBot ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.08)',
                      borderRadius: isBot ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '8px 12px',
                      border: isBot ? '1px solid rgba(20,184,166,0.3)' : '1px solid rgba(255,255,255,0.1)',
                      wordBreak: 'break-word',
                    }}>
                      <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {msg.text || (msg.file_id ? `[${msg.file_type || 'File'}]` : '')}
                      </div>
                      {renderFile(msg)}
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: '2px' }}>
                        {formatTime(msg.date)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message to the group..."
          disabled={sending}
          style={{ flex: 1, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '10px 16px', color: '#fff', fontSize: '14px', outline: 'none' }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: sending || !inputText.trim() ? 'var(--border-color)' : 'var(--primary-accent)',
            color: sending || !inputText.trim() ? 'var(--text-secondary)' : '#000',
            border: 'none', cursor: sending || !inputText.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}
        >
          {sending ? (
            <span style={{ fontSize: '12px' }}>...</span>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>

      {error && (
        <div style={{ padding: '8px 16px', color: '#f87171', fontSize: '13px', backgroundColor: 'rgba(239,68,68,0.1)' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
