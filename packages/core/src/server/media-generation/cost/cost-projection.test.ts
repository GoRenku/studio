import { describe, expect, it } from 'vitest';
import type {
  LookbookImageGenerationSpec,
  SceneDialogueAudioGenerationSpec,
  ShotVideoTakeOutputGenerationSpec,
} from '../../../client/index.js';
import {
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type { ProjectRelativePath } from '../../../client/project.js';
import { buildMediaGenerationCostProjection } from './cost-projection.js';

describe('media generation cost projection', () => {
  it('prices an image spec even when the prompt is creatively empty', async () => {
    const projection = await buildMediaGenerationCostProjection({
      spec: {
        purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
        target: { kind: 'lookbook', id: 'missing-lookbook' },
        modelChoice: 'fal-ai/xai/grok-imagine-image',
        prompt: '',
        focusSections: [],
        takeCount: 2,
        imageFrame: '16:9',
        detail: 'standard',
        outputFormat: 'png',
      } satisfies LookbookImageGenerationSpec,
    });

    expect(projection.estimate).toMatchObject({
      state: 'priced',
      estimatedCostUsd: expect.any(Number),
      billableUnits: expect.objectContaining({ outputCount: 2 }),
    });
  });

  it('prices dialogue audio from text without validating cast voice readiness', async () => {
    const projection = await buildMediaGenerationCostProjection({
      spec: {
        purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
        target: {
          kind: 'sceneDialogue',
          sceneId: 'stale-scene',
          dialogueId: 'stale-dialogue',
        },
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: 'missing-cast-voice',
        plainText: 'We keep moving.',
        v3Text: 'We keep moving.',
        outputFormat: 'mp3_44100_128',
        languageCode: null,
      } satisfies SceneDialogueAudioGenerationSpec,
    });

    expect(projection.estimate).toMatchObject({
      state: 'priced',
      mediaKind: 'audio',
      estimatedCostUsd: expect.any(Number),
    });
  });

  it('reports missing pricing input for dialogue audio without text', async () => {
    const projection = await buildMediaGenerationCostProjection({
      spec: {
        purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
        target: {
          kind: 'sceneDialogue',
          sceneId: 'stale-scene',
          dialogueId: 'stale-dialogue',
        },
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: 'missing-cast-voice',
        plainText: '',
        v3Text: '',
        outputFormat: 'mp3_44100_128',
        languageCode: null,
      } satisfies SceneDialogueAudioGenerationSpec,
    });

    expect(projection.estimate).toMatchObject({
      state: 'missing-pricing-input',
      missingInputs: ['characterCount'],
    });
  });

  it('prices final shot video from route facts without resolving input files', async () => {
    const projection = await buildMediaGenerationCostProjection({
      spec: {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: {
          kind: 'sceneShotVideoTake',
          id: 'stale-target',
          sceneId: 'stale-scene',
          takeId: 'stale-take',
          shotIds: ['stale-shot'],
        },
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        prompt: '',
        parameterValues: {
          duration: '5',
          resolution: '720p',
          aspect_ratio: '16:9',
        },
        inputs: [
          {
            kind: 'first-frame',
            assetId: 'missing-asset',
            assetFileId: 'missing-file',
            role: 'first_frame',
            mediaKind: 'image',
            projectRelativePath: 'missing/input.png' as ProjectRelativePath,
          },
        ],
      } satisfies ShotVideoTakeOutputGenerationSpec,
    });

    expect(projection.estimate).toMatchObject({
      state: 'priced',
      mediaKind: 'video',
      estimatedCostUsd: expect.any(Number),
      billableUnits: expect.objectContaining({
        inputImageCount: expect.any(Number),
      }),
    });
  });

  it('prices Kling V3 dialogue audio as voice control without validating bindings', async () => {
    const projection = await buildMediaGenerationCostProjection({
      spec: {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: {
          kind: 'sceneShotVideoTake',
          id: 'stale-target',
          sceneId: 'stale-scene',
          takeId: 'stale-take',
          shotIds: ['stale-shot'],
        },
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        prompt: '',
        parameterValues: {
          duration: '5',
          generate_audio: true,
        },
        inputs: [
          {
            kind: 'audio',
            assetId: 'missing-audio-asset',
            assetFileId: 'missing-audio-file',
            role: 'dialogue_audio',
            mediaKind: 'audio',
            projectRelativePath:
              'generated/audio/dialogue-001.wav' as ProjectRelativePath,
            subjectKind: 'scene-dialogue',
            subjectId: 'dialogue-001',
            providerReferenceRole: 'audio-reference',
          },
        ],
      } satisfies ShotVideoTakeOutputGenerationSpec,
    });

    expect(projection.estimate).toMatchObject({
      state: 'priced',
      estimatedCostUsd: 0.98,
      billableUnits: expect.objectContaining({
        uses_voice_control: true,
      }),
    });
  });
});
