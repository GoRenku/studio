import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  GenerationRunResult,
} from '@gorenku/studio-engines';
import {
  KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS,
  injectKlingTransientVoiceIds,
  resolveKlingTransientVoices,
} from './kling-transient-voice.js';
import type { KlingTransientVoiceConversion } from './provider-payloads.js';

describe('Kling transient voice IDs', () => {
  it('injects deterministic simulated voice IDs without writing the sidecar cache', async () => {
    const projectFolder = await createProject();
    await writeProjectFile(projectFolder, 'generated/audio/dialogue.wav', 'voice bytes');
    const conversion = conversionFor('generated/audio/dialogue.wav');

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [conversion],
      simulate: true,
      runGeneration: vi.fn(),
    });
    const payload = { elements: [{ video_url: 'renku-input://video.mp4' }] };
    const requestParameters = { elements: [{ video_url: 'renku-input://video.mp4' }] };
    injectKlingTransientVoiceIds({
      payload,
      requestParameters,
      resolutions: report.resolutions,
    });

    expect(report.resolutions[0]).toMatchObject({
      cacheResult: 'skipped',
      simulated: true,
    });
    expect(payload).toEqual({
      elements: [
        {
          video_url: 'renku-input://video.mp4',
          voice_id: expect.stringMatching(/^simulated_kling_voice_/),
        },
      ],
    });
    await expect(
      fs.access(path.join(projectFolder, '.renku/cache/kling-transient-voice-ids.json'))
    ).rejects.toBeTruthy();
  });

  it('uses a fresh cache hit without calling create-voice', async () => {
    const projectFolder = await createProject();
    await writeProjectFile(projectFolder, 'generated/audio/dialogue.wav', 'voice bytes');
    const fingerprint =
      'sha256:488a250f46f73a5447579e25f7ecf6b64b60f7d31fa716a922ae325a4c38fb95';
    await writeProjectFile(
      projectFolder,
      '.renku/cache/kling-transient-voice-ids.json',
      JSON.stringify({
        version: 1,
        entries: [
          {
            provider: 'fal-ai',
            model: 'kling-video/create-voice',
            sourceAudioFingerprint: fingerprint,
            sourceAudioAssetFileId: 'audio_file_dialogue',
            sourceProjectPath: 'generated/audio/dialogue.wav',
            voiceId: 'cached_voice_001',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(
              Date.now() + KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS
            ).toISOString(),
          },
        ],
      })
    );
    const runGeneration = vi.fn();

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [conversionFor('generated/audio/dialogue.wav')],
      simulate: false,
      runGeneration,
    });

    expect(runGeneration).not.toHaveBeenCalled();
    expect(report.resolutions[0]).toMatchObject({
      voiceId: 'cached_voice_001',
      cacheResult: 'hit',
    });
  });

  it('ignores expired and path-only cache entries, then writes a fresh fingerprint match', async () => {
    const projectFolder = await createProject();
    await writeProjectFile(projectFolder, 'generated/audio/dialogue.wav', 'new voice bytes');
    await writeProjectFile(
      projectFolder,
      '.renku/cache/kling-transient-voice-ids.json',
      JSON.stringify({
        version: 1,
        entries: [
          {
            provider: 'fal-ai',
            model: 'kling-video/create-voice',
            sourceAudioFingerprint: 'sha256:old',
            sourceAudioAssetFileId: 'audio_file_dialogue',
            sourceProjectPath: 'generated/audio/dialogue.wav',
            voiceId: 'expired_voice',
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      })
    );
    const runGeneration = createVoiceRun('fresh_voice_001');

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [conversionFor('generated/audio/dialogue.wav')],
      simulate: false,
      runGeneration,
    });
    const cache = JSON.parse(
      await fs.readFile(
        path.join(projectFolder, '.renku/cache/kling-transient-voice-ids.json'),
        'utf8'
      )
    );

    expect(runGeneration).toHaveBeenCalledTimes(1);
    expect(report.resolutions[0]).toMatchObject({
      voiceId: 'fresh_voice_001',
      cacheResult: 'miss',
    });
    expect(cache.entries).toEqual([
      expect.objectContaining({
        sourceProjectPath: 'generated/audio/dialogue.wav',
        voiceId: 'fresh_voice_001',
        sourceAudioFingerprint: expect.stringMatching(/^sha256:/),
      }),
    ]);
  });

  it('resolves every conversion that shares a fingerprint with one live create-voice call', async () => {
    const projectFolder = await createProject();
    await writeProjectFile(projectFolder, 'generated/audio/dialogue-a.wav', 'same voice bytes');
    await writeProjectFile(projectFolder, 'generated/audio/dialogue-b.wav', 'same voice bytes');
    const runGeneration = createVoiceRun('shared_voice_001');
    const secondConversion = conversionFor('generated/audio/dialogue-b.wav');

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [
        conversionFor('generated/audio/dialogue-a.wav'),
        {
          ...secondConversion,
          sourceAudio: {
            ...secondConversion.sourceAudio,
            inputId: 'audio_file_dialogue_copy',
            assetFileId: 'audio_file_dialogue_copy',
          },
          targetElementId: 'scribe',
          targetPromptToken: '@Element2',
          payloadPath: ['elements', 1, 'voice_id'],
        },
      ],
      simulate: false,
      runGeneration,
    });

    expect(runGeneration).toHaveBeenCalledTimes(1);
    expect(report.resolutions).toEqual([
      expect.objectContaining({
        voiceId: 'shared_voice_001',
        cacheResult: 'miss',
        sourceAudioFingerprint: expect.stringMatching(/^sha256:/),
      }),
      expect.objectContaining({
        voiceId: 'shared_voice_001',
        cacheResult: 'miss',
        sourceAudioFingerprint: expect.stringMatching(/^sha256:/),
      }),
    ]);
  });

  it('treats corrupt sidecar files as cache misses', async () => {
    const projectFolder = await createProject();
    await writeProjectFile(projectFolder, 'generated/audio/dialogue.wav', 'voice bytes');
    await writeProjectFile(
      projectFolder,
      '.renku/cache/kling-transient-voice-ids.json',
      '{not valid json'
    );
    const runGeneration = createVoiceRun('fresh_voice_002');

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [conversionFor('generated/audio/dialogue.wav')],
      simulate: false,
      runGeneration,
    });

    expect(runGeneration).toHaveBeenCalledTimes(1);
    expect(report.resolutions[0]).toMatchObject({
      voiceId: 'fresh_voice_002',
      cacheResult: 'miss',
    });
  });

  it('skips cache reads and writes when source audio cannot be fingerprinted', async () => {
    const projectFolder = await createProject();
    const runGeneration = createVoiceRun('uncached_voice_001');

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [conversionFor('generated/audio/missing.wav')],
      simulate: false,
      runGeneration,
    });

    expect(runGeneration).toHaveBeenCalledTimes(1);
    expect(report.resolutions[0]).toMatchObject({
      voiceId: 'uncached_voice_001',
      cacheResult: 'skipped',
    });
    await expect(
      fs.access(path.join(projectFolder, '.renku/cache/kling-transient-voice-ids.json'))
    ).rejects.toBeTruthy();
  });

  it('continues generation with a structured warning when the sidecar cache cannot be written', async () => {
    const projectFolder = await createProject();
    await writeProjectFile(projectFolder, 'generated/audio/dialogue.wav', 'voice bytes');
    await fs.mkdir(
      path.join(projectFolder, '.renku/cache/kling-transient-voice-ids.json'),
      { recursive: true }
    );

    const report = await resolveKlingTransientVoices({
      projectFolder,
      conversions: [conversionFor('generated/audio/dialogue.wav')],
      simulate: false,
      runGeneration: createVoiceRun('fresh_voice_003'),
    });

    expect(report.resolutions[0]).toMatchObject({
      voiceId: 'fresh_voice_003',
      cacheResult: 'miss',
    });
    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_KLING_TRANSIENT_VOICE_CACHE_WRITE_FAILED',
      }),
    ]);
  });
});

