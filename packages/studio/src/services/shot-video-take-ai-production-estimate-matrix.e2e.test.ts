// @vitest-environment jsdom
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  SceneShotListDocument,
  ProjectRelativePath,
  SceneShotVideoTakeMediaInput,
  ShotVideoTakeDependencyDraft,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeParameterValues,
  ShotVideoTakePreparedInput,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeShotGroupMode,
  ShotVideoTakeRequestedInput,
} from '@gorenku/studio-core/client';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import { createProjectsRoute } from '../../server/routes/projects.js';
import {
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
} from './studio-shot-video-takes-api';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

interface SampleIds {
  sceneId: string;
  castMemberId: string;
  locationId: string;
}

interface EstimateMatrixCase {
  label: string;
  modelChoice: ShotVideoTakeModelChoice;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  providerModel: string;
  parameterValues: ShotVideoTakeParameterValues;
  expectedRouteSettings: ShotVideoTakeParameterValues;
  expectedBillableUnits: ShotVideoTakeParameterValues;
  expectedCostUsd: number;
  expectedMissingDependencyCostUsd: number;
  expectedMissingDependencyLineCount: number;
}

type EstimateMatrixCaseTemplate = Omit<
  EstimateMatrixCase,
  | 'label'
  | 'shotGroupMode'
  | 'expectedMissingDependencyCostUsd'
  | 'expectedMissingDependencyLineCount'
> & {
  label: string;
};

interface RunSetupPricingPermutationCase {
  label: string;
  modelChoice: ShotVideoTakeModelChoice;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
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
const VIDEO_PROMPT_DEPENDENCY_COST_USD = GPT_IMAGE_2_LOW_1024_BY_768_COST_USD;
const DEFAULT_CHARACTER_SHEET_DEPENDENCY_COST_USD = GPT_IMAGE_2_MEDIUM_1920_BY_1080_COST_USD;
const DEFAULT_LOOKBOOK_DEPENDENCY_COST_USD = GPT_IMAGE_2_MEDIUM_1920_BY_1080_COST_USD;
const DEFAULT_LOCATION_SHEET_DEPENDENCY_COST_USD = GPT_IMAGE_2_MEDIUM_1024_BY_768_COST_USD;
const DEFAULT_REFERENCE_CONTEXT_DEPENDENCY_COST_USD =
  DEFAULT_CHARACTER_SHEET_DEPENDENCY_COST_USD +
  DEFAULT_LOOKBOOK_DEPENDENCY_COST_USD +
  DEFAULT_LOCATION_SHEET_DEPENDENCY_COST_USD;
const DEFAULT_REFERENCE_CONTEXT_DEPENDENCY_LINE_COUNT = 3;
const REFERENCE_BUNDLE_DEPENDENCY_COST_USD =
  DEFAULT_CHARACTER_SHEET_DEPENDENCY_COST_USD +
  GPT_IMAGE_2_MEDIUM_1024_BY_768_COST_USD +
  GPT_IMAGE_2_MEDIUM_1920_BY_1080_COST_USD;
const REFERENCE_BUNDLE_DEPENDENCY_LINE_COUNT = 3;
const INPUT_MODES: ShotVideoTakeInputModeId[] = [
  'text-only',
  'first-frame',
  'first-last-frame',
  'reference',
  'source-video-reference',
];
const SHOT_GROUP_MODES: ShotVideoTakeShotGroupMode[] = ['single-shot', 'multi-shot'];

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
  singleTakeId: string;
  multiTakeId: string;
  activeLookbookId: string | null;
  preparedInputs: {
    firstFrame: ShotVideoTakePreparedInput;
    lastFrame: ShotVideoTakePreparedInput;
    multiShotFirstFrame: ShotVideoTakePreparedInput;
    multiShotLastFrame: ShotVideoTakePreparedInput;
    videoPromptSheet: ShotVideoTakePreparedInput;
    referenceBundle: ShotVideoTakePreparedInput[];
    sourceVideo: ShotVideoTakePreparedInput;
  };
}

const ESTIMATE_MATRIX: EstimateMatrixCase[] = [
  ...shotGroupCases(seedanceCase('text-only', 'bytedance/seedance-2.0/text-to-video')),
  ...shotGroupCases(seedanceCase('first-frame', 'bytedance/seedance-2.0/image-to-video')),
  ...shotGroupCases(seedanceCase('first-last-frame', 'bytedance/seedance-2.0/image-to-video')),
  ...shotGroupCases(seedanceCase('reference', 'bytedance/seedance-2.0/reference-to-video')),
  ...shotGroupCases(klingV3Case('standard', 'text-only', 'kling-video/v3/standard/text-to-video')),
  ...shotGroupCases(klingV3Case('standard', 'first-frame', 'kling-video/v3/standard/image-to-video')),
  ...shotGroupCases(klingV3Case('standard', 'first-last-frame', 'kling-video/v3/standard/image-to-video')),
  ...shotGroupCases(klingV3Case('pro', 'text-only', 'kling-video/v3/pro/text-to-video')),
  ...shotGroupCases(klingV3Case('pro', 'first-frame', 'kling-video/v3/pro/image-to-video')),
  ...shotGroupCases(klingV3Case('pro', 'first-last-frame', 'kling-video/v3/pro/image-to-video')),
  ...shotGroupCases(klingO3Case('standard', 'text-only', 'kling-video/o3/standard/text-to-video')),
  ...shotGroupCases(klingO3Case('standard', 'first-frame', 'kling-video/o3/standard/image-to-video')),
  ...shotGroupCases(klingO3Case('standard', 'first-last-frame', 'kling-video/o3/standard/image-to-video')),
  ...shotGroupCases(klingO3Case('standard', 'reference', 'kling-video/o3/standard/reference-to-video')),
  ...shotGroupCases(klingO3Case('standard', 'source-video-reference', 'kling-video/o3/standard/video-to-video/reference')),
  ...shotGroupCases(klingO3Case('pro', 'text-only', 'kling-video/o3/pro/text-to-video')),
  ...shotGroupCases(klingO3Case('pro', 'first-frame', 'kling-video/o3/pro/image-to-video')),
  ...shotGroupCases(klingO3Case('pro', 'first-last-frame', 'kling-video/o3/pro/image-to-video')),
  ...shotGroupCases(klingO3Case('pro', 'reference', 'kling-video/o3/pro/reference-to-video')),
  ...shotGroupCases(klingO3Case('pro', 'source-video-reference', 'kling-video/o3/pro/video-to-video/reference')),
  ...shotGroupCases(veoCase('text-only', 'veo3.1', 1.2)),
  ...shotGroupCases(veoCase('first-frame', 'veo3.1/image-to-video', 3.2)),
  ...shotGroupCases(veoCase('first-last-frame', 'veo3.1/first-last-frame-to-video', 3.2)),
  ...shotGroupCases(veoCase('reference', 'veo3.1/reference-to-video', 3.2)),
  ...shotGroupCases(grokCase()),
  ...shotGroupCases(ltxCase('text-only', 'ltx-2.3/text-to-video')),
  ...shotGroupCases(ltxCase('first-frame', 'ltx-2.3/image-to-video')),
  ...shotGroupCases(ltxCase('first-last-frame', 'ltx-2.3/image-to-video')),
  ...shotGroupCases(happyHorseCase('text-only', 'alibaba/happy-horse/text-to-video')),
  ...shotGroupCases(happyHorseCase('first-frame', 'alibaba/happy-horse/image-to-video')),
  ...shotGroupCases(happyHorseCase('reference', 'alibaba/happy-horse/reference-to-video')),
];

