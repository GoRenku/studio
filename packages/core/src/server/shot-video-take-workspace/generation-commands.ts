import {
  bindGenerationSemanticValues,
  describeGenerationModelInputs,
  listStudioModelAvailability,
} from '@gorenku/studio-engines';
import type {
  GenerationCostEstimateReport,
  GenerationModelDescriptor,
  GenerationReference,
  GenerationReferenceSelection,
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
  GenerationSpecRecord,
  JsonValue,
} from '../../client/generation.js';
import type {
  ShotVideoTakeGenerationSetup,
  ShotVideoTakeWorkspaceMutationReport,
} from '../../client/shot-video-take-workspace.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { requireSceneShotVideoTakeAuthoringOpen } from '../database/access/shot-video-take-media.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import {
  estimateGenerationCost,
  requiredInputMediaCounts,
} from '../generation/estimates.js';
import { readGenerationPurpose } from '../generation/purposes.js';
import {
  applyGenerationGenericReferences,
  applyGenerationReferenceSlotSelection,
} from '../generation/references.js';
import {
  createGenerationSpec,
  listGenerationSpecs,
  updateGenerationSpec,
} from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';
import { modelIdentityFromChoice } from './generation-session.js';
import { resourceKeys } from './lifecycle-commands.js';
import {
  requireShotVideoTakeSelectionContext,
} from './queries.js';
import { readShotVideoTakeWorkspace } from './workspace.js';
import {
  isShotVideoTakeGenerationParameter,
} from './generation-parameter-presentation.js';

export async function setShotVideoTakeGenerationSpec(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  selectedShotId?: string;
  setup: ShotVideoTakeGenerationSetup;
  idGenerator: ProjectIdGenerator;
  now: string;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  requireShotVideoTakeSelectionContext(input);
  requireSceneShotVideoTakeAuthoringOpen(input);
  const context = await readGenerationPurpose('shot.video-take').buildContext({
    target: { kind: 'sceneShotVideoTake', id: input.takeId },
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const model = modelIdentityFromChoice(context, input.setup.modelChoice);
  if (!model) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_MODEL_INVALID',
      'Choose an available Shot Video Take generation model.'
    );
  }
  const current = currentSpec(input.session, input.takeId);
  const spec = await buildSetupSpec({
    current: current?.spec ?? null,
    model,
    setup: input.setup,
    references: current?.spec.references ?? [],
    takeId: input.takeId,
  });
  const purpose = readGenerationPurpose('shot.video-take');
  if (current) {
    updateGenerationSpec({
      id: current.id,
      spec,
      purpose,
      session: input.session,
      now: input.now,
    });
  } else {
    createGenerationSpec({
      id: input.idGenerator.next('media_generation_spec'),
      spec,
      purpose,
      session: input.session,
      now: input.now,
    });
  }
  const workspace = await readShotVideoTakeWorkspace(input);
  return { workspace, resourceKeys: resourceKeys(input.sceneId, input.takeId) };
}

export async function setShotVideoTakeGenerationReference(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  selectedShotId?: string;
  selection: GenerationReferenceSlotSelectionInput;
  idGenerator: ProjectIdGenerator;
  now: string;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  requireShotVideoTakeSelectionContext(input);
  requireSceneShotVideoTakeAuthoringOpen(input);
  const current = currentSpec(input.session, input.takeId);
  const purpose = readGenerationPurpose('shot.video-take');
  const base = current?.spec ?? {
    purpose: 'shot.video-take' as const,
    target: { kind: 'sceneShotVideoTake' as const, id: input.takeId },
    values: {},
    references: [],
  };
  const spec = applyGenerationReferenceSlotSelection(base, input.selection);
  if (current) {
    updateGenerationSpec({
      id: current.id,
      spec,
      purpose,
      session: input.session,
      now: input.now,
    });
  } else {
    createGenerationSpec({
      id: input.idGenerator.next('media_generation_spec'),
      spec,
      purpose,
      session: input.session,
      now: input.now,
    });
  }
  const workspace = await readShotVideoTakeWorkspace(input);
  return { workspace, resourceKeys: resourceKeys(input.sceneId, input.takeId) };
}

