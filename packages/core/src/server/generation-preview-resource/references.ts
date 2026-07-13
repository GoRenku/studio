import type { GenerationPreview } from '../../client/generation.js';
import type { GenerationPreviewResourceReference } from '../../client/generation-preview-resource.js';
import { ProjectDataError } from '../project-data-error.js';

export function projectGenerationPreviewReferences(
  preview: GenerationPreview
): Array<Omit<GenerationPreviewResourceReference, 'browserUrl'>> {
  return preview.references.map((selection) => {
    const resolved = selection.resolved;
    if (!resolved || selection.reference.kind !== 'asset-file') {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_REFERENCE_UNAVAILABLE',
        `Generation preview reference is not an available exact asset file: ${selection.id}.`
      );
    }
    return {
      kind: resolved.mediaKind,
      role: resolved.role,
      label: resolved.label,
      providerToken: selection.providerField,
      assetId: selection.reference.assetId,
      assetFileId: selection.reference.assetFileId,
      sourcePurpose: resolved.provenance.origin,
      selected: selection.included,
      selectionControl: {
        selectionId: selection.id,
        required: false,
        defaultIncluded: selection.included,
        editable: Boolean(preview.specId),
      },
    };
  });
}
