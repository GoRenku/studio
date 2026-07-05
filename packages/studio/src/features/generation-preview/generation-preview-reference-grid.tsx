import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { GenerationPreviewReferenceCard } from './generation-preview-reference-card';

interface GenerationPreviewReferenceGridProps {
  preview: StudioGenerationPreview;
  updatingDependencyId: string | null;
  onReferenceToggle: (reference: StudioGenerationPreviewReference) => void;
}

export function GenerationPreviewReferenceGrid({
  preview,
  updatingDependencyId,
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
          canEdit={Boolean(preview.generationSpecId)}
          updating={
            updatingDependencyId === reference.selectionControl?.dependencyId
          }
          onToggle={onReferenceToggle}
        />
      ))}
    </div>
  );
}
