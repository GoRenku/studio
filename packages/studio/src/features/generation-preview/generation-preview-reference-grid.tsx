import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import type { GenerationPreviewDraft } from './generation-preview-draft';
import { generationPreviewReferenceSelected } from './generation-preview-draft';
import { GenerationPreviewReferenceCard } from './generation-preview-reference-card';

interface GenerationPreviewReferenceGridProps {
  preview: StudioGenerationPreview;
  draft: GenerationPreviewDraft;
  updating: boolean;
  editable?: boolean;
  onReferenceToggle: (reference: StudioGenerationPreviewReference) => void;
}

export function GenerationPreviewReferenceGrid({
  preview,
  draft,
  updating,
  editable,
  onReferenceToggle,
}: GenerationPreviewReferenceGridProps) {
  if (!preview.references.length) {
    return (
      <p className='text-sm text-muted-foreground'>
        No references are attached to this preview.
      </p>
    );
  }

  return (
    <div className='grid grid-cols-3 gap-3'>
      {preview.references.map((reference, index) => (
        <GenerationPreviewReferenceCard
          key={`${reference.kind}:${reference.assetId}:${reference.assetFileId}:${index}`}
          reference={reference}
          selected={generationPreviewReferenceSelected(reference, draft)}
          canEdit={editable ?? Boolean(preview.generationSpecId)}
          updating={updating}
          onToggle={onReferenceToggle}
        />
      ))}
    </div>
  );
}
