import { useState } from 'react';
import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';
import {
  deleteStudioSceneStoryboardImage,
  selectStudioSceneStoryboardImage,
} from '@/services/studio-scene-storyboard-images-api';
import { MediaCardCollectionDialog } from '@/ui/media-card/media-card-collection-dialog';
import type { MediaCardCollectionDialogState } from '@/ui/media-card/media-card-contract';
import { useBeatStoryboardImageCandidates } from './use-beat-storyboard-image-candidates';

export function BeatStoryboardImageCandidatesDialog(input: {
  projectName: string;
  sceneId: string;
  sceneBeatsRevisionId: string;
  beatId: string | null;
  beatTitle: string;
  aspectRatio: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSceneBeatsChange: () => void;
}) {
  const { resource, error, reload } = useBeatStoryboardImageCandidates({
    ...input,
    enabled: input.open && Boolean(input.beatId),
  });
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const beat = resource?.beats.find((candidate) => candidate.beatId === input.beatId);
  const state: MediaCardCollectionDialogState = mutationError || error
    ? {
        kind: 'error',
        message: mutationError ?? error ?? 'Unable to load Storyboard images.',
        retryLabel: 'Retry',
        onRetry: () => { setMutationError(null); reload(); },
      }
    : !resource
      ? { kind: 'loading', message: 'Loading Storyboard images...' }
      : !beat || beat.images.length === 0
        ? { kind: 'empty', message: 'No Storyboard image candidates for this Beat.' }
        : {
            kind: 'ready',
            items: beat.images.flatMap((assetFile, index) => {
              if (!input.beatId) return [];
              const imageLabel = `Storyboard image ${index + 1} for ${input.beatTitle}`;
              return [{
                id: assetFile.id,
                card: {
                  media: { kind: 'image' as const, src: assetFile.url, alt: imageLabel, fit: 'contain' as const, effect: 'zoom-on-hover' as const },
                  frame: { kind: 'ratio' as const, aspectRatio: input.aspectRatio },
                  presentation: { kind: 'overlay' as const },
                  activation: {
                    kind: 'image-preview' as const,
                    label: `Preview ${imageLabel}`,
                    image: { src: assetFile.url, alt: imageLabel, title: input.beatTitle },
                  },
                  cornerAction: assetFile.generationProvenance ? {
                    kind: 'inspect' as const,
                    label: `Inspect generation request for ${imageLabel}`,
                    visibility: 'always' as const,
                    onAction: () => openGenerationRequestInspector({ projectName: input.projectName, assetFileId: assetFile.id }),
                  } : undefined,
                  selection: {
                    kind: 'choose' as const,
                    selected: assetFile.id === beat.selectedImageId,
                    selectedLabel: 'Selected Storyboard image',
                    unselectedLabel: 'Use as selected Storyboard image',
                    onChoose: async () => {
                      try {
                        await selectStudioSceneStoryboardImage({ ...input, beatId: input.beatId!, assetFileId: assetFile.id });
                        setMutationError(null);
                        reload();
                        input.onSceneBeatsChange();
                      } catch (selectionError) {
                        setMutationError(selectionError instanceof Error ? selectionError.message : 'Unable to select image.');
                      }
                    },
                  },
                  deleteAction: assetFile.id === beat.selectedImageId ? undefined : {
                    label: `Delete ${imageLabel}`,
                    confirmationTitle: 'Delete Storyboard Image?',
                    confirmationMessage: 'This image will move to Trash. You can restore it later.',
                    onDelete: async () => {
                      await deleteStudioSceneStoryboardImage({ ...input, beatId: input.beatId!, assetFileId: assetFile.id });
                      reload();
                      input.onSceneBeatsChange();
                    },
                  },
                  emptyState: { kind: 'image' as const },
                },
              }];
            }),
          };
  return (
    <MediaCardCollectionDialog
      open={input.open}
      onOpenChange={(open) => {
        if (!open) setMutationError(null);
        input.onOpenChange(open);
      }}
      title={input.beatTitle || 'Storyboard Images'}
      description='Select the storyboard image shown for this Beat.'
      state={state}
      presentation={{ kind: 'flush' }}
      minimumCardWidthPx={220}
    />
  );
}
