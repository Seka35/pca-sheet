"use client";

import { useEffect, useState, useCallback } from 'react';

const inputStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '10px 12px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '13px',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
  fontWeight: '500',
};

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

export default function BackupPage() {
  const [backups, setBackups] = useState([]);
  const [cron, setCron] = useState({ hour_utc: 3, last_run: null });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [restoreModal, setRestoreModal] = useState(null); // { filename, date, clients }
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState(null); // { type: 'ok' | 'err', text: '' }
  const [currentClientCount, setCurrentClientCount] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backups');
      const data = await res.json();
      setBackups(data.backups || []);
      setCron(data.cron || { hour_utc: 3, last_run: null });
    } catch (e) {
      setMessage({ type: 'err', text: 'Load failed: ' + e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load current client count once (used in the restore confirmation).
  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((rows) => setCurrentClientCount(Array.isArray(rows) ? rows.length : null))
      .catch(() => setCurrentClientCount(null));
  }, []);

  const createNow = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/backups', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setMessage({ type: 'ok', text: `Backup ${data.backup.filename} created (${data.backup.clients} clients).${data.pruned?.length ? ` Pruned ${data.pruned.length} old backup(s).` : ''}` });
      load();
    } catch (e) {
      setMessage({ type: 'err', text: e.message });
    } finally {
      setCreating(false);
    }
  };

  const updateHour = async (h) => {
    try {
      const res = await fetch('/api/backups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: h }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setCron((c) => ({ ...c, hour_utc: data.hour }));
      setMessage({ type: 'ok', text: `Daily backup will now run at ${data.hour}:00 UTC.` });
    } catch (e) {
      setMessage({ type: 'err', text: e.message });
    }
  };

  const openRestore = (b) => {
    setRestoreModal({
      filename: b.filename,
      date: b.created_at,
      clients: b.clients,
      renewals: b.renewals,
    });
    setConfirmText('');
    setMessage(null);
  };

  const doRestore = async () => {
    if (confirmText !== 'RESTORE') return;
    setRestoring(restoreModal.filename);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(restoreModal.filename)}/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setMessage({ type: 'ok', text: `Restored from ${data.restored_from}. Pre-restore snapshot saved as ${data.pre_restore}.` });
      setRestoreModal(null);
      load();
    } catch (e) {
      setMessage({ type: 'err', text: 'Restore failed: ' + e.message });
    } finally {
      setRestoring(null);
    }
  };

  const sourceBadge = (src) => {
    const map = {
      'cron':         { color: '#60A5FA', bg: 'rgba(59, 130, 246, 0.12)' },
      'manual':       { color: '#34D399', bg: 'rgba(16, 185, 129, 0.12)' },
      'pre-restore':  { color: '#FBBF24', bg: 'rgba(245, 158, 11, 0.12)' },
      'unknown':      { color: 'var(--text-secondary)', bg: 'var(--border-color)' },
    };
    const c = map[src] || map.unknown;
    return (
      <span style={{
        backgroundColor: c.bg, color: c.color,
        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
      }}>{src}</span>
    );
  };

  return (
    <div style={{ paddingBottom: '64px' }}>
      {/* Header */}
      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Backup</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Daily snapshot of the database. Last 30 days kept.
            {cron.last_run && <> Last auto-backup: {formatDate(cron.last_run)}.</>}
          </p>
        </div>
        <button onClick={createNow} disabled={creating} className="btn-primary" style={{ opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Creating…' : 'Create backup now'}
        </button>
      </div>

      {message && (
        <div className="card" style={{
          marginBottom: '16px', padding: '12px 16px',
          borderColor: message.type === 'ok' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          color: message.type === 'ok' ? '#34D399' : '#F87171',
          fontSize: '13px', fontWeight: '500',
        }}>
          {message.text}
        </div>
      )}

      {/* Schedule config */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Schedule</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Daily backup hour (UTC)</label>
            <input
              type="number" min="0" max="23"
              value={cron.hour_utc}
              onChange={(e) => updateHour(e.target.value)}
              style={{ ...inputStyle, width: '80px' }}
            />
          </div>
          <div style={{ alignSelf: 'end', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Cron runs at <b>{cron.hour_utc}:00 UTC</b> every day. 30-day rolling retention.
          </div>
        </div>
      </div>

      {/* Backups list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Backups</h2>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {backups.length} {backups.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
        ) : backups.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No backups yet. Click "Create backup now" to take the first one.
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '900px' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Date</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Filename</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500' }}>Source</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Size</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Clients</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Renewals</th>
                  <th style={{ padding: '16px 24px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>{formatDate(b.created_at)}</td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{b.filename}</td>
                    <td style={{ padding: '16px 24px' }}>{sourceBadge(b.source)}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatBytes(b.size)}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>{b.clients ?? '—'}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>{b.renewals ?? '—'}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button onClick={() => openRestore(b)} style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#F87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px', padding: '6px 12px',
                        fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      }}>Restore</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore confirmation modal */}
      {restoreModal && (
        <div
          onClick={() => setRestoreModal(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px',
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#F87171' }}>⚠ Restore database</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                This will <b>overwrite the live database</b> with the contents of this backup.
                All changes made after this point will be lost.
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--bg-main)', padding: '12px 14px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: '6px' }}><b>Backup date:</b> {formatDate(restoreModal.date)}</div>
              <div style={{ marginBottom: '6px' }}><b>Filename:</b> <span style={{ fontFamily: 'monospace' }}>{restoreModal.filename}</span></div>
              <div style={{ marginBottom: '6px' }}>
                <b>Clients at backup time:</b> {restoreModal.clients ?? '—'}{' '}
                {currentClientCount !== null && restoreModal.clients !== null && (
                  <span style={{ color: restoreModal.clients === currentClientCount ? 'var(--text-secondary)' : '#FBBF24' }}>
                    (now: {currentClientCount} {restoreModal.clients !== currentClientCount ? '⚠ differs' : ''})
                  </span>
                )}
              </div>
              {restoreModal.renewals !== null && (
                <div><b>Renewals at backup time:</b> {restoreModal.renewals}</div>
              )}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              A <b>pre-restore snapshot</b> of the current database will be saved automatically
              (you'll see it in the list as <code style={{ backgroundColor: 'var(--bg-main)', padding: '1px 4px', borderRadius: '3px' }}>pre-restore</code>)
              — use it to roll back if needed.
            </div>

            <div>
              <label style={labelStyle}>
                Type <b style={{ color: '#F87171' }}>RESTORE</b> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                autoComplete="off"
                spellCheck="false"
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setRestoreModal(null)} style={{
                backgroundColor: 'transparent', color: 'var(--text-secondary)',
                padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '13px',
              }}>Cancel</button>
              <button
                onClick={doRestore}
                disabled={confirmText !== 'RESTORE' || restoring}
                style={{
                  backgroundColor: '#F87171', color: '#0B111A',
                  padding: '10px 16px', borderRadius: '8px', border: 'none',
                  fontSize: '13px', fontWeight: '600',
                  cursor: (confirmText !== 'RESTORE' || restoring) ? 'not-allowed' : 'pointer',
                  opacity: (confirmText !== 'RESTORE' || restoring) ? 0.5 : 1,
                }}
              >
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