function shotGroupCases(template: EstimateMatrixCaseTemplate): EstimateMatrixCase[] {
  return SHOT_GROUP_MODES.map((shotGroupMode) => {
    const route = { ...template, shotGroupMode };
    const expectedMissingDependencyCostUsd = missingDependencyCostForRoute(route);
    return {
      ...template,
      shotGroupMode,
      label: `${shotGroupMode} ${template.label}`,
      expectedMissingDependencyCostUsd,
      expectedMissingDependencyLineCount: missingDependencyLineCountForRoute(route),
    };
  });
}

function shotGroupRouteCases<
  T extends {
    inputModeId: ShotVideoTakeInputModeId;
    providerModel: string;
  },
>(templates: T[]): Array<T & { shotGroupMode: ShotVideoTakeShotGroupMode }> {
  return templates.flatMap((template) =>
    SHOT_GROUP_MODES.map((shotGroupMode) => ({
      ...template,
      shotGroupMode,
    }))
  );
}


describe('shot video take estimate integration matrix', () => {
  const originalFetch = global.fetch;
  let homeDir: string;
  let projectData: ProjectDataService;
  let setup: MatrixProjectSetup;

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-shot-video-estimate-matrix-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createE2eMovieProject({ projectData, homeDir });
    setup = await createMatrixProjectSetup(projectData, homeDir);
    installStudioApiFetch({ projectData, homeDir });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('covers every current shot video model route exposed through the Studio API', async () => {
    const studioApiRouteKeys = await listStudioApiRouteKeys({
      projectData,
      homeDir,
      setup,
    });
    const matrixRouteKeys = ESTIMATE_MATRIX.map((entry) =>
      routeKey(entry.modelChoice, entry.inputModeId, entry.shotGroupMode)
    ).sort();

    expect(matrixRouteKeys).toEqual(studioApiRouteKeys);
  });

  it('prices first-last frame AI Production setup before any dependency prompts are drafted', async () => {
    await projectData.setActiveSceneShotList({
      homeDir,
      sceneId: setup.ids.sceneId,
      shotListId: setup.singleShotListId,
    });

    const estimate = await estimateShotVideoTakeProduction(
      'constantinople',
      setup.ids.sceneId,
      setup.singleTakeId,
      {
        inputModeId: 'first-last-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
      }
    );

    const dependencyLines = estimate.plan?.lines.filter(
      (line) => line.kind === 'dependency-generation'
    ) ?? [];
    const firstFrameLine = dependencyLines.find(
      (line) => line.dependencyKind === 'first-frame'
    );
    const lastFrameLine = dependencyLines.find(
      (line) => line.dependencyKind === 'last-frame'
    );
    const locationSheetLine = dependencyLines.find(
      (line) => line.dependencyKind === 'location-environment-sheet'
    );

    expect(estimate.issues).toEqual([]);
    expect(estimate.plan?.estimate).toMatchObject({
      state: 'complete',
      pricedLineCount: 6,
      unpricedLineCount: 0,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(estimate.plan?.estimate.estimatedTotalUsd).toBeCloseTo(2.8486, 6);
    expect(dependencyLines).toHaveLength(5);
    expect(firstFrameLine).toMatchObject({
      pricing: { state: 'priced', estimatedUsd: 0.005 },
      materializationState: 'missing-input',
    });
    expect(firstFrameLine).not.toHaveProperty('draftGenerationSpec');
    expect(lastFrameLine).toMatchObject({
      pricing: { state: 'priced', estimatedUsd: 0.005 },
      materializationState: 'missing-input',
    });
    expect(lastFrameLine).not.toHaveProperty('draftGenerationSpec');
    expect(locationSheetLine).toMatchObject({
      pricing: {
        state: 'priced',
        estimatedUsd: DEFAULT_LOCATION_SHEET_DEPENDENCY_COST_USD,
      },
      materializationState: 'generatable',
    });
    expect(estimate.plan?.finalEstimate?.estimatedCostUsd).toBeCloseTo(2.7216, 6);
    assertNoObsoleteEstimateFields(estimate);
  });

  it('serializes first-last frame pricing through the real Studio plan route before dependency prompts are drafted', async () => {
    await projectData.setActiveSceneShotList({
      homeDir,
      sceneId: setup.ids.sceneId,
      shotListId: setup.singleShotListId,
    });

    const report = await planShotVideoTakeProduction(
      'constantinople',
      setup.ids.sceneId,
      setup.singleTakeId,
      {
        inputModeId: 'first-last-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
      }
    );

    const firstFrameLine = report.plan.lines.find(
      (line) => line.dependencyKind === 'first-frame'
    );
    const lastFrameLine = report.plan.lines.find(
      (line) => line.dependencyKind === 'last-frame'
    );
    const locationSheetLine = report.plan.lines.find(
      (line) => line.dependencyKind === 'location-environment-sheet'
    );

    expect(report.diagnostics).toEqual([]);
    expect(report.plan.estimate).toMatchObject({
      state: 'complete',
      pricedLineCount: 6,
      unpricedLineCount: 0,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(report.plan.estimate.estimatedTotalUsd).toBeCloseTo(2.8486, 6);
    expect(firstFrameLine).toMatchObject({
      kind: 'dependency-generation',
      materializationState: 'missing-input',
      pricing: { state: 'priced', estimatedUsd: 0.005 },
    });
    expect(firstFrameLine).not.toHaveProperty('draftGenerationSpec');
    expect(lastFrameLine).toMatchObject({
      kind: 'dependency-generation',
      materializationState: 'missing-input',
      pricing: { state: 'priced', estimatedUsd: 0.005 },
    });
    expect(lastFrameLine).not.toHaveProperty('draftGenerationSpec');
    expect(locationSheetLine).toMatchObject({
      kind: 'dependency-generation',
      materializationState: 'generatable',
      pricing: {
        state: 'priced',
        estimatedUsd: DEFAULT_LOCATION_SHEET_DEPENDENCY_COST_USD,
      },
    });
    assertNoObsoleteEstimateFields(report);
  });

  it.each(ESTIMATE_MATRIX)('$label estimates prepared video setup', async (entry) => {
    const estimate = await estimateFromBrowserClient({
      projectData,
      homeDir,
      setup,
      entry,
      includePreparedInputs: true,
    });
    const preparedDependencyCostUsd = preparedDependencyCostForRoute(entry);

    expect(estimate.issues).toEqual([]);
    expect(
      estimate.plan?.lines.filter((line) => line.kind === 'dependency-generation')
    ).toHaveLength(preparedDependencyLineCountForRoute(entry));
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
      entry.expectedCostUsd + preparedDependencyCostUsd,
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
    assertNoObsoleteEstimateFields(estimate);
  });

  it.each(ESTIMATE_MATRIX)('$label keeps a numeric graph estimate before dependencies exist', async (entry) => {
    const estimate = await estimateFromBrowserClient({
      projectData,
      homeDir,
      setup,
      entry,
      includePreparedInputs: false,
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
    assertNoObsoleteEstimateFields(estimate);
  });

  it.each(RUN_SETUP_PRICING_PERMUTATIONS)(
    '$label prices the unprepared UI state from the real dependency inventory',
    async (entry) => {
      const estimate = await estimateFromBrowserClient({
        projectData,
        homeDir,
        setup,
        entry,
        includePreparedInputs: false,
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
      assertNoObsoleteEstimateFields(estimate);
    }
  );
});

function assertNoObsoleteEstimateFields(value: unknown): void {
  const visited = new Set<unknown>();
  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) {
      return;
    }
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    expect(candidate).not.toHaveProperty('estimateLines');
    expect(candidate).not.toHaveProperty('cost');
    Object.values(candidate).forEach(visit);
  };
  visit(value);
}

async function listStudioApiRouteKeys(input: {
  projectData: ProjectDataService;
  homeDir: string;
  setup: MatrixProjectSetup;
}): Promise<string[]> {
  const routeKeys: string[] = [];
  for (const shotGroupMode of SHOT_GROUP_MODES) {
    await input.projectData.setActiveSceneShotList({
      homeDir: input.homeDir,
      sceneId: input.setup.ids.sceneId,
      shotListId:
        shotGroupMode === 'multi-shot'
          ? input.setup.multiShotListId
          : input.setup.singleShotListId,
    });
    for (const inputModeId of INPUT_MODES) {
      const report = await readShotVideoTakeProduction(
        'constantinople',
        input.setup.ids.sceneId,
        shotGroupMode === 'multi-shot'
          ? input.setup.multiTakeId
          : input.setup.singleTakeId,
        inputModeId
      );
      routeKeys.push(
        ...report.models.models
          .filter((model) => model.available)
          .map((model) =>
            routeKey(model.modelChoice, inputModeId, shotGroupMode)
          )
      );
    }
  }
  return [...new Set(routeKeys)].sort();
}

async function estimateFromBrowserClient(input: {
  projectData: ProjectDataService;
  homeDir: string;
  setup: MatrixProjectSetup;
  entry: EstimateMatrixCase | RunSetupPricingPermutationCase;
  includePreparedInputs: boolean;
}) {
  await input.projectData.setActiveSceneShotList({
    homeDir: input.homeDir,
    sceneId: input.setup.ids.sceneId,
    shotListId: shotListIdForCase(input.entry, input.setup),
  });
  return estimateShotVideoTakeProduction(
    'constantinople',
    input.setup.ids.sceneId,
    takeIdForCase(input.entry, input.setup),
    productionForCase(input.entry, input.setup, {
      includePreparedInputs: input.includePreparedInputs,
    })
  );
}

function installStudioApiFetch(input: {
  projectData: ProjectDataService;
  homeDir: string;
}): void {
  const app = new Hono().route(
    '/studio-api/projects',
    createProjectsRoute({
      projectData: homeScopedProjectData(input.projectData, input.homeDir),
    })
  );
  (window as unknown as {
    __RENKU_STUDIO_BOOTSTRAP__?: { studioApiToken: string };
  }).__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'estimate-matrix-token' };
  global.fetch = (async (requestInfo: RequestInfo | URL, init?: RequestInit) => {
    const url =
      requestInfo instanceof Request
        ? requestInfo.url
        : requestInfo instanceof URL
          ? requestInfo.toString()
          : requestInfo;
    return app.request(url, init);
  }) as typeof fetch;
}

function homeScopedProjectData(
  projectData: ProjectDataService,
  homeDir: string
): ProjectDataService {
  return new Proxy(projectData, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]) => {
        if (args.length === 0) {
          return value.call(target);
        }
        return value.call(target, withHomeDir(args[0], homeDir), ...args.slice(1));
      };
    },
  });
}

function withHomeDir(input: unknown, homeDir: string): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }
  return { ...(input as Record<string, unknown>), homeDir };
}

