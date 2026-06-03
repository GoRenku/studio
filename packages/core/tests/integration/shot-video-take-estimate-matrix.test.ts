import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  listShotVideoModelFamilies,
  type ShotVideoTakeIntent,
  type ShotVideoTakeModelChoice,
} from '@gorenku/studio-engines';
import type {
  SceneShotListDocument,
  ShotVideoTakeParameterValues,
  ShotVideoTakePreparedInput,
  ShotVideoTakeRequestedInput,
} from '../../src/client/scene-shot-list.js';
import type { ShotVideoTakeAvailableInput } from '../../src/client/media-generation.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../src/server/index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../src/server/testing/project-data-fixtures.js';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

interface SampleIds {
  sceneId: string;
  castMemberId: string;
  locationId: string;
}

interface EstimateMatrixCase {
  label: string;
  modelChoice: ShotVideoTakeModelChoice;
  intentId: ShotVideoTakeIntent;
  providerModel: string;
  parameterValues: ShotVideoTakeParameterValues;
  expectedRouteSettings: ShotVideoTakeParameterValues;
  expectedBillableUnits: ShotVideoTakeParameterValues;
  expectedCostUsd: number;
}

interface MatrixProjectSetup {
  ids: SampleIds;
  singleShotListId: string;
  multiShotListId: string;
  activeLookbookId: string | null;
  preparedInputs: {
    firstFrame: ShotVideoTakePreparedInput;
    lastFrame: ShotVideoTakePreparedInput;
    storyboard: ShotVideoTakePreparedInput;
    referenceBundle: ShotVideoTakePreparedInput[];
  };
}

const ESTIMATE_MATRIX: EstimateMatrixCase[] = [
  seedanceCase('text-only', 'bytedance/seedance-2.0/text-to-video'),
  seedanceCase('first-frame', 'bytedance/seedance-2.0/image-to-video'),
  seedanceCase('first-last-frame', 'bytedance/seedance-2.0/image-to-video'),
  seedanceCase('reference', 'bytedance/seedance-2.0/reference-to-video'),
  seedanceCase('multi-shot', 'bytedance/seedance-2.0/reference-to-video'),
  klingCase('text-only', 'kling-video/v3/pro/text-to-video'),
  klingCase('first-frame', 'kling-video/v3/pro/image-to-video'),
  klingCase('first-last-frame', 'kling-video/v3/pro/image-to-video'),
  klingCase('multi-shot', 'kling-video/v3/pro/text-to-video'),
  veoCase('text-only', 'veo3.1', 1.2),
  veoCase('first-frame', 'veo3.1/image-to-video', 3.2),
  veoCase('first-last-frame', 'veo3.1/first-last-frame-to-video', 3.2),
  veoCase('reference', 'veo3.1/reference-to-video', 3.2),
  grokCase(),
  ltxCase('text-only', 'ltx-2.3/text-to-video'),
  ltxCase('first-frame', 'ltx-2.3/image-to-video'),
  ltxCase('first-last-frame', 'ltx-2.3/image-to-video'),
  happyHorseCase('text-only', 'alibaba/happy-horse/text-to-video'),
  happyHorseCase('first-frame', 'alibaba/happy-horse/image-to-video'),
  happyHorseCase('reference', 'alibaba/happy-horse/reference-to-video'),
];

describe('shot video take estimate integration matrix', () => {
  let homeDir: string;
  let projectData: ProjectDataService;
  let setup: MatrixProjectSetup;

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-shot-video-estimate-matrix-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
    setup = await createMatrixProjectSetup(projectData, homeDir);
  });

  it('covers every current shot video model route exposed by the engines catalog', () => {
    const catalogRouteKeys = listShotVideoModelFamilies()
      .flatMap((family) =>
        family.routes.map((route) => routeKey(family.choice, route.intent))
      )
      .sort();
    const matrixRouteKeys = ESTIMATE_MATRIX.map((entry) =>
      routeKey(entry.modelChoice, entry.intentId)
    ).sort();

    expect(matrixRouteKeys).toEqual(catalogRouteKeys);
  });

  it.each(ESTIMATE_MATRIX)('$label estimates final video creation only', async (entry) => {
    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: setup.ids.sceneId,
      shotListId: shotListIdForIntent(entry.intentId, setup),
      shotIds: shotIdsForIntent(entry.intentId),
      production: {
        intentId: entry.intentId,
        modelChoice: entry.modelChoice,
        parameterValues: entry.parameterValues,
        preparedInputs: preparedInputsForIntent(entry.intentId, setup),
        requestedInputs: requestedInputsForIntent(entry.intentId, setup),
      },
    });

    expect(estimate.issues).toEqual([]);
    expect(estimate.plan?.lines.filter((line) => line.kind === 'dependency-generation')).toEqual([]);
    expect(estimate.plan?.request.routeSettings).toEqual(entry.expectedRouteSettings);
    expect(estimate.estimate).toMatchObject({
      provider: 'fal-ai',
      model: entry.providerModel,
      warnings: [],
      billableUnits: entry.expectedBillableUnits,
    });
    expect(estimate.estimate?.estimatedCostUsd).toBeCloseTo(
      entry.expectedCostUsd,
      6
    );
    expect(estimate.plan?.estimate.estimatedTotalUsd).toBeCloseTo(
      entry.expectedCostUsd,
      6
    );

    const finalLine = estimate.plan?.lines.find(
      (line) => line.kind === 'final-video-generation'
    );
    expect(finalLine?.pricing.state).toBe('priced');
    if (finalLine?.pricing.state !== 'priced') {
      throw new Error(`Expected a priced final line for ${entry.label}.`);
    }
    expect(finalLine.pricing.estimatedUsd).toBeCloseTo(
      entry.expectedCostUsd,
      6
    );
  });
});

