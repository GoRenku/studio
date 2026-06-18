import { describe, expect, it } from 'vitest';
import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type ProjectRelativePath,
  type SceneShotVideoTakeTarget,
  type ShotVideoTakeGenerationContext,
  type ShotVideoTakeGenerationSpec,
} from '../../../client/index.js';
import {
  buildKlingTransientVoiceConversions,
  buildShotVideoTakeProviderPayload,
} from './provider-payloads.js';

describe('shot video take provider payloads', () => {
  it('maps selected dialogue audio references to deduplicated provider audio input files', () => {
    const target: SceneShotVideoTakeTarget = {
      kind: 'sceneShotVideoTake',
      id: 'scene_001:take_generation_001',
      sceneId: 'scene_001',
      takeId: 'take_generation_001',
      shotIds: ['shot_001'],
    };
    const spec: ShotVideoTakeGenerationSpec = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target,
      inputModeId: 'reference',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      prompt: 'Generate the shot with dialogue audio reference.',
      parameterValues: { duration: 6 },
      inputs: [
        referenceImageInput('image_file_001', 'generated/images/reference-001.png'),
        dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
        dialogueAudioInput('audio_file_001_copy', 'generated/audio/dialogue-001.mp3'),
      ],
    };

    const plan = buildShotVideoTakeProviderPayload(spec, {
      shotGroupMode: 'single-shot',
    } as ShotVideoTakeGenerationContext);

    expect(plan.inputFiles).toEqual([
      {
        field: 'image_urls',
        projectRelativePath: 'generated/images/reference-001.png',
        mediaKind: 'image',
        asArray: true,
        required: false,
      },
      {
        field: 'audio_urls',
        projectRelativePath: 'generated/audio/dialogue-001.mp3',
        mediaKind: 'audio',
        asArray: true,
        required: false,
      },
    ]);
  });

  it('rejects provider payloads with more dialogue audio inputs than the route allows', () => {
    const target: SceneShotVideoTakeTarget = {
      kind: 'sceneShotVideoTake',
      id: 'scene_001:take_generation_001',
      sceneId: 'scene_001',
      takeId: 'take_generation_001',
      shotIds: ['shot_001'],
    };
    const spec: ShotVideoTakeGenerationSpec = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target,
      inputModeId: 'reference',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      prompt: 'Generate the shot with too many dialogue audio references.',
      parameterValues: { duration: 6 },
      inputs: [
        referenceImageInput('image_file_001', 'generated/images/reference-001.png'),
        dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
        dialogueAudioInput('audio_file_002', 'generated/audio/dialogue-002.mp3'),
        dialogueAudioInput('audio_file_003', 'generated/audio/dialogue-003.mp3'),
        dialogueAudioInput('audio_file_004', 'generated/audio/dialogue-004.mp3'),
      ],
    };

    expect(() =>
      buildShotVideoTakeProviderPayload(spec, {
        shotGroupMode: 'single-shot',
      } as ShotVideoTakeGenerationContext)
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
      })
    );
  });

  it('rejects Seedance audio references without visual references', () => {
    const common = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: shotTarget(),
      inputModeId: 'reference' as const,
      modelChoice: 'fal-ai/bytedance/seedance-2.0' as const,
      prompt: 'Generate the shot with dialogue audio reference.',
      parameterValues: { duration: 6 },
    };

    expect(() =>
      buildShotVideoTakeProviderPayload(
        {
          ...common,
          inputs: [dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3')],
        },
        { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_SEEDANCE_AUDIO_REQUIRES_VISUAL_REFERENCE',
      })
    );
  });

  it('maps clean Cast Voice samples to Seedance audio references without best-effort dialogue intent', () => {
    const plan = buildShotVideoTakeProviderPayload(
      {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: shotTarget(),
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        prompt: '@Image1 defines the look. @Audio1 provides voice style.',
        parameterValues: { duration: 6 },
        inputs: [
          referenceImageInput('image_file_001', 'generated/images/reference-001.png'),
          cleanCastVoiceSampleInput(
            'cast_voice_sample_001',
            'cast/urban/voice-samples/clean-sample.mp3'
          ),
        ],
      },
      { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
    );

    expect(plan.payload).toMatchObject({
      prompt: '@Image1 defines the look. @Audio1 provides voice style.',
    });
    expect(plan.inputFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'audio_urls',
          projectRelativePath: 'cast/urban/voice-samples/clean-sample.mp3',
          mediaKind: 'audio',
          asArray: true,
        }),
      ])
    );
  });

  it('maps Kling V3 image-to-video with start and end frames', () => {
    const plan = buildShotVideoTakeProviderPayload(
      {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: shotTarget(),
        inputModeId: 'first-last-frame',
        modelChoice: 'fal-ai/kling-video/v3/standard',
        prompt: 'The character crosses the courtyard.',
        parameterValues: { duration: '5' },
        inputs: [
          firstFrameInput('generated/images/start.png'),
          lastFrameInput('generated/images/end.png'),
        ],
      },
      { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
    );

    expect(plan.model).toBe('kling-video/v3/standard/image-to-video');
    expect(plan.payload).toMatchObject({
      prompt: 'The character crosses the courtyard.',
      duration: '5',
      generate_audio: true,
      shot_type: 'customize',
      negative_prompt: 'blur, distort, and low quality',
      cfg_scale: 0.5,
    });
    expect(plan.inputFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'start_image_url',
          projectRelativePath: 'generated/images/start.png',
        }),
        expect.objectContaining({
          field: 'end_image_url',
          projectRelativePath: 'generated/images/end.png',
        }),
      ])
    );
  });

  it('maps Kling V3 image-set elements into elements payloads', () => {
    const plan = buildShotVideoTakeProviderPayload(
      {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: shotTarget(),
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        prompt: '@Element1 enters from frame left.',
        parameterValues: { duration: '5' },
        inputs: [
          firstFrameInput('generated/images/start.png'),
          elementFrontalImageInput('urban', 'generated/cast/urban-front.png'),
          elementReferenceImageInput('urban', 'generated/cast/urban-side.png'),
        ],
      },
      { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
    );

    expect(plan.payload.elements).toEqual([
      {
        frontal_image_url: 'renku-input://generated/cast/urban-front.png',
        reference_image_urls: ['renku-input://generated/cast/urban-side.png'],
      },
    ]);
    expect(plan.inputFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payloadPath: ['elements', 0, 'frontal_image_url'],
          projectRelativePath: 'generated/cast/urban-front.png',
        }),
        expect.objectContaining({
          payloadPath: ['elements', 0, 'reference_image_urls', 0],
          projectRelativePath: 'generated/cast/urban-side.png',
        }),
      ])
    );
  });

  it('projects Kling V3 dialogue audio into transient video-element voice conversions', () => {
    const spec: ShotVideoTakeGenerationSpec = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: shotTarget(),
      inputModeId: 'first-frame',
      modelChoice: 'fal-ai/kling-video/v3/pro',
      prompt: '@Element1 says, "We keep moving."',
      parameterValues: { duration: '5', generate_audio: true },
      inputs: [
        firstFrameInput('generated/images/start.png'),
        elementVideoInput('urban', 'generated/video/urban-reference.mp4'),
        dialogueAudioInput('audio_file_urban', 'generated/audio/dialogue-urban.mp3'),
      ],
    };
    const context = { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext;
    const plan = buildShotVideoTakeProviderPayload(spec, context);
    const conversions = buildKlingTransientVoiceConversions({
      spec,
      payload: plan.payload,
      route: undefined,
    });

    expect(plan.payload.elements).toEqual([
      {
        video_url: 'renku-input://generated/video/urban-reference.mp4',
      },
    ]);
    expect(conversions).toEqual([
      expect.objectContaining({
        provider: 'fal-ai',
        model: 'kling-video/create-voice',
        sourceAudio: expect.objectContaining({
          assetFileId: 'audio_file_urban',
          projectRelativePath: 'generated/audio/dialogue-urban.mp3',
        }),
        targetElementId: 'urban',
        targetPromptToken: '@Element1',
        payloadPath: ['elements', 0, 'voice_id'],
      }),
    ]);
  });

  it('rejects Kling V3 text-only dialogue audio because there is no element voice target', () => {
    expect(() =>
      buildShotVideoTakeProviderPayload(
        {
          purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
          target: shotTarget(),
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/kling-video/v3/pro',
          prompt: 'Generate the shot with selected dialogue audio.',
          parameterValues: { duration: '5', generate_audio: true },
          inputs: [
            dialogueAudioInput(
              'audio_file_urban',
              'generated/audio/dialogue-urban.mp3'
            ),
          ],
        },
        { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_KLING_DIALOGUE_AUDIO_ELEMENTS_UNSUPPORTED',
      })
    );
  });

  it('rejects multiple Kling video elements and unsupported dialogue audio binding', () => {
    const common = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: shotTarget(),
      inputModeId: 'first-frame' as const,
      modelChoice: 'fal-ai/kling-video/v3/pro' as const,
      prompt: 'Generate the shot.',
      parameterValues: { duration: '5', generate_audio: true },
    };

    expect(() =>
      buildShotVideoTakeProviderPayload(
        {
          ...common,
          inputs: [
            firstFrameInput('generated/images/start.png'),
            elementVideoInput('urban', 'generated/video/urban-reference.mp4'),
            elementVideoInput('scribe', 'generated/video/scribe-reference.mp4'),
          ],
        },
        { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_KLING_VIDEO_ELEMENT_MAX_COUNT_EXCEEDED',
      })
    );

    expect(() =>
      buildShotVideoTakeProviderPayload(
        {
          ...common,
          inputs: [
            firstFrameInput('generated/images/start.png'),
            elementFrontalImageInput('urban', 'generated/cast/urban-front.png'),
            {
              ...dialogueAudioInput(
                'audio_file_urban',
                'generated/audio/dialogue-urban.mp3'
              ),
              elementId: 'urban',
            },
          ],
        },
      { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_KLING_IMAGE_ELEMENT_VOICE_UNSUPPORTED',
      })
    );
  });

  it('maps Kling O3 reference-to-video top-level images and elements', () => {
    const plan = buildShotVideoTakeProviderPayload(
      {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: shotTarget(),
        inputModeId: 'reference',
        modelChoice: 'fal-ai/kling-video/o3/pro',
        prompt: '@Element1 crosses through the style of @Image1.',
        parameterValues: { duration: '5' },
        inputs: [
          topLevelImageInput('generated/images/lookbook-style.png'),
          elementFrontalImageInput('urban', 'generated/cast/urban-front.png'),
        ],
      },
      { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
    );

    expect(plan.model).toBe('kling-video/o3/pro/reference-to-video');
    expect(plan.payload).toMatchObject({
      image_urls: ['renku-input://generated/images/lookbook-style.png'],
      elements: [
        {
          frontal_image_url: 'renku-input://generated/cast/urban-front.png',
        },
      ],
      generate_audio: false,
      aspect_ratio: '16:9',
    });
  });

  it('maps Kling O3 source-video-reference routes', () => {
    const plan = buildShotVideoTakeProviderPayload(
      {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: shotTarget(),
        inputModeId: 'source-video-reference',
        modelChoice: 'fal-ai/kling-video/o3/standard',
        prompt: 'Preserve @Video1 camera rhythm and add @Image1 color.',
        parameterValues: { duration: '5', keep_audio: false },
        inputs: [
          sourceVideoInput('generated/video/source-motion.mp4'),
          topLevelImageInput('generated/images/lookbook-style.png'),
        ],
      },
      { shotGroupMode: 'single-shot' } as ShotVideoTakeGenerationContext
    );

    expect(plan.model).toBe('kling-video/o3/standard/video-to-video/reference');
    expect(plan.payload).toMatchObject({
      video_url: 'renku-input://generated/video/source-motion.mp4',
      image_urls: ['renku-input://generated/images/lookbook-style.png'],
      keep_audio: false,
      aspect_ratio: 'auto',
      shot_type: 'customize',
    });
  });
});

