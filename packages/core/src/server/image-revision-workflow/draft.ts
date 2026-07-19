import type {
  GenerationEditorControl,
  GenerationPreviewResourceData,
  ImageRevisionDraft,
  ImageRevisionMode,
} from '../../client/index.js';
import type {
  GenerationModelDescriptor,
  GenerationPreview,
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { buildGenerationPreview } from '../generation/previews.js';
import { readGenerationPurpose } from '../generation/purposes.js';
import { applyFixedGenerationSettings } from '../generation/purpose-settings.js';
import {
  allocateGenerationReferencePromptMention,
  applyGenerationReferenceSlotSelection,
  resolveGenerationReference,
} from '../generation/references.js';
import {
  recommendedStudioImageModelFamilyId,
  readStudioImageModelFamilyId,
  resolveStudioImageRoute,
} from '../generation/image-model-authoring.js';
import { validatedStudioImageParameterValues } from '../generation/image-configurable-values.js';
import { validateGenerationSpecForExecution } from '../generation/validation.js';
import { projectGenerationPreviewResource } from '../generation-preview-resource/projection.js';
import { routeGenerationPreviewReferences } from '../generation-preview-resource/authoring.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ResolvedImageRevisionSource } from './source.js';

const SOURCE_IMAGE_PLACEMENT = {
  kind: 'slot' as const,
  sectionId: 'source',
  slotId: 'source-image',
};

export async function createImageRevisionModeDefinition(input: {
  mode: ImageRevisionMode;
  source: ResolvedImageRevisionSource;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<{
  draft: ImageRevisionDraft;
  spec: GenerationSpec;
  preview: GenerationPreviewResourceData;
  controls: GenerationEditorControl[];
}> {
  const spec = input.mode === 'regenerate'
    ? await createRegenerationSpec(input)
    : await createImageEditSpec(input);
  const preview = await buildImageRevisionPreview({
    spec,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  return {
    spec,
    draft: draftFromPreview(input.mode, preview),
    preview,
    controls: preview.authoring.controls,
  };
}

export async function buildImageRevisionSpec(input: {
  source: ResolvedImageRevisionSource;
  draft: ImageRevisionDraft;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  const definition = await createImageRevisionModeDefinition({
    mode: input.draft.mode,
    source: input.source,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  let spec = structuredClone(definition.spec);
  for (const selection of input.draft.slotSelections) {
    assertImageEditSourceIsLocked(input.draft.mode, selection);
    spec = applyGenerationReferenceSlotSelection(spec, selection);
    spec = await allocateImageMention({
      spec,
      selection,
      session: input.session,
      projectFolder: input.projectFolder,
    });
  }
  assertExactEditSource(spec, input.source, input.draft.mode);
  const purpose = readGenerationPurpose(spec.purpose);
  const context = await purpose.buildContext({
    target: spec.target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const resolvedRoute = await resolveStudioImageRoute({
    modelFamilyId: input.draft.modelFamilyId,
    hasSelectedImageReferences: await hasSelectedImages({
      spec,
      session: input.session,
      projectFolder: input.projectFolder,
    }),
    availableModels: context.models,
  });
  const promptField = requirePromptField(resolvedRoute.model);
  const negativeField = negativePromptField(resolvedRoute.model);
  const parameterValues = Object.fromEntries(
    input.draft.generationControls.map((control) => [
      control.controlId,
      control.value as JsonValue,
    ]),
  );
  spec.model = {
    provider: resolvedRoute.route.provider,
    model: resolvedRoute.route.model,
  };
  spec.values = {
    [promptField.name]: input.draft.authoredText,
    ...validatedStudioImageParameterValues({
      route: resolvedRoute.route,
      model: resolvedRoute.model,
      parameterValues,
    }),
    ...(negativeField && input.draft.negativeText !== undefined
      ? { [negativeField.name]: input.draft.negativeText }
      : {}),
  };
  spec = await routeGenerationPreviewReferences({
    spec,
    model: resolvedRoute.model,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  return applyFixedGenerationSettings({ spec, purpose });
}

export async function buildImageRevisionPreview(input: {
  spec: GenerationSpec;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationPreviewResourceData> {
  const purpose = readGenerationPurpose(input.spec.purpose);
  const authoredSpec = await applyFixedGenerationSettings({ spec: input.spec, purpose });
  const context = await purpose.buildContext({
    target: authoredSpec.target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const validation = await validateGenerationSpecForExecution({
    spec: authoredSpec,
    purpose,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const preview: GenerationPreview = {
    ...(await buildGenerationPreview({
      spec: authoredSpec,
      referenceGuide: context.referenceGuide,
      session: input.session,
      projectFolder: input.projectFolder,
      validatedRequest: validation.valid ? validation.request : undefined,
    })),
    settings: context.settings,
    models: context.models,
  };
  return projectGenerationPreviewResource({ preview, session: input.session });
}

async function createRegenerationSpec(input: {
  source: ResolvedImageRevisionSource;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  const sourceSpec = regenerationSourceSpec(input.source);
  let spec: GenerationSpec = {
    ...structuredClone(sourceSpec),
    executionKind: 'renku-managed',
  };
  for (const selection of spec.references) {
    spec = await allocateImageMention({
      spec,
      selection: { placement: selection.placement, reference: selection.reference },
      session: input.session,
      projectFolder: input.projectFolder,
    });
  }
  const purpose = readGenerationPurpose(spec.purpose);
  const context = await purpose.buildContext({
    target: spec.target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const hasImages = await hasSelectedImages({
    spec,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const sourceFamilyId = await readStudioImageModelFamilyId(sourceSpec.model);
  const modelFamilyId = sourceFamilyId && await familyCanResolve({
    modelFamilyId: sourceFamilyId,
    hasSelectedImageReferences: hasImages,
    availableModels: context.models,
  })
    ? sourceFamilyId
    : await recommendedStudioImageModelFamilyId({
        recommendedModel: context.settings.recommendedModel,
        availableModels: context.models,
        hasSelectedImageReferences: hasImages,
      });
  const resolvedRoute = await resolveStudioImageRoute({
    modelFamilyId,
    hasSelectedImageReferences: hasImages,
    availableModels: context.models,
  });
  const prompt = sourcePrompt(sourceSpec, context.models);
  const promptField = requirePromptField(resolvedRoute.model);
  const negativeField = negativePromptField(resolvedRoute.model);
  const sourceNegativeText = sourceNegativePrompt(sourceSpec, context.models);
  const parameterValues = supportedSourceValues({
    sourceSpec,
    route: resolvedRoute.route,
    model: resolvedRoute.model,
  });
  spec.model = {
    provider: resolvedRoute.route.provider,
    model: resolvedRoute.route.model,
  };
  spec.values = {
    [promptField.name]: prompt,
    ...parameterValues,
    ...(negativeField && sourceNegativeText !== undefined
      ? { [negativeField.name]: sourceNegativeText }
      : {}),
  };
  spec = await routeGenerationPreviewReferences({
    spec,
    model: resolvedRoute.model,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  return applyFixedGenerationSettings({ spec, purpose });
}

async function createImageEditSpec(input: {
  source: ResolvedImageRevisionSource;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  const purpose = readGenerationPurpose('image.edit');
  const target = { kind: 'asset' as const, id: input.source.asset.id };
  const context = await purpose.buildContext({
    target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const modelFamilyId = await recommendedStudioImageModelFamilyId({
    recommendedModel: context.settings.recommendedModel,
    availableModels: context.models,
    hasSelectedImageReferences: true,
  });
  const resolvedRoute = await resolveStudioImageRoute({
    modelFamilyId,
    hasSelectedImageReferences: true,
    availableModels: context.models,
  });
  let spec: GenerationSpec = {
    purpose: 'image.edit',
    target,
    executionKind: 'renku-managed',
    model: {
      provider: resolvedRoute.route.provider,
      model: resolvedRoute.route.model,
    },
    values: { [requirePromptField(resolvedRoute.model).name]: '' },
    references: [{
      placement: SOURCE_IMAGE_PLACEMENT,
      promptMention: '@Reference1',
      reference: {
        kind: 'asset-file',
        assetId: input.source.asset.id,
        assetFileId: input.source.file.id,
      },
    }],
    nextPromptMentionNumber: 2,
  };
  spec = await routeGenerationPreviewReferences({
    spec,
    model: resolvedRoute.model,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  return applyFixedGenerationSettings({ spec, purpose });
}

function regenerationSourceSpec(source: ResolvedImageRevisionSource): GenerationSpec {
  if (source.generationRun?.status === 'completed') {
    return source.generationRun.specSnapshot;
  }
  if (source.sourceGenerationSpec) {
    return source.sourceGenerationSpec;
  }
  throw new ProjectDataError(
    'CORE_IMAGE_REVISION_REGENERATE_PROVENANCE_REQUIRED',
    source.asset.origin === 'imported'
      ? 'Regenerate is unavailable because this image was imported and has no original generation request.'
      : 'Regenerate requires a completed generation run or frozen attached source request.',
  );
}

function draftFromPreview(
  mode: ImageRevisionMode,
  preview: GenerationPreviewResourceData,
): ImageRevisionDraft {
  return {
    mode,
    modelFamilyId: preview.authoring.selectedModelFamilyId,
    authoredText: preview.finalPrompt.authoredText,
    ...(preview.finalPrompt.negativeText !== undefined
      ? { negativeText: preview.finalPrompt.negativeText }
      : {}),
    generationControls: preview.authoring.controls
      .filter((control) => control.kind !== 'readonly')
      .map((control) => ({ controlId: control.controlId, value: control.value })),
    slotSelections: [],
  };
}

async function allocateImageMention(input: {
  spec: GenerationSpec;
  selection: GenerationReferenceSlotSelectionInput | GenerationSpec['references'][number];
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  if (!input.selection.reference) {
    return input.spec;
  }
  const resolved = await resolveGenerationReference({
    session: input.session,
    projectFolder: input.projectFolder,
    reference: input.selection.reference,
  });
  return resolved?.mediaKind === 'image'
    ? allocateGenerationReferencePromptMention({
        spec: input.spec,
        placement: input.selection.placement,
      })
    : input.spec;
}

async function hasSelectedImages(input: {
  spec: GenerationSpec;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<boolean> {
  const resolved = await Promise.all(input.spec.references.map((selection) =>
    resolveGenerationReference({
      session: input.session,
      projectFolder: input.projectFolder,
      reference: selection.reference,
    })
  ));
  return resolved.some((reference) => reference?.mediaKind === 'image');
}

async function familyCanResolve(input: Parameters<typeof resolveStudioImageRoute>[0]): Promise<boolean> {
  try {
    await resolveStudioImageRoute(input);
    return true;
  } catch (error) {
    if (error instanceof ProjectDataError &&
        (error.code === 'CORE_GENERATION_IMAGE_MODEL_FAMILY_INVALID' ||
         error.code === 'CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE')) {
      return false;
    }
    throw error;
  }
}

function supportedSourceValues(input: {
  sourceSpec: GenerationSpec;
  route: Parameters<typeof validatedStudioImageParameterValues>[0]['route'];
  model: GenerationModelDescriptor;
}): Record<string, JsonValue> {
  const candidates = Object.fromEntries(input.route.userConfigurableParameters.flatMap(
    (parameter) => input.sourceSpec.values[parameter.field] === undefined
      ? []
      : [[parameter.field, input.sourceSpec.values[parameter.field]!]],
  ));
  return validatedStudioImageParameterValues({
    route: input.route,
    model: input.model,
    parameterValues: candidates,
  });
}

function sourcePrompt(spec: GenerationSpec, models: GenerationModelDescriptor[]): string {
  const model = exactModel(spec, models);
  const field = model ? requirePromptField(model) : null;
  const value = field ? spec.values[field.name] : spec.values.prompt;
  return typeof value === 'string' ? value : '';
}

function sourceNegativePrompt(
  spec: GenerationSpec,
  models: GenerationModelDescriptor[],
): string | undefined {
  const model = exactModel(spec, models);
  const field = model ? negativePromptField(model) : null;
  const value = field ? spec.values[field.name] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function exactModel(
  spec: GenerationSpec,
  models: GenerationModelDescriptor[],
): GenerationModelDescriptor | undefined {
  return models.find((model) => model.provider === spec.model?.provider &&
    model.model === spec.model?.model);
}

function requirePromptField(model: GenerationModelDescriptor) {
  const field = model.fields.find((candidate) =>
    candidate.semantic?.kind === 'authored-text' && candidate.semantic.role === 'prompt'
  );
  if (!field) {
    throw new ProjectDataError(
      'CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE',
      'The resolved Studio image route has no authored prompt field.',
    );
  }
  return field;
}

function negativePromptField(model: GenerationModelDescriptor) {
  return model.fields.find((candidate) =>
    candidate.semantic?.kind === 'authored-text' &&
    candidate.semantic.role === 'negative-prompt'
  );
}

function assertImageEditSourceIsLocked(
  mode: ImageRevisionMode,
  selection: GenerationReferenceSlotSelectionInput,
): void {
  if (mode === 'edit' && selection.placement.sectionId === SOURCE_IMAGE_PLACEMENT.sectionId &&
      selection.placement.slotId === SOURCE_IMAGE_PLACEMENT.slotId) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_SOURCE_REQUIRED',
      'The exact source image selection is locked for Image Revision Edit.',
    );
  }
}

function assertExactEditSource(
  spec: GenerationSpec,
  source: ResolvedImageRevisionSource,
  mode: ImageRevisionMode,
): void {
  if (mode !== 'edit') {
    return;
  }
  const selection = spec.references.find((candidate) =>
    candidate.placement.kind === 'slot' &&
    candidate.placement.sectionId === SOURCE_IMAGE_PLACEMENT.sectionId &&
    candidate.placement.slotId === SOURCE_IMAGE_PLACEMENT.slotId
  );
  if (selection?.reference.kind !== 'asset-file' ||
      selection.reference.assetId !== source.asset.id ||
      selection.reference.assetFileId !== source.file.id) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_SOURCE_REQUIRED',
      'Image Revision Edit requires the exact source image.',
    );
  }
}
