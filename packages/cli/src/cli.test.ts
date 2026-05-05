import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runRenkuCli } from './cli.js';

describe('renku CLI', () => {
  let homeDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-test-'));
    stdout = [];
    stderr = [];
  });

  it('shows top-level help with the renku binary and init command', async () => {
    const exitCode = await runRenkuCli([], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('$ renku <command>');
    expect(stdout.join('\n')).toContain('init <storage-root>');
    expect(stderr).toEqual([]);
  });

  it('creates config with renku init <storage-root>', async () => {
    const storageRoot = path.join(homeDir, 'movies');

    const exitCode = await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku config created.');
    expect(stdout.join('\n')).toContain(`Storage root: ${storageRoot}`);
    expect(stderr).toEqual([]);
    await expect(
      fs.readFile(path.join(homeDir, '.config', 'renku', 'config.yaml'), 'utf8')
    ).resolves.toContain(`storageRoot: ${storageRoot}`);
  });

  it('prints JSON for renku init <storage-root> --json', async () => {
    const storageRoot = path.join(homeDir, 'movies');

    const exitCode = await runRenkuCli(['init', storageRoot, '--json'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      status: 'created',
      configPath: path.join(homeDir, '.config', 'renku', 'config.yaml'),
      storageRoot,
    });
    expect(stderr).toEqual([]);
  });

  it('fails clearly when init is missing a storage root', async () => {
    const exitCode = await runRenkuCli(['init'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr.join('\n')).toContain(
      'Missing required storage root. Usage: renku init <storage-root>'
    );
  });

  it('reports existing config without overwriting it', async () => {
    const firstStorageRoot = path.join(homeDir, 'first');
    const secondStorageRoot = path.join(homeDir, 'second');

    await runRenkuCli(['init', firstStorageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];

    const exitCode = await runRenkuCli(['init', secondStorageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku config already exists.');
    expect(stdout.join('\n')).toContain(`Storage root: ${firstStorageRoot}`);
    expect(stdout.join('\n')).not.toContain(secondStorageRoot);
    expect(stderr).toEqual([]);
  });
});

function captureIo(stdout: string[], stderr: string[]) {
  return {
    stdout: {
      log(message: string) {
        stdout.push(message);
      },
    },
    stderr: {
      error(message: string) {
        stderr.push(message);
      },
    },
  };
}
