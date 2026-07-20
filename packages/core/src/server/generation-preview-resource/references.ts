import type {
  GenerationPreview,
  GenerationReferenceCatalogItem,
  GenerationReferenceSelection,
} from '../../client/generation.js';
import type {
  GenerationPreviewReferenceSlot,
  GenerationPreviewResourceDataReference,
} from '../../client/generation-preview-resource.js';

type ProjectedReference = GenerationPreviewResourceDataReference;
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
      locked: referenceSlotLocked(preview.spec.purpose, selection.placement),
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
        locked: referenceSlotLocked(preview.spec.purpose, placement),
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

function referenceSlotLocked(
  purpose: GenerationPreview['spec']['purpose'],
  placement: Extract<GenerationReferenceSelection['placement'], { kind: 'slot' }>,
): boolean {
  return purpose === 'image.edit' &&
    placement.sectionId === 'source' &&
    placement.slotId === 'source-image';
}

function projectCatalogItem(
  candidate: GenerationReferenceCatalogItem
): ProjectedReference {
  return {
    kind: candidate.mediaKind,
    role: candidate.role,
    label: candidate.label,
    identity: candidate.reference.kind === 'asset-file'
      ? {
          kind: 'asset-file',
          assetId: candidate.reference.assetId,
          assetFileId: candidate.reference.assetFileId,
        }
      : {
          kind: 'project-file',
          projectRelativePath: candidate.projectRelativePath,
        },
    sourcePurpose: candidate.provenance.origin,
    selected: false,
  };
}

function projectSavedReference(
  selection: GenerationPreview['references'][number]
): ProjectedReference {
  const resolved = selection.resolved;
  return {
    kind: resolved?.mediaKind ?? 'image',
    role: resolved?.role ?? 'unavailable',
    label: resolved?.label ?? 'Unavailable reference',
    ...(selection.promptMention ? { promptMention: selection.promptMention } : {}),
    identity: selection.reference.kind === 'asset-file'
      ? {
          kind: 'asset-file',
          assetId: selection.reference.assetId,
          assetFileId: selection.reference.assetFileId,
        }
      : {
          kind: 'project-file',
          projectRelativePath: selection.reference.projectRelativePath,
        },
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
