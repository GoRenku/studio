import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  GenerationPreviewRequest,
  GenerationPreviewRequestReference,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ShotVideoTakeOutputGenerationSpec,
  ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import {
  insertMediaGenerationSpec,
  updateMediaGenerationSpec,
  listMediaGenerationSpecs,
} from '../../../../database/access/media-generation.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../../../entity-ids.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import type {
  ValidateShotVideoTakeOutputGenerationSpecInput,
  CreateShotVideoTakeOutputGenerationSpecInput,
  UpdateShotVideoTakeOutputGenerationSpecInput,
  ShotVideoTakeContextInput,
  ReadMediaGenerationSpecInput,
} from '../../../../project-data-service-contracts.js';
import {
  draftMediaGenerationSpecRecord,
} from '../../../cost/draft-generation.js';
import {
  buildShotVideoTakeContext,
} from '../authoring/context.js';
import {
  modelChoices,
} from './model-list.js';
import {
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  buildShotVideoTakeProviderPayload,
  toGenerationRequest,
  type ShotVideoTakeProviderPlan,
} from '../provider/provider-payloads.js';
import {
  describeGenerationModelInputs,
  type ShotVideoRoute,
} from '@gorenku/studio-engines';
import { buildShotVideoTakePreviewConfiguration } from '../../../../generation-preview/configuration/shot-video-configuration.js';
import { providerPreviewPromptText } from '../../../../generation-preview/provider-preview-prompt.js';
import {
  finalInputMatchesRouteSlot,
  missingRequiredRouteInputLabelsForFinalSpec,
  requireShotVideoTakeRoute,
} from '../shared/route-settings.js';
import {
  assertEditableSceneShotVideoTake,
  sameShotIds,
} from '../authoring/take-context.js';
import {
  readShotSpec,
} from './spec-records.js';
export async function validateShotVideoTakeSpec(
  input: ValidateShotVideoTakeOutputGenerationSpecInput
) {
  const normalized = normalizeFinalSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: normalized.target.takeId,
  });
  validateFinalSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeProviderPayload(normalized, context);
  return {
    valid: true as const,
    spec: normalized,
    providerPayload: plan.payload,
    context,
  };
}



export async function createShotVideoTakeSpec(
  input: CreateShotVideoTakeOutputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeFinalSpec(input.spec);
  const validation = await validateShotVideoTakeSpec({ ...input, spec: normalized });
  assertEditableSceneShotVideoTake(validation.context.take);
  return withShotProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: normalized.title?.trim() || normalized.prompt.slice(0, 80) || 'Shot video take',
      now: new Date().toISOString(),
    });
  });
}



export async function updateShotVideoTakeSpec(
  input: UpdateShotVideoTakeOutputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeFinalSpec(input.spec);
  const validation = await validateShotVideoTakeSpec({ ...input, spec: normalized });
  assertEditableSceneShotVideoTake(validation.context.take);
  return withShotProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: normalized.title?.trim() || normalized.prompt.slice(0, 80) || 'Shot video take',
      now: new Date().toISOString(),
    })
  );
}



export async function listShotVideoTakeSpecs(
  input: ShotVideoTakeContextInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildShotVideoTakeContext(input);
  return withShotProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      targetKind: 'sceneShotVideoTake',
      targetId: context.target.id,
    }),
  }));
}



export async function prepareShotVideoTakeSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readShotSpec(input);
  assertShotVideoTakeSpec(specRecord.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: specRecord.spec.target.takeId,
  });
  validateFinalSpecAgainstContext(specRecord.spec, context);
  const plan = buildShotVideoTakeProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function buildShotVideoTakeGenerationPreview(
  input: {
    projectName?: string;
    homeDir?: string;
    specRecord: MediaGenerationSpecRecord;
  }
): Promise<GenerationPreviewRequest> {
  const { specRecord } = input;
  assertShotVideoTakeSpec(specRecord.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: specRecord.spec.target.takeId,
  });
  validateFinalSpecAgainstContext(specRecord.spec, context);
  const route = requireShotVideoTakeRoute(
    specRecord.spec.modelChoice,
    specRecord.spec.inputModeId,
    context.shotGroupMode
  );
  const plan = buildShotVideoTakeProviderPayload(specRecord.spec, context);
  const supportsNegativePrompt = await providerModelSupportsNegativePrompt(plan);
  const providerTokenByInput = shotVideoTakeProviderTokenByInput({
    route,
    inputFiles: plan.inputFiles,
  });
  const providerTokenOrder = shotVideoTakeProviderTokenOrder({
    route,
    inputFiles: plan.inputFiles,
  });
  return {
    kind: 'generationPreview',
    previewId: `generation-preview:${specRecord.id}`,
    generationSpecId: specRecord.id,
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    project: {
      id: context.project.id ?? context.project.name,
      name: context.project.name,
      title: context.project.title,
    },
    target: specRecord.target,
    title: specRecord.title,
    model: {
      provider: plan.provider,
      modelId: plan.model,
      route: plan.model,
      executionPath: 'renku-managed',
      mediaKind: 'video',
    },
    finalPrompt: {
      authoredText: specRecord.spec.prompt,
      providerText: providerPreviewPromptText(plan.payload, specRecord.spec.prompt),
      ...(supportsNegativePrompt
        ? { negativeText: specRecord.spec.negativePrompt ?? '' }
        : {}),
    },
    references: shotVideoTakePreviewReferences(
      specRecord.spec,
      providerTokenByInput
    ),
    configuration: buildShotVideoTakePreviewConfiguration({
      spec: specRecord.spec,
      context,
      plan,
      modelLabel:
        modelChoices(context, specRecord.spec.inputModeId).find(
          (model) => model.modelChoice === specRecord.spec.modelChoice
        )?.label ?? specRecord.spec.modelChoice,
    }),
    providerPreview: {
      provider: plan.provider,
      model: plan.model,
      mode: plan.mode,
      ...(providerTokenOrder.length > 0 ? { providerTokenOrder } : {}),
      payload: plan.payload,
    },
    diagnostics: [],
  };
}

