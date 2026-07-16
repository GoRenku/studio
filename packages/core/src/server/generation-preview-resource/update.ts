import type {
  GenerationReference,
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { buildGenerationPreview } from '../generation/previews.js';
import type { GenerationPurposeDescriptor } from '../generation/purpose-contract.js';
import { readGenerationSpec, updateGenerationSpec } from '../generation/specs.js';
import { validateGenerationSpecForExecution } from '../generation/validation.js';
import { projectGenerationPreviewResource } from './projection.js';
import {
  applyGenerationGenericReferences,
  applyGenerationReferenceSlotSelection,
} from '../generation/references.js';

export async function updateGenerationPreviewResource(input: {
  specId: string;
  prompt: { authoredText: string; negativeText?: string | null };
  slotSelections: GenerationReferenceSlotSelectionInput[];
  genericReferences: GenerationReference[];
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
  const model = context.models.find(
    (candidate) =>
      candidate.provider === record.spec.model?.provider &&
      candidate.model === record.spec.model?.model
  );
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
  let spec: GenerationSpec = structuredClone(record.spec);
  spec.values[promptField.name] = input.prompt.authoredText;
  if (negativeField && input.prompt.negativeText !== undefined) {
    if (input.prompt.negativeText === null) {
      delete spec.values[negativeField.name];
    } else {
      spec.values[negativeField.name] = input.prompt.negativeText;
    }
  }
  const guide = context.referenceGuide;
  for (const selection of input.slotSelections) {
    spec = applyGenerationReferenceSlotSelection(spec, selection);
  }
  spec = applyGenerationGenericReferences(spec, input.genericReferences);
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
      specId: input.specId,
      settings: context.settings,
      models: context.models,
    },
    session: input.session,
  });
}
