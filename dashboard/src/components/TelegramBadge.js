// Small reusable pill showing a Telegram chat ID (or "—").
export default function TelegramBadge({ chatId, title }) {
  if (!chatId) {
    return (
      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
    );
  }
  return (
    <span
      title={title ? `${title} • ${chatId}` : chatId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#60A5FA',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        padding: '3px 8px',
        borderRadius: '4px',
        maxWidth: '160px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
      {chatId}
    </span>
  );
}