function seedanceCase(
  inputModeId: ShotVideoTakeInputModeId,
  providerModel: string
): EstimateMatrixCaseTemplate {
  return {
    label: `Seedance 2.0 ${inputModeId}`,
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    inputModeId,
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
    expectedCostUsd: 2.7216,
  };
}

function seedanceRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedFinalCosts = [
    { resolution: '480p' as const, aspectRatio: '21:9', expectedFinalCostUsd: 1.0584 },
    { resolution: '480p' as const, aspectRatio: '16:9', expectedFinalCostUsd: 0.806085 },
    { resolution: '480p' as const, aspectRatio: '4:3', expectedFinalCostUsd: 0.6048 },
    { resolution: '480p' as const, aspectRatio: '1:1', expectedFinalCostUsd: 0.4536 },
    { resolution: '480p' as const, aspectRatio: '3:4', expectedFinalCostUsd: 0.3402 },
    { resolution: '480p' as const, aspectRatio: '9:16', expectedFinalCostUsd: 0.25515 },
    { resolution: '720p' as const, aspectRatio: '21:9', expectedFinalCostUsd: 2.3814 },
    { resolution: '720p' as const, aspectRatio: '16:9', expectedFinalCostUsd: 1.8144 },
    { resolution: '720p' as const, aspectRatio: '4:3', expectedFinalCostUsd: 1.3608 },
    { resolution: '720p' as const, aspectRatio: '1:1', expectedFinalCostUsd: 1.0206 },
    { resolution: '720p' as const, aspectRatio: '3:4', expectedFinalCostUsd: 0.76545 },
    { resolution: '720p' as const, aspectRatio: '9:16', expectedFinalCostUsd: 0.5740875 },
  ];
  const routeCases = shotGroupRouteCases([
    {
      inputModeId: 'text-only' as const,
      providerModel: 'bytedance/seedance-2.0/text-to-video',
    },
    {
      inputModeId: 'first-frame' as const,
      providerModel: 'bytedance/seedance-2.0/image-to-video',
    },
    {
      inputModeId: 'first-last-frame' as const,
      providerModel: 'bytedance/seedance-2.0/image-to-video',
    },
    {
      inputModeId: 'reference' as const,
      providerModel: 'bytedance/seedance-2.0/reference-to-video',
    },
  ]);
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
          label: `${routeCase.shotGroupMode} ${routeCase.inputModeId} Seedance 2.0 ${duration}s ${costCase.resolution} ${costCase.aspectRatio}`,
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          inputModeId: routeCase.inputModeId,
          shotGroupMode: routeCase.shotGroupMode,
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

