import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RENKU_TEMP_DIR_PREFIX = 'renku-';
const STALE_TEMP_DIR_AGE_MS = 15 * 60 * 1000;

// Vitest global setup. Test fixtures across the workspace create renku-*
// directories with fs.mkdtemp and rely on this hook to remove them: stale
// leftovers from earlier or crashed runs at startup, and this run's own
// directories at teardown. The age gate at startup keeps a concurrently
// running vitest process (for example another package in watch mode) safe.
export default async function cleanupRenkuTempDirs() {
  const runStartedAt = Date.now();
  await removeRenkuTempDirs(
    (entry) => runStartedAt - entry.mtimeMs > STALE_TEMP_DIR_AGE_MS
  );
  return async () => {
    await removeRenkuTempDirs((entry) => entry.mtimeMs >= runStartedAt - 1000);
  };
}

async function removeRenkuTempDirs(shouldRemove) {
  const tempRoot = os.tmpdir();
  let entries;
  try {
    entries = await fs.readdir(tempRoot, { withFileTypes: true });
  } catch {
    return;
  }

  const removals = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(RENKU_TEMP_DIR_PREFIX)) {
      continue;
    }
    const entryPath = path.join(tempRoot, entry.name);
    removals.push(
      (async () => {
        try {
          const stats = await fs.lstat(entryPath);
          if (!stats.isDirectory() || !shouldRemove(stats)) {
            return;
          }
          await fs.rm(entryPath, { recursive: true, force: true });
        } catch {
          // Cleanup must never fail a test run; leftovers are retried next run.
        }
      })()
    );
  }
  await Promise.all(removals);
}
