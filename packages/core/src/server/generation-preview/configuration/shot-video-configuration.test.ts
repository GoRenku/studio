import { describe, expect, it } from 'vitest';
import type {
  ProjectRelativePath,
  SceneShotVideoTakeTarget,
  ShotVideoTakeOutputGenerationSpec,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import type { ShotVideoTakeProviderPlan } from '../../media-generation/purposes/shot-video-take/provider/provider-payloads.js';
import { buildShotVideoTakePreviewConfiguration } from './shot-video-configuration.js';

describe('shot video take preview configuration', () => {
  it('builds final video rows from route parameters and omits media inputs', () => {
    const configuration = buildShotVideoTakePreviewConfiguration({
      spec: finalSpec(),
      context: productionContext(),
      plan: providerPlan(),
      modelLabel: 'Kling 3.0 Pro',
    });

    expect(row(configuration, 'model')).toMatchObject({
      label: 'Model',
      value: 'fal-ai/kling-video/v3/pro',
      valueLabel: 'Kling 3.0 Pro',
    });
    expect(row(configuration, 'inputMode')).toMatchObject({
      label: 'Input mode',
      value: 'first-frame',
    });
    expect(row(configuration, 'providerRoute')).toMatchObject({
      label: 'Provider route',
      value: 'kling-video/v3/pro/image-to-video',
    });
    expect(row(configuration, 'duration')).toMatchObject({
      value: '5',
      source: 'spec',
      presentation: 'parameter-control',
      providerField: 'duration',
    });
    expect(row(configuration, 'generate_audio')).toMatchObject({
      value: true,
      source: 'spec',
      presentation: 'parameter-control',
      providerField: 'generate_audio',
    });
    expect(allRowKeys(configuration)).not.toContain('prompt');
    expect(allRowKeys(configuration)).not.toContain('image_url');
    expect(allRowKeys(configuration)).not.toContain('image_urls');
    expect(allRowKeys(configuration)).not.toContain('audio_url');
    expect(allRowLabels(configuration)).not.toContain(`Reference ${'count'}`);
  });
});

function finalSpec(): ShotVideoTakeOutputGenerationSpec {
  return {
    purpose: 'shot.video-take',
    target: target(),
    inputModeId: 'first-frame',
    modelChoice: 'fal-ai/kling-video/v3/pro',
    prompt: 'Create a final shot video.',
    parameterValues: {
      duration: '5',
      generate_audio: true,
    },
    inputs: [
      {
        kind: 'first-frame',
        assetId: 'asset_first_frame',
        assetFileId: 'asset_file_first_frame',
        role: 'first_frame',
        mediaKind: 'image',
        projectRelativePath: 'generated/shot/start.png' as ProjectRelativePath,
        subjectKind: 'shot',
        subjectId: 'shot_001',
      },
    ],
  };
}

function productionContext(): ShotVideoTakeProductionContext {
  return {
    purpose: 'shot.video-take',
    target: target(),
    project: {
      id: 'project_001',
      name: 'test-project',
      title: 'Test Project',
      aspectRatio: '16:9',
    },
    scene: {
      id: 'scene_001',
      title: 'Scene 1',
      setting: { timeOfDay: 'day', locationIds: [] },
      storyFunction: [],
    },
    shotList: {
      id: 'shot_list_001',
      title: 'Shot List',
      summary: 'One shot.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
    },
    shotGroupMode: 'single-shot',
    shots: [
      {
        shotId: 'shot_001',
        title: 'Shot 1',
        storyBeat: 'A beat.',
        narrativePurpose: 'Establish the moment.',
        description: 'A test shot.',
        shotType: 'medium-shot',
        aspectRatio: '16:9',
        subject: 'Ada',
        action: 'Looks up.',
        dialogue: [],
        coveredBlockIndexes: [],
        castMemberIds: [],
        locationIds: [],
      },
    ],
    displayShots: [],
    selectedCast: [],
    selectedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    mediaInputs: [],
    defaults: {
      inputModeId: 'first-frame',
      imageDependencyModelChoice: 'fal-ai/openai/gpt-image-2',
      parameterValues: {
        duration: '5',
        generate_audio: false,
      },
    },
    take: {
      takeId: 'take_001',
      sceneId: 'scene_001',
      sourceShotListId: 'shot_list_001',
      title: 'Take 1',
      shotIds: ['shot_001'],
      picked: false,
      video: null,
      state: {
        version: 2,
        structure: {
          mode: 'continuous',
          sharedDirection: {},
        },
        production: {
          parameterValues: {
            duration: '5',
            generate_audio: true,
          },
        },
      },
      status: {
        editability: {
          state: 'editable',
          diagnostics: [],
          message: 'Editable.',
        },
        resolvability: {
          state: 'resolvable',
          diagnostics: [],
          message: 'Resolvable.',
        },
        runnability: {
          state: 'not-evaluated',
          diagnostics: [],
          message: 'Not evaluated.',
        },
        archive: {
          state: 'active',
          message: 'Active.',
        },
        history: {
          differences: [],
          message: 'Current.',
        },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    resourceKeys: [],
  };
}

function providerPlan(): ShotVideoTakeProviderPlan {
  return {
    provider: 'fal-ai',
    model: 'kling-video/v3/pro/image-to-video',
    mode: 'image-to-video',
    outputCount: 1,
    inputFiles: [
      {
        field: 'image_url',
        projectRelativePath: 'generated/shot/start.png' as ProjectRelativePath,
        mediaKind: 'image',
        required: true,
      },
    ],
    payload: {
      prompt: 'Create a final shot video.',
      image_url: 'renku-input://generated/shot/start.png',
      duration: '5',
      generate_audio: true,
    },
  };
}

function target(): SceneShotVideoTakeTarget {
  return {
    kind: 'sceneShotVideoTake',
    id: 'scene_001:take_001',
    sceneId: 'scene_001',
    takeId: 'take_001',
    shotIds: ['shot_001'],
  };
}

function row(
  configuration: ReturnType<typeof buildShotVideoTakePreviewConfiguration>,
  key: string
) {
  const match = configuration.sections
    .flatMap((section) => section.rows)
    .find((row) => row.key === key);
  expect(match).toBeTruthy();
  return match;
}

function allRowKeys(
  configuration: ReturnType<typeof buildShotVideoTakePreviewConfiguration>
): string[] {
  return configuration.sections.flatMap((section) =>
    section.rows.map((row) => row.key)
  );
}

function allRowLabels(
  configuration: ReturnType<typeof buildShotVideoTakePreviewConfiguration>
): string[] {
  return configuration.sections.flatMap((section) =>
    section.rows.map((row) => row.label)
  );
}
