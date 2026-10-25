import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initRenkuConfig } from '@gorenku/studio-core/server';
import { runCodexPermissionsCommand, type RunCodexPermissionsCommandOptions } from './codex-permissions-command.js';

let homeDir: string;
let projectLibrary: string;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-codex-command-'));
  projectLibrary = path.join(homeDir, 'Movies', 'Renku');
  await initRenkuConfig(projectLibrary, { homeDir });
});

afterEach(async () => {
  await fs.rm(homeDir, { recursive: true, force: true });
});

const codexFile = () => path.join(projectLibrary, '.codex', 'config.toml');

function run(input: string[], overrides: Partial<RunCodexPermissionsCommandOptions> = {}) {
  const log = vi.fn();
  const options: RunCodexPermissionsCommandOptions = {
    input, json: false, yes: false, homeDir,
    io: { stdout: { log }, stderr: { error: vi.fn() } },
    checkSandbox: () => 'writable',
    ...overrides,
  };
  return { log, result: runCodexPermissionsCommand(options) };
}

describe('renku codex permissions', () => {
  it('reports that the Project Library is not set up yet', async () => {
    const { log, result } = run(['permissions', 'status']);
    await result;
    expect(log).toHaveBeenCalledWith(`Codex permissions: not set up for ${projectLibrary}. Run renku codex permissions set.`);
  });

  it('shows the file, writes it after confirmation and checks the Codex sandbox', async () => {
    const confirm = vi.fn(async () => true);
    const checkSandbox = vi.fn(() => 'writable' as const);
    const { log, result } = run(['permissions', 'set'], { confirm, checkSandbox });
    await result;
    expect(confirm).toHaveBeenCalledWith('Write this file?');
    expect(log).toHaveBeenCalledWith(`  ${codexFile()}`);
    expect(log).toHaveBeenCalledWith('    default_permissions = "renku-studio"');
    expect(await fs.readFile(codexFile(), 'utf8')).toContain('default_permissions = "renku-studio"');
    expect(checkSandbox).toHaveBeenCalledWith({ projectLibrary, stateDir: expect.any(String) });
    expect(log).toHaveBeenCalledWith('Codex check: Renku can save its data. Start a new Codex thread in your Project Library to use these permissions.');
  });

  it('changes nothing when the user declines', async () => {
    const { result } = run(['permissions', 'set'], { confirm: async () => false });
    await expect(result).rejects.toMatchObject({ code: 'CLI172' });
    await expect(fs.stat(codexFile())).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('needs --yes without a terminal to confirm in', async () => {
    await expect(run(['permissions', 'set'], { json: true }).result).rejects.toMatchObject({ code: 'CLI170' });
    await run(['permissions', 'set'], { json: true, yes: true }).result;
    expect(await fs.readFile(codexFile(), 'utf8')).toContain('renku-studio');
  });

  it('tells the user to trust the folder when the Codex check is refused', async () => {
    const { log, result } = run(['permissions', 'set'], { yes: true, checkSandbox: () => 'refused' });
    await result;
    expect(log).toHaveBeenCalledWith(`Codex check: refused. Open Codex in ${projectLibrary} and trust the folder when Codex asks, then run renku codex permissions status.`);
  });

  it('refuses to replace or remove Codex settings the user wrote', async () => {
    await fs.mkdir(path.dirname(codexFile()), { recursive: true });
    await fs.writeFile(codexFile(), 'model = "mine"\n');
    await expect(run(['permissions', 'set'], { yes: true }).result).rejects.toMatchObject({ code: 'CODEX_PERMISSIONS001' });
    await expect(run(['permissions', 'remove'], { yes: true }).result).rejects.toMatchObject({ code: 'CODEX_PERMISSIONS001' });
    expect(await fs.readFile(codexFile(), 'utf8')).toBe('model = "mine"\n');
  });

  it('removes its own file after confirmation', async () => {
    await run(['permissions', 'set'], { yes: true }).result;
    const confirm = vi.fn(async () => true);
    await run(['permissions', 'remove'], { confirm }).result;
    expect(confirm).toHaveBeenCalledWith('Remove Renku\'s Codex permissions?');
    await expect(fs.stat(codexFile())).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports an unknown subcommand', async () => {
    await expect(run(['permissions', 'grant']).result).rejects.toMatchObject({ code: 'CLI173' });
  });
});