async function createProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'renku-kling-voice-'));
}

async function writeProjectFile(
  projectFolder: string,
  projectRelativePath: string,
  contents: string
): Promise<void> {
  const absolutePath = path.join(projectFolder, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents);
}

function conversionFor(projectRelativePath: string): KlingTransientVoiceConversion {
  return {
    provider: 'fal-ai',
    model: 'kling-video/create-voice',
    sourceAudio: {
      inputId: 'audio_file_dialogue',
      assetId: 'asset_dialogue',
      assetFileId: 'audio_file_dialogue',
      projectRelativePath,
      subjectKind: 'scene-dialogue',
      subjectId: 'dialogue_001',
    },
    targetElementId: 'urban',
    targetPromptToken: '@Element1',
    payloadPath: ['elements', 0, 'voice_id'],
  };
}

function createVoiceRun(voiceId: string) {
  return vi.fn(async (input: {
    outputRoot: string;
    outputProjectRelativeRoot: string;
    request: { outputNames?: string[] };
  }): Promise<GenerationRunResult> => {
    const fileName = input.request.outputNames?.[0] ?? 'voice.json';
    const absolutePath = path.join(input.outputRoot, fileName);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify({ voice_id: voiceId }));
    const projectRelativePath = path.posix.join(
      input.outputProjectRelativeRoot,
      fileName
    );
    return {
      outputs: [
        {
          artifactId: 'Artifact:GeneratedJson[output=1]',
          mimeType: 'application/json',
          projectRelativePath,
        },
      ],
      diagnostics: {},
      receipt: {
        provider: 'fal-ai',
        model: 'kling-video/create-voice',
        mediaKind: 'json',
        mode: 'json',
        generatedAt: new Date().toISOString(),
        requestHash: 'sha256:create-voice',
        outputs: [],
        simulated: false,
      },
    };
  });
}
