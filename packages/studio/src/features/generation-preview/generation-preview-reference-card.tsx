import type { StudioGenerationPreviewReference } from '@gorenku/studio-core/client';
import { AudioPreview } from '@/ui/audio-preview';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { VideoPreview } from '@/ui/video-preview';

interface GenerationPreviewReferenceCardProps {
  reference: StudioGenerationPreviewReference;
  canEdit: boolean;
  updating: boolean;
  onToggle: (reference: StudioGenerationPreviewReference) => void;
}

export function GenerationPreviewReferenceCard({
  reference,
  canEdit,
  updating,
  onToggle,
}: GenerationPreviewReferenceCardProps) {
  const selected = reference.selected || reference.selectionControl?.required === true;
  const canToggle =
    canEdit &&
    Boolean(reference.selectionControl?.editable) &&
    !reference.selectionControl?.required;
  const title = referenceDisplayTitle(reference);
  const control = canToggle ? (
    <ImageSelectionControl
      selected={selected}
      selectedLabel={`Exclude ${title ?? 'reference'}`}
      unselectedLabel={`Include ${title ?? 'reference'}`}
      disabled={updating}
      busy={updating}
      onToggleSelected={async () => onToggle(reference)}
    />
  ) : null;

  if (reference.kind === 'audio') {
    return (
      <article className='flex min-h-28 flex-col gap-3 rounded-md border border-border/50 bg-card/40 p-3'>
        {title ? (
          <h3 className='truncate text-sm font-semibold text-foreground'>
            {title}
          </h3>
        ) : null}
        <AudioPreview
          src={reference.browserUrl}
          title={reference.label}
          className='w-full'
        />
        {control ? <div className='flex justify-end'>{control}</div> : null}
      </article>
    );
  }

  return (
    <ImageOverlayCard
      title={title}
      imageUrl={reference.browserUrl}
      imageAlt={title ?? 'Generation preview reference'}
      selected={selected}
      bottomRightControl={control}
      previewContent={
        reference.kind === 'video'
          ? ({ active }) => (
              <VideoPreview
                src={reference.browserUrl}
                title={reference.label}
                active={active}
                className='h-full w-full object-cover'
              />
            )
          : undefined
      }
      onOpen={() => {}}
    />
  );
}

function referenceDisplayTitle(
  reference: StudioGenerationPreviewReference
): string | undefined {
  const label = reference.label.trim();
  if (!label) {
    return undefined;
  }
  if (/^(image|video|audio)\s*\d+$/i.test(label)) {
    return undefined;
  }
  if (
    label === reference.assetId ||
    label === reference.assetFileId ||
    label === reference.providerToken
  ) {
    return undefined;
  }
  if (/^(asset|asset_file|file|reference)[-_][a-z0-9_-]+$/i.test(label)) {
    return undefined;
  }
  return label;
}
