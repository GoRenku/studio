import type { GenerationPreviewResourceReference } from '@gorenku/studio-core/client';
import { AudioPreview } from '@/ui/audio-preview';
import { MediaCard } from '@/ui/media-card/media-card';

interface GenerationPreviewReferenceCardProps {
  reference: GenerationPreviewResourceReference;
  selected: boolean;
  onOpen?: () => void;
  onToggleSelected?: () => void | Promise<void>;
}

export function GenerationPreviewReferenceCard({
  reference,
  selected,
  onOpen,
  onToggleSelected,
}: GenerationPreviewReferenceCardProps) {
  const title = referenceDisplayTitle(reference);

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
      </article>
    );
  }

  return (
    <MediaCard
      media={
        reference.kind === 'video'
          ? {
              kind: 'video',
              src: reference.browserUrl,
              title: reference.label,
              playback: onOpen ? 'hover-muted' : 'still',
            }
          : {
              kind: 'image',
              src: reference.browserUrl,
              alt: title ?? 'Generation preview reference',
              fit: 'cover',
              effect: 'zoom-on-hover',
            }
      }
      frame={{ kind: 'ratio', aspectRatio: 16 / 10 }}
      presentation={{
        kind: 'overlay',
        copy: title ? { title } : undefined,
      }}
      selected={selected}
      selection={
        onToggleSelected
          ? {
              selected,
              selectedLabel: `Exclude ${title ?? 'reference'}`,
              unselectedLabel: `Include ${title ?? 'reference'}`,
              onToggle: onToggleSelected,
            }
          : undefined
      }
      activation={
        onOpen
          ? {
              label: title ?? reference.label,
              onActivate: onOpen,
            }
          : undefined
      }
    />
  );
}

function referenceDisplayTitle(
  reference: GenerationPreviewResourceReference
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
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(label)) {
    return undefined;
  }
  return label;
}
