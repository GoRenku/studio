import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/access/scene-dialogue-audio.js', () => ({
  readSceneDialogueAudioRecord: vi.fn(),
}));

vi.mock('../../database/access/screenplay-resource.js', () => ({
  readScreenplaySceneFromSession: vi.fn(),
}));

vi.mock('../cost/cost-projection.js', async () => {
  const actual = await vi.importActual<typeof import('../cost/cost-projection.js')>(
    '../cost/cost-projection.js'
  );
  return {
    ...actual,
    buildMediaGenerationCostProjection: vi.fn(),
  };
});

vi.mock('./project-session.js', () => ({
  withMediaGenerationEstimationProjectSession: vi.fn(),
}));

import { readSceneDialogueAudioRecord } from '../../database/access/scene-dialogue-audio.js';
import { readScreenplaySceneFromSession } from '../../database/access/screenplay-resource.js';
import { buildMediaGenerationCostProjection } from '../cost/cost-projection.js';
import { withMediaGenerationEstimationProjectSession } from './project-session.js';
import { estimateSceneDialogueAudioPricingOnly } from './scene-dialogue-audio-estimates.js';

const mockedReadAudioRecord = vi.mocked(readSceneDialogueAudioRecord);
const mockedReadScene = vi.mocked(readScreenplaySceneFromSession);
const mockedBuildCostProjection = vi.mocked(buildMediaGenerationCostProjection);
const mockedWithSession = vi.mocked(withMediaGenerationEstimationProjectSession);

describe('Scene Dialogue Audio pricing-only lifecycle estimate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithSession.mockImplementation(async (_input, fn) =>
      fn({ session: { kind: 'session' } } as never)
    );
    mockedReadScene.mockReturnValue({
      blocks: [
        {
          type: 'dialogue',
          dialogueId: 'dialogue-a',
          lines: ['Hello there.'],
        },
      ],
    } as never);
    mockedBuildCostProjection.mockResolvedValue({
      estimate: {
        state: 'priced',
        estimatedCostUsd: 0.1,
      },
    } as never);
  });

  it('builds pricing specs from setup overrides and emits the missing Cast Voice warning', async () => {
    mockedReadAudioRecord.mockReturnValueOnce({
      plainText: 'Existing text',
      v3Text: '[excited] Existing v3 text',
      modelChoice: 'elevenlabs/eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      languageCode: 'en',
    } as never);

    await expect(
      estimateSceneDialogueAudioPricingOnly({
        projectName: 'movie',
        homeDir: '/home',
        sceneId: 'scene-a',
        dialogueId: 'dialogue-a',
        setup: {
          plainText: ' Setup text ',
          modelChoice: 'elevenlabs/eleven_multilingual_v2',
          outputFormat: 'mp3_44100_128',
        },
      })
    ).resolves.toMatchObject({
      pricing: { state: 'priced', estimatedUsd: 0.1 },
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_SCENE_DIALOGUE_AUDIO_MISSING_CAST_VOICE',
          severity: 'warning',
        }),
      ],
    });

    expect(mockedBuildCostProjection).toHaveBeenCalledWith({
      projectName: 'movie',
      homeDir: '/home',
      spec: expect.objectContaining({
        purpose: 'scene.dialogue-audio',
        plainText: 'Setup text',
        v3Text: 'Setup text',
        languageCode: 'en',
      }),
    });
  });

  it('uses v3 text treatment for Eleven v3 pricing inputs', async () => {
    mockedReadAudioRecord.mockReturnValueOnce(null);

    await estimateSceneDialogueAudioPricingOnly({
      sceneId: 'scene-a',
      dialogueId: 'dialogue-a',
      setup: {
        modelChoice: 'elevenlabs/eleven_v3',
        plainText: 'Plain text',
        v3Text: '[whispering] Tagged text',
      },
    });

    expect(mockedBuildCostProjection).toHaveBeenCalledWith({
      projectName: undefined,
      homeDir: undefined,
      spec: expect.objectContaining({
        plainText: '[whispering] Tagged text',
        v3Text: '[whispering] Tagged text',
      }),
    });
  });

  it('fails unsupported models and missing dialogue with structured project errors', async () => {
    await expect(
      estimateSceneDialogueAudioPricingOnly({
        sceneId: 'scene-a',
        dialogueId: 'dialogue-a',
        setup: { modelChoice: 'unknown/model' as never },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA385' });

    mockedReadScene.mockReturnValueOnce({ blocks: [] } as never);
    await expect(
      estimateSceneDialogueAudioPricingOnly({
        sceneId: 'scene-a',
        dialogueId: 'missing-dialogue',
        setup: {},
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA380' });
  });
});
