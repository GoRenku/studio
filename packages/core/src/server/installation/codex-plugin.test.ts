import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { readCodexPluginInstallation, recordCodexPluginInstallation } from './codex-plugin.js';

describe('Codex plugin installation', () => {
  let homeDir: string;
  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-plugin-'));
  });

  it('defaults to false and records installation before library setup', async () => {
    await expect(readCodexPluginInstallation({ homeDir })).resolves.toBe(false);
    await recordCodexPluginInstallation(true, { homeDir });
    await expect(readCodexPluginInstallation({ homeDir })).resolves.toBe(true);
    await recordCodexPluginInstallation(false, { homeDir });
    await expect(readCodexPluginInstallation({ homeDir })).resolves.toBe(false);
    await expect(fs.stat(path.join(homeDir, '.config/renku/config.yaml'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readdir(path.join(homeDir, '.config/renku'))).toEqual(['codex-plugin.json']);
  });

  it.each(['invalid', 'null', '[]', '{}', '{"codexPluginInstalled":"true"}'])('rejects invalid state %s', async (contents) => {
    await recordCodexPluginInstallation(false, { homeDir });
    await fs.writeFile(path.join(homeDir, '.config/renku/codex-plugin.json'), contents);
    await expect(readCodexPluginInstallation({ homeDir })).rejects.toMatchObject({ code: 'CONFIG017' });
  });

  it('reports write failure through CONFIG017', async () => {
    await fs.mkdir(path.join(homeDir, '.config'), { recursive: true });
    await fs.writeFile(path.join(homeDir, '.config/renku'), 'blocked');
    await expect(recordCodexPluginInstallation(true, { homeDir })).rejects.toMatchObject({ code: 'CONFIG017' });
  });
});
