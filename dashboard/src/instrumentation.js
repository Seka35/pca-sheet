// Next.js 16 — instrumentation.js
// Called once per server instance, before the server starts handling requests.
// Boot the Telegram bot, the DB schema, and the daily backup cron.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Run schema init (idempotent) then start the bot.
  try {
    const { initDatabase } = await import('./lib/db.js');
    initDatabase();
  } catch (e) {
    console.error('[instrumentation] initDatabase failed:', e.message);
  }

  try {
    const { startBot } = await import('./lib/telegramBot.js');
    const res = await startBot();
    if (res?.started) {
      console.log('[instrumentation] telegram bot started');
    } else {
      console.log(`[instrumentation] telegram bot not started: ${res?.reason || 'unknown'}`);
    }
  } catch (e) {
    console.error('[instrumentation] startBot threw:', e.message);
  }

  try {
    const { startBackupCron } = await import('./lib/backup.js');
    startBackupCron();
    console.log('[instrumentation] backup cron started');
  } catch (e) {
    console.error('[instrumentation] startBackupCron threw:', e.message);
  }
}
