import type { MediaGenerationReferenceView } from '@gorenku/studio-core/client';
import { useState } from 'react';
import { MediaCard } from '@/ui/media-card/media-card';
import type {
  MediaCardActivation,
  MediaCardFrame,
  MediaCardMedia,
} from '@/ui/media-card/media-card-contract';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';

export function MediaGenerationReferenceCard({
  reference,
}: {
  reference: MediaGenerationReferenceView;
}) {
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const accessibleName = reference.reviewLabel;
  return (
    <>
      <MediaCard
        media={referenceMedia(reference, accessibleName)}
        frame={referenceFrame(reference)}
        presentation={{
          kind: 'overlay',
        }}
        activation={referenceActivation({
          reference,
          accessibleName,
          onOpenVideo: () => setVideoPreviewOpen(true),
        })}
        emptyState={{ kind: referenceEmptyState(reference) }}
      />
      {reference.available && reference.browserUrl && reference.kind === 'video' ? (
        <VideoPreviewDialog
          open={videoPreviewOpen}
          onOpenChange={setVideoPreviewOpen}
          src={reference.browserUrl}
          title={accessibleName}
        />
      ) : null}
    </>
  );
}

function referenceMedia(
  reference: MediaGenerationReferenceView,
  accessibleName: string,
): MediaCardMedia | null {
  if (!reference.available || !reference.browserUrl) return null;
  if (reference.kind === 'audio') {
    return {
      kind: 'audio',
      src: reference.browserUrl,
      title: accessibleName,
    };
  }
  if (reference.kind === 'video') {
    return {
      kind: 'video',
      src: reference.browserUrl,
      title: accessibleName,
      playback: 'hover-muted',
    };
  }
  return {
    kind: 'image',
    src: reference.browserUrl,
    alt: accessibleName,
    fit: 'cover',
    effect: 'zoom-on-hover',
  };
}

function referenceFrame(reference: MediaGenerationReferenceView): MediaCardFrame {
  return reference.kind === 'audio'
    ? { kind: 'minimum-height', minimumHeightPx: 112 }
    : { kind: 'ratio', aspectRatio: 16 / 10 };
}

function referenceActivation(input: {
  reference: MediaGenerationReferenceView;
  accessibleName: string;
  onOpenVideo: () => void;
}): MediaCardActivation | undefined {
  if (!input.reference.available || !input.reference.browserUrl) return undefined;
  if (input.reference.kind === 'image') {
    return {
      kind: 'image-preview',
      label: `Open ${input.accessibleName} preview`,
      image: {
        src: input.reference.browserUrl,
        alt: input.accessibleName,
        title: input.accessibleName,
      },
    };
  }
  if (input.reference.kind === 'video') {
    return {
      kind: 'callback',
      label: `Open ${input.accessibleName} preview`,
      onActivate: input.onOpenVideo,
    };
  }
  return undefined;
}

function referenceEmptyState(
  reference: MediaGenerationReferenceView,
): 'image' | 'film' | 'waveform' {
  if (reference.kind === 'audio') return 'waveform';
  return reference.kind === 'video' ? 'film' : 'image';
}
