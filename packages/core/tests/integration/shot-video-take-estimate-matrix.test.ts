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
  expectedMissingDependencyCostUsd: number;
  expectedMissingDependencyLineCount: number;
}

interface RunSetupPricingPermutationCase {
  label: string;
  modelChoice: ShotVideoTakeModelChoice;
  intentId: ShotVideoTakeIntent;
  providerModel: string;
  parameterValues: ShotVideoTakeParameterValues;
  expectedRouteSettings: ShotVideoTakeParameterValues;
  expectedBillableUnits: ShotVideoTakeParameterValues;
  expectedFinalCostUsd: number;
  expectedDependencyCostUsd: number;
  expectedDependencyLineCount: number;
  expectedTotalCostUsd: number;
}

const GPT_IMAGE_2_LOW_1024_BY_768_COST_USD = 0.005;
const GPT_IMAGE_2_MEDIUM_1024_BY_768_COST_USD = 0.037;
const GPT_IMAGE_2_MEDIUM_1920_BY_1080_COST_USD = 0.04;
const FIRST_FRAME_DEPENDENCY_COST_USD = GPT_IMAGE_2_LOW_1024_BY_768_COST_USD;
const LAST_FRAME_DEPENDENCY_COST_USD = GPT_IMAGE_2_LOW_1024_BY_768_COST_USD;
const MULTI_SHOT_STORYBOARD_DEPENDENCY_COST_USD = GPT_IMAGE_2_LOW_1024_BY_768_COST_USD;
const REFERENCE_BUNDLE_DEPENDENCY_COST_USD =
  GPT_IMAGE_2_MEDIUM_1920_BY_1080_COST_USD +
  GPT_IMAGE_2_MEDIUM_1024_BY_768_COST_USD +
  GPT_IMAGE_2_MEDIUM_1920_BY_1080_COST_USD;

const RUN_SETUP_PRICING_PERMUTATIONS: RunSetupPricingPermutationCase[] = [
  ...seedanceRunSetupPricingPermutations(),
  ...klingRunSetupPricingPermutations(),
  ...veoRunSetupPricingPermutations(),
  ...grokRunSetupPricingPermutations(),
  ...ltxRunSetupPricingPermutations(),
  ...happyHorseRunSetupPricingPermutations(),
];

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

  it.each(ESTIMATE_MATRIX)('$label keeps a numeric graph estimate before dependencies exist', async (entry) => {
    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: setup.ids.sceneId,
      shotListId: shotListIdForIntent(entry.intentId, setup),
      shotIds: shotIdsForIntent(entry.intentId),
      production: {
        intentId: entry.intentId,
        modelChoice: entry.modelChoice,
        parameterValues: entry.parameterValues,
      },
    });

    expect(estimate.issues).toEqual([]);
    expect(estimate.plan?.estimate.estimatedTotalUsd).toEqual(expect.any(Number));
    expect(estimate.plan!.estimate.estimatedTotalUsd).toBeCloseTo(
      entry.expectedCostUsd + entry.expectedMissingDependencyCostUsd,
      6
    );
    expect(estimate.plan?.estimate.requiresPriceOverride).toBe(false);
    expect(
      estimate.plan?.lines.filter((line) => line.kind === 'dependency-generation')
    ).toHaveLength(entry.expectedMissingDependencyLineCount);
    expect(estimate.plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'final-video-generation',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
  });

  it.each(RUN_SETUP_PRICING_PERMUTATIONS)(
    '$label prices the unprepared UI state from the real dependency graph',
    async (entry) => {
      const estimate = await projectData.estimateShotVideoTakeProduction({
        homeDir,
        sceneId: setup.ids.sceneId,
        shotListId: shotListIdForIntent(entry.intentId, setup),
        shotIds: shotIdsForIntent(entry.intentId),
        production: {
          intentId: entry.intentId,
          modelChoice: entry.modelChoice,
          parameterValues: entry.parameterValues,
        },
      });

      expect(estimate.issues).toEqual([]);
      expect(estimate.plan?.request.routeSettings).toEqual(entry.expectedRouteSettings);
      expect(estimate.estimate).toMatchObject({
        provider: 'fal-ai',
        model: entry.providerModel,
        warnings: [],
        billableUnits: entry.expectedBillableUnits,
      });
      expect(estimate.estimate?.estimatedCostUsd).toBeCloseTo(
        entry.expectedFinalCostUsd,
        6
      );
      expect(estimate.plan?.estimate.estimatedTotalUsd).toBeCloseTo(
        entry.expectedTotalCostUsd,
        6
      );
      const dependencyLines = estimate.plan?.lines.filter(
        (line) => line.kind === 'dependency-generation'
      ) ?? [];
      expect(dependencyLines).toHaveLength(entry.expectedDependencyLineCount);
      const dependencyTotal = dependencyLines.reduce((sum, line) => {
        return line.pricing.state === 'priced' ? sum + line.pricing.estimatedUsd : sum;
      }, 0);
      expect(dependencyTotal).toBeCloseTo(entry.expectedDependencyCostUsd, 6);
      const finalLine = estimate.plan?.lines.find(
        (line) => line.kind === 'final-video-generation'
      );
      expect(finalLine?.pricing.state).toBe('priced');
      if (finalLine?.pricing.state !== 'priced') {
        throw new Error(`Expected a priced final line for ${entry.label}.`);
      }
      expect(finalLine.pricing.estimatedUsd).toBeCloseTo(
        entry.expectedFinalCostUsd,
        6
      );
    }
  );
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
    expectedMissingDependencyCostUsd: missingDependencyCostForRoute({ intentId, providerModel }),
    expectedMissingDependencyLineCount: missingDependencyLineCountForRoute({ intentId, providerModel }),
  };
}

function seedanceRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedFinalCosts = [
    { resolution: '480p' as const, aspectRatio: '21:9', expectedFinalCostUsd: 1.323 },
    { resolution: '480p' as const, aspectRatio: '16:9', expectedFinalCostUsd: 1.00760625 },
    { resolution: '480p' as const, aspectRatio: '4:3', expectedFinalCostUsd: 0.756 },
    { resolution: '480p' as const, aspectRatio: '1:1', expectedFinalCostUsd: 0.567 },
    { resolution: '480p' as const, aspectRatio: '3:4', expectedFinalCostUsd: 0.42525 },
    { resolution: '480p' as const, aspectRatio: '9:16', expectedFinalCostUsd: 0.3189375 },
    { resolution: '720p' as const, aspectRatio: '21:9', expectedFinalCostUsd: 2.97675 },
    { resolution: '720p' as const, aspectRatio: '16:9', expectedFinalCostUsd: 2.268 },
    { resolution: '720p' as const, aspectRatio: '4:3', expectedFinalCostUsd: 1.701 },
    { resolution: '720p' as const, aspectRatio: '1:1', expectedFinalCostUsd: 1.27575 },
    { resolution: '720p' as const, aspectRatio: '3:4', expectedFinalCostUsd: 0.9568125 },
    { resolution: '720p' as const, aspectRatio: '9:16', expectedFinalCostUsd: 0.717609375 },
  ];
  const routeCases = [
    {
      intentId: 'text-only' as const,
      providerModel: 'bytedance/seedance-2.0/text-to-video',
    },
    {
      intentId: 'first-frame' as const,
      providerModel: 'bytedance/seedance-2.0/image-to-video',
    },
    {
      intentId: 'first-last-frame' as const,
      providerModel: 'bytedance/seedance-2.0/image-to-video',
    },
    {
      intentId: 'reference' as const,
      providerModel: 'bytedance/seedance-2.0/reference-to-video',
    },
    {
      intentId: 'multi-shot' as const,
      providerModel: 'bytedance/seedance-2.0/reference-to-video',
    },
  ];
  return routeCases.flatMap((routeCase) =>
    expectedFinalCosts.map((costCase): RunSetupPricingPermutationCase => {
        const expectedRouteSettings = {
          duration: String(duration),
          aspect_ratio: costCase.aspectRatio,
          resolution: costCase.resolution,
          generate_audio: true,
          seed: null,
        };
        const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
        return {
          label: `${routeCase.intentId} Seedance 2.0 ${duration}s ${costCase.resolution} ${costCase.aspectRatio}`,
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          intentId: routeCase.intentId,
          providerModel: routeCase.providerModel,
          parameterValues: {
            duration,
            aspect_ratio: costCase.aspectRatio,
            resolution: costCase.resolution,
            generate_audio: true,
          },
          expectedRouteSettings,
          expectedBillableUnits: {
            duration: String(duration),
            aspect_ratio: costCase.aspectRatio,
            resolution: costCase.resolution,
          },
          expectedFinalCostUsd: costCase.expectedFinalCostUsd,
          expectedDependencyCostUsd,
          expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
          expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
        };
      })
  );
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
    expectedMissingDependencyCostUsd: missingDependencyCostForRoute({ intentId, providerModel }),
    expectedMissingDependencyLineCount: missingDependencyLineCountForRoute({ intentId, providerModel }),
  };
}

function klingRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedFinalCosts = [
    { generateAudio: true, expectedFinalCostUsd: 1.008 },
    { generateAudio: false, expectedFinalCostUsd: 0.672 },
  ];
  const routeCases = [
    {
      intentId: 'text-only' as const,
      providerModel: 'kling-video/v3/pro/text-to-video',
      hasAspectRatio: true,
    },
    {
      intentId: 'first-frame' as const,
      providerModel: 'kling-video/v3/pro/image-to-video',
      hasAspectRatio: false,
    },
    {
      intentId: 'first-last-frame' as const,
      providerModel: 'kling-video/v3/pro/image-to-video',
      hasAspectRatio: false,
    },
    {
      intentId: 'multi-shot' as const,
      providerModel: 'kling-video/v3/pro/text-to-video',
      hasAspectRatio: true,
    },
  ];
  return routeCases.flatMap((routeCase) =>
    expectedFinalCosts.map((costCase): RunSetupPricingPermutationCase => {
      const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
      const expectedRouteSettings = {
        duration: String(duration),
        ...(routeCase.hasAspectRatio ? { aspect_ratio: '16:9' } : {}),
        generate_audio: costCase.generateAudio,
        cfg_scale: 0.5,
      };
      return {
        label: `${routeCase.intentId} Kling 3.0 ${duration}s audio ${costCase.generateAudio ? 'on' : 'off'}`,
        modelChoice: 'fal-ai/kling-video/v3/pro',
        intentId: routeCase.intentId,
        providerModel: routeCase.providerModel,
        parameterValues: expectedRouteSettings,
        expectedRouteSettings,
        expectedBillableUnits: {
          duration: String(duration),
          generate_audio: costCase.generateAudio,
        },
        expectedFinalCostUsd: costCase.expectedFinalCostUsd,
        expectedDependencyCostUsd,
        expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
        expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
      };
    })
  );
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
    expectedMissingDependencyCostUsd: missingDependencyCostForRoute({ intentId, providerModel }),
    expectedMissingDependencyLineCount: missingDependencyLineCountForRoute({ intentId, providerModel }),
  };
}

function veoRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const routeCases = [
    {
      intentId: 'text-only' as const,
      providerModel: 'veo3.1',
      duration: '6s',
      expectedCosts: [
        { resolution: '720p' as const, generateAudio: true, expectedFinalCostUsd: 0.9 },
        { resolution: '720p' as const, generateAudio: false, expectedFinalCostUsd: 0.6 },
        { resolution: '1080p' as const, generateAudio: true, expectedFinalCostUsd: 0.9 },
        { resolution: '1080p' as const, generateAudio: false, expectedFinalCostUsd: 0.6 },
        { resolution: '4k' as const, generateAudio: true, expectedFinalCostUsd: 0.9 },
        { resolution: '4k' as const, generateAudio: false, expectedFinalCostUsd: 0.6 },
      ],
      aspectRatio: '16:9',
      autoFix: true,
    },
    {
      intentId: 'first-frame' as const,
      providerModel: 'veo3.1/image-to-video',
      duration: '6s',
      expectedCosts: [
        { resolution: '720p' as const, generateAudio: true, expectedFinalCostUsd: 2.4 },
        { resolution: '720p' as const, generateAudio: false, expectedFinalCostUsd: 1.2 },
        { resolution: '1080p' as const, generateAudio: true, expectedFinalCostUsd: 2.4 },
        { resolution: '1080p' as const, generateAudio: false, expectedFinalCostUsd: 1.2 },
      ],
      aspectRatio: '16:9',
      autoFix: false,
    },
    {
      intentId: 'first-last-frame' as const,
      providerModel: 'veo3.1/first-last-frame-to-video',
      duration: '6s',
      expectedCosts: [
        { resolution: '720p' as const, generateAudio: true, expectedFinalCostUsd: 2.4 },
        { resolution: '720p' as const, generateAudio: false, expectedFinalCostUsd: 1.2 },
        { resolution: '1080p' as const, generateAudio: true, expectedFinalCostUsd: 2.4 },
        { resolution: '1080p' as const, generateAudio: false, expectedFinalCostUsd: 1.2 },
        { resolution: '4k' as const, generateAudio: true, expectedFinalCostUsd: 2.4 },
        { resolution: '4k' as const, generateAudio: false, expectedFinalCostUsd: 1.2 },
      ],
      aspectRatio: '16:9',
      autoFix: false,
    },
    {
      intentId: 'reference' as const,
      providerModel: 'veo3.1/reference-to-video',
      duration: '8s',
      expectedCosts: [
        { resolution: '720p' as const, generateAudio: true, expectedFinalCostUsd: 3.2 },
        { resolution: '720p' as const, generateAudio: false, expectedFinalCostUsd: 1.6 },
        { resolution: '1080p' as const, generateAudio: true, expectedFinalCostUsd: 3.2 },
        { resolution: '1080p' as const, generateAudio: false, expectedFinalCostUsd: 1.6 },
      ],
      autoFix: false,
    },
  ];
  return routeCases.flatMap((routeCase) =>
    routeCase.expectedCosts.map((costCase): RunSetupPricingPermutationCase => {
        const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
        const expectedRouteSettings = {
          ...(routeCase.aspectRatio ? { aspect_ratio: routeCase.aspectRatio } : {}),
          duration: routeCase.duration,
          generate_audio: costCase.generateAudio,
          resolution: costCase.resolution,
          auto_fix: routeCase.autoFix,
        };
        return {
          label: `${routeCase.intentId} Veo 3.1 ${routeCase.duration} ${costCase.resolution} audio ${costCase.generateAudio ? 'on' : 'off'}`,
          modelChoice: 'fal-ai/veo3.1',
          intentId: routeCase.intentId,
          providerModel: routeCase.providerModel,
          parameterValues: expectedRouteSettings,
          expectedRouteSettings,
          expectedBillableUnits: {
            duration: routeCase.duration,
            generate_audio: costCase.generateAudio,
          },
          expectedFinalCostUsd: costCase.expectedFinalCostUsd,
          expectedDependencyCostUsd,
          expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
          expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
        };
      })
  );
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
    expectedMissingDependencyCostUsd: missingDependencyCostForRoute({
      intentId: 'first-frame',
      providerModel: 'xai/grok-imagine-video/v1.5/image-to-video',
    }),
    expectedMissingDependencyLineCount: missingDependencyLineCountForRoute({
      intentId: 'first-frame',
      providerModel: 'xai/grok-imagine-video/v1.5/image-to-video',
    }),
  };
}

function grokRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedCosts = [
    { resolution: '480p' as const, expectedFinalCostUsd: 0.49 },
    { resolution: '720p' as const, expectedFinalCostUsd: 0.85 },
  ];
  return expectedCosts.map((costCase): RunSetupPricingPermutationCase => {
    const routeCase = {
      intentId: 'first-frame' as const,
      providerModel: 'xai/grok-imagine-video/v1.5/image-to-video',
    };
      return {
        label: `first-frame XAI Grok Imagine Video 1.5 ${duration}s ${costCase.resolution}`,
        modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
        intentId: routeCase.intentId,
        providerModel: routeCase.providerModel,
        parameterValues: {
          duration,
          resolution: costCase.resolution,
        },
        expectedRouteSettings: {
          duration,
          resolution: costCase.resolution,
        },
        expectedBillableUnits: {
          duration,
          resolution: costCase.resolution,
          inputImageCount: 1,
        },
        expectedFinalCostUsd: costCase.expectedFinalCostUsd,
        expectedDependencyCostUsd: missingDependencyCostForRoute(routeCase),
        expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
        expectedTotalCostUsd: costCase.expectedFinalCostUsd + missingDependencyCostForRoute(routeCase),
      };
    })
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
    expectedMissingDependencyCostUsd: missingDependencyCostForRoute({ intentId, providerModel }),
    expectedMissingDependencyLineCount: missingDependencyLineCountForRoute({ intentId, providerModel }),
  };
}

function ltxRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedCosts = [
    { resolution: '1080p' as const, expectedFinalCostUsd: 0.36 },
    { resolution: '1440p' as const, expectedFinalCostUsd: 0.72 },
    { resolution: '2160p' as const, expectedFinalCostUsd: 1.44 },
  ];
  const routeCases = [
    {
      intentId: 'text-only' as const,
      providerModel: 'ltx-2.3/text-to-video',
      aspectRatio: '16:9',
    },
    {
      intentId: 'first-frame' as const,
      providerModel: 'ltx-2.3/image-to-video',
      aspectRatio: '16:9',
    },
    {
      intentId: 'first-last-frame' as const,
      providerModel: 'ltx-2.3/image-to-video',
      aspectRatio: '16:9',
    },
  ];
  return routeCases.flatMap((routeCase) =>
    expectedCosts.map((costCase): RunSetupPricingPermutationCase => {
      const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
      const expectedRouteSettings = {
        duration,
        aspect_ratio: routeCase.aspectRatio,
        generate_audio: true,
        resolution: costCase.resolution,
        fps: 25,
      };
      return {
        label: `${routeCase.intentId} LTX 3.2 ${duration}s ${costCase.resolution}`,
        modelChoice: 'fal-ai/ltx-3.2',
        intentId: routeCase.intentId,
        providerModel: routeCase.providerModel,
        parameterValues: expectedRouteSettings,
        expectedRouteSettings,
        expectedBillableUnits: {
          duration,
          resolution: costCase.resolution,
        },
        expectedFinalCostUsd: costCase.expectedFinalCostUsd,
        expectedDependencyCostUsd,
        expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
        expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
      };
    })
  );
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
    expectedMissingDependencyCostUsd: missingDependencyCostForRoute({ intentId, providerModel }),
    expectedMissingDependencyLineCount: missingDependencyLineCountForRoute({ intentId, providerModel }),
  };
}

function happyHorseRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedCosts = [
    { resolution: '720p' as const, expectedFinalCostUsd: 0.84 },
    { resolution: '1080p' as const, expectedFinalCostUsd: 1.68 },
  ];
  const routeCases = [
    {
      intentId: 'text-only' as const,
      providerModel: 'alibaba/happy-horse/text-to-video',
      hasAspectRatio: true,
    },
    {
      intentId: 'first-frame' as const,
      providerModel: 'alibaba/happy-horse/image-to-video',
      hasAspectRatio: false,
    },
    {
      intentId: 'reference' as const,
      providerModel: 'alibaba/happy-horse/reference-to-video',
      hasAspectRatio: true,
    },
  ];
  return routeCases.flatMap((routeCase) =>
    expectedCosts.map((costCase): RunSetupPricingPermutationCase => {
      const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
      const expectedRouteSettings = {
        ...(routeCase.hasAspectRatio ? { aspect_ratio: '16:9' } : {}),
        enable_safety_checker: true,
        seed: null,
        resolution: costCase.resolution,
        duration,
      };
      return {
        label: `${routeCase.intentId} Alibaba Happy Horse ${duration}s ${costCase.resolution}`,
        modelChoice: 'fal-ai/alibaba/happy-horse',
        intentId: routeCase.intentId,
        providerModel: routeCase.providerModel,
        parameterValues: expectedRouteSettings,
        expectedRouteSettings,
        expectedBillableUnits: {
          duration,
          resolution: costCase.resolution,
        },
        expectedFinalCostUsd: costCase.expectedFinalCostUsd,
        expectedDependencyCostUsd,
        expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
        expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
      };
    })
  );
}

