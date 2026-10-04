import { useState } from 'react';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import { MediaCardCollectionDialog } from '@/ui/media-card/media-card-collection-dialog';
import type {
  MediaCardCollectionDialogState,
  MediaCardCollectionItem,
} from '@/ui/media-card/media-card-contract';
import {
  deleteStudioShotImageCandidate,
  setStudioShotSelectedImage,
} from '@/services/studio-shot-plans-api';
import type { StudioShot } from '@/services/studio-shot-plans-contracts';
import { useShotImageCandidates } from './use-shot-image-candidates';

export function ShotImageCandidatesDialog({
  projectName,
  sceneId,
  shot,
  open,
  onOpenChange,
  onShotPlansChange,
}: {
  projectName: string;
  sceneId: string;
  shot: StudioShot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShotPlansChange: () => void;
}) {
  const { resource, error, reload } = useShotImageCandidates({
    projectName,
    sceneId,
    shotId: shot?.id ?? '',
    enabled: open && Boolean(shot),
  });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMutationError(null);
    }
    onOpenChange(nextOpen);
  };
  const readyCandidates = resource?.items.map((assetFile, index) => ({ assetFile, index })) ?? [];
  const title = shot?.title ?? 'Shot Images';
  const description =
    'Select the image used by the Shot rail and Shot Plan mosaic.';

  if (resource && readyCandidates.length === 1) {
    const candidate = readyCandidates[0]!;
    return (
      <ImagePreviewDialog
        images={
          open
            ? [{
                src: candidate.assetFile.url,
                alt: `Image candidate ${candidate.index + 1} for ${title}`,
                title,
              }]
            : []
        }
        currentIndex={0}
        onOpenChange={handleOpenChange}
      />
    );
  }

  if (resource && readyCandidates.length === 0) {
    return null;
  }

  const state: MediaCardCollectionDialogState = mutationError
    ? {
        kind: 'error',
        message: mutationError,
        retryLabel: 'Retry',
        onRetry: () => {
          setMutationError(null);
          reload();
        },
      }
    : error
      ? {
          kind: 'error',
          message: error,
          retryLabel: 'Retry',
          onRetry: reload,
        }
      : !resource
        ? {
            kind: 'loading',
            message: 'Loading Shot images...',
          }
        : {
            kind: 'ready',
            items: readyCandidates.map(({ assetFile, index }) =>
              candidateItem({
                projectName,
                shot,
                assetFile,
                imageUrl: assetFile.url,
                index,
                selected: assetFile.id === resource.selectedAssetFileId,
                onMutationError: setMutationError,
                reload,
                onShotPlansChange,
              })
            ),
          };

  return (
    <MediaCardCollectionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      state={state}
      presentation={{ kind: 'flush' }}
      minimumCardWidthPx={220}
    />
  );
}

function candidateItem({
  projectName,
  shot,
  assetFile,
  imageUrl,
  index,
  selected,
  onMutationError,
  reload,
  onShotPlansChange,
}: {
  projectName: string;
  shot: StudioShot | null;
  assetFile: StudioShot['images'][number];
  imageUrl: string;
  index: number;
  selected: boolean;
  onMutationError: (message: string | null) => void;
  reload: () => void;
  onShotPlansChange: () => void;
}): MediaCardCollectionItem {
  const imageLabel = `Image candidate ${index + 1} for ${shot?.title ?? 'Shot'}`;

  return {
    id: assetFile.id,
    card: {
      media: {
        kind: 'image',
        src: imageUrl,
        alt: imageLabel,
        fit: 'cover',
        effect: 'zoom-on-hover',
      },
      frame: { kind: 'ratio', aspectRatio: 16 / 9 },
      presentation: { kind: 'overlay' },
      activation: {
        kind: 'image-preview',
        label: `Preview ${imageLabel}`,
        image: {
          src: imageUrl,
          alt: imageLabel,
          title: shot?.title ?? 'Shot Image',
        },
      },
      selection: {
        kind: 'choose',
        selected,
        selectedLabel: 'Selected image',
        unselectedLabel: 'Use as selected image',
        onChoose: async () => {
          if (!shot) {
            return;
          }
          try {
            await setStudioShotSelectedImage({
              projectName,
              shotId: shot.id,
              assetFileId: assetFile.id,
            });
            onMutationError(null);
            reload();
            onShotPlansChange();
          } catch (selectionError) {
            onMutationError(
              selectionError instanceof Error
                ? selectionError.message
                : 'Unable to select the image.'
            );
          }
        },
      },
      deleteAction: selected
        ? undefined
        : {
            label: `Delete image candidate ${index + 1}`,
            confirmationTitle: 'Delete Shot Image?',
            confirmationMessage:
              'This image will move to Trash. You can restore it later.',
            onDelete: async () => {
              if (!shot) {
                return;
              }
              await deleteStudioShotImageCandidate({
                projectName,
                shotId: shot.id,
                assetFileId: assetFile.id,
              });
              reload();
              onShotPlansChange();
            },
          },
      emptyState: { kind: 'image' },
    },
  };
}
