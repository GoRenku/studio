import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initRenkuConfig } from '../../config/document.js';
import { resolveRenkuConfigDir, resolveRenkuStateDir } from '../../config/paths.js';
import { recordCodexPluginInstallation } from '../codex-plugin.js';
import {
  readCodexPermissionsFile,
  refreshCodexPermissionsFile,
  removeCodexPermissionsFile,
  setUpCodexPermissions,
  writeCodexPermissionsFile,
} from './codex-permissions.js';
import { RENKU_CODEX_FILE_HEADER, renderRenkuCodexFile } from './renku-codex-file.js';

let homeDir: string;
let projectLibrary: string;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-codex-permissions-'));
  projectLibrary = path.join(homeDir, 'Movies', 'Renku');
  await fs.mkdir(projectLibrary, { recursive: true });
});

afterEach(async () => {
  await fs.rm(homeDir, { recursive: true, force: true });
});

const codexFile = () => path.join(projectLibrary, '.codex', 'config.toml');

describe('Renku Codex permissions file', () => {
  it('grants read access to the settings folder and write access to the state folder, quoting paths safely', () => {
    const contents = renderRenkuCodexFile({ configDir: 'C:\\Users\\Ana\\AppData\\Local\\Renku\\Studio', stateDir: 'C:\\Users\\Ana\\AppData\\Local\\Renku\\Studio\\State' });
    expect(contents.startsWith(RENKU_CODEX_FILE_HEADER)).toBe(true);
    expect(contents).toContain('default_permissions = "renku-studio"');
    expect(contents).toContain('"C:\\\\Users\\\\Ana\\\\AppData\\\\Local\\\\Renku\\\\Studio" = "read"');
    expect(contents).toContain('"C:\\\\Users\\\\Ana\\\\AppData\\\\Local\\\\Renku\\\\Studio\\\\State" = "write"');
  });

  it('writes the file into the Project Library, then reports it current', async () => {
    expect((await readCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('missing');
    const written = await writeCodexPermissionsFile({ homeDir, projectLibrary });
    expect(written).toMatchObject({ state: 'current', path: codexFile() });
    const contents = await fs.readFile(codexFile(), 'utf8');
    expect(contents).toContain(`${JSON.stringify(resolveRenkuConfigDir({ homeDir }))} = "read"`);
    expect(contents).toContain(`${JSON.stringify(resolveRenkuStateDir({ homeDir }))} = "write"`);
    expect((await readCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('current');
  });

  it('refreshes an older Renku file and leaves a missing one alone', async () => {
    expect((await refreshCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('missing');
    await fs.mkdir(path.dirname(codexFile()), { recursive: true });
    await fs.writeFile(codexFile(), `${RENKU_CODEX_FILE_HEADER}\nold content\n`);
    expect((await readCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('outdated');
    expect((await refreshCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('current');
    expect(await fs.readFile(codexFile(), 'utf8')).not.toContain('old content');
  });

  it('never replaces, refreshes or removes a file the user wrote', async () => {
    await fs.mkdir(path.dirname(codexFile()), { recursive: true });
    await fs.writeFile(codexFile(), 'model = "my-model"\n');
    expect((await readCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('foreign');
    await expect(writeCodexPermissionsFile({ homeDir, projectLibrary })).rejects.toMatchObject({ code: 'CODEX_PERMISSIONS001' });
    await expect(removeCodexPermissionsFile({ homeDir, projectLibrary })).rejects.toMatchObject({ code: 'CODEX_PERMISSIONS001' });
    expect((await refreshCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('foreign');
    expect(await fs.readFile(codexFile(), 'utf8')).toBe('model = "my-model"\n');
  });

  it('removes its own file and the empty .codex folder', async () => {
    await writeCodexPermissionsFile({ homeDir, projectLibrary });
    expect((await removeCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('missing');
    await expect(fs.stat(path.dirname(codexFile()))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await removeCodexPermissionsFile({ homeDir, projectLibrary })).state).toBe('missing');
  });

  it('is set up for a new Project Library only when the Codex plugin was installed', async () => {
    expect(await setUpCodexPermissions({ homeDir, projectLibrary })).toBeNull();
    await recordCodexPluginInstallation(true, { homeDir });
    expect(await setUpCodexPermissions({ homeDir, projectLibrary })).toMatchObject({ state: 'current' });
  });

  it('writes the file when Renku creates its config and a Project Library', async () => {
    await recordCodexPluginInstallation(true, { homeDir });
    const result = await initRenkuConfig(projectLibrary, { homeDir });
    expect(result.codexPermissions).toMatchObject({ state: 'current', path: codexFile() });
    expect(await fs.readFile(codexFile(), 'utf8')).toContain('default_permissions = "renku-studio"');
    expect((await initRenkuConfig(projectLibrary, { homeDir })).codexPermissions).toBeNull();
  });
});