function seedanceCase(
  intentId: ShotVideoTakeIntent,
  providerModel: string
): EstimateMatrixCase {
  return {
    label: `Seedance 2.0 ${intentId}`,
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    intentId,
    providerModel,
    parameterValues: {
      duration: 9,
      aspect_ratio: '16:9',
      resolution: '720p',
      generate_audio: true,
    },
    expectedRouteSettings: {
      duration: '9',
      aspect_ratio: '16:9',
      resolution: '720p',
      generate_audio: true,
      seed: null,
    },
    expectedBillableUnits: {
      duration: '9',
      aspect_ratio: '16:9',
      resolution: '720p',
    },
    expectedCostUsd: 3.402,
  };
}

function klingCase(
  intentId: ShotVideoTakeIntent,
  providerModel: string
): EstimateMatrixCase {
  const hasAspectRatio = intentId === 'text-only' || intentId === 'multi-shot';
  const routeSettings = {
    duration: '9',
    ...(hasAspectRatio ? { aspect_ratio: '16:9' } : {}),
    generate_audio: true,
    cfg_scale: 0.5,
  };
  return {
    label: `Kling 3.0 ${intentId}`,
    modelChoice: 'fal-ai/kling-video/v3/pro',
    intentId,
    providerModel,
    parameterValues: routeSettings,
    expectedRouteSettings: routeSettings,
    expectedBillableUnits: {
      duration: '9',
      generate_audio: true,
    },
    expectedCostUsd: 1.512,
  };
}

function veoCase(
  intentId: ShotVideoTakeIntent,
  providerModel: string,
  expectedCostUsd: number
): EstimateMatrixCase {
  let routeSettings: ShotVideoTakeParameterValues;
  if (intentId === 'reference') {
    routeSettings = {
      auto_fix: false,
      duration: '8s',
      generate_audio: true,
      resolution: '720p',
    };
  } else {
    routeSettings = {
      duration: '8s',
      aspect_ratio: '16:9',
      resolution: '720p',
      generate_audio: true,
      auto_fix: intentId === 'text-only',
    };
  }
  return {
    label: `Veo 3.1 ${intentId}`,
    modelChoice: 'fal-ai/veo3.1',
    intentId,
    providerModel,
    parameterValues: routeSettings,
    expectedRouteSettings: routeSettings,
    expectedBillableUnits: {
      duration: '8s',
      generate_audio: true,
    },
    expectedCostUsd,
  };
}

function grokCase(): EstimateMatrixCase {
  return {
    label: 'XAI Grok Imagine Video 1.5 first-frame',
    modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
    intentId: 'first-frame',
    providerModel: 'xai/grok-imagine-video/v1.5/image-to-video',
    parameterValues: {
      duration: 9,
      resolution: '720p',
    },
    expectedRouteSettings: {
      duration: 9,
      resolution: '720p',
    },
    expectedBillableUnits: {
      duration: 9,
      resolution: '720p',
    },
    expectedCostUsd: 1.27,
  };
}

function ltxCase(
  intentId: ShotVideoTakeIntent,
  providerModel: string
): EstimateMatrixCase {
  const routeSettings = {
    duration: 8,
    aspect_ratio: '16:9',
    generate_audio: true,
    resolution: '1080p',
    fps: 25,
  };
  return {
    label: `LTX 3.2 ${intentId}`,
    modelChoice: 'fal-ai/ltx-3.2',
    intentId,
    providerModel,
    parameterValues: routeSettings,
    expectedRouteSettings: routeSettings,
    expectedBillableUnits: {
      duration: 8,
      resolution: '1080p',
    },
    expectedCostUsd: 0.48,
  };
}

