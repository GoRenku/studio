import type {
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
  JsonValue,
  ShotPlanVideoInputMode,
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
} from '../generation/references.js';
import { applyFixedGenerationSettings } from '../generation/purpose-settings.js';
import { readGenerationPreviewAuthoringStrategy } from './authoring-strategies/registry.js';

export async function updateGenerationPreviewResource(input: {
  specId: string;
  prompt: { authoredText: string; negativeText?: string | null };
  modelFamilyId?: string;
  shotPlanVideoInputMode?: ShotPlanVideoInputMode;
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
    authoredFrom: record.spec.authoredFrom,
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
  if (!input.modelFamilyId) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_MODEL_REQUIRED',
      'Managed generation Preview updates require a model family.'
    );
  }
  let spec = await readGenerationPreviewAuthoringStrategy(
    input.purpose.outputMediaKind,
  ).update({
    spec: record.spec,
    prompt: input.prompt,
    modelFamilyId: input.modelFamilyId,
    shotPlanVideoInputMode: input.shotPlanVideoInputMode,
    parameterValues: input.parameterValues,
    slotSelections: input.slotSelections,
    purpose: input.purpose,
    availableModels: context.models,
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const guide = context.referenceGuide;
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