function shotTarget(): SceneShotVideoTakeTarget {
  return {
    kind: 'sceneShotVideoTake',
    id: 'scene_001:take_generation_001',
    sceneId: 'scene_001',
    takeId: 'take_generation_001',
    shotIds: ['shot_001'],
  };
}

function dialogueAudioInput(assetFileId: string, projectRelativePath: string) {
  return {
    kind: 'audio' as const,
    assetId: 'asset_dialogue_001',
    assetFileId,
    role: 'dialogue_audio',
    mediaKind: 'audio' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'scene-dialogue' as const,
    subjectId: 'dialogue_urban',
    providerReferenceRole: 'audio-reference' as const,
    seedanceAudioReferenceIntent: 'generated-dialogue-reference' as const,
  };
}

function cleanCastVoiceSampleInput(assetFileId: string, projectRelativePath: string) {
  return {
    kind: 'audio' as const,
    assetId: 'asset_cast_voice_sample_001',
    assetFileId,
    role: 'voice_sample',
    mediaKind: 'audio' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'cast-member' as const,
    subjectId: 'cast_urban',
    providerReferenceRole: 'audio-reference' as const,
    seedanceAudioReferenceIntent: 'clean-voice-sample' as const,
  };
}

function firstFrameInput(projectRelativePath: string) {
  return imageInput('first-frame', 'first_frame', projectRelativePath);
}

