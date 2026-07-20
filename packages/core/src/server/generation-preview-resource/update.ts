import type {
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { buildGenerationPreview } from '../generation/previews.js';
import type { GenerationPurposeDescriptor } from '../generation/purpose-contract.js';
import { readGenerationSpec, updateGenerationSpec } from '../generation/specs.js';
import { validateGenerationSpecForExecution } from '../generation/validation.js';
import { projectGenerationPreviewResource } from './projection.js';
import {
  applyGenerationReferenceSlotSelection,
  allocateGenerationReferencePromptMention,
  resolveGenerationReference,
} from '../generation/references.js';
import {
  routeGenerationPreviewReferences,
} from './authoring.js';
import { resolveStudioImageRoute } from '../generation/image-model-authoring.js';
import { validatedStudioImageParameterValues } from '../generation/image-configurable-values.js';
import { applyFixedGenerationSettings } from '../generation/purpose-settings.js';

export async function updateGenerationPreviewResource(input: {
  specId: string;
  prompt: { authoredText: string; negativeText?: string | null };
  modelFamilyId?: string;
  parameterValues: Record<string, JsonValue>;
  slotSelections: GenerationReferenceSlotSelectionInput[];
  purpose: GenerationPurposeDescriptor;
  session: DatabaseSession;
  projectFolder: string;
  now: string;
}) {
  const record = readGenerationSpec({ id: input.specId, session: input.session });
  const context = await input.purpose.buildContext({
    target: record.spec.target,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  if (record.spec.executionKind === 'agent-external') {
    if (Object.keys(input.parameterValues).length > 0) {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_EXTERNAL_PARAMETERS_UNSUPPORTED',
        'External generation Preview updates support prompt and reference changes only.'
      );
    }
    let spec: GenerationSpec = {
      ...structuredClone(record.spec),
      values: {
        ...record.spec.values,
        prompt: input.prompt.authoredText,
      },
    };
    for (const selection of input.slotSelections) {
      spec = applyGenerationReferenceSlotSelection(spec, selection);
    }
    const updated = updateGenerationSpec({
      id: input.specId,
      spec,
      purpose: input.purpose,
      session: input.session,
      now: input.now,
    });
    const preview = await buildGenerationPreview({
      spec: updated.spec,
      referenceGuide: context.referenceGuide,
      session: input.session,
      projectFolder: input.projectFolder,
    });
    return projectGenerationPreviewResource({
      preview: {
        ...preview,
        generationSpec: { id: updated.id, frozenAt: updated.frozenAt },
        settings: context.settings,
        models: [],
      },
      session: input.session,
    });
  }
  let spec: GenerationSpec = structuredClone(record.spec);
  if (!input.modelFamilyId) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_MODEL_REQUIRED',
      'Managed generation Preview updates require a model family.'
    );
  }
  for (const selection of input.slotSelections) {
    spec = applyGenerationReferenceSlotSelection(spec, selection);
    if (!selection.reference) {
      continue;
    }
    const resolved = await resolveGenerationReference({
      session: input.session,
      projectFolder: input.projectFolder,
      reference: selection.reference,
    });
    if (resolved?.mediaKind === 'image') {
      spec = allocateGenerationReferencePromptMention({
        spec,
        placement: selection.placement,
      });
    }
  }
  const resolvedReferences = await Promise.all(spec.references.map((selection) =>
    resolveGenerationReference({
      session: input.session,
      projectFolder: input.projectFolder,
      reference: selection.reference,
    })
  ));
  const resolvedRoute = await resolveStudioImageRoute({
    modelFamilyId: input.modelFamilyId,
    hasSelectedImageReferences: resolvedReferences.some(
      (reference) => reference?.mediaKind === 'image',
    ),
    availableModels: context.models,
  });
  const model = resolvedRoute.model;
  const promptField = model?.fields.find(
    (field) =>
      field.semantic?.kind === 'authored-text' &&
      field.semantic.role === 'prompt'
  );
  if (!promptField) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_PROMPT_UNSUPPORTED',
      'The selected generation model does not expose an authored prompt field.'
    );
  }
  const negativeField = model?.fields.find(
    (field) =>
      field.semantic?.kind === 'authored-text' &&
      field.semantic.role === 'negative-prompt'
  );
  if (input.prompt.negativeText !== undefined && !negativeField) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_NEGATIVE_PROMPT_UNSUPPORTED',
      'The selected generation model does not expose a negative prompt field.'
    );
  }
  spec.model = {
    provider: resolvedRoute.route.provider,
    model: resolvedRoute.route.model,
  };
  spec.values = {
    [promptField.name]: input.prompt.authoredText,
    ...validatedStudioImageParameterValues({
      route: resolvedRoute.route,
      model,
      parameterValues: input.parameterValues,
    }),
  };
  if (negativeField && input.prompt.negativeText !== undefined) {
    if (input.prompt.negativeText !== null) {
      spec.values[negativeField.name] = input.prompt.negativeText;
    }
  }
  const guide = context.referenceGuide;
  spec = await routeGenerationPreviewReferences({
    spec,
    model,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  spec = await applyFixedGenerationSettings({ spec, purpose: input.purpose });
  const updated = updateGenerationSpec({
    id: input.specId,
    spec,
    purpose: input.purpose,
    session: input.session,
    now: input.now,
  });
  const validation = await validateGenerationSpecForExecution({
    spec: updated.spec,
    purpose: input.purpose,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const preview = await buildGenerationPreview({
    spec: updated.spec,
    referenceGuide: guide,
    session: input.session,
    projectFolder: input.projectFolder,
    ...(validation.valid ? { validatedRequest: validation.request } : {}),
  });
  return projectGenerationPreviewResource({
    preview: {
      ...preview,
      generationSpec: { id: updated.id, frozenAt: updated.frozenAt },
      settings: context.settings,
      models: context.models,
    },
    session: input.session,
  });
}
