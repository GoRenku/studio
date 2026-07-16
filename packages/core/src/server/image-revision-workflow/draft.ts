import type {
  GenerationEditorControl,
  GenerationPreviewResourceData,
  ImageRevisionDraft,
  ImageRevisionMode,
} from '../../client/index.js';
import type {
  GenerationContext,
  GenerationModelDescriptor,
  GenerationPreview,
  GenerationReferenceGuide,
  GenerationReferenceSelection,
  GenerationSpec,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { buildGenerationPreview } from '../generation/previews.js';
import { readGenerationPurpose } from '../generation/purposes.js';
import { applyFixedGenerationSettings } from '../generation/purpose-settings.js';
import { validateGenerationSpecForExecution } from '../generation/validation.js';
import { projectGenerationPreviewResource } from '../generation-preview-resource/projection.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ResolvedImageRevisionSource } from './source.js';

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
    ? requireRegenerationSpec(input.source)
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
    controls: controlsFromPreview(preview),
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
  const model = await modelForSpec(definition.spec, input.session, input.projectFolder);
  const supportedControls = new Set(
    model.fields
      .filter((field) => !field.media && field.semantic?.kind !== 'authored-text')
      .map((field) => field.name)
  );
  const values = { ...definition.spec.values };
  for (const control of input.draft.generationControls) {
    if (!supportedControls.has(control.controlId)) {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_CONTROL_UNSUPPORTED',
        `Unsupported Image Revision control: ${control.controlId}.`
      );
    }
    values[control.controlId] = control.value;
  }
  const promptField = field(model, 'authored-text', 'prompt');
  const negativeField = field(model, 'authored-text', 'negative-prompt');
  values[promptField.name] = input.draft.authoredText;
  if (negativeField && input.draft.negativeText !== undefined) {
    values[negativeField.name] = input.draft.negativeText;
  }
  const spec: GenerationSpec = {
    ...definition.spec,
    values,
  };
  return spec;
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
      referenceGuide: exactReferenceGuide(
        context.referenceGuide,
        authoredSpec.references,
      ),
      session: input.session,
      projectFolder: input.projectFolder,
      validatedRequest: validation.valid ? validation.request : undefined,
    })),
    settings: context.settings,
    models: context.models,
  };
  return projectGenerationPreviewResource({ preview, session: input.session });
}

function requireRegenerationSpec(source: ResolvedImageRevisionSource): GenerationSpec {
  const spec = source.generationRun?.specSnapshot;
  if (!spec || source.generationRun?.status !== 'completed') {
    if (source.asset.origin === 'imported') {
      throw new ProjectDataError(
        'CORE_IMAGE_REVISION_REGENERATE_PROVENANCE_REQUIRED',
        'Regenerate is unavailable because this image was imported and has no original generation request.'
      );
    }
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_REGENERATE_PROVENANCE_REQUIRED',
      'Regenerate requires exact completed generation provenance for the source AssetFile.'
    );
  }
  return structuredClone(spec);
}

async function createImageEditSpec(input: {
  source: ResolvedImageRevisionSource;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  const purpose = readGenerationPurpose('image.edit');
  const context = await purpose.buildContext({
    target: { kind: 'asset', id: input.source.asset.id },
    session: input.session,
    projectFolder: input.projectFolder,
  });
  const model = recommendedModel(context);
  const sourceField = model.fields.find(
    (candidate) => candidate.semantic?.kind === 'media' && candidate.semantic.role === 'source-image'
  ) ?? model.fields.find(
    (candidate) => candidate.semantic?.kind === 'media' && candidate.semantic.role === 'reference-image'
  );
  if (!sourceField) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_MODEL_UNAVAILABLE',
      'No available image-edit model accepts a source image.'
    );
  }
  const selection: GenerationReferenceSelection = {
    id: `image-revision-source:${input.source.file.id}`,
    placement: { kind: 'slot', sectionId: 'source', slotId: 'source-image' },
    reference: {
      kind: 'asset-file',
      assetId: input.source.asset.id,
      assetFileId: input.source.file.id,
    },
  };
  return {
    purpose: 'image.edit',
    target: { kind: 'asset', id: input.source.asset.id },
    model: { provider: model.provider, model: model.model },
    values: {},
    references: [
      selection,
    ],
  };
}