function happyHorseCase(
  intentId: ShotVideoTakeIntent,
  providerModel: string
): EstimateMatrixCase {
  const hasAspectRatio = intentId === 'text-only' || intentId === 'reference';
  const routeSettings = {
    ...(hasAspectRatio ? { aspect_ratio: '16:9' } : {}),
    enable_safety_checker: true,
    seed: null,
    resolution: '1080p',
    duration: 9,
  };
  return {
    label: `Alibaba Happy Horse ${intentId}`,
    modelChoice: 'fal-ai/alibaba/happy-horse',
    intentId,
    providerModel,
    parameterValues: routeSettings,
    expectedRouteSettings: routeSettings,
    expectedBillableUnits: {
      duration: 9,
      resolution: '1080p',
    },
    expectedCostUsd: 2.52,
  };
}

async function createMatrixProjectSetup(
  projectData: ProjectDataService,
  homeDir: string
): Promise<MatrixProjectSetup> {
  const ids = await sampleIds(projectData, homeDir);
  const shotListIds = createDeterministicIdGenerator();
  const singleShotList = await writeShotList(projectData, homeDir, ids, 1, shotListIds);
  const multiShotList = await writeShotList(projectData, homeDir, ids, 2, shotListIds);
  await writeProjectFile(projectData, homeDir, 'generated/media/first-frame.png', 'first frame');
  await writeProjectFile(projectData, homeDir, 'generated/media/last-frame.png', 'last frame');
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/multi-shot-storyboard.png',
    'multi-shot storyboard'
  );
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/reference-bundle.png',
    'reference bundle image'
  );

  const firstFrame = await projectData.importShotFirstFrame({
    homeDir,
    sceneId: ids.sceneId,
    shotListId: singleShotList.shotList.id,
    shotIds: ['shot_001'],
    sourceProjectRelativePath: 'generated/media/first-frame.png',
  });
  const lastFrame = await projectData.importShotLastFrame({
    homeDir,
    sceneId: ids.sceneId,
    shotListId: singleShotList.shotList.id,
    shotIds: ['shot_001'],
    sourceProjectRelativePath: 'generated/media/last-frame.png',
  });
  const storyboard = await projectData.importShotMultiShotStoryboardSheet({
    homeDir,
    sceneId: ids.sceneId,
    shotListId: multiShotList.shotList.id,
    shotIds: ['shot_001', 'shot_002'],
    sourceProjectRelativePath: 'generated/media/multi-shot-storyboard.png',
  });
  const referenceImage = await projectData.importCastCharacterSheetMedia({
    homeDir,
    castMemberId: ids.castMemberId,
    sourceProjectRelativePath: 'generated/media/reference-bundle.png',
  });
  const referenceFile = referenceImage.imported.files[0];
  if (!referenceFile) {
    throw new Error('Expected imported reference image to have a primary file.');
  }
  const context = await projectData.buildShotVideoTakeContext({
    homeDir,
    sceneId: ids.sceneId,
    shotListId: singleShotList.shotList.id,
    shotIds: ['shot_001'],
  });
  const referenceBundle: ShotVideoTakePreparedInput[] = [
    {
      kind: 'character-sheet',
      assetId: referenceImage.imported.assetId,
      assetFileId: referenceFile.id,
      subjectKind: 'cast-member',
      subjectId: ids.castMemberId,
    },
    {
      kind: 'location-sheet',
      assetId: referenceImage.imported.assetId,
      assetFileId: referenceFile.id,
      subjectKind: 'location',
      subjectId: ids.locationId,
    },
    ...(context.activeLookbook
      ? [
          {
            kind: 'reference-image' as const,
            assetId: referenceImage.imported.assetId,
            assetFileId: referenceFile.id,
            subjectKind: 'lookbook' as const,
            subjectId: context.activeLookbook.id,
          },
        ]
      : []),
  ];

  return {
    ids,
    singleShotListId: singleShotList.shotList.id,
    multiShotListId: multiShotList.shotList.id,
    activeLookbookId: context.activeLookbook?.id ?? null,
    preparedInputs: {
      firstFrame: preparedInputFromImported(firstFrame.input),
      lastFrame: preparedInputFromImported(lastFrame.input),
      storyboard: preparedInputFromImported(storyboard.input),
      referenceBundle,
    },
  };
}

