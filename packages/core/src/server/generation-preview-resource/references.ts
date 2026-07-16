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
type ProjectedSlot = Omit<
  GenerationPreviewReferenceSlot,
  'current' | 'eligibleCandidates'
> & {
  current: ProjectedReference | null;
  eligibleCandidates: ProjectedReference[];
};

export function projectGenerationPreviewReferences(
  preview: GenerationPreview
): { slots: ProjectedSlot[]; additional: ProjectedReference[] } {
  const slots = new Map<string, ProjectedSlot>();
  for (const selection of preview.references) {
    if (selection.placement.kind !== 'slot') {
      continue;
    }
    slots.set(placementKey(selection.placement), {
      label: selection.placement.slotId,
      placement: selection.placement,
      current: projectSavedReference(selection),
      eligibleCandidates: [],
    });
  }
  for (const section of preview.referenceGuide.sections) {
    for (const slot of section.slots) {
      const placement = {
        kind: 'slot' as const,
        sectionId: section.id,
        slotId: slot.id,
        ...(slot.subject ? { subject: slot.subject } : {}),
      };
      const key = placementKey(placement);
      const persisted = slots.get(key);
      slots.set(key, {
        label: slot.label,
        placement,
        current: persisted?.current ?? null,
        eligibleCandidates: slot.eligibleCandidates.map(projectCatalogItem),
      });
    }
  }
  return {
    slots: [...slots.values()],
    additional: preview.references
      .filter((selection) => selection.placement.kind === 'additional')
      .map(projectSavedReference),
  };
}

function projectCatalogItem(
  candidate: GenerationReferenceCatalogItem
): ProjectedReference {
  if (candidate.reference.kind !== 'asset-file') {
    throw unavailable(candidate.label);
  }
  return {
    kind: candidate.mediaKind,
    role: candidate.role,
    label: candidate.label,
    assetId: candidate.reference.assetId,
    assetFileId: candidate.reference.assetFileId,
    sourcePurpose: candidate.provenance.origin,
    selected: false,
  };
}

function projectSavedReference(
  selection: GenerationPreview['references'][number]
): ProjectedReference {
  if (selection.reference.kind !== 'asset-file') {
    throw unavailable(selection.id);
  }
  const resolved = selection.resolved;
  return {
    kind: resolved?.mediaKind ?? 'image',
    role: resolved?.role ?? 'unavailable',
    label: resolved?.label ?? 'Unavailable reference',
    ...(selection.providerField ? { providerToken: selection.providerField } : {}),
    assetId: selection.reference.assetId,
    assetFileId: selection.reference.assetFileId,
    ...(resolved ? { sourcePurpose: resolved.provenance.origin } : {}),
    selected: true,
  };
}

function placementKey(
  placement: Extract<GenerationReferenceSelection['placement'], { kind: 'slot' }>
): string {
  return [
    placement.sectionId,
    placement.slotId,
    placement.subject?.kind ?? '',
    placement.subject?.id ?? '',
  ].join('\0');
}

function unavailable(identity: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_GENERATION_PREVIEW_REFERENCE_UNAVAILABLE',
    `Generation preview reference is not an available exact asset file: ${identity}.`
  );
}
