// Backup engine — daily snapshots of the SQLite DB, restore, prune.
// Backups live in src/lib/backups/ (persisted in the Docker volume).
// Each backup is a copy of pca_renew.db with a sidecar .json containing metadata.

import { promises as fs } from 'fs';
import path from 'path';
import { db, all, get, run, closeDb, reopenDb, DB_PATH } from './db.js';

const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
const RETENTION_DAYS = 30;

// Daily-cron config lives in bot_config (singleton row, id=1). We use the same
// row but with a different key prefix to keep things in one place.
const DEFAULT_CRON_HOUR_UTC = 3;

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function parseTimestampFromName(name) {
  // YYYY-MM-DD_HHMMSS
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

async function ensureDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function getCronConfig() {
  const row = get('SELECT sweep_interval_minutes, timezone FROM bot_config WHERE id = 1');
  // We don't have a dedicated column for backup hour yet — store it as a sidecar.
  return row;
}

export async function createBackup({ source = 'manual' } = {}) {
  await ensureDir();
  const stamp = timestamp();
  const filename = `${stamp}.db`;
  const filepath = path.join(BACKUP_DIR, filename);
  const metaPath = path.join(BACKUP_DIR, `${stamp}.json`);

  // Snapshot the client count BEFORE we copy — the live DB is still open.
  let clientCount = 0;
  let renewalCount = 0;
  try {
    clientCount = get('SELECT COUNT(*) AS n FROM clients')?.n || 0;
    renewalCount = get('SELECT COUNT(*) AS n FROM renewals')?.n || 0;
  } catch (e) { /* table may not exist yet */ }

  // Use SQLite's online backup API (atomic, safe even with open connections).
  try {
    await db.backup(filepath);
  } catch (e) {
    // Fallback: raw file copy. Still safe-ish because better-sqlite3 is sync.
    await fs.copyFile(DB_PATH, filepath);
  }

  const stat = await fs.stat(filepath);
  const metadata = {
    filename,
    created_at: new Date().toISOString(),
    source,  // 'manual' | 'cron' | 'pre-restore'
    size: stat.size,
    clients: clientCount,
    renewals: renewalCount,
  };
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

  return metadata;
}

export async function listBackups() {
  await ensureDir();
  const entries = await fs.readdir(BACKUP_DIR);
  const backups = [];
  for (const name of entries) {
    if (!name.endsWith('.db')) continue;
    const dbPath = path.join(BACKUP_DIR, name);
    const metaPath = path.join(BACKUP_DIR, name.replace(/\.db$/, '.json'));
    let meta = null;
    try { meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')); } catch {}
    const stat = await fs.stat(dbPath);
    const ts = parseTimestampFromName(name);
    backups.push({
      filename: name,
      created_at: meta?.created_at || (ts ? ts.toISOString() : null),
      source: meta?.source || 'unknown',
      size: stat.size,
      clients: meta?.clients ?? null,
      renewals: meta?.renewals ?? null,
      mtime: stat.mtimeMs,
    });
  }
  backups.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return backups;
}

export async function pruneOldBackups({ retentionDays = RETENTION_DAYS } = {}) {
  await ensureDir();
  const cutoff = Date.now() - retentionDays * 86400 * 1000;
  const backups = await listBackups();
  const removed = [];
  for (const b of backups) {
    if (b.mtime < cutoff) {
      const dbFile = path.join(BACKUP_DIR, b.filename);
      const metaFile = path.join(BACKUP_DIR, b.filename.replace(/\.db$/, '.json'));
      try { await fs.unlink(dbFile); } catch {}
      try { await fs.unlink(metaFile); } catch {}
      removed.push(b.filename);
    }
  }
  return removed;
}

export async function restoreBackup(filename) {
  if (!filename || !/^[\d_\-]+\.db$/.test(filename)) {
    throw new Error('Invalid backup filename');
  }
  await ensureDir();
  const filepath = path.join(BACKUP_DIR, filename);
  try {
    await fs.access(filepath);
  } catch {
    throw new Error('Backup file not found: ' + filename);
  }

  // 1) Create a pre-restore snapshot of the CURRENT live DB so the user can
  //    roll back if the restore is wrong.
  const preRestore = await createBackup({ source: 'pre-restore' });

  // 2) Close the active DB connection, copy the backup file over the live DB,
  //    then reopen. better-sqlite3 is single-connection per process, so this is
  //    the only safe way without restarting the container.
  closeDb();
  try {
    await fs.copyFile(filepath, DB_PATH);
  } finally {
    reopenDb();
  }

  return { restored_from: filename, pre_restore: preRestore.filename };
}

// --- Cron scheduling ------------------------------------------------------

function readCronHour() {
  // Stored in bot_config.reminder_days (lol no — we use a sidecar JSON).
  // Simpler: keep it in a small JSON file under src/lib/backups/cron.json.
  // But we want it server-rendered on the page, so we use the DB.
  // We piggyback on bot_config: store backup_hour in templates_json under a
  // reserved key. Hmm, that's ugly. Use a dedicated table instead.
  const row = get("SELECT value FROM bot_config WHERE id = 1"); // placeholder
  return DEFAULT_CRON_HOUR_UTC;
}

let cronTimer = null;
let cronRunning = false;

export function getCronState() {
  const row = get(`SELECT json_extract(templates_json, '$._backup_hour') AS hour,
                          json_extract(templates_json, '$._backup_last_run') AS last_run
                   FROM bot_config WHERE id = 1`);
  return {
    hour_utc: row?.hour ? Number(row.hour) : DEFAULT_CRON_HOUR_UTC,
    last_run: row?.last_run || null,
  };
}

export function setCronHour(hour) {
  const h = Math.max(0, Math.min(23, Number(hour) || DEFAULT_CRON_HOUR_UTC));
  // Store the hour inside templates_json under reserved keys.
  const row = get('SELECT templates_json FROM bot_config WHERE id = 1');
  let tpl = {};
  try { tpl = JSON.parse(row?.templates_json || '{}'); } catch {}
  tpl._backup_hour = h;
  run('UPDATE bot_config SET templates_json = ? WHERE id = 1', [JSON.stringify(tpl)]);
  return h;
}

function recordCronRun() {
  const row = get('SELECT templates_json FROM bot_config WHERE id = 1');
  let tpl = {};
  try { tpl = JSON.parse(row?.templates_json || '{}'); } catch {}
  tpl._backup_last_run = new Date().toISOString();
  run('UPDATE bot_config SET templates_json = ? WHERE id = 1', [JSON.stringify(tpl)]);
}

function msUntilNextRun(hourUtc) {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0
  ));
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function startBackupCron() {
  if (globalThis.__pcaBackupCron) return globalThis.__pcaBackupCron;
  globalThis.__pcaBackupCron = true;

  const { hour_utc } = getCronState();
  scheduleNext();

  function scheduleNext() {
    const { hour_utc: h } = getCronState();
    const ms = msUntilNextRun(h);
    console.log(`[backup] next run in ${Math.round(ms / 60000)} minutes (at ${h}:00 UTC)`);
    if (cronTimer) clearTimeout(cronTimer);
    cronTimer = setTimeout(async () => {
      if (cronRunning) return;
      cronRunning = true;
      try {
        const meta = await createBackup({ source: 'cron' });
        recordCronRun();
        console.log(`[backup] cron created ${meta.filename} (${meta.clients} clients)`);
        const removed = await pruneOldBackups();
        if (removed.length) console.log(`[backup] pruned ${removed.length} old backup(s)`);
      } catch (e) {
        console.error('[backup] cron failed:', e.message);
      } finally {
        cronRunning = false;
        scheduleNext();
      }
    }, ms);
  }
}

export function stopBackupCron() {
  if (cronTimer) clearTimeout(cronTimer);
  cronTimer = null;
  globalThis.__pcaBackupCron = false;
}

export { BACKUP_DIR, RETENTION_DAYS };
