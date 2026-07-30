import { useState } from 'react';
import type { GenerationPreviewResourceReference } from '@gorenku/studio-core/client';
import { MediaCard } from '@/ui/media-card/media-card';
import type {
  MediaCardActivation,
  MediaCardFrame,
  MediaCardMedia,
} from '@/ui/media-card/media-card-contract';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';

interface GenerationRequestReferenceCardProps {
  reference: GenerationPreviewResourceReference;
  fallbackTitle?: string;
  selected: boolean;
  onToggleSelected?: () => void | Promise<void>;
}

export function GenerationRequestReferenceCard({
  reference,
  fallbackTitle,
  selected,
  onToggleSelected,
}: GenerationRequestReferenceCardProps) {
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const title = referenceDisplayTitle(reference) ?? fallbackTitle;
  const displayTitle = title ?? 'Generation reference';
  return (
    <>
      <MediaCard
        media={referenceCardMedia(reference, title)}
        frame={referenceCardFrame(reference)}
        presentation={{ kind: 'overlay', copy: title ? { title } : undefined }}
        selected={selected}
        selection={onToggleSelected ? {
          kind: 'toggle',
          selected,
          selectedLabel: `Exclude ${title ?? 'reference'}`,
          unselectedLabel: `Include ${title ?? 'reference'}`,
          onToggle: onToggleSelected,
        } : undefined}
        activation={referenceCardActivation({
          reference,
          displayTitle,
          onOpenVideo: () => setVideoPreviewOpen(true),
        })}
      />
      {reference.kind === 'video' ? (
        <VideoPreviewDialog
          open={videoPreviewOpen}
          onOpenChange={setVideoPreviewOpen}
          src={reference.browserUrl}
          title={displayTitle}
        />
      ) : null}
    </>
  );
}

function referenceCardMedia(
  reference: GenerationPreviewResourceReference,
  title: string | undefined,
): MediaCardMedia {
  if (reference.kind === 'audio') {
    return {
      kind: 'audio',
      src: reference.browserUrl,
      title: title ?? 'Generation reference',
    };
  }
  if (reference.kind === 'video') {
    return {
      kind: 'video',
      src: reference.browserUrl,
      title: title ?? 'Generation reference',
      playback: 'hover-muted',
    };
  }
  return {
    kind: 'image',
    src: reference.browserUrl,
    alt: title ?? 'Generation reference',
    fit: 'cover',
    effect: 'zoom-on-hover',
  };
}

function referenceCardFrame(
  reference: GenerationPreviewResourceReference,
): MediaCardFrame {
  return reference.kind === 'audio'
    ? { kind: 'minimum-height', minimumHeightPx: 112 }
    : { kind: 'ratio', aspectRatio: 16 / 10 };
}

function referenceCardActivation(input: {
  reference: GenerationPreviewResourceReference;
  displayTitle: string;
  onOpenVideo: () => void;
}): MediaCardActivation | undefined {
  if (input.reference.kind === 'image') {
    return {
      kind: 'image-preview',
      label: `Open ${input.displayTitle} preview`,
      image: {
        src: input.reference.browserUrl,
        alt: input.displayTitle,
        title: input.displayTitle,
      },
    };
  }
  if (input.reference.kind === 'video') {
    return {
      kind: 'callback',
      label: `Open ${input.displayTitle} preview`,
      onActivate: input.onOpenVideo,
    };
  }
  return undefined;
}

function referenceDisplayTitle(
  reference: GenerationPreviewResourceReference,
): string | undefined {
  const label = reference.label.trim();
  if (!label || /^(image|video|audio)\s*\d+$/i.test(label) ||
      (reference.identity.kind === 'asset-file' &&
        (label === reference.identity.assetId ||
          label === reference.identity.assetFileId)) ||
      label === reference.promptMention ||
      /^(asset|asset_file|file|reference)[-_][a-z0-9_-]+$/i.test(label) ||
      /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(label)) {
    return undefined;
  }
  return label;
}
