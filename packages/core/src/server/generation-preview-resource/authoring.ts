import type {
  GenerationModelDescriptor,
  GenerationModelIdentity,
  GenerationOutputMediaKind,
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveGenerationReference } from '../generation/references.js';
import { ProjectDataError } from '../project-data-error.js';

export function readGenerationPreviewModel(input: {
  models: GenerationModelDescriptor[];
  identity: Required<GenerationModelIdentity>;
}): GenerationModelDescriptor {
  const model = input.models.find(
    (candidate) =>
      candidate.provider === input.identity.provider &&
      candidate.model === input.identity.model
  );
  if (!model) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_MODEL_UNAVAILABLE',
      'The selected generation model is not available for this purpose.'
    );
  }
  return model;
}

export function validatedGenerationPreviewParameterValues(
  model: GenerationModelDescriptor,
  parameterValues: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const fields = new Map(
    model.fields
      .filter((field) => !field.media && field.semantic?.kind !== 'authored-text')
      .map((field) => [field.name, field])
  );
  const values: Record<string, JsonValue> = {};
  for (const [name, value] of Object.entries(parameterValues)) {
    if (!fields.has(name)) {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_PARAMETER_UNAVAILABLE',
        `The selected generation model does not expose parameter ${name}.`
      );
    }
    if (value !== null) {
      values[name] = value;
    }
  }
  return values;
}

export async function routeGenerationPreviewReferences(input: {
  spec: GenerationSpec;
  model: GenerationModelDescriptor;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  const references = await Promise.all(
    input.spec.references.map(async (selection) => {
      const resolved = await resolveGenerationReference({
        session: input.session,
        projectFolder: input.projectFolder,
        reference: selection.reference,
      });
      if (!resolved) {
        return selection;
      }
      const providerField = selectGenerationPreviewProviderField({
        model: input.model,
        mediaKind: resolved.mediaKind,
        currentProviderField: selection.providerField,
      });
      if (!providerField) {
        const { providerField: _providerField, ...unrouted } = selection;
        return unrouted;
      }
      return { ...selection, providerField };
    })
  );
  return { ...input.spec, references };
}

export function selectGenerationPreviewProviderField(input: {
  model: GenerationModelDescriptor;
  mediaKind: GenerationOutputMediaKind;
  currentProviderField?: string;
}): string | undefined {
  const compatibleFields = input.model.fields.filter(
    (field) => field.media?.acceptedKinds.includes(input.mediaKind)
  );
  const semanticMediaFields = compatibleFields.filter(
    (field) => field.semantic?.kind === 'media'
  );
  const mediaFields = semanticMediaFields.length > 0
    ? semanticMediaFields
    : compatibleFields;
  return mediaFields.find(
    (field) => field.name === input.currentProviderField
  )?.name ?? (mediaFields.length === 1 ? mediaFields[0]?.name : undefined);
}