function lastFrameInput(projectRelativePath: string) {
  return imageInput('last-frame', 'last_frame', projectRelativePath);
}

function topLevelImageInput(projectRelativePath: string) {
  return {
    ...imageInput('reference-image', 'reference_image', projectRelativePath),
    providerReferenceRole: 'top-level-image' as const,
  };
}

function elementFrontalImageInput(
  elementId: string,
  projectRelativePath: string
) {
  return {
    ...imageInput('character-sheet', 'character_sheet', projectRelativePath),
    providerReferenceRole: 'element-frontal-image' as const,
    elementId,
  };
}

function elementReferenceImageInput(elementId: string, projectRelativePath: string) {
  return {
    ...imageInput('character-sheet', 'character_sheet', projectRelativePath),
    providerReferenceRole: 'element-reference-image' as const,
    elementId,
  };
}

function elementVideoInput(
  elementId: string,
  projectRelativePath: string
) {
  return {
    kind: 'source-video' as const,
    assetId: `asset_${elementId}_video`,
    assetFileId: `asset_file_${elementId}_video`,
    role: 'source_video',
    mediaKind: 'video' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'cast-member' as const,
    subjectId: elementId,
    providerReferenceRole: 'element-video' as const,
    elementId,
  };
}

function sourceVideoInput(projectRelativePath: string) {
  return {
    kind: 'source-video' as const,
    assetId: 'asset_source_video',
    assetFileId: 'asset_file_source_video',
    role: 'source_video',
    mediaKind: 'video' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'asset' as const,
    subjectId: 'asset_source_video',
    providerReferenceRole: 'source-video' as const,
  };
}

function imageInput(
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'character-sheet',
  role: string,
  projectRelativePath: string
) {
  return {
    kind,
    assetId: `asset_${role}`,
    assetFileId: `asset_file_${role}`,
    role,
    mediaKind: 'image' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'asset' as const,
    subjectId: `asset_${role}`,
  };
}

function referenceImageInput(assetFileId: string, projectRelativePath: string) {
  return {
    kind: 'reference-image' as const,
    assetId: 'asset_reference_001',
    assetFileId,
    role: 'reference_image',
    mediaKind: 'image' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'asset' as const,
    subjectId: 'asset_reference_001',
  };
}
