import { execFileSync } from 'node:child_process';

const LOG_PATH = '~/Library/Logs/renku-growth-report.log';

// Shows a macOS notification for a failed scheduled run. Only the error code
// is shown; the details stay in the log file.
export function showFailureNotification(code, { run = execFileSync } = {}) {
  const safeCode = String(code).replace(/[^A-Z0-9_]/g, '') || 'unexpected error';
  const script = `display notification "See ${LOG_PATH} or run pnpm growth:report." with title "Renku growth report failed" subtitle "${safeCode}"`;
  run('osascript', ['-e', script], { stdio: 'ignore' });
}