function klingV3Case(
  level: 'standard' | 'pro',
  inputModeId: ShotVideoTakeInputModeId,
  providerModel: string
): EstimateMatrixCaseTemplate {
  const hasAspectRatio = inputModeId === 'text-only';
  const routeSettings = {
    duration: '9',
    ...(hasAspectRatio ? { aspect_ratio: '16:9' } : {}),
    generate_audio: true,
    cfg_scale: 0.5,
  };
  return {
    label: `Kling V3 ${level} ${inputModeId}`,
    modelChoice: `fal-ai/kling-video/v3/${level}`,
    inputModeId,
    providerModel,
    parameterValues: routeSettings,
    expectedRouteSettings: routeSettings,
    expectedBillableUnits: {
      duration: '9',
      generate_audio: true,
    },
    expectedCostUsd: level === 'standard' ? 1.134 : 1.512,
  };
}

function klingO3Case(
  level: 'standard' | 'pro',
  inputModeId: ShotVideoTakeInputModeId,
  providerModel: string
): EstimateMatrixCaseTemplate {
  const sourceVideo = inputModeId === 'source-video-reference';
  const hasAspectRatio =
    inputModeId === 'text-only' ||
    inputModeId === 'reference' ||
    inputModeId === 'source-video-reference';
  const routeSettings = {
    duration: '9',
    ...(hasAspectRatio ? { aspect_ratio: sourceVideo ? 'auto' : '16:9' } : {}),
    ...(sourceVideo ? { keep_audio: true } : { generate_audio: true }),
  };
  const audioRate = level === 'standard' ? 0.112 : 0.14;
  const sourceVideoRate = level === 'standard' ? 0.126 : 0.168;
  return {
    label: `Kling O3 ${level} ${inputModeId}`,
    modelChoice: `fal-ai/kling-video/o3/${level}`,
    inputModeId,
    providerModel,
    parameterValues: routeSettings,
    expectedRouteSettings: routeSettings,
    expectedBillableUnits: {
      duration: '9',
      ...(sourceVideo ? {} : { generate_audio: true }),
    },
    expectedCostUsd: 9 * (sourceVideo ? sourceVideoRate : audioRate),
  };
}

function klingRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  return [
    ...klingV3RunSetupPricingPermutations(duration, 'standard'),
    ...klingV3RunSetupPricingPermutations(duration, 'pro'),
    ...klingO3RunSetupPricingPermutations(duration, 'standard'),
    ...klingO3RunSetupPricingPermutations(duration, 'pro'),
  ];
}