function missingDependencyCostForRoute(input: {
  intentId: ShotVideoTakeIntent;
  providerModel: string;
}): number {
  if (input.intentId === 'first-frame') {
    return FIRST_FRAME_DEPENDENCY_COST_USD + REFERENCE_BUNDLE_DEPENDENCY_COST_USD;
  }
  if (input.intentId === 'first-last-frame') {
    return (
      FIRST_FRAME_DEPENDENCY_COST_USD +
      LAST_FRAME_DEPENDENCY_COST_USD +
      REFERENCE_BUNDLE_DEPENDENCY_COST_USD
    );
  }
  if (
    input.intentId === 'multi-shot' &&
    input.providerModel === 'bytedance/seedance-2.0/reference-to-video'
  ) {
    return MULTI_SHOT_STORYBOARD_DEPENDENCY_COST_USD + REFERENCE_BUNDLE_DEPENDENCY_COST_USD;
  }
  if (input.intentId === 'reference') {
    return REFERENCE_BUNDLE_DEPENDENCY_COST_USD;
  }
  return 0;
}

function missingDependencyLineCountForRoute(input: {
  intentId: ShotVideoTakeIntent;
  providerModel: string;
}): number {
  if (input.intentId === 'first-last-frame') {
    return 5;
  }
  if (input.intentId === 'first-frame') {
    return 4;
  }
  if (
    input.intentId === 'multi-shot' &&
    input.providerModel === 'bytedance/seedance-2.0/reference-to-video'
  ) {
    return 4;
  }
  if (input.intentId === 'reference') {
    return 3;
  }
  return 0;
}

async function createMatrixProjectSetup(
  projectData: ProjectDataService,
  homeDir: string
): Promise<MatrixProjectSetup> {
  const ids = await sampleIds(projectData, homeDir);
  const shotListIds = createDeterministicIdGenerator();
  const singleShotList = await writeShotList(projectData, homeDir, ids, 1, shotListIds);
  const multiShotList = await writeShotList(projectData, homeDir, ids, 2, shotListIds);
  const activeLookbook = await createActiveLookbook(projectData, homeDir);
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
    activeLookbookId: context.activeLookbook?.id ?? activeLookbook.lookbook.id,
    preparedInputs: {
      firstFrame: preparedInputFromImported(firstFrame.input),
      lastFrame: preparedInputFromImported(lastFrame.input),
      storyboard: preparedInputFromImported(storyboard.input),
      referenceBundle,
    },
  };
}

async function createActiveLookbook(
  projectData: ProjectDataService,
  homeDir: string
) {
  const lookbook = await projectData.createLookbook({
    projectName: 'constantinople',
    homeDir,
    name: 'Imperial Wound',
    document: lookbookDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.setActiveLookbook({
    projectName: 'constantinople',
    homeDir,
    lookbookId: lookbook.lookbook.id,
  });
  return lookbook;
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

function lookbookDocument() {
  return {
    kind: 'lookbook' as const,
    lookbook: {
      thesis: {
        statement: 'The siege image language should feel rigorous and tense.',
        principles: ['Use negative space as pressure.'],
      },
      palette: {
        description: 'Stone, smoke, and muted gold.',
        colors: [{ hex: '#8a6f2a', name: 'Wounded gold', meaning: 'Ceremony under pressure.' }],
        observations: [{ text: 'Warmth appears only where authority is strained.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'The image language stays austere and watchful.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [{ name: 'Map pressure', description: 'Maps and walls compress the frame.' }],
      },
      lighting: {
        description: 'Practical pools of warm light cut through cool rooms.',
        patterns: [{ name: 'Lamp islands', description: 'Oil lamps isolate decision makers.' }],
      },
      texture: {
        description: 'Stone, vellum, smoke, and worn metal carry texture.',
        observations: [{ text: 'Fine surface texture is visible in midtones.' }],
      },
      camera: {
        description: 'Camera grammar is patient and observant.',
        movement: [{ name: 'Slow push', description: 'Push in only when a decision hardens.' }],
        motion: [{ name: 'Held labor', description: 'Blocking moves with deliberate weight.' }],
        framing: [{ name: 'Measured distance', description: 'Close-ups are rare and earned.' }],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
