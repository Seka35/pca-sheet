"use client";

import { useEffect, useState, useCallback } from 'react';
import { availableVars } from '@/lib/botTemplates';
import { extractTeleId } from '@/lib/teleIdParser';

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

function StatusPill({ status, reason }) {
  let bg = 'rgba(239, 68, 68, 0.1)';
  let color = '#F87171';
  let label = 'Disabled';
  if (status?.polling) {
    bg = 'rgba(16, 185, 129, 0.1)';
    color = '#34D399';
    label = 'Online';
  } else if (status?.enabled) {
    bg = 'rgba(245, 158, 11, 0.1)';
    color = '#FBBF24';
    label = 'Error';
  }
  return (
    <span
      title={reason || ''}
      style={{
        backgroundColor: bg, color, padding: '4px 12px',
        borderRadius: '100px', fontSize: '12px', fontWeight: '700',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}
    >
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  );
}

export default function BotPage() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [templates, setTemplates] = useState({});
  const [groups, setGroups] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tokenPreview, setTokenPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [sweepResult, setSweepResult] = useState(null);
  const [testModal, setTestModal] = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('<b>Hello</b> from PCA bot 👋');
  const [testResult, setTestResult] = useState(null);

  // Local config form state.
  const [form, setForm] = useState({
    token: '',
    enabled: false,
    sweep_interval_minutes: 15,
    quiet_hours_start: '',
    quiet_hours_end: '',
    timezone: 'UTC',
    human_verification_enabled: false,
    team_notification_chat_id: '',
  });
  const [hasToken, setHasToken] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, t, g, l] = await Promise.all([
        fetch('/api/bot/status').then((r) => r.json()),
        fetch('/api/bot/config').then((r) => r.json()),
        fetch('/api/bot/templates').then((r) => r.json()),
        fetch('/api/bot/groups').then((r) => r.json()),
        fetch('/api/bot/log?limit=50').then((r) => r.json()),
      ]);
      setStatus(s);
      setConfig(c);
      setTemplates(t.templates || {});
      setGroups(Array.isArray(g) ? g : []);
      setLogs(Array.isArray(l) ? l : []);
      setHasToken(!!c?.has_token);
      setTokenPreview(c?.token_preview || null);
      setForm({
        token: '',
        enabled: !!c?.enabled,
        sweep_interval_minutes: c?.sweep_interval_minutes || 15,
        quiet_hours_start: c?.quiet_hours_start || '',
        quiet_hours_end: c?.quiet_hours_end || '',
        timezone: c?.timezone || 'UTC',
        human_verification_enabled: !!c?.human_verification_enabled,
        team_notification_chat_id: c?.team_notification_chat_id || '',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Clear the "Saved" indicator after a few seconds, or when the user edits the form again.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  useEffect(() => {
    // If the user changes anything, the previously-shown "Saved" is now stale.
    setSavedAt(null);
    // We intentionally don't include savedAt in deps — this effect is just a "form changed" listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.token, form.enabled, form.sweep_interval_minutes, form.quiet_hours_start, form.quiet_hours_end, form.timezone]);

  const saveConfig = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      const body = {
        enabled: form.enabled,
        sweep_interval_minutes: Number(form.sweep_interval_minutes),
        quiet_hours_start: form.quiet_hours_start || null,
        quiet_hours_end: form.quiet_hours_end || null,
        timezone: form.timezone,
        human_verification_enabled: form.human_verification_enabled,
        team_notification_chat_id: form.team_notification_chat_id || null,
      };
      if (form.token) body.token = form.token;
      const res = await fetch('/api/bot/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      await loadAll();
      setSavedAt(new Date());
      setForm((f) => ({ ...f, token: '' }));  // Clear the field after save
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveTemplates = async (newTemplates) => {
    setSaving(true);
    try {
      const res = await fetch('/api/bot/templates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: newTemplates }),
      });
      if (!res.ok) throw new Error('save failed');
      setTemplates(newTemplates);
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const runSweep = async () => {
    setSweepResult(null);
    try {
      const res = await fetch('/api/bot/sweep', { method: 'POST' });
      const data = await res.json();
      setSweepResult(data);
      loadAll();
    } catch (e) {
      setSweepResult({ error: e.message });
    }
  };

  const clearLogs = async () => {
    if (!confirm('Delete all reminder logs? This cannot be undone.')) return;
    try {
      await fetch('/api/bot/log?all=true', { method: 'DELETE' });
      setLogs([]);
 } catch (e) {
      alert('Failed to clear logs: ' + e.message);
    }
  };

  const sendTest = async () => {
    setTestResult(null);
    try {
      const res = await fetch('/api/bot/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: testChatId, message: testMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message_id: data.message_id });
        setTestModal(false);
      } else {
        setTestResult({ ok: false, error: data.error || 'failed', detail: data.detail });
      }
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    }
  };

  const assignGroup = async (chatId, clientId) => {
    try {
      const res = await fetch(`/api/bot/groups/${encodeURIComponent(chatId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });
      if (!res.ok) throw new Error('assign failed');
      loadAll();
    } catch (e) {
      alert('Assign failed: ' + e.message);
    }
  };

  const unlinkGroup = async (chatId) => {
    if (!confirm('Unlink this group? Reminders will stop.')) return;
    try {
      const res = await fetch(`/api/bot/groups/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('unlink failed');
      loadAll();
    } catch (e) {
      alert('Unlink failed: ' + e.message);
    }
  };

  const addTemplate = () => {
    // Find the next available positive offset (after existing ones)
    const existingOffsets = Object.keys(templates).map(Number);
    let nextOffset = 1;
    while (existingOffsets.includes(nextOffset)) nextOffset++;
    const updated = {
      ...templates,
      [String(nextOffset)]: { label: 'New reminder', message: 'Hi {{client_name}}, this is a reminder.', enabled: true },
    };
    setTemplates(updated);
  };

  const removeTemplate = (offset) => {
    const next = { ...templates };
    delete next[String(offset)];
    setTemplates(next);
  };

  const updateTemplate = (offset, patch) => {
    setTemplates({
      ...templates,
      [String(offset)]: { ...templates[String(offset)], ...patch },
    });
  };

  const renameTemplateOffset = (oldOffset, newOffset) => {
    const newOffsetStr = String(newOffset);
    if (templates[newOffsetStr] !== undefined && oldOffset !== newOffsetStr) {
      alert(`Template for offset ${newOffset} already exists.`);
      return;
    }
    const next = { ...templates };
    const data = next[String(oldOffset)];
    delete next[String(oldOffset)];
    next[newOffsetStr] = data;
    setTemplates(next);
  };

  const formatTypeChip = (type) => {
    const colors = {
      'T-7': 'rgba(56, 189, 248, 0.15)',
      'T-2': 'rgba(245, 158, 11, 0.15)',
      'T0':  'rgba(239, 68, 68, 0.15)',
      'T+1': 'rgba(239, 68, 68, 0.15)',
    };
    const textColors = {
      'T-7': '#38BDF8', 'T-2': '#FBBF24', 'T0': '#F87171', 'T+1': '#F87171',
    };
    return (
      <span style={{
        backgroundColor: colors[type] || 'var(--border-color)',
        color: textColors[type] || 'var(--text-secondary)',
        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
      }}>{type}</span>
    );
  };

  return (
    <div style={{ paddingBottom: '64px' }}>
      {/* Header */}
      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Bot Telegram</h1>
            {status && <StatusPill status={status} reason={status.reason} />}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Send renewal reminders to a Telegram group shared with the client.
            {status?.bot_username
              ? <> Connected as <b>@{status.bot_username}</b> — token is valid.</>
              : status?.reason === 'no_token'
                ? <> Paste a Telegram bot token below to get started.</>
                : status?.reason === 'disabled'
                  ? <> Bot token saved but disabled — toggle "Bot enabled" and save.</>
                  : status?.reason === 'invalid_token'
                    ? <> Token saved but invalid — check it on @BotFather.</>
                    : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setTestModal(true)} style={{
            backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
            padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>Test send</button>
          <button onClick={runSweep} style={{
            backgroundColor: 'var(--primary-accent)', color: '#0B111A',
            padding: '10px 14px', borderRadius: '8px', border: 'none',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>Run sweep now</button>
        </div>
      </div>

      {sweepResult && (
        <div className="card" style={{ marginBottom: '24px', padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Last sweep</div>
          <pre style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)' }}>
{JSON.stringify(sweepResult, null, 2)}
          </pre>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
      ) : (
        <>
          {/* Section A — General */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>General</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Bot token (from @BotFather)</label>
                  {hasToken && (
                    <span style={{
                      fontSize: '11px', fontWeight: '600',
                      color: '#34D399', backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 8px', borderRadius: '4px',
                    }}>✓ Token saved</span>
                  )}
                </div>
                {tokenPreview && (
                  <div style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    marginBottom: '6px',
                    display: 'inline-block',
                    letterSpacing: '0.5px',
                  }}>
                    {tokenPreview}
                  </div>
                )}
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck="false"
                  placeholder={hasToken ? 'Leave empty to keep the current token, or paste a new one to replace it' : 'Paste the token from @BotFather'}
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  style={inputStyle}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Stored server-side in the database. The input is masked for security
                  (it stays empty after save — that's normal). {hasToken && status?.bot_username && (
                    <>Currently connected as <b>@{status.bot_username}</b>.</>
                  )}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Sweep interval (minutes)</label>
                <input type="number" min="1" value={form.sweep_interval_minutes}
                  onChange={(e) => setForm({ ...form, sweep_interval_minutes: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Timezone</label>
                <input type="text" placeholder="UTC" value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Quiet hours start</label>
                <input type="time" value={form.quiet_hours_start}
                  onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Quiet hours end</label>
                <input type="time" value={form.quiet_hours_end}
                  onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Team notification chat ID</label>
                <input type="text" placeholder="e.g. -1001234567890"
                  value={form.team_notification_chat_id}
                  onChange={(e) => setForm({ ...form, team_notification_chat_id: e.target.value })}
                  style={inputStyle} />
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Team receives product-disabled alerts here. Leave empty to disable.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'end' }}>
                <input id="enabled" type="checkbox" checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label htmlFor="enabled" style={{ fontSize: '13px', cursor: 'pointer' }}>Bot enabled</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'end' }}>
                <input id="human_verification" type="checkbox" checked={form.human_verification_enabled}
                  onChange={(e) => setForm({ ...form, human_verification_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label htmlFor="human_verification" style={{ fontSize: '13px', cursor: 'pointer' }}>Human verification required</label>
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              {savedAt && (
                <span style={{ fontSize: '12px', color: '#34D399', fontWeight: '600' }}>
                  ✓ Saved
                </span>
              )}
              <button onClick={saveConfig} disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>

          {/* Section B — Reminder schedule */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Reminder schedule</h2>
              <button onClick={addTemplate} style={{
                backgroundColor: 'transparent', color: 'var(--primary-accent)',
                padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--primary-accent)',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>+ Add reminder</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.keys(templates).sort((a, b) => Number(a) - Number(b)).map((offset) => {
                  const tpl = templates[offset];
                  const isFinal = tpl.is_final_reminder === true;
                  return (
                    <div key={offset} style={{
                      backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px',
                      border: isFinal ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                    }}>
                      {isFinal && (
                        <div style={{
                          fontSize: '11px', color: '#F87171', fontWeight: '600',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          padding: '4px 8px', borderRadius: '4px', marginBottom: '10px',
                        }}>
                          🔕 Final reminder — product will be disabled after this fires
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ flex: '0 0 100px' }}>
                          <label style={labelStyle}>Day offset</label>
                          <input type="number" value={offset}
                            onChange={(e) => renameTemplateOffset(offset, parseInt(e.target.value) || 0)}
                            style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Label</label>
                          <input type="text" value={tpl.label || ''}
                            onChange={(e) => updateTemplate(offset, { label: e.target.value })}
                            style={inputStyle} />
                        </div>
                        <div style={{ flex: '0 0 80px' }}>
                          <label style={labelStyle}>Enabled</label>
                          <input type="checkbox" checked={tpl.enabled !== false}
                            onChange={(e) => updateTemplate(offset, { enabled: e.target.checked })}
                            style={{ width: '18px', height: '18px' }} />
                        </div>
                        <div style={{ flex: '0 0 110px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ ...labelStyle, color: '#F87171' }}>Disable product</label>
                          <input type="checkbox" checked={tpl.is_final_reminder === true}
                            onChange={(e) => updateTemplate(offset, { is_final_reminder: e.target.checked })}
                            style={{ width: '18px', height: '18px' }}
                            title="When this reminder fires, mark the product as inactive"
                          />
                        </div>
                        <button onClick={() => removeTemplate(offset)} style={{
                          alignSelf: 'end', backgroundColor: 'transparent',
                          color: '#F87171', border: 'none', cursor: 'pointer',
                          padding: '8px 12px', fontSize: '12px',
                        }}>Delete</button>
                      </div>
                      <label style={labelStyle}>Message (HTML — use {`{{variables}}`})</label>
                      <textarea
                        value={tpl.message || ''}
                        onChange={(e) => updateTemplate(offset, { message: e.target.value })}
                        rows={3}
                        style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                      />
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--primary-accent)' }}>Negative = before due date.</span>
                        <span style={{ color: '#FBBF24' }}> 0 = day of.</span>
                        <span style={{ color: '#F87171' }}> Positive = after.</span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>Telegram HTML supported.</span>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(templates).length === 0 && (
                  <div style={{ color: 'var(--text-secondary)', padding: '16px', textAlign: 'center' }}>
                    No reminders configured. Add one to start sending messages.
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Available variables
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableVars.map((v) => (
                    <div key={v.key} style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                      <code style={{ backgroundColor: 'var(--bg-main)', padding: '2px 6px', borderRadius: '3px' }}>{`{{${v.key}}}`}</code>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => saveTemplates(templates)} disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save templates'}
              </button>
            </div>
          </div>

          {/* Section C — Linked groups */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Linked groups</h2>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '800px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Chat ID</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Group title</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Tele ID</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Client</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Last seen</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    // Show the parsed Tele ID from the group title (real-time)
                    // next to the client's persisted Tele ID. Mismatch = link is wrong.
                    const titleTeleId = extractTeleId(g.chat_title);
                    const teleMatches = titleTeleId && g.client_tele_id && titleTeleId === g.client_tele_id;
                    const teleMismatch = titleTeleId && g.client_tele_id && titleTeleId !== g.client_tele_id;
                    return (
                    <tr key={g.chat_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {g.chat_id}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{g.chat_title}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                        {titleTeleId ? (
                          <span style={{
                            fontFamily: 'monospace', fontWeight: '600',
                            color: teleMismatch ? '#F87171' : '#60A5FA',
                            backgroundColor: teleMismatch ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.12)',
                            padding: '2px 6px', borderRadius: '4px',
                            title: teleMismatch
                              ? `Group title says "Tele ${titleTeleId}" but client is linked to Tele ${g.client_tele_id}`
                              : (g.client_tele_id ? 'Match ✓' : 'Detected from group title, client not yet linked'),
                          }}>
                            {titleTeleId}
                            {teleMatches && <span style={{ marginLeft: '4px', opacity: 0.7 }}>✓</span>}
                            {teleMismatch && <span style={{ marginLeft: '4px' }}>⚠</span>}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {g.status === 'linked' ? (
                          <span style={{ fontWeight: '500' }}>{g.client_name || `ID ${g.client_id}`}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          backgroundColor: g.status === 'linked' ? 'rgba(16, 185, 129, 0.1)' : g.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: g.status === 'linked' ? '#34D399' : g.status === 'pending' ? '#FBBF24' : '#F87171',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                        }}>{g.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {g.last_seen_at ? new Date(g.last_seen_at + 'Z').toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {g.status === 'archived' ? (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {g.status === 'pending' && (
                              <AssignControl onAssign={(cid) => assignGroup(g.chat_id, cid)} />
                            )}
                            <button onClick={() => unlinkGroup(g.chat_id)} style={{
                              backgroundColor: 'transparent', color: '#F87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px',
                              padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
                            }}>{g.status === 'pending' ? 'Reject' : 'Unlink'}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No groups yet. Add the bot to a Telegram group and type /start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section D — Recent reminders */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Recent reminders</h2>
              <button onClick={clearLogs} style={{
                backgroundColor: 'transparent', color: '#F87171',
                padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>Clear logs</button>
            </div>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '800px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>When</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Client</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Renewal</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {l.sent_at ? new Date(l.sent_at + 'Z').toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{l.client_name || `#${l.client_id}`}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>{l.renewal_sr_no}</td>
                      <td style={{ padding: '12px 16px' }}>{formatTypeChip(l.reminder_type)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          color: l.status === 'sent' ? '#34D399' : l.status === 'failed' ? '#F87171' : 'var(--text-secondary)',
                          fontSize: '11px', fontWeight: '700',
                        }}>{l.status}</span>
                        {l.error && <div style={{ fontSize: '11px', color: '#F87171', marginTop: '2px' }}>{l.error}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span dangerouslySetInnerHTML={{ __html: l.message }} />
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No reminders sent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Test send modal */}
      {testModal && (
        <div
          onClick={() => setTestModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px',
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Test send</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              Pick a chat ID from the Linked groups list above, paste it here, and send a test message.
            </p>
            <div>
              <label style={labelStyle}>Chat ID</label>
              <input value={testChatId} onChange={(e) => setTestChatId(e.target.value)} placeholder="e.g. -1001234567890" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Message (HTML)</label>
              <textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={4}
                style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
            {testResult && !testResult.ok && (
              <div style={{ fontSize: '12px', color: '#F87171' }}>{testResult.error}{testResult.detail ? ' — ' + testResult.detail : ''}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setTestModal(false)} style={{
                backgroundColor: 'transparent', color: 'var(--text-secondary)',
                padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={sendTest} disabled={!testChatId || !testMessage} className="btn-primary">
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline control to pick a client by name (simple prompt-based fallback to keep this page self-contained).
function AssignControl({ onAssign }) {
  const [name, setName] = useState('');
  return (
    <div style={{ display: 'inline-flex', gap: '6px' }}>
      <input
        placeholder="Client name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ ...inputStyle, padding: '4px 8px', fontSize: '12px', width: '160px' }}
      />
      <button
        onClick={() => { if (name.trim()) { onAssign(name.trim()); setName(''); } }}
        style={{
          backgroundColor: 'var(--primary-accent)', color: '#0B111A',
          border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
        }}
      >Assign</button>
    </div>
  );
}
