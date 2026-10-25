import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * `writable`: Codex's sandbox, opened in the Project Library, lets Renku save
 * its data. `refused`: it does not, usually because the folder is not trusted
 * in Codex yet. `unavailable`: no `codex` command was found to check with.
 */
export type CodexSandboxCheck = 'writable' | 'refused' | 'unavailable';

/** Writes and removes one empty file in Renku's state folder inside Codex's sandbox, run from the Project Library. */
export function checkCodexSandbox(input: { projectLibrary: string; stateDir: string }): CodexSandboxCheck {
  const probe = path.join(input.stateDir, '.codex-permission-check');
  const script = `const fs = require('node:fs'); fs.mkdirSync(${JSON.stringify(input.stateDir)}, { recursive: true }); fs.writeFileSync(${JSON.stringify(probe)}, ''); fs.unlinkSync(${JSON.stringify(probe)});`;
  const result = spawnSync('codex', ['sandbox', '--', process.execPath, '-e', script], {
    cwd: input.projectLibrary,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error) {
    return 'unavailable';
  }
  return result.status === 0 ? 'writable' : 'refused';
}
