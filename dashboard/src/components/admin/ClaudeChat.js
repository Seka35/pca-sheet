"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

export default function ClaudeChat({
  csvHeaders,
  csvRows,
  onPatchApplied,
  sessionId,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposedPatch, setProposedPatch] = useState(null);
  const [applying, setApplying] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text, opts = {}) => {
    if (!text.trim()) return;

    const userMsg = { role: 'user', content: text, includeCsvContext: true };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');
    setProposedPatch(null);

    try {
      const res = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [userMsg],
          sessionId,
          csvHeaders,
          csvRows,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get response');
      }

      const data = await res.json();

      const assistantMsg = {
        role: 'assistant',
        content: data.text || '',
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.proposedPatch) {
        setProposedPatch({
          code: data.proposedPatch,
          fullText: data.text,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyPatch = async () => {
    if (!proposedPatch) return;

    setApplying(true);
    setError('');

    try {
      // First apply the patch
      const res = await fetch('/api/claude/apply-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newCode: proposedPatch.code,
          csvHeaders,
          csvRows,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply patch');
      }

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ Patch applied successfully! Re-parsing CSV...`,
        },
      ]);

      setProposedPatch(null);

      // Trigger re-render in parent
      if (onPatchApplied) {
        onPatchApplied(data.parsedClients);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const clearChat = async () => {
    try {
      await fetch(`/api/claude/chat?sessionId=${sessionId}`, { method: 'DELETE' });
      setMessages([]);
      setProposedPatch(null);
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>Claude</span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              color: '#34D399',
              borderRadius: '4px',
              fontWeight: '600',
            }}
          >
            MiniMax-M2.7
          </span>
        </div>
        <button
          onClick={clearChat}
          style={{
            padding: '4px 10px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginTop: '32px',
              lineHeight: '1.6',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>💬</div>
            Describe the problems you see in the CSV preview.
            <br />
            e.g. <em>"Tyler Farrington has 7 products but should only have 2"</em>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-accent)',
                animation: 'pulse 1s infinite',
              }}
            />
            Claude is thinking...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#EF4444',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {proposedPatch && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(52, 211, 153, 0.05)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#34D399',
                marginBottom: '8px',
              }}
            >
              📝 Proposed Script Patch
            </div>
            <pre
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(0,0,0,0.3)',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                maxHeight: '200px',
                marginBottom: '12px',
              }}
            >
              {proposedPatch.code.slice(0, 500)}
              {proposedPatch.code.length > 500 && '...'}
            </pre>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={applyPatch}
                disabled={applying}
                style={{
                  padding: '8px 20px',
                  backgroundColor: applying ? 'rgba(52, 211, 153, 0.5)' : 'var(--primary-accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: applying ? 'not-allowed' : 'pointer',
                }}
              >
                {applying ? 'Applying...' : '✅ Apply Patch & Re-parse'}
              </button>
              <button
                onClick={() => setProposedPatch(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what needs to change in the script..."
          rows={2}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px',
            backgroundColor: loading ? 'rgba(52, 211, 153, 0.3)' : 'var(--primary-accent)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .markdown-content table {
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 12px;
        }
        .markdown-content th,
        .markdown-content td {
          border: 1px solid var(--border-color);
          padding: 4px 8px;
          text-align: left;
        }
        .markdown-content th {
          background: rgba(255,255,255,0.05);
        }
        .markdown-content code {
          background: rgba(0,0,0,0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }
        .markdown-content pre {
          background: rgba(0,0,0,0.3);
          padding: 10px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .markdown-content pre code {
          background: none;
          padding: 0;
        }
        .markdown-content strong {
          font-weight: 700;
        }
        .markdown-content em {
          font-style: italic;
        }
        .markdown-content ul, .markdown-content ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .markdown-content li {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  // Parse markdown for assistant messages
  const htmlContent = useMemo(() => {
    if (isUser || !message.content) return '';
    try {
      return marked.parse(message.content);
    } catch {
      return message.content;
    }
  }, [message.content, isUser]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isUser
            ? 'var(--primary-accent)'
            : 'rgba(255,255,255,0.06)',
          color: isUser ? '#000' : 'var(--text-primary)',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</span>
        ) : (
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          />
        )}
      </div>
    </div>
  );
}
