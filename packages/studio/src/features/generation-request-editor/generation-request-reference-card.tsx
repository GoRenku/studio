import { useState } from 'react';
import type { GenerationPreviewResourceReference } from '@gorenku/studio-core/client';
import { MediaCard } from '@/ui/media-card/media-card';
import type {
  MediaCardActivation,
  MediaCardFrame,
  MediaCardMedia,
} from '@/ui/media-card/media-card-contract';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';
import { generationReferencePresentation } from './generation-reference-presentation';

interface GenerationRequestReferenceCardProps {
  reference: GenerationPreviewResourceReference;
  contextLabel: string;
  selected: boolean;
  onToggleSelected?: () => void | Promise<void>;
}

export function GenerationRequestReferenceCard({
  reference,
  contextLabel,
  selected,
  onToggleSelected,
}: GenerationRequestReferenceCardProps) {
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const presentation = generationReferencePresentation({
    reference,
    contextLabel,
  });
  return (
    <>
      <MediaCard
        media={referenceCardMedia(reference, presentation.accessibleName)}
        frame={referenceCardFrame(reference)}
        presentation={{
          kind: 'overlay',
          copy: presentation.title ? { title: presentation.title } : undefined,
        }}
        selected={selected}
        selection={onToggleSelected ? {
          kind: 'toggle',
          selected,
          selectedLabel: `Exclude ${presentation.accessibleName}`,
          unselectedLabel: `Include ${presentation.accessibleName}`,
          onToggle: onToggleSelected,
        } : undefined}
        activation={referenceCardActivation({
          reference,
          accessibleName: presentation.accessibleName,
          onOpenVideo: () => setVideoPreviewOpen(true),
        })}
      />
      {reference.kind === 'video' ? (
        <VideoPreviewDialog
          open={videoPreviewOpen}
          onOpenChange={setVideoPreviewOpen}
          src={reference.browserUrl}
          title={presentation.accessibleName}
        />
      ) : null}
    </>
  );
}

function referenceCardMedia(
  reference: GenerationPreviewResourceReference,
  accessibleName: string,
): MediaCardMedia {
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

function referenceCardFrame(
  reference: GenerationPreviewResourceReference,
): MediaCardFrame {
  return reference.kind === 'audio'
    ? { kind: 'minimum-height', minimumHeightPx: 112 }
    : { kind: 'ratio', aspectRatio: 16 / 10 };
}

function referenceCardActivation(input: {
  reference: GenerationPreviewResourceReference;
  accessibleName: string;
  onOpenVideo: () => void;
}): MediaCardActivation | undefined {
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