async function modelForSpec(
  spec: GenerationSpec,
  session: DatabaseSession,
  projectFolder: string
): Promise<GenerationModelDescriptor> {
  const context = await readGenerationPurpose(spec.purpose).buildContext({
    target: spec.target,
    session,
    projectFolder,
  });
  const model = context.models.find((candidate) =>
    candidate.provider === spec.model?.provider && candidate.model === spec.model?.model
  );
  if (!model) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_MODEL_UNAVAILABLE',
      'The source model is not currently available for Image Revision.'
    );
  }
  return model;
}

function recommendedModel(context: GenerationContext): GenerationModelDescriptor {
  return context.models.find((candidate) =>
    candidate.provider === context.settings.recommendedModel?.provider &&
    candidate.model === context.settings.recommendedModel?.model
  ) ?? context.models[0] ?? (() => {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_MODEL_UNAVAILABLE',
      'No image-edit model is currently available.'
    );
  })();
}

function draftFromPreview(
  mode: ImageRevisionMode,
  preview: GenerationPreviewResourceData
): ImageRevisionDraft {
  return {
    mode,
    authoredText: preview.finalPrompt.authoredText,
    ...(preview.finalPrompt.negativeText !== undefined
      ? { negativeText: preview.finalPrompt.negativeText }
      : {}),
    generationControls: controlsFromPreview(preview).map((control) => ({
      controlId: control.controlId,
      value: control.value,
    })),
  };
}

function exactReferenceGuide(
  guide: GenerationReferenceGuide,
  references: GenerationReferenceSelection[],
): GenerationReferenceGuide {
  const selectedPlacements = new Set(
    references.flatMap((selection) =>
      selection.placement.kind === 'slot'
        ? [referencePlacementKey(selection.placement)]
        : []
    ),
  );
  return {
    sections: guide.sections.flatMap((section) => {
      const slots = section.slots
        .filter((slot) =>
          selectedPlacements.has(referencePlacementKey({
            kind: 'slot',
            sectionId: section.id,
            slotId: slot.id,
            ...(slot.subject ? { subject: slot.subject } : {}),
          }))
        )
        .map((slot) => ({ ...slot, eligibleCandidates: [] }));
      return slots.length ? [{ ...section, slots }] : [];
    }),
    notices: guide.notices,
  };
}

function referencePlacementKey(
  placement: Extract<
    GenerationReferenceSelection['placement'],
    { kind: 'slot' }
  >,
): string {
  return [
    placement.sectionId,
    placement.slotId,
    placement.subject?.kind ?? '',
    placement.subject?.id ?? '',
  ].join(':');
}

function controlsFromPreview(preview: GenerationPreviewResourceData): GenerationEditorControl[] {
  return preview.configuration.sections.flatMap((section) =>
    section.rows.flatMap((row): GenerationEditorControl[] => {
      if (row.presentation !== 'parameter-control') {
        return [];
      }
      if (row.allowedValues) {
        return [{
          controlId: row.key,
          kind: 'select',
          label: row.label,
          value: row.value,
          required: row.required ?? false,
          options: row.allowedValues.map((value) => ({ label: String(value), value })),
        }];
      }
      if (typeof row.value === 'number') {
        return [{
          controlId: row.key,
          kind: 'number',
          label: row.label,
          value: row.value,
          required: row.required ?? false,
          ...(row.minimum !== undefined ? { min: row.minimum } : {}),
          ...(row.maximum !== undefined ? { max: row.maximum } : {}),
        }];
      }
      return [{
        controlId: row.key,
        kind: 'readonly',
        label: row.label,
        value: row.value,
      }];
    })
  );
}

function field(
  model: GenerationModelDescriptor,
  kind: 'authored-text',
  role: 'prompt'
): GenerationModelDescriptor['fields'][number];
function field(
  model: GenerationModelDescriptor,
  kind: 'authored-text',
  role: 'negative-prompt'
): GenerationModelDescriptor['fields'][number] | undefined;
function field(
  model: GenerationModelDescriptor,
  kind: 'authored-text',
  role: 'prompt' | 'negative-prompt'
) {
  const result = model.fields.find(
    (candidate) => candidate.semantic?.kind === kind && candidate.semantic.role === role
  );
  if (!result && role === 'prompt') {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_MODEL_UNAVAILABLE',
      'Image Revision model does not expose authored prompt text.'
    );
  }
  return result;
}
