import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../../../../client/index.js';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../../../testing/shot-video-take-fixtures.js';

describe('shot video take preflight and validation', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('rejects a multi-shot final spec without the required video prompt sheet', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'reference',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One continuous two-shot video take.',
          parameterValues: {},
          inputs: [],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA384',
      message: expect.stringContaining('video-prompt-sheet'),
    });
  });

  it('rejects dialogue audio inputs when the selected route has no audio slot', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One video take with unsupported dialogue audio.',
          parameterValues: {},
          inputs: [
            dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED',
    });
  });

  it('rejects dialogue audio inputs above the selected route max count', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'reference',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One video take with too many dialogue audio references.',
          parameterValues: {},
          inputs: [
            dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
            dialogueAudioInput('audio_file_002', 'generated/audio/dialogue-002.mp3'),
            dialogueAudioInput('audio_file_003', 'generated/audio/dialogue-003.mp3'),
            dialogueAudioInput('audio_file_004', 'generated/audio/dialogue-004.mp3'),
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
    });
  });

  it('estimates final shot-video cost without transient Kling create-voice internals', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/audio/dialogue-001.wav',
      'voice bytes'
    );

    const spec = await projectData.createShotVideoTakeSpec({
      homeDir,
      spec: {
        purpose: 'shot.video-take',
        target: context.target,
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        prompt: '@Element1 says quietly, "We keep moving."',
        parameterValues: { duration: '5', generate_audio: true },
        inputs: [
          imageInput('first-frame', 'first_frame', 'generated/images/start.png'),
          elementVideoInput('urban', 'generated/video/urban-reference.mp4'),
          dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.wav'),
        ],
      },
    });

    const estimate = await projectData.estimateShotVideoTakeSpec({
      homeDir,
      specId: spec.id,
    });

    expect(estimate.estimate.estimatedCostUsd).toBeCloseTo(0.98);
    expect(estimate.estimate.state).toBe('priced');
    expect(approvalArtifactKeys(estimate.estimate)).toEqual([]);
    expect(estimate.estimate.billableUnits).toMatchObject({
      uses_voice_control: true,
    });
    expect(estimate.estimate.billableUnits).not.toHaveProperty(
      'transientKlingVoiceConversions'
    );
  });

  it('shows provider multi_prompt text and edits a model-supported negative prompt', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });
    const multiPrompt = [
      { prompt: 'Urban studies the cannon mold before speaking.', duration: 3 },
      { prompt: 'The chamber answers with a restrained slow push.', duration: 2 },
    ];

    const spec = await projectData.createShotVideoTakeSpec({
      homeDir,
      spec: {
        purpose: 'shot.video-take',
        target: context.target,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        prompt: '',
        parameterValues: { duration: '5', multi_prompt: multiPrompt },
        inputs: [],
      },
    });

    const preview = await projectData.buildMediaGenerationPreview({
      homeDir,
      specId: spec.id,
    });

    expect(preview.finalPrompt.providerText).toBe(
      [
        'Shot 1 (duration: 3): Urban studies the cannon mold before speaking.',
        'Shot 2 (duration: 2): The chamber answers with a restrained slow push.',
      ].join('\n\n')
    );
    expect(preview.finalPrompt.negativeText).toBe('');
    expect(preview.providerPreview?.payload).toMatchObject({
      prompt: null,
      multi_prompt: multiPrompt,
    });

    const withNegativePrompt = await projectData.updateGenerationPreviewSpec({
      homeDir,
      specId: spec.id,
      prompt: {
        authoredText: '',
        negativeText: 'No camera shake.',
      },
      referenceSelections: [],
    });
    expect(withNegativePrompt.finalPrompt.negativeText).toBe('No camera shake.');

    const clearedNegativePrompt = await projectData.updateGenerationPreviewSpec({
      homeDir,
      specId: spec.id,
      prompt: {
        authoredText: '',
        negativeText: null,
      },
      referenceSelections: [],
    });
    expect(clearedNegativePrompt.finalPrompt.negativeText).toBe('');
  });

  it('omits the negative prompt when the selected model schema has no field for it', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });
    const spec = await projectData.createShotVideoTakeSpec({
      homeDir,
      spec: {
        purpose: 'shot.video-take',
        target: context.target,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        prompt: 'One continuous video take.',
        parameterValues: {},
        inputs: [],
      },
    });

    const preview = await projectData.buildMediaGenerationPreview({
      homeDir,
      specId: spec.id,
    });

    expect(preview.finalPrompt).not.toHaveProperty('negativeText');
  });

  it('projects route prompt tokens in saved final video previews', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });

    const spec = await projectData.createShotVideoTakeSpec({
      homeDir,
      spec: {
        purpose: 'shot.video-take',
        target: context.target,
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0/mini',
        prompt:
          '@Image1 defines timing, @Image2 defines the place, and @Audio1 defines voice style.',
        parameterValues: { duration: '5' },
        inputs: [
          imageInput(
            'video-prompt-sheet',
            'video_prompt_sheet',
            'generated/images/video-prompt-sheet.png'
          ),
          imageInput(
            'location-sheet',
            'location_sheet',
            'generated/images/location-sheet.png'
          ),
          dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
        ],
      },
    });

    const preview = await projectData.buildMediaGenerationPreview({
      homeDir,
      specId: spec.id,
    });

    expect(preview.references.map((reference) => reference.providerToken)).toEqual([
      '@Image1',
      '@Image2',
      '@Audio1',
    ]);
    expect(preview.providerPreview?.providerTokenOrder).toEqual([
      '@Image1',
      '@Image2',
      '@Audio1',
    ]);
    expect(preview.configuration.sections.map((section) => section.key)).toEqual([
      'model',
      'model-inputs',
    ]);
  });

  it('shows model configuration in draft final video previews', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      takeId: written.take.takeId,
    });

    const preview = await projectData.buildDraftMediaGenerationPreview({
      homeDir,
      spec: {
        purpose: 'shot.video-take',
        target: context.target,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        prompt: 'One continuous video take over the ruined city.',
        parameterValues: { duration: '5' },
        inputs: [],
      },
    });

    const modelSection = preview.configuration.sections.find(
      (section) => section.key === 'model'
    );

    expect(preview.generationSpecId).toBe(
      `draft:shot.video-take:sceneShotVideoTake:${context.target.id}`
    );
    expect(preview.configuration.sections.map((section) => section.key)).toEqual([
      'model',
      'model-inputs',
    ]);
    expect(modelSection?.label).toBe('Model');
    expect(modelSection?.rows.map((row) => row.key)).toEqual([
      'model',
      'inputMode',
      'providerRoute',
    ]);
    expect(modelSection?.rows[0]).toMatchObject({
      label: 'Model',
      value: 'fal-ai/kling-video/v3/pro',
    });
    expect(typeof modelSection?.rows[0]?.valueLabel).toBe('string');
  });
});

function approvalArtifactKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.keys(value).filter((key) => /approval/i.test(key));
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
    subjectId: assetFileId,
    providerReferenceRole: 'audio-reference' as const,
  };
}

function imageInput(
  kind: 'first-frame' | 'video-prompt-sheet' | 'location-sheet',
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
    subjectKind: 'shot' as const,
    subjectId: 'shot_001',
  };
}

function elementVideoInput(elementId: string, projectRelativePath: string) {
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