export async function shotVideoTakeSpecSupportsNegativePrompt(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<boolean> {
  const { specRecord } = input;
  assertShotVideoTakeSpec(specRecord.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: specRecord.spec.target.takeId,
  });
  validateFinalSpecAgainstContext(specRecord.spec, context);
  const plan = buildShotVideoTakeProviderPayload(specRecord.spec, context);
  return providerModelSupportsNegativePrompt(plan);
}

async function providerModelSupportsNegativePrompt(
  plan: ShotVideoTakeProviderPlan
): Promise<boolean> {
  const descriptor = await describeGenerationModelInputs({
    provider: plan.provider,
    model: plan.model,
  });
  return descriptor?.fields.some((field) => field.name === 'negative_prompt') ?? false;
}



export async function prepareShotVideoTakeDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ShotVideoTakeOutputGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = normalizeFinalSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: normalized.target.takeId,
  });
  validateFinalSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

function shotVideoTakePreviewReferences(
  spec: ShotVideoTakeOutputGenerationSpec,
  providerTokenByInput: Map<string, string>
): GenerationPreviewRequestReference[] {
  return spec.inputs.map((reference) => {
    const providerToken = providerTokenByInput.get(providerInputKey(reference));
    return {
      kind: reference.mediaKind,
      role: reference.role,
      label: reference.role || reference.kind,
      ...(providerToken ? { providerToken } : {}),
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
      selected: true,
    };
  });
}

function shotVideoTakeProviderTokenByInput(input: {
  route: ShotVideoRoute;
  inputFiles?: ShotVideoTakeProviderPlan['inputFiles'];
}): Map<string, string> {
  const providerTokenByInput = new Map<string, string>();
  for (const providerInput of input.inputFiles ?? []) {
    const providerToken = shotVideoTakeProviderTokenForInputFile({
      route: input.route,
      inputFile: providerInput,
      inputFiles: input.inputFiles ?? [],
    });
    if (!providerToken) {
      continue;
    }
    providerTokenByInput.set(providerInputFileKey(providerInput), providerToken);
  }
  return providerTokenByInput;
}

function shotVideoTakeProviderTokenOrder(input: {
  route: ShotVideoRoute;
  inputFiles?: ShotVideoTakeProviderPlan['inputFiles'];
}): string[] {
  const providerTokenOrder: string[] = [];
  for (const providerInput of input.inputFiles ?? []) {
    const providerToken = shotVideoTakeProviderTokenForInputFile({
      route: input.route,
      inputFile: providerInput,
      inputFiles: input.inputFiles ?? [],
    });
    if (!providerToken || providerTokenOrder.includes(providerToken)) {
      continue;
    }
    providerTokenOrder.push(providerToken);
  }
  return providerTokenOrder;
}

function shotVideoTakeProviderTokenForInputFile(input: {
  route: ShotVideoRoute;
  inputFile: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>[number];
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>;
}): string | undefined {
  const { route, inputFile, inputFiles } = input;
  const contract = route.referenceContract;
  if (!contract) {
    return undefined;
  }
  if (
    contract.sourceVideo &&
    inputFile.field === contract.sourceVideo.providerField
  ) {
    return contract.sourceVideo.promptToken;
  }
  if (
    contract.elements &&
    inputFile.field === contract.elements.providerField
  ) {
    const elementIndex =
      Array.isArray(inputFile.payloadPath) &&
      typeof inputFile.payloadPath[1] === 'number'
        ? inputFile.payloadPath[1]
        : undefined;
    return elementIndex === undefined
      ? undefined
      : `${contract.elements.promptTokenPrefix}${elementIndex + 1}`;
  }
  if (
    contract.topLevelImages &&
    inputFile.field === contract.topLevelImages.providerField &&
    inputFile.mediaKind === 'image'
  ) {
    const index = providerInputIndex(inputFiles, inputFile);
    return index < 0
      ? undefined
      : `${contract.topLevelImages.promptTokenPrefix}${index + 1}`;
  }
  if (
    contract.audioReferences &&
    inputFile.field === contract.audioReferences.providerField &&
    inputFile.mediaKind === 'audio'
  ) {
    const index = providerInputIndex(inputFiles, inputFile);
    return index < 0
      ? undefined
      : `${contract.audioReferences.promptTokenPrefix}${index + 1}`;
  }
  return undefined;
}

