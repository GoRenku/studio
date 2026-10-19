import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTelemetryCommand } from './telemetry-command.js';

function createIo() {
  return { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } };
}

function printed(io: ReturnType<typeof createIo>): string[] {
  return io.stdout.log.mock.calls.map(([line]) => String(line));
}

describe('renku telemetry', () => {
  let homeDir: string;
  let telemetryFile: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-telemetry-command-'));
    telemetryFile = path.join(homeDir, '.config', 'renku', 'telemetry.json');
    // The test configuration sets RENKU_TELEMETRY_DISABLED, so nothing is sent.
    vi.stubEnv('DO_NOT_TRACK', '');
    vi.stubEnv('CI', '');
    vi.stubEnv('RENKU_TELEMETRY_DEBUG', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows statistics as off by default', async () => {
    const io = createIo();
    await expect(runTelemetryCommand({ input: ['status'], json: false, io, homeDir })).resolves.toBe(0);
    expect(printed(io)).toEqual([
      'Usage statistics: off',
      'Debug printing: off',
      'Every field Renku sends: https://gorenku.com/privacy#app-usage-statistics',
    ]);
  });

  it('enables with an install ID and says why nothing is sent', async () => {
    const io = createIo();
    await runTelemetryCommand({ input: ['enable'], json: false, io, homeDir });
    const { installId } = JSON.parse(await fs.readFile(telemetryFile, 'utf8'));
    expect(printed(io)).toEqual([
      'Usage statistics: on',
      `Install ID: ${installId}`,
      'Sending: no (RENKU_TELEMETRY_DISABLED is set)',
      'Debug printing: off',
      'Every field Renku sends: https://gorenku.com/privacy#app-usage-statistics',
    ]);
  });

  it('prints Core status as JSON and disables by deleting the file', async () => {
    await runTelemetryCommand({ input: ['enable'], json: true, io: createIo(), homeDir });
    const io = createIo();
    await runTelemetryCommand({ input: ['disable'], json: true, io, homeDir });
    expect(JSON.parse(printed(io)[0] ?? '')).toEqual({
      enabled: false,
      installId: null,
      blockedBy: 'RENKU_TELEMETRY_DISABLED',
      debug: false,
    });
    await expect(fs.stat(telemetryFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('disables even when the file is invalid', async () => {
    await fs.mkdir(path.dirname(telemetryFile), { recursive: true });
    await fs.writeFile(telemetryFile, '{');
    await expect(runTelemetryCommand({ input: ['status'], json: false, io: createIo(), homeDir }))
      .rejects.toMatchObject({ code: 'CORE_TELEMETRY_FILE_INVALID' });
    await runTelemetryCommand({ input: ['disable'], json: false, io: createIo(), homeDir });
    await expect(fs.stat(telemetryFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([[[]], [['on']], [['status', 'now']]])('rejects %j with CLI169', async (input) => {
    await expect(runTelemetryCommand({ input, json: false, io: createIo(), homeDir }))
      .rejects.toMatchObject({ code: 'CLI169' });
  });
});
