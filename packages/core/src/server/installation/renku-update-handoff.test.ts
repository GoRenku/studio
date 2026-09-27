import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveStudioRuntimeDescriptorPath } from '../studio-coordination/index.js';
import { startRenkuUpdateFromStudioWithOptions } from './renku-update-handoff.js';

vi.mock('../studio-coordination/index.js', () => ({
  readStudioRuntimeDescriptor: vi.fn(async () => ({ pid: 12345 })),
  resolveStudioRuntimeDescriptorPath: vi.fn(() => '/tmp/renku-test-descriptor.json'),
}));

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "Renku José O'Brien-"));
  const binRoot = path.join(root, 'launchers with spaces');
  mkdirSync(path.join(root, 'distribution'));
  mkdirSync(binRoot);
  writeFileSync(path.join(root, 'distribution/install.sh'), '');
  writeFileSync(path.join(root, 'INSTALLATION.json'), JSON.stringify({ installRoot: root, binRoot }));
  writeFileSync(path.join(binRoot, 'renku'), '');
  return { root, executable: path.join(root, 'runtime/node/bin/node') };
}

const available = async () => ({ state: 'available' as const, installedVersion: '0.0.1', publishedVersion: '0.0.2' });

describe('Studio update handoff', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects a stale offer before opening a terminal', async () => {
    const launch = vi.fn(() => true);
    await expect(startRenkuUpdateFromStudioWithOptions({ check: async () => ({ state: 'current', installedVersion: '0.0.1', publishedVersion: '0.0.1' }), launch })).rejects.toMatchObject({ code: 'UPDATE009' });
    expect(launch).not.toHaveBeenCalled();
  });

  it('leaves Studio running when the terminal fails or never reports readiness', async () => {
    const { executable } = fixture();
    await expect(startRenkuUpdateFromStudioWithOptions({ platform: 'darwin', executable, processId: 12345, check: available, launch: () => false })).rejects.toMatchObject({ code: 'UPDATE011' });
    await expect(startRenkuUpdateFromStudioWithOptions({ platform: 'darwin', executable, processId: 12345, check: available, launch: () => true, readyTimeoutMs: 0 })).rejects.toMatchObject({ code: 'UPDATE011' });
  });

  it('writes a BOM-marked PowerShell handoff with Unicode paths and agent profiles', async () => {
    const { root } = fixture();
    vi.spyOn(os, 'tmpdir').mockReturnValueOnce(root);
    vi.mocked(resolveStudioRuntimeDescriptorPath).mockReturnValueOnce(path.join(root, 'studio-runtime.json'));
    vi.stubEnv('CLAUDE_CONFIG_DIR', path.join(root, 'claude profile'));
    vi.stubEnv('CODEX_HOME', undefined);
    writeFileSync(path.join(root, 'distribution/install.ps1'), '');
    writeFileSync(path.join(root, 'launchers with spaces/renku.cmd'), '');
    const executable = path.join(root, 'runtime/node/node.exe');
    let script = '';
    await expect(startRenkuUpdateFromStudioWithOptions({
      platform: 'win32', executable, processId: 12345, check: available,
      launch: (_platform, file) => {
        const bytes = readFileSync(file);
        expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        script = bytes.subarray(3).toString('utf8');
        expect(script).toContain(path.join(path.dirname(file), 'ready').replaceAll("'", "''"));
        return false;
      },
    })).rejects.toMatchObject({ code: 'UPDATE011' });
    expect(script).toContain("O''Brien");
    expect(script).toContain(path.join(root, 'launchers with spaces/renku.cmd').replaceAll("'", "''"));
    expect(script).toContain(path.join(root, 'studio-runtime.json').replaceAll("'", "''"));
    expect(script).toContain(`$env:CLAUDE_CONFIG_DIR = '${path.join(root, 'claude profile').replaceAll("'", "''")}'`);
    expect(script).toContain('$env:CODEX_HOME = $null');
    expect(script).toContain('studio stop');
    expect(script).toContain('studio start');
    expect(script).toContain('Restart manually: &');
    expect(script).toContain('Studio shutdown timed out.');
  });

  it.each(['custom', 'absent', 'empty'] as const)('preserves %s agent-directory overrides through a different Terminal environment', async (profile) => {
    const { root, executable } = fixture();
    const names = ['CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'VIBE_HOME', 'HERMES_HOME', 'AUTOHAND_HOME', 'GROK_HOME', 'SARVAM_HOME',
      'XDG_CONFIG_HOME', 'FLATPAK_XDG_CONFIG_HOME', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE'];
    const expected: Record<string, string> = {};
    for (const name of names) {
      const value = profile === 'custom' ? path.join(root, name) : '';
      vi.stubEnv(name, profile === 'absent' ? undefined : value);
      if (profile !== 'absent') {
        expected[name] = value;
      }
    }
    vi.mocked(resolveStudioRuntimeDescriptorPath).mockReturnValueOnce(path.join(root, 'studio-runtime.json'));
    const log = path.join(root, 'profiles.jsonl');
    const launcher = path.join(root, 'launchers with spaces/renku');
    writeFileSync(launcher, `#!/bin/sh
exec '${process.execPath.replaceAll("'", "'\\''")}' - "$@" <<'JS'
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  command: process.argv.slice(2).join(' '),
  environment: Object.fromEntries(${JSON.stringify(names)}.flatMap(name => process.env[name] === undefined ? [] : [[name, process.env[name]]])),
}) + '\\n');
JS
`, { mode: 0o755 });
    chmodSync(launcher, 0o755);
    let scriptPath = '';
    await expect(startRenkuUpdateFromStudioWithOptions({
      platform: 'darwin', executable, processId: 12345, check: available,
      launch: (_platform, file) => { scriptPath = file; return false; },
    })).rejects.toMatchObject({ code: 'UPDATE011' });
    writeFileSync(path.join(path.dirname(scriptPath), 'go'), 'go');
    execFileSync('/bin/sh', [scriptPath], {
      env: { ...process.env, ...Object.fromEntries(names.map(name => [name, '/different-terminal-profile'])) },
      timeout: 5_000,
    });
    expect(readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line))).toEqual(
      ['studio stop', 'update', 'studio start'].map(command => ({ command, environment: expected })),
    );
  });

  it('requires terminal readiness and builds a fixed, quoted stop-update-start sequence', async () => {
    const { root, executable } = fixture();
    const launcher = path.join(root, 'launchers with spaces/renku');
    const log = path.join(root, 'commands.log');
    const descriptorPath = '/tmp/renku-test-descriptor.json';
    writeFileSync(descriptorPath, '{}');
    writeFileSync(launcher, `#!/bin/sh
printf '%s\\n' "$*" >> '${log.replaceAll("'", "'\\''")}'
if [ "$1 $2" = 'studio stop' ]; then (sleep 0.3; rm '${descriptorPath}') & fi
`, { mode: 0o755 });
    chmodSync(launcher, 0o755);
    let script = '';
    let scriptPath = '';
    const launch = vi.fn((_platform: typeof process.platform, file: string) => {
      scriptPath = file;
      script = readFileSync(file, 'utf8');
      writeFileSync(path.join(path.dirname(file), 'ready'), 'ready');
      return true;
    });
    await expect(startRenkuUpdateFromStudioWithOptions({ platform: 'darwin', executable, processId: 12345, check: available, launch })).resolves.toEqual({ started: true, publishedVersion: '0.0.2' });
    expect(script).toContain("O'\\''Brien");
    expect(script.indexOf('studio stop')).toBeLessThan(script.indexOf(' update;'));
    expect(script.indexOf(' update;')).toBeLessThan(script.indexOf('studio start;'));
    expect(script).toContain('Studio shutdown timed out.');
    expect(script).toContain('/tmp/renku-test-descriptor.json');
    expect(launch).toHaveBeenCalledOnce();
    execFileSync('/bin/sh', [scriptPath], { timeout: 5_000 });
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(['studio stop', 'update', 'studio start']);
    writeFileSync(launcher, `#!/bin/sh
printf '%s\\n' "$*" >> '${log.replaceAll("'", "'\\''")}'
if [ "$1" = update ]; then exit 1; fi
`);
    const failedUpdate = spawnSync('/bin/sh', [scriptPath], { encoding: 'utf8', timeout: 5_000 });
    expect(failedUpdate.status).toBe(1);
    expect(failedUpdate.stdout).toContain('Restart manually:');
    expect(readFileSync(log, 'utf8').trim().split('\n').slice(-2)).toEqual(['studio stop', 'update']);
    await expect(startRenkuUpdateFromStudioWithOptions({ check: available, launch })).rejects.toMatchObject({ code: 'UPDATE010' });
  });
});