function providerInputIndex(
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  inputFile: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>[number]
): number {
  return inputFiles
    .filter(
      (candidate) =>
        candidate.field === inputFile.field &&
        candidate.mediaKind === inputFile.mediaKind
    )
    .findIndex(
      (candidate) =>
        providerInputFileKey(candidate) === providerInputFileKey(inputFile)
    );
}

function providerInputKey(
  input: ShotVideoTakeOutputGenerationSpec['inputs'][number]
): string {
  return `${input.mediaKind}:${input.projectRelativePath}`;
}

function providerInputFileKey(
  inputFile: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>[number]
): string {
  return `${inputFile.mediaKind}:${inputFile.projectRelativePath}`;
}



export function normalizeFinalSpec(spec: ShotVideoTakeOutputGenerationSpec): ShotVideoTakeOutputGenerationSpec {
  if (spec.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA367',
      `Unsupported shot video take final purpose: ${spec.purpose}.`
    );
  }
  return { ...spec, parameterValues: spec.parameterValues ?? {}, inputs: spec.inputs ?? [] };
}



export function validateFinalSpecAgainstContext(
  spec: ShotVideoTakeOutputGenerationSpec,
  context: ShotVideoTakeProductionContext
): void {
  validateFinalPricingSpecAgainstContext(spec, context);
  const missingInputs = missingRequiredRouteInputLabelsForFinalSpec({
    context,
    spec,
  });
  if (missingInputs.length > 0) {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      `Shot video take spec is missing required input${
        missingInputs.length === 1 ? '' : 's'
      }: ${missingInputs.join(', ')}.`
    );
  }
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  const unsupportedAudio = spec.inputs.find(
    (input) =>
      input.kind === 'audio' &&
      input.subjectKind === 'scene-dialogue' &&
      route.providerFamily !== 'kling-v3' &&
      route.providerFamily !== 'kling-o3' &&
      !route.inputSlots.some((slot) => finalInputMatchesRouteSlot(input, slot))
  );
  if (unsupportedAudio) {
    throw new ProjectDataError(
      'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED',
      'Audio references are not supported by this model route.',
      {
        suggestion:
          'Choose a shot-video model route with audio reference input support or exclude the dialogue audio references.',
      }
    );
  }
  const audioSlot = route.inputSlots.find(
    (slot) => slot.kind === 'audio' && slot.mediaKind === 'audio'
  );
  if (typeof audioSlot?.maxCount === 'number') {
    const dialogueAudioCount = spec.inputs.filter(
      (input) =>
        input.kind === 'audio' &&
        input.subjectKind === 'scene-dialogue' &&
        finalInputMatchesRouteSlot(input, audioSlot)
    ).length;
    if (dialogueAudioCount > audioSlot.maxCount) {
      throw new ProjectDataError(
        'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
        `Selected dialogue audio references exceed this model route limit: ${dialogueAudioCount} / ${audioSlot.maxCount}.`,
        {
          suggestion: `Select ${audioSlot.maxCount} or fewer dialogue audio references for this model route.`,
        }
      );
    }
  }
}



export function validateFinalPricingSpecAgainstContext(
  spec: ShotVideoTakeOutputGenerationSpec,
  context: ShotVideoTakeProductionContext
): void {
  if (!sameShotIds(spec.target.shotIds, context.target.shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA370',
      'Shot video take spec targets stale take shot ids.'
    );
  }
  const report = modelChoices(context, spec.inputModeId).find((model) => model.modelChoice === spec.modelChoice);
  if (!report || !report.available || !report.supportedInputModes.includes(spec.inputModeId)) {
    throw new ProjectDataError(
      'PROJECT_DATA371',
      'Shot video take model does not support the selected input mode for this take.'
    );
  }
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  for (const key of Object.keys(spec.parameterValues)) {
    if (!route.parameters.some((parameter) => parameter.id === key)) {
      throw new ProjectDataError(
        'PROJECT_DATA372',
        `Unsupported shot video take parameter for selected model: ${key}.`
      );
    }
  }
}



export function assertShotVideoTakeSpec(
  spec: unknown
): asserts spec is ShotVideoTakeOutputGenerationSpec {
  if (!spec || typeof spec !== 'object' || (spec as { purpose?: string }).purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError('PROJECT_DATA367', 'Media generation spec is not a shot video take spec.');
  }
}