function klingV3RunSetupPricingPermutations(
  duration: number,
  level: 'standard' | 'pro'
): RunSetupPricingPermutationCase[] {
  const rates = level === 'standard'
    ? { audioOn: 0.126, audioOff: 0.084 }
    : { audioOn: 0.168, audioOff: 0.112 };
  const expectedFinalCosts = [
    { generateAudio: true, expectedFinalCostUsd: duration * rates.audioOn },
    { generateAudio: false, expectedFinalCostUsd: duration * rates.audioOff },
  ];
  const routeCases = shotGroupRouteCases([
    {
      inputModeId: 'text-only' as const,
      providerModel: `kling-video/v3/${level}/text-to-video`,
      hasAspectRatio: true,
    },
    {
      inputModeId: 'first-frame' as const,
      providerModel: `kling-video/v3/${level}/image-to-video`,
      hasAspectRatio: false,
    },
    {
      inputModeId: 'first-last-frame' as const,
      providerModel: `kling-video/v3/${level}/image-to-video`,
      hasAspectRatio: false,
    },
  ]);
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
        label: `${routeCase.shotGroupMode} ${routeCase.inputModeId} Kling V3 ${level} ${duration}s audio ${costCase.generateAudio ? 'on' : 'off'}`,
        modelChoice: `fal-ai/kling-video/v3/${level}`,
        inputModeId: routeCase.inputModeId,
        shotGroupMode: routeCase.shotGroupMode,
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

function klingO3RunSetupPricingPermutations(
  duration: number,
  level: 'standard' | 'pro'
): RunSetupPricingPermutationCase[] {
  const audioRates = level === 'standard'
    ? { audioOn: 0.112, audioOff: 0.084, sourceVideo: 0.126 }
    : { audioOn: 0.14, audioOff: 0.112, sourceVideo: 0.168 };
  const routeCases = shotGroupRouteCases([
    {
      inputModeId: 'text-only' as const,
      providerModel: `kling-video/o3/${level}/text-to-video`,
      hasAspectRatio: true,
      sourceVideo: false,
    },
    {
      inputModeId: 'first-frame' as const,
      providerModel: `kling-video/o3/${level}/image-to-video`,
      hasAspectRatio: false,
      sourceVideo: false,
    },
    {
      inputModeId: 'first-last-frame' as const,
      providerModel: `kling-video/o3/${level}/image-to-video`,
      hasAspectRatio: false,
      sourceVideo: false,
    },
    {
      inputModeId: 'reference' as const,
      providerModel: `kling-video/o3/${level}/reference-to-video`,
      hasAspectRatio: true,
      sourceVideo: false,
    },
    {
      inputModeId: 'source-video-reference' as const,
      providerModel: `kling-video/o3/${level}/video-to-video/reference`,
      hasAspectRatio: true,
      sourceVideo: true,
    },
  ]);
  return routeCases.flatMap((routeCase) => {
    const costCases = routeCase.sourceVideo
      ? [{ keepAudio: true, expectedFinalCostUsd: duration * audioRates.sourceVideo }]
      : [
          { generateAudio: true, expectedFinalCostUsd: duration * audioRates.audioOn },
          { generateAudio: false, expectedFinalCostUsd: duration * audioRates.audioOff },
        ];
    return costCases.map((costCase): RunSetupPricingPermutationCase => {
      const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
      const expectedRouteSettings = {
        duration: String(duration),
        ...(routeCase.hasAspectRatio
          ? { aspect_ratio: routeCase.sourceVideo ? 'auto' : '16:9' }
          : {}),
        ...(routeCase.sourceVideo
          ? { keep_audio: 'keepAudio' in costCase ? costCase.keepAudio : true }
          : { generate_audio: 'generateAudio' in costCase ? costCase.generateAudio : true }),
      };
      return {
        label: `${routeCase.shotGroupMode} ${routeCase.inputModeId} Kling O3 ${level} ${duration}s`,
        modelChoice: `fal-ai/kling-video/o3/${level}`,
        inputModeId: routeCase.inputModeId,
        shotGroupMode: routeCase.shotGroupMode,
        providerModel: routeCase.providerModel,
        parameterValues: expectedRouteSettings,
        expectedRouteSettings,
        expectedBillableUnits: {
          duration: String(duration),
          ...(routeCase.sourceVideo
            ? {}
            : { generate_audio: 'generateAudio' in costCase ? costCase.generateAudio : true }),
        },
        expectedFinalCostUsd: costCase.expectedFinalCostUsd,
        expectedDependencyCostUsd,
        expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
        expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
      };
    });
  });
}

function veoCase(
  inputModeId: ShotVideoTakeInputModeId,
  providerModel: string,
  expectedCostUsd: number
): EstimateMatrixCaseTemplate {
  let routeSettings: ShotVideoTakeParameterValues;
  if (inputModeId === 'reference') {
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
      auto_fix: inputModeId === 'text-only',
    };
  }
  return {
    label: `Veo 3.1 ${inputModeId}`,
    modelChoice: 'fal-ai/veo3.1',
    inputModeId,
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

function veoRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const routeCases = shotGroupRouteCases([
    {
      inputModeId: 'text-only' as const,
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
      inputModeId: 'first-frame' as const,
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
      inputModeId: 'first-last-frame' as const,
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
      inputModeId: 'reference' as const,
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
  ]);
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
          label: `${routeCase.shotGroupMode} ${routeCase.inputModeId} Veo 3.1 ${routeCase.duration} ${costCase.resolution} audio ${costCase.generateAudio ? 'on' : 'off'}`,
          modelChoice: 'fal-ai/veo3.1',
          inputModeId: routeCase.inputModeId,
          shotGroupMode: routeCase.shotGroupMode,
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

function grokCase(): EstimateMatrixCaseTemplate {
  const inputModeId = 'first-frame';
  const providerModel = 'xai/grok-imagine-video/v1.5/image-to-video';
  return {
    label: 'XAI Grok Imagine Video 1.5 first-frame',
    modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
    inputModeId,
    providerModel,
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

function grokRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedCosts = [
    { resolution: '480p' as const, expectedFinalCostUsd: 0.49 },
    { resolution: '720p' as const, expectedFinalCostUsd: 0.85 },
  ];
  return shotGroupRouteCases([
    {
      inputModeId: 'first-frame' as const,
      providerModel: 'xai/grok-imagine-video/v1.5/image-to-video',
    },
  ]).flatMap((routeCase) =>
    expectedCosts.map((costCase): RunSetupPricingPermutationCase => {
      const expectedDependencyCostUsd = missingDependencyCostForRoute(routeCase);
      return {
        label: `${routeCase.shotGroupMode} first-frame XAI Grok Imagine Video 1.5 ${duration}s ${costCase.resolution}`,
        modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
        inputModeId: routeCase.inputModeId,
        shotGroupMode: routeCase.shotGroupMode,
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
        expectedDependencyCostUsd,
        expectedDependencyLineCount: missingDependencyLineCountForRoute(routeCase),
        expectedTotalCostUsd: costCase.expectedFinalCostUsd + expectedDependencyCostUsd,
      };
    })
  );
}

function ltxCase(
  inputModeId: ShotVideoTakeInputModeId,
  providerModel: string
): EstimateMatrixCaseTemplate {
  const routeSettings = {
    duration: 8,
    aspect_ratio: '16:9',
    generate_audio: true,
    resolution: '1080p',
    fps: 25,
  };
  return {
    label: `LTX 3.2 ${inputModeId}`,
    modelChoice: 'fal-ai/ltx-3.2',
    inputModeId,
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

function ltxRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedCosts = [
    { resolution: '1080p' as const, expectedFinalCostUsd: 0.36 },
    { resolution: '1440p' as const, expectedFinalCostUsd: 0.72 },
    { resolution: '2160p' as const, expectedFinalCostUsd: 1.44 },
  ];
  const routeCases = shotGroupRouteCases([
    {
      inputModeId: 'text-only' as const,
      providerModel: 'ltx-2.3/text-to-video',
      aspectRatio: '16:9',
    },
    {
      inputModeId: 'first-frame' as const,
      providerModel: 'ltx-2.3/image-to-video',
      aspectRatio: '16:9',
    },
    {
      inputModeId: 'first-last-frame' as const,
      providerModel: 'ltx-2.3/image-to-video',
      aspectRatio: '16:9',
    },
  ]);
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
        label: `${routeCase.shotGroupMode} ${routeCase.inputModeId} LTX 3.2 ${duration}s ${costCase.resolution}`,
        modelChoice: 'fal-ai/ltx-3.2',
        inputModeId: routeCase.inputModeId,
        shotGroupMode: routeCase.shotGroupMode,
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
  inputModeId: ShotVideoTakeInputModeId,
  providerModel: string
): EstimateMatrixCaseTemplate {
  const hasAspectRatio = inputModeId === 'text-only' || inputModeId === 'reference';
  const routeSettings = {
    ...(hasAspectRatio ? { aspect_ratio: '16:9' } : {}),
    enable_safety_checker: true,
    seed: null,
    resolution: '1080p',
    duration: 9,
  };
  return {
    label: `Alibaba Happy Horse ${inputModeId}`,
    modelChoice: 'fal-ai/alibaba/happy-horse',
    inputModeId,
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

function happyHorseRunSetupPricingPermutations(): RunSetupPricingPermutationCase[] {
  const duration = 6;
  const expectedCosts = [
    { resolution: '720p' as const, expectedFinalCostUsd: 0.84 },
    { resolution: '1080p' as const, expectedFinalCostUsd: 1.68 },
  ];
  const routeCases = shotGroupRouteCases([
    {
      inputModeId: 'text-only' as const,
      providerModel: 'alibaba/happy-horse/text-to-video',
      hasAspectRatio: true,
    },
    {
      inputModeId: 'first-frame' as const,
      providerModel: 'alibaba/happy-horse/image-to-video',
      hasAspectRatio: false,
    },
    {
      inputModeId: 'reference' as const,
      providerModel: 'alibaba/happy-horse/reference-to-video',
      hasAspectRatio: true,
    },
  ]);
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
        label: `${routeCase.shotGroupMode} ${routeCase.inputModeId} Alibaba Happy Horse ${duration}s ${costCase.resolution}`,
        modelChoice: 'fal-ai/alibaba/happy-horse',
        inputModeId: routeCase.inputModeId,
        shotGroupMode: routeCase.shotGroupMode,
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
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  providerModel: string;
}): number {
  let cost = baseReferenceDependencyCostForRoute(input);
  if (input.inputModeId === 'first-frame') {
    cost += FIRST_FRAME_DEPENDENCY_COST_USD;
  }
  if (input.inputModeId === 'first-last-frame') {
    cost += FIRST_FRAME_DEPENDENCY_COST_USD + LAST_FRAME_DEPENDENCY_COST_USD;
  }
  if (requiresVideoPromptSheet(input)) {
    cost += VIDEO_PROMPT_DEPENDENCY_COST_USD;
  }
  return cost;
}

function missingDependencyLineCountForRoute(input: {
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  providerModel: string;
}): number {
  let count = baseReferenceDependencyLineCountForRoute(input);
  if (input.inputModeId === 'first-last-frame') {
    count += 2;
  }
  if (input.inputModeId === 'first-frame') {
    count += 1;
  }
  if (requiresVideoPromptSheet(input)) {
    count += 1;
  }
  return count;
}

function preparedDependencyCostForRoute(input: {
  inputModeId: ShotVideoTakeInputModeId;
}): number {
  return baseReferenceDependencyCostForRoute(input);
}

function preparedDependencyLineCountForRoute(input: {
  inputModeId: ShotVideoTakeInputModeId;
}): number {
  return baseReferenceDependencyLineCountForRoute(input);
}

function baseReferenceDependencyCostForRoute(input: {
  inputModeId: ShotVideoTakeInputModeId;
}): number {
  return input.inputModeId === 'reference'
    ? REFERENCE_BUNDLE_DEPENDENCY_COST_USD
    : DEFAULT_REFERENCE_CONTEXT_DEPENDENCY_COST_USD;
}

function baseReferenceDependencyLineCountForRoute(input: {
  inputModeId: ShotVideoTakeInputModeId;
}): number {
  return input.inputModeId === 'reference'
    ? REFERENCE_BUNDLE_DEPENDENCY_LINE_COUNT
    : DEFAULT_REFERENCE_CONTEXT_DEPENDENCY_LINE_COUNT;
}

function requiresVideoPromptSheet(input: {
  shotGroupMode: ShotVideoTakeShotGroupMode;
}): boolean {
  return input.shotGroupMode === 'multi-shot';
}

async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}

async function createE2eMovieProject(input: {
  projectData: ProjectDataService;
  homeDir: string;
}): Promise<void> {
  await input.projectData.createMovieProject({
    projectName: 'constantinople',
    title: 'Preparation of the Siege',
    logline: 'A documentary about preparation before 1453.',
    summary: 'A documentary project summary stored in SQLite.',
    aspectRatio: '16:9',
    homeDir: input.homeDir,
    idGenerator: createDeterministicIdGenerator(),
  });
  await input.projectData.openCurrentProject({
    projectName: 'constantinople',
    homeDir: input.homeDir,
  });
  await input.projectData.applyCastOperations({
    homeDir: input.homeDir,
    document: {
      kind: 'castOperations',
      operations: [
        {
          operation: 'castMember.add',
          castMember: {
            key: 'narrator',
            handle: 'narrator',
            name: 'Narrator',
            isVoiceOver: true,
            role: 'voiceover',
          },
        },
        {
          operation: 'castMember.add',
          castMember: {
            key: 'mehmed-ii',
            handle: 'mehmed-ii',
            name: 'Mehmed II',
            role: 'protagonist',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await input.projectData.applyLocationOperations({
    homeDir: input.homeDir,
    document: {
      kind: 'locationOperations',
      operations: [
        {
          operation: 'location.add',
          location: {
            key: 'council-chamber',
            handle: 'council-chamber',
            name: "Mehmed's council chamber",
            description: 'Formal Ottoman planning room with maps and oil lamps.',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await input.projectData.createScreenplay({
    homeDir: input.homeDir,
    document: sampleScreenplayCreateDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
}

function sampleScreenplayCreateDocument(): Parameters<
  ProjectDataService['createScreenplay']
>[0]['document'] {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Preparation of the Siege',
      logline: 'A documentary about preparation before 1453.',
      summary: 'Mehmed turns an inherited ambition into a concrete plan.',
    },
    cast: [],
    locations: [],
    acts: [
      {
        key: 'act-one',
        title: 'Act I',
        sequences: [
          {
            key: 'young-sultan',
            title: "The Young Sultan's Obsession",
            purpose: 'Mehmed turns conquest into policy.',
            scenes: [
              {
                key: 'throne-city',
                title: 'A Throne Facing an Ancient City',
                setting: {
                  interiorExterior: 'INT',
                  timeOfDay: 'NIGHT',
                  locationIds: ['location_test0001'],
                },
                storyFunction: [
                  "Mehmed's accession is framed against Constantinople.",
                ],
                blocks: [
                  {
                    type: 'action',
                    text: 'Mehmed studies the city map.',
                    castMemberIds: ['cast_test0002'],
                    locationIds: ['location_test0001'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
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
  const singleTakeReport = await projectData.createSceneShotVideoTake({
    homeDir,
    sceneId: ids.sceneId,
    shotListId: singleShotList.shotList.id,
    shotIds: ['shot_001'],
  });
  const multiTakeReport = await projectData.createSceneShotVideoTake({
    homeDir,
    sceneId: ids.sceneId,
    shotListId: multiShotList.shotList.id,
    shotIds: ['shot_001', 'shot_002'],
  });
  const singleTake = singleTakeReport.overview.take;
  const multiTake = multiTakeReport.overview.take;
  const activeLookbook = await createActiveLookbook(projectData, homeDir);
  await writeProjectFile(projectData, homeDir, 'generated/media/first-frame.png', 'first frame');
  await writeProjectFile(projectData, homeDir, 'generated/media/last-frame.png', 'last frame');
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/multi-shot-first-frame.png',
    'multi-shot first frame'
  );
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/multi-shot-last-frame.png',
    'multi-shot last frame'
  );
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/video-prompt-sheet.png',
    'video prompt sheet'
  );
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/reference-bundle.png',
    'reference bundle image'
  );
  await writeProjectFile(
    projectData,
    homeDir,
    'generated/media/source-video.mp4',
    'source video'
  );

  const firstFrame = await projectData.importShotFirstFrame({
    homeDir,
    takeId: singleTake.takeId,
    sourceProjectRelativePath: 'generated/media/first-frame.png',
  });
  const lastFrame = await projectData.importShotLastFrame({
    homeDir,
    takeId: singleTake.takeId,
    sourceProjectRelativePath: 'generated/media/last-frame.png',
  });
  const multiShotFirstFrame = await projectData.importShotFirstFrame({
    homeDir,
    takeId: multiTake.takeId,
    sourceProjectRelativePath: 'generated/media/multi-shot-first-frame.png',
  });
  const multiShotLastFrame = await projectData.importShotLastFrame({
    homeDir,
    takeId: multiTake.takeId,
    sourceProjectRelativePath: 'generated/media/multi-shot-last-frame.png',
  });
  const videoPromptSheet = await projectData.importShotVideoPromptSheet({
    homeDir,
    takeId: multiTake.takeId,
    sourceProjectRelativePath: 'generated/media/video-prompt-sheet.png',
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
  const sourceVideo = await projectData.registerAsset({
    projectName: 'constantinople',
    homeDir,
    target: { kind: 'scene', sceneId: ids.sceneId },
    type: 'shot_source_video',
    mediaKind: 'video',
    title: 'Source video reference',
    projectRelativePath: 'generated/media/source-video.mp4' as ProjectRelativePath,
    fileRole: 'primary',
    role: 'shot_source_video',
  });
  const sourceVideoFile = sourceVideo.files[0];
  if (!sourceVideoFile) {
    throw new Error('Expected registered source video to have a primary file.');
  }
  const context = await projectData.buildShotVideoTakeContext({
    homeDir,
    takeId: singleTake.takeId,
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
            kind: 'lookbook-sheet' as const,
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
    singleTakeId: singleTake.takeId,
    multiTakeId: multiTake.takeId,
    activeLookbookId: context.activeLookbook?.id ?? activeLookbook.lookbook.id,
    preparedInputs: {
      firstFrame: preparedInputFromImported(firstFrame.mediaInput),
      lastFrame: preparedInputFromImported(lastFrame.mediaInput),
      multiShotFirstFrame: preparedInputFromImported(multiShotFirstFrame.mediaInput),
      multiShotLastFrame: preparedInputFromImported(multiShotLastFrame.mediaInput),
      videoPromptSheet: preparedInputFromImported(videoPromptSheet.mediaInput),
      referenceBundle,
      sourceVideo: {
        kind: 'source-video',
        assetId: sourceVideo.assetId,
        assetFileId: sourceVideoFile.id,
        subjectKind: 'asset',
        subjectId: sourceVideo.assetId,
      },
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
  await projectData.selectLookbookForType({
    projectName: 'constantinople',
    homeDir,
    type: 'movie',
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

function productionForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase,
  setup: MatrixProjectSetup,
  options: { includePreparedInputs: boolean }
): SceneShotVideoTakeProductionState {
  return {
    inputModeId: input.inputModeId,
    modelChoice: input.modelChoice,
    parameterValues: input.parameterValues,
    ...(options.includePreparedInputs
      ? { preparedInputs: preparedInputsForCase(input, setup) }
      : {}),
    requestedInputs: requestedInputsForCase(input, setup),
    agentProposal: {
      basedOnInputModeId: input.inputModeId,
      basedOnModelChoice: input.modelChoice,
      basedOnShotIds: shotIdsForCase(input),
      dependencyDrafts: dependencyDraftsForCase(input),
      finalPromptDraft: {
        prompt: `Author final video generation for ${input.label} using the selected shot design and prepared references.`,
        title: `${input.label} final video take`,
      },
    },
  };
}

function dependencyDraftsForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase
): ShotVideoTakeDependencyDraft[] {
  const drafts: ShotVideoTakeDependencyDraft[] = [];
  if (
    input.inputModeId === 'first-frame' ||
    input.inputModeId === 'first-last-frame'
  ) {
    drafts.push({
      purpose: 'shot.first-frame',
      dependencyKind: 'first-frame',
      outputInputKind: 'first-frame',
      referenceMode: 'movie-lookbook',
      prompt: `Author the exact first frame for ${input.label} from the selected composition, motion, cast, location, and lookbook references.`,
      title: `${input.label} first frame`,
    });
  }
  if (input.inputModeId === 'first-last-frame') {
    drafts.push({
      purpose: 'shot.last-frame',
      dependencyKind: 'last-frame',
      outputInputKind: 'last-frame',
      referenceMode: 'movie-lookbook',
      prompt: `Author the exact last frame for ${input.label}, preserving continuity from the first frame while showing the final action state.`,
      title: `${input.label} last frame`,
    });
  }
  if (requiresVideoPromptSheet(input)) {
    drafts.push({
      purpose: 'shot.video-prompt-sheet',
      dependencyKind: 'video-prompt-sheet',
      outputInputKind: 'video-prompt-sheet',
      referenceMode: 'movie-lookbook',
      prompt: `Author one ordered video prompt sheet planning sheet for ${input.label}, with one readable panel per selected shot and compact camera/action metadata.`,
      title: `${input.label} video prompt sheet`,
    });
  }
  return drafts;
}

function preparedInputFromImported(
  input: SceneShotVideoTakeMediaInput
): ShotVideoTakePreparedInput {
  return {
    kind: input.kind,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
  };
}

function preparedInputsForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase,
  setup: MatrixProjectSetup
): ShotVideoTakePreparedInput[] {
  const firstFrame =
    input.shotGroupMode === 'multi-shot'
      ? setup.preparedInputs.multiShotFirstFrame
      : setup.preparedInputs.firstFrame;
  const lastFrame =
    input.shotGroupMode === 'multi-shot'
      ? setup.preparedInputs.multiShotLastFrame
      : setup.preparedInputs.lastFrame;

  if (input.inputModeId === 'first-frame') {
    return requiresVideoPromptSheet(input)
      ? [firstFrame, setup.preparedInputs.videoPromptSheet]
      : [firstFrame];
  }
  if (input.inputModeId === 'first-last-frame') {
    return requiresVideoPromptSheet(input)
      ? [firstFrame, lastFrame, setup.preparedInputs.videoPromptSheet]
      : [firstFrame, lastFrame];
  }
  if (input.inputModeId === 'reference') {
    return requiresVideoPromptSheet(input)
      ? [...setup.preparedInputs.referenceBundle, setup.preparedInputs.videoPromptSheet]
      : setup.preparedInputs.referenceBundle;
  }
  if (input.inputModeId === 'source-video-reference') {
    return requiresVideoPromptSheet(input)
      ? [setup.preparedInputs.sourceVideo, setup.preparedInputs.videoPromptSheet]
      : [setup.preparedInputs.sourceVideo];
  }
  return requiresVideoPromptSheet(input) ? [setup.preparedInputs.videoPromptSheet] : [];
}

function requestedInputsForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase,
  setup: MatrixProjectSetup
): ShotVideoTakeRequestedInput[] {
  if (input.inputModeId !== 'reference') {
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
            kind: 'lookbook-sheet' as const,
            subjectKind: 'lookbook' as const,
            subjectId: setup.activeLookbookId,
          },
        ]
      : []),
  ];
}

function shotIdsForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase
): string[] {
  return input.shotGroupMode === 'multi-shot'
    ? ['shot_001', 'shot_002']
    : ['shot_001'];
}

function shotListIdForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase,
  setup: MatrixProjectSetup
): string {
  return input.shotGroupMode === 'multi-shot'
    ? setup.multiShotListId
    : setup.singleShotListId;
}

function takeIdForCase(
  input: EstimateMatrixCase | RunSetupPricingPermutationCase,
  setup: MatrixProjectSetup
): string {
  return input.shotGroupMode === 'multi-shot'
    ? setup.multiTakeId
    : setup.singleTakeId;
}

function routeKey(
  modelChoice: ShotVideoTakeModelChoice,
  inputModeId: ShotVideoTakeInputModeId,
  shotGroupMode: ShotVideoTakeShotGroupMode
): string {
  return `${modelChoice}:${inputModeId}:${shotGroupMode}`;
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
    kind: 'movieLookbook' as const,
    movieLookbook: {
      name: 'Imperial Wound',
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
