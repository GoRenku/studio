import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HEARD_ABOUT_RENKU_ANSWERS, type TelemetryEvent } from '../../client/telemetry.js';
import { resolveTelemetryFilePath } from './choice-file.js';
import {
  generationCompletedEvent,
  readTelemetryStatusWithOptions,
  recordTelemetryEventWithOptions,
  setTelemetryChoiceWithOptions,
  type TelemetryRuntimeOptions,
} from './service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INSTALL_ID = '0b6f6c1e-8a7d-4f0e-9c55-2f1d1c7a9e10';

describe('usage statistics', () => {
  let homeDir: string;
  let filePath: string;
  let fetcher: ReturnType<typeof vi.fn>;
  let printed: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-telemetry-test-'));
    filePath = resolveTelemetryFilePath({ homeDir });
    fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    printed = [];
  });

  function runtime(environment: Record<string, string> = {}): TelemetryRuntimeOptions {
    return {
      environment,
      fetcher: fetcher as unknown as typeof fetch,
      printDebug: (line) => printed.push(line),
      readVersion: () => '0.1.35',
      now: () => new Date('2026-10-15T10:00:00.000Z'),
    };
  }

  async function writeInstallId(installId = INSTALL_ID) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ formatVersion: 1, installId }));
  }

  function sentBodies() {
    return fetcher.mock.calls.map(([, init]) => JSON.parse(String((init as { body: string }).body)));
  }

  describe('choice', () => {
    it('is off when no file exists', async () => {
      await expect(readTelemetryStatusWithOptions({ homeDir }, runtime())).resolves.toEqual({
        enabled: false,
        installId: null,
        blockedBy: null,
        debug: false,
      });
    });

    it('creates a random install ID when turned on and keeps it when turned on again', async () => {
      const first = await setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: true } }, runtime());
      expect(first.enabled).toBe(true);
      expect(first.installId).toMatch(UUID);
      expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual({ formatVersion: 1, installId: first.installId });

      const second = await setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: true } }, runtime());
      expect(second.installId).toBe(first.installId);
      expect(fetcher).not.toHaveBeenCalled();
      expect((await fs.readdir(path.dirname(filePath))).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    });

    it('turning off when already off changes nothing and sends nothing', async () => {
      await expect(setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: false } }, runtime()))
        .resolves.toMatchObject({ enabled: false, installId: null });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('reports an invalid file, and turning off still deletes it without sending', async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify({ formatVersion: 1, installId: 'not-a-uuid' }));

      await expect(readTelemetryStatusWithOptions({ homeDir }, runtime()))
        .rejects.toMatchObject({ code: 'CORE_TELEMETRY_FILE_INVALID' });
      await expect(setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: true } }, runtime()))
        .rejects.toMatchObject({ code: 'CORE_TELEMETRY_FILE_INVALID' });

      await setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: false } }, runtime());
      await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('rejects a file with extra fields', async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify({ formatVersion: 1, installId: INSTALL_ID, extra: true }));
      await expect(readTelemetryStatusWithOptions({ homeDir }, runtime()))
        .rejects.toMatchObject({ code: 'CORE_TELEMETRY_FILE_INVALID' });
    });
  });

  describe('heard about', () => {
    it.each(HEARD_ABOUT_RENKU_ANSWERS)('accepts %s and sends it once after saving', async (answer) => {
      const status = await setTelemetryChoiceWithOptions(
        { homeDir, choice: { enabled: true, heardAbout: answer } },
        runtime()
      );
      expect(sentBodies()).toEqual([
        expect.objectContaining({ event: 'heard_about', distinct_id: status.installId, properties: expect.objectContaining({ answer }) }),
      ]);
    });

    it('rejects an unknown answer and an answer while turning off', async () => {
      await expect(setTelemetryChoiceWithOptions(
        { homeDir, choice: { enabled: true, heardAbout: 'newsletter' as never } },
        runtime()
      )).rejects.toMatchObject({ code: 'CORE_TELEMETRY_CHOICE_INVALID' });
      await expect(setTelemetryChoiceWithOptions(
        { homeDir, choice: { enabled: false, heardAbout: 'github' } },
        runtime()
      )).rejects.toMatchObject({ code: 'CORE_TELEMETRY_CHOICE_INVALID' });
      await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('opting out', () => {
    it('sends telemetry_opted_out with the old ID and removes the saved choice', async () => {
      await writeInstallId();
      await setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: false } }, runtime());
      expect(sentBodies()).toEqual([expect.objectContaining({ event: 'telemetry_opted_out', distinct_id: INSTALL_ID })]);
      await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('revokes recording while the final opt-out request is pending', async () => {
      await writeInstallId();
      let finishSend!: (response: Response) => void;
      fetcher.mockReturnValue(new Promise<Response>((resolve) => {
        finishSend = resolve;
      }));
      const optOut = setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: false } }, runtime());

      try {
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        await expect(readTelemetryStatusWithOptions({ homeDir }, runtime()))
          .resolves.toMatchObject({ enabled: false, installId: null });
        await recordTelemetryEventWithOptions({ name: 'generation_completed', mediaKind: 'image' }, { homeDir }, runtime());
        await recordTelemetryEventWithOptions({ name: 'sample_film_download_finished', result: 'installed' }, { homeDir }, runtime());
        expect(sentBodies()).toEqual([
          expect.objectContaining({ event: 'telemetry_opted_out', distinct_id: INSTALL_ID }),
        ]);
      } finally {
        finishSend(new Response(null, { status: 200 }));
        await optOut;
      }
    });

    it('still deletes the file when the send fails', async () => {
      await writeInstallId();
      fetcher.mockRejectedValue(new Error('offline'));
      await setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: false } }, runtime());
      await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('sends nothing when an environment switch blocks sending', async () => {
      await writeInstallId();
      await setTelemetryChoiceWithOptions({ homeDir, choice: { enabled: false } }, runtime({ DO_NOT_TRACK: '1' }));
      expect(fetcher).not.toHaveBeenCalled();
      await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('environment switches', () => {
    it.each(['DO_NOT_TRACK', 'RENKU_TELEMETRY_DISABLED', 'CI'] as const)('%s blocks every send', async (name) => {
      await writeInstallId();
      for (const value of ['1', 'true', 'yes']) {
        await recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, runtime({ [name]: value }));
        await expect(readTelemetryStatusWithOptions({ homeDir }, runtime({ [name]: value })))
          .resolves.toMatchObject({ enabled: true, blockedBy: name });
      }
      expect(fetcher).not.toHaveBeenCalled();
    });

    it.each(['', '0', 'false'])('a switch set to "%s" does not block', async (value) => {
      await writeInstallId();
      await recordTelemetryEventWithOptions(
        { name: 'studio_started' },
        { homeDir },
        runtime({ DO_NOT_TRACK: value, RENKU_TELEMETRY_DISABLED: value, CI: value })
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('reports the first switch in order', async () => {
      await expect(readTelemetryStatusWithOptions({ homeDir }, runtime({ CI: 'true', RENKU_TELEMETRY_DISABLED: '1' })))
        .resolves.toMatchObject({ blockedBy: 'RENKU_TELEMETRY_DISABLED' });
    });

    it('debug prints the event without the project token and sends nothing', async () => {
      await writeInstallId();
      await recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, runtime({ RENKU_TELEMETRY_DEBUG: '1' }));
      expect(fetcher).not.toHaveBeenCalled();
      expect(printed).toHaveLength(1);
      expect(printed[0]).toMatch(/^renku usage statistics \(debug, not sent\): /);
      expect(printed[0]).not.toContain('api_key');
      expect(printed[0]).not.toContain('phc_');
    });

    it('prints nothing in debug mode when a switch blocks sending', async () => {
      await writeInstallId();
      await recordTelemetryEventWithOptions(
        { name: 'studio_started' },
        { homeDir },
        runtime({ RENKU_TELEMETRY_DEBUG: '1', DO_NOT_TRACK: '1' })
      );
      expect(printed).toEqual([]);
    });

    it('records nothing while usage statistics are off', async () => {
      await recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, runtime({ RENKU_TELEMETRY_DEBUG: '1' }));
      expect(printed).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('never in the way', () => {
    it.each([
      ['a rejected fetch', () => fetcher.mockRejectedValue(new Error('offline'))],
      ['an HTTP 500', () => fetcher.mockResolvedValue(new Response(null, { status: 500 }))],
    ])('resolves after %s', async (_label, arrange) => {
      await writeInstallId();
      arrange();
      await expect(recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, runtime())).resolves.toBeUndefined();
    });

    it('gives the send a 2-second timeout', async () => {
      await writeInstallId();
      await recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, runtime());
      const init = fetcher.mock.calls[0]?.[1] as { signal?: unknown };
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('skips the event when the file is unreadable or the version cannot be read', async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, '{');
      await expect(recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, runtime())).resolves.toBeUndefined();

      await writeInstallId();
      const brokenVersion = { ...runtime({ RENKU_TELEMETRY_DEBUG: '1' }), readVersion: () => { throw new Error('UPDATE005'); } };
      await expect(recordTelemetryEventWithOptions({ name: 'studio_started' }, { homeDir }, brokenVersion)).resolves.toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
      expect(printed).toEqual([expect.stringMatching(/^renku usage statistics \(debug, skipped\): studio_started: /)]);
    });
  });

  describe('payload', () => {
    // This is the public field list: change gorenku.com/privacy#app-usage-statistics with it.
    const cases: Array<[TelemetryEvent, Record<string, string>]> = [
      [{ name: 'studio_started' }, {}],
      [{ name: 'project_created' }, {}],
      [{ name: 'fdx_imported' }, {}],
      [{ name: 'sample_film_download_started' }, {}],
      [{ name: 'sample_film_download_finished', result: 'installed' }, { result: 'installed' }],
      [
        { name: 'sample_film_download_finished', result: 'failed', errorCode: 'SAMPLE_FILM_DOWNLOAD_FAILED' },
        { result: 'failed', error_code: 'SAMPLE_FILM_DOWNLOAD_FAILED' },
      ],
      [{ name: 'sample_film_opened' }, {}],
      [{ name: 'generation_completed', mediaKind: 'video' }, { media_kind: 'video' }],
      [{ name: 'heard_about', answer: 'hn' }, { answer: 'hn' }],
      [{ name: 'telemetry_opted_out' }, {}],
    ];

    it.each(cases)('sends exactly the listed fields for %o', async (event, extra) => {
      await writeInstallId();
      await recordTelemetryEventWithOptions(event, { homeDir }, runtime());
      expect(fetcher).toHaveBeenCalledWith('https://eu.i.posthog.com/i/v0/e/', expect.objectContaining({ method: 'POST' }));
      expect(sentBodies()).toEqual([{
        api_key: 'phc_rTTOTmP5c7ZzNTKVMbVwEzmyofCP3dio7ZSI1Zavub6',
        event: event.name,
        distinct_id: INSTALL_ID,
        timestamp: '2026-10-15T10:00:00.000Z',
        properties: {
          surface: 'studio',
          version: '0.1.35',
          platform: process.platform,
          arch: process.arch,
          ...extra,
          $geoip_disable: true,
        },
      }]);
    });
  });

  describe('generationCompletedEvent', () => {
    const assetFile = (origin: string, mediaKind: string) => ({ origin, mediaKind }) as never;

    it('uses the first generated image, video or audio file', () => {
      expect(generationCompletedEvent([assetFile('imported', 'image'), assetFile('generated', 'audio')]))
        .toEqual({ name: 'generation_completed', mediaKind: 'audio' });
    });

    it('returns null for files without generation origin and for other media kinds', () => {
      expect(generationCompletedEvent([assetFile('external', 'image')])).toBeNull();
      expect(generationCompletedEvent([assetFile('generated', 'model')])).toBeNull();
      expect(generationCompletedEvent([])).toBeNull();
    });
  });
});