export async function setShotVideoTakeGenerationGenericReferences(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  selectedShotId?: string;
  references: GenerationReference[];
  idGenerator: ProjectIdGenerator;
  now: string;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  requireShotVideoTakeSelectionContext(input);
  requireSceneShotVideoTakeAuthoringOpen(input);
  const current = currentSpec(input.session, input.takeId);
  const purpose = readGenerationPurpose('shot.video-take');
  const base = current?.spec ?? {
    purpose: 'shot.video-take' as const,
    target: { kind: 'sceneShotVideoTake' as const, id: input.takeId },
    values: {},
    references: [],
  };
  const spec = applyGenerationGenericReferences(base, input.references);
  if (current) {
    updateGenerationSpec({
      id: current.id,
      spec,
      purpose,
      session: input.session,
      now: input.now,
    });
  } else {
    createGenerationSpec({
      id: input.idGenerator.next('media_generation_spec'),
      spec,
      purpose,
      session: input.session,
      now: input.now,
    });
  }
  const workspace = await readShotVideoTakeWorkspace(input);
  return { workspace, resourceKeys: resourceKeys(input.sceneId, input.takeId) };
}

export async function estimateShotVideoTakeGeneration(input: {
  setup?: ShotVideoTakeGenerationSetup;
}): Promise<GenerationCostEstimateReport> {
  if (!input.setup) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_SPEC_REQUIRED',
      'Choose a Shot Video Take generation setup before estimating it.'
    );
  }
  const selectedModel = (await listStudioModelAvailability({
    mediaKind: 'video',
    use: 'any',
  })).find(
    (model) => `${model.provider}/${model.model}` === input.setup?.modelChoice
  ) ?? requireModel();
  const descriptor = await describeGenerationModelInputs({
    provider: selectedModel.provider,
    model: selectedModel.model,
  });
  if (!descriptor) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_MODEL_INVALID',
      'The selected Shot Video Take model has no current provider descriptor.'
    );
  }
  const supportedParameters = new Set(
    descriptor.fields
      .filter(isShotVideoTakeGenerationParameter)
      .map((field) => field.name)
  );
  const values = Object.fromEntries(
    Object.entries(input.setup.parameterValues).filter(([name]) =>
      supportedParameters.has(name)
    )
  ) as Record<string, JsonValue>;
  return estimateGenerationCost({
    provider: selectedModel.provider,
    model: selectedModel.model,
    mediaKind: 'video',
    values,
    inputMediaCounts: requiredInputMediaCounts(descriptor),
  });
}

async function buildSetupSpec(input: {
  current: GenerationSpec | null;
  model: GenerationModelDescriptor;
  setup: ShotVideoTakeGenerationSetup;
  references: GenerationReferenceSelection[];
  takeId: string;
}): Promise<GenerationSpec> {
  const oldPrompt = authoredValue(input.current, 'prompt');
  const oldNegativePrompt = authoredValue(input.current, 'negative-prompt');
  const descriptor = await describeGenerationModelInputs({
    provider: input.model.provider,
    model: input.model.model,
  });
  if (!descriptor) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_MODEL_INVALID',
      'The selected Shot Video Take model has no current provider descriptor.'
    );
  }
  const semanticValues = bindGenerationSemanticValues({
    descriptor,
    values: {
      ...(oldPrompt !== undefined ? { prompt: oldPrompt } : {}),
      ...(oldNegativePrompt !== undefined ? { negativePrompt: oldNegativePrompt } : {}),
    },
  });
  const supportedParameters = new Set(
    descriptor.fields
      .filter(isShotVideoTakeGenerationParameter)
      .map((field) => field.name)
  );
  const parameterValues = Object.fromEntries(
    Object.entries(input.setup.parameterValues).filter(([name]) =>
      supportedParameters.has(name)
    )
  ) as Record<string, JsonValue>;
  const values = {
    ...semanticValues,
    ...parameterValues,
  } as GenerationSpec['values'];
  return {
    purpose: 'shot.video-take',
    target: { kind: 'sceneShotVideoTake', id: input.takeId },
    model: { provider: input.model.provider, model: input.model.model },
    values,
    references: input.references,
    title: input.current?.title,
  };
}

function authoredValue(
  spec: GenerationSpec | null,
  role: 'prompt' | 'negative-prompt'
): string | undefined {
  if (!spec?.model?.provider || !spec.model.model) {
    return undefined;
  }
  const value = Object.entries(spec.values).find(([name]) =>
    role === 'prompt'
      ? name === 'prompt' || name === 'text'
      : name === 'negative_prompt' || name === 'negativePrompt'
  )?.[1];
  return typeof value === 'string' ? value : undefined;
}

function currentSpec(session: DatabaseSession, takeId: string): GenerationSpecRecord | null {
  return listGenerationSpecs({
    session,
    purpose: 'shot.video-take',
    target: { kind: 'sceneShotVideoTake', id: takeId },
  })[0] ?? null;
}

function requireModel(): never {
  throw new ProjectDataError(
    'CORE_SHOT_VIDEO_TAKE_MODEL_INVALID',
    'Choose an available Shot Video Take generation model.'
  );
}