async function sampleIds(
  projectData: ProjectDataService,
  homeDir: string
): Promise<SampleIds> {
  const screenplay = await projectData.readScreenplay({ homeDir });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return {
    sceneId: scene.id as string,
    castMemberId: screenplay.screenplay!.cast[1]!.id as string,
    locationId: screenplay.screenplay!.locations[0]!.id as string,
  };
}

async function writeShotList(
  projectData: ProjectDataService,
  homeDir: string,
  ids: SampleIds,
  shotCount: number,
  idGenerator = createDeterministicIdGenerator()
) {
  return projectData.writeSceneShotList({
    homeDir,
    document: sampleShotList(ids, shotCount),
    idGenerator,
  });
}

async function writeProjectFile(
  projectData: ProjectDataService,
  homeDir: string,
  projectRelativePath: string,
  contents: string
): Promise<void> {
  const project = await projectData.readCurrentProject({ homeDir });
  if (!project) {
    throw new Error('Expected current project to exist.');
  }
  const absolutePath = path.join(project.projectFolder, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents);
}

function preparedInputFromImported(
  input: ShotVideoTakeAvailableInput
): ShotVideoTakePreparedInput {
  return {
    kind: input.kind,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
  };
}

function preparedInputsForIntent(
  intentId: ShotVideoTakeIntent,
  setup: MatrixProjectSetup
): ShotVideoTakePreparedInput[] {
  if (intentId === 'first-frame') {
    return [setup.preparedInputs.firstFrame];
  }
  if (intentId === 'first-last-frame') {
    return [setup.preparedInputs.firstFrame, setup.preparedInputs.lastFrame];
  }
  if (intentId === 'multi-shot') {
    return [setup.preparedInputs.storyboard];
  }
  if (intentId === 'reference') {
    return setup.preparedInputs.referenceBundle;
  }
  return [];
}

function requestedInputsForIntent(
  intentId: ShotVideoTakeIntent,
  setup: MatrixProjectSetup
): ShotVideoTakeRequestedInput[] {
  if (intentId !== 'reference') {
    return [];
  }
  return [
    {
      kind: 'character-sheet',
      subjectKind: 'cast-member',
      subjectId: setup.ids.castMemberId,
    },
    {
      kind: 'location-sheet',
      subjectKind: 'location',
      subjectId: setup.ids.locationId,
    },
    ...(setup.activeLookbookId
      ? [
          {
            kind: 'reference-image' as const,
            subjectKind: 'lookbook' as const,
            subjectId: setup.activeLookbookId,
          },
        ]
      : []),
  ];
}

function shotIdsForIntent(intentId: ShotVideoTakeIntent): string[] {
  return intentId === 'multi-shot' ? ['shot_001', 'shot_002'] : ['shot_001'];
}

function shotListIdForIntent(
  intentId: ShotVideoTakeIntent,
  setup: MatrixProjectSetup
): string {
  return intentId === 'multi-shot'
    ? setup.multiShotListId
    : setup.singleShotListId;
}

function routeKey(
  modelChoice: ShotVideoTakeModelChoice,
  intentId: ShotVideoTakeIntent
): string {
  return `${modelChoice}:${intentId}`;
}

function sampleShotList(ids: SampleIds, shotCount: number): SceneShotListDocument {
  const baseShot = {
    title: 'Walls in smoke',
    storyBeat: 'The defenders lose the line of sight as the cannon smoke spreads.',
    narrativePurpose: 'Establish the bombardment as a physical and psychological force.',
    description: 'Wide static shot of a city wall half swallowed by smoke.',
    shotType: 'wide',
    cameraAngle: 'eye level',
    cameraMovement: 'static',
    framing: 'layered wall and smoke composition',
    lensIntent: 'moderate wide lens feel',
    subject: 'Mehmed watches the wall through drifting smoke.',
    action: 'Mehmed studies the impact zone in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
    audioNotes: 'Distant stone impacts and low smoke movement.',
    productionNotes: 'Keep the frame austere and heavy.',
  };
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Bombardment coverage',
    summary: 'A compact coverage plan for final video take estimation.',
    coverageStrategy:
      'Use composed, legible shots that exercise every video generation route.',
    lookbookInfluence: 'Use the project aspect ratio unless a shot specifies otherwise.',
    shots: Array.from({ length: shotCount }, (_, index) => ({
      ...baseShot,
      shotId: `shot_${String(index + 1).padStart(3, '0')}`,
      title: index === 0 ? baseShot.title : `Walls in smoke alternate ${index + 1}`,
    })),
  };
}
