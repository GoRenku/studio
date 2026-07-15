import type {
  GenerationPreviewReferenceChange,
} from '../../client/generation-preview-resource.js';
import type {
  GenerationReferenceSelection,
  GenerationSpec,
} from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';

export function applyGenerationSpecReferenceChanges(input: {
  spec: GenerationSpec;
  changes: GenerationPreviewReferenceChange[];
}): GenerationSpec {
  const placements = new Set<string>();
  let references = [...input.spec.references];
  for (const change of input.changes) {
    const key = placementKey(change.placement);
    if (placements.has(key)) {
      throw new ProjectDataError(
        'CORE_GENERATION_SELECTION_INVALID',
        'A Preview update may change each reference slot at most once.'
      );
    }
    placements.add(key);
    references = references.filter((selection) =>
      !placementsEqual(selection.placement, change.placement)
    );
    if (change.kind === 'replace') {
      references.push({
        id: `slot:${key}`,
        placement: change.placement,
        included: true,
        reference: change.reference,
      });
    }
  }
  return { ...input.spec, references };
}

function placementsEqual(
  left: GenerationReferenceSelection['placement'],
  right: GenerationReferenceSelection['placement']
): boolean {
  return left.kind === 'slot' && right.kind === 'slot' &&
    placementKey(left) === placementKey(right);
}

function placementKey(
  placement: Extract<GenerationReferenceSelection['placement'], { kind: 'slot' }>
): string {
  return [
    placement.sectionId,
    placement.slotId,
    placement.scope?.kind ?? '',
    placement.scope?.id ?? '',
    placement.subject?.kind ?? '',
    placement.subject?.id ?? '',
  ].join(':');
}
