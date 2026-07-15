import type {
  GenerationModelDescriptor,
  GenerationReferenceGuide,
  GenerationReferenceSelection,
  GenerationSpec,
} from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';

export function bindGenerationReferenceFields(input: {
  spec: GenerationSpec;
  guide: GenerationReferenceGuide;
  models: GenerationModelDescriptor[];
}): GenerationSpec {
  const model = input.models.find((candidate) =>
    candidate.provider === input.spec.model?.provider &&
    candidate.model === input.spec.model?.model
  );
  if (!model) {
    return input.spec;
  }
  return {
    ...input.spec,
    references: input.spec.references.map((selection) => ({
      ...selection,
      providerField: referenceField(input.guide, model, selection),
    })),
  };
}

function referenceField(
  guide: GenerationReferenceGuide,
  model: GenerationModelDescriptor,
  selection: GenerationReferenceSelection
): string {
  const role = selection.placement.kind === 'additional'
    ? additionalReferenceRole(model, selection)
    : findSlot(guide, selection).providerRole;
  const fields = model.fields.filter(
    (field) => field.semantic?.kind === 'media' && field.semantic.role === role
  );
  if (fields.length !== 1) {
    throw new ProjectDataError(
      'CORE_GENERATION_REFERENCE_BINDING_UNAVAILABLE',
      `The selected model does not expose one unambiguous ${role} field for this reference.`
    );
  }
  return fields[0]!.name;
}

function additionalReferenceRole(
  model: GenerationModelDescriptor,
  selection: GenerationReferenceSelection
) {
  const currentField = selection.providerField
    ? model.fields.find((field) => field.name === selection.providerField)
    : undefined;
  if (currentField?.semantic?.kind === 'media') {
    return currentField.semantic.role;
  }
  const roles = [...new Set(model.fields.flatMap((field) =>
    field.semantic?.kind === 'media' ? [field.semantic.role] : []
  ))];
  if (roles.length !== 1) {
    throw new ProjectDataError(
      'CORE_GENERATION_REFERENCE_BINDING_UNAVAILABLE',
      'The selected model does not expose one unambiguous media field for this additional reference.'
    );
  }
  return roles[0]!;
}

function findSlot(
  guide: GenerationReferenceGuide,
  selection: GenerationReferenceSelection
) {
  if (selection.placement.kind === 'additional') {
    throw new ProjectDataError(
      'CORE_GENERATION_REFERENCE_BINDING_UNAVAILABLE',
      'Additional reference placement does not identify a typed slot.'
    );
  }
  const placement = selection.placement;
  const section = guide.sections.find((candidate) =>
    candidate.id === placement.sectionId &&
    subjectsEqual(candidate.scope, placement.scope)
  );
  const slot = section?.slots.find((candidate) =>
    candidate.id === placement.slotId &&
    subjectsEqual(candidate.subject, placement.subject)
  );
  if (!slot) {
    throw new ProjectDataError(
      'CORE_GENERATION_REFERENCE_BINDING_UNAVAILABLE',
      `Generation reference slot is unavailable: ${placement.sectionId}/${placement.slotId}.`
    );
  }
  return slot;
}

function subjectsEqual(
  left: { kind: string; id: string } | undefined,
  right: { kind: string; id: string } | undefined
): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}
