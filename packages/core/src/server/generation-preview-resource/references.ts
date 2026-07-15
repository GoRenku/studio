import type {
  GenerationPreview,
  GenerationReferenceCatalogItem,
  GenerationReferenceSelection,
} from '../../client/generation.js';
import type {
  GenerationPreviewReferenceSlot,
  GenerationPreviewResourceReference,
} from '../../client/generation-preview-resource.js';
import { ProjectDataError } from '../project-data-error.js';

type ProjectedReference = Omit<GenerationPreviewResourceReference, 'browserUrl'>;

export function projectGenerationPreviewReferences(
  preview: GenerationPreview
): {
  slots: Array<Omit<GenerationPreviewReferenceSlot, 'candidates'> & {
    candidates: ProjectedReference[];
  }>;
  additional: ProjectedReference[];
} {
  const slots = preview.referenceGuide.sections.flatMap((section) =>
    section.slots.flatMap((slot) => {
      const placement = {
        kind: 'slot' as const,
        sectionId: section.id,
        slotId: slot.id,
        ...(section.scope ? { scope: section.scope } : {}),
        ...(slot.subject ? { subject: slot.subject } : {}),
      };
      const selected = preview.references.find((reference) =>
        reference.included && placementsEqual(reference.placement, placement)
      );
      if (slot.candidates.length === 0 && !selected) {
        return [];
      }
      return [{
        label: slot.label,
        placement,
        candidates: slot.candidates.map((candidate) =>
          projectCatalogItem(candidate, selected?.reference, selected)
        ),
      }];
    })
  );
  const additional = preview.references
    .filter((selection) => selection.placement.kind === 'additional')
    .map(projectSavedReference);
  return { slots, additional };
}

function projectCatalogItem(
  candidate: GenerationReferenceCatalogItem,
  selectedReference: GenerationReferenceSelection['reference'] | undefined,
  selection: GenerationReferenceSelection | undefined
): ProjectedReference {
  if (candidate.reference.kind !== 'asset-file') {
    throw unavailable(candidate.label);
  }
  const selected = selectedReference
    ? referencesEqual(candidate.reference, selectedReference)
    : false;
  return {
    kind: candidate.mediaKind,
    role: candidate.role,
    label: candidate.label,
    ...(selected && selection?.providerField
      ? { providerToken: selection.providerField }
      : {}),
    assetId: candidate.reference.assetId,
    assetFileId: candidate.reference.assetFileId,
    sourcePurpose: candidate.provenance.origin,
    selected,
  };
}

function projectSavedReference(
  selection: GenerationPreview['references'][number]
): ProjectedReference {
  const resolved = selection.resolved;
  if (!resolved || selection.reference.kind !== 'asset-file') {
    throw unavailable(selection.id);
  }
  return {
    kind: resolved.mediaKind,
    role: resolved.role,
    label: resolved.label,
    ...(selection.providerField ? { providerToken: selection.providerField } : {}),
    assetId: selection.reference.assetId,
    assetFileId: selection.reference.assetFileId,
    sourcePurpose: resolved.provenance.origin,
    selected: selection.included,
  };
}

function placementsEqual(
  left: GenerationReferenceSelection['placement'],
  right: GenerationReferenceSelection['placement']
): boolean {
  return left.kind === 'slot' && right.kind === 'slot' &&
    left.sectionId === right.sectionId &&
    left.slotId === right.slotId &&
    subjectsEqual(left.scope, right.scope) &&
    subjectsEqual(left.subject, right.subject);
}

function subjectsEqual(
  left: { kind: string; id: string } | undefined,
  right: { kind: string; id: string } | undefined
): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}

function referencesEqual(
  left: GenerationReferenceSelection['reference'],
  right: GenerationReferenceSelection['reference']
): boolean {
  return left.kind === 'asset-file' && right.kind === 'asset-file'
    ? left.assetId === right.assetId && left.assetFileId === right.assetFileId
    : left.kind === 'project-file' && right.kind === 'project-file'
      ? left.projectRelativePath === right.projectRelativePath
      : false;
}

function unavailable(identity: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_GENERATION_PREVIEW_REFERENCE_UNAVAILABLE',
    `Generation preview reference is not an available exact asset file: ${identity}.`
  );
}
