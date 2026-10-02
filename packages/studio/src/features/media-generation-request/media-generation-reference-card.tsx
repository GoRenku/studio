import type { MediaGenerationReferenceView } from '@gorenku/studio-core/client';
import { useState } from 'react';
import { MediaCard } from '@/ui/media-card/media-card';
import type {
  MediaCardActivation,
  MediaCardFrame,
  MediaCardMedia,
} from '@/ui/media-card/media-card-contract';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';

export type MediaGenerationReferencePresentation = Pick<MediaGenerationReferenceView, 'requestPointer' | 'kind' | 'reviewLabel' | 'promptMention' | 'browserUrl' | 'available'>;

export interface MediaGenerationReferenceSource {
  browserUrl?: string;
  loadPreview: () => Promise<string>;
}

export function MediaGenerationReferenceCard({
  reference,
  source,
}: {
  reference: MediaGenerationReferencePresentation;
  source?: MediaGenerationReferenceSource;
}) {
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const accessibleName = reference.reviewLabel;
  const presented = { ...reference, browserUrl: reference.browserUrl ?? source?.browserUrl ?? previewUrl };
  const openPreview = async () => {
    if (!source || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      setPreviewUrl(await source.loadPreview());
      if (reference.kind === 'image') setImagePreviewOpen(true);
      if (reference.kind === 'video') setVideoPreviewOpen(true);
    } catch {
      setError('Reference preview could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <MediaCard
        media={referenceMedia(presented, accessibleName)}
        frame={referenceFrame(reference)}
        presentation={{
          kind: 'overlay',
          ...(!reference.available ? { copy: { title: accessibleName, description: 'Reference unavailable.' } } : {}),
        }}
        activation={source && reference.available && !(reference.kind === 'audio' && presented.browserUrl) ? {
          kind: 'callback', label: `Open ${accessibleName} preview`, disabled: loading,
          onActivate: () => { void openPreview(); },
        } : referenceActivation({
          reference,
          accessibleName,
          onOpenVideo: () => setVideoPreviewOpen(true),
        })}
        emptyState={{ kind: referenceEmptyState(reference) }}
      />
      {loading ? <p role='status' className='mt-2 text-xs text-muted-foreground'>Loading preview…</p> : null}
      {error ? <p role='alert' className='mt-2 text-xs text-destructive'>{error}</p> : null}
      {source && imagePreviewOpen && previewUrl ? <ImagePreviewDialog images={[{ src: previewUrl, alt: accessibleName, title: accessibleName }]} currentIndex={0} onOpenChange={setImagePreviewOpen} /> : null}
      {reference.available && (previewUrl ?? reference.browserUrl) && reference.kind === 'video' ? (
        <VideoPreviewDialog
          open={videoPreviewOpen}
          onOpenChange={setVideoPreviewOpen}
          src={(previewUrl ?? reference.browserUrl)!}
          title={accessibleName}
        />
      ) : null}
    </>
  );
}

function referenceMedia(
  reference: MediaGenerationReferencePresentation,
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

function referenceFrame(reference: MediaGenerationReferencePresentation): MediaCardFrame {
  return reference.kind === 'audio'
    ? { kind: 'minimum-height', minimumHeightPx: 112 }
    : { kind: 'ratio', aspectRatio: 16 / 10 };
}

function referenceActivation(input: {
  reference: MediaGenerationReferencePresentation;
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
  reference: MediaGenerationReferencePresentation,
): 'image' | 'film' | 'waveform' {
  if (reference.kind === 'audio') return 'waveform';
  return reference.kind === 'video' ? 'film' : 'image';
}
