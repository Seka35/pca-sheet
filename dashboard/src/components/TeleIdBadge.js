"use client";

// Compact pill showing a client's Tele ID. Three visual states:
//   1. assigned    — the ID is in the DB and matches the parsed name (green/blue)
//   2. conflict    — the ID is NULL in DB but the name has a pattern that's
//                    already taken by another client (yellow, with warning)
//   3. missing     — the name has no "Tele NNN" pattern at all (em-dash)
//
// The UNIQUE index on clients.tele_id means at most one client owns a given
// Tele ID, so the bot can always disambiguate. The conflict state is purely
// informational for the seller — it tells them "the Sheet has a duplicate
// row, fix the source data so this client gets its own ID".

export default function TeleIdBadge({ teleId, parsedTeleId, conflict, size = 'md' }) {
  const fontSize = size === 'sm' ? '11px' : '12px';
  const pad = size === 'sm' ? '2px 6px' : '3px 8px';

  // Conflict: name parses to a Tele ID but DB has NULL.
  // Show the parsed value with a warning so the seller sees the data issue.
  if (conflict && parsedTeleId) {
    return (
      <span
        title={`Parsed "${parsedTeleId}" from name but it's already taken by another client. Fix the Sheet so this client has a unique Tele ID, or the bot will fall back to exact-name matching.`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'monospace', fontSize, fontWeight: '600',
          color: '#FBBF24', backgroundColor: 'rgba(245, 158, 11, 0.12)',
          padding: pad, borderRadius: '4px',
          border: '1px dashed rgba(245, 158, 11, 0.4)',
        }}
      >
        <span style={{ fontSize: '10px', opacity: 0.6 }}>Tele</span> {parsedTeleId}
        <span style={{ fontSize: '10px' }}>⚠</span>
      </span>
    );
  }

  if (teleId) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontFamily: 'monospace', fontSize, fontWeight: '600',
        color: '#60A5FA', backgroundColor: 'rgba(59, 130, 246, 0.12)',
        padding: pad, borderRadius: '4px',
      }}>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>Tele</span> {teleId}
      </span>
    );
  }

  return <span style={{ color: 'var(--text-secondary)', fontSize }}>—</span>;
}
