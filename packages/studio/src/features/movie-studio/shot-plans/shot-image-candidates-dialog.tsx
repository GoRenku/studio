import { useState } from 'react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100vh-3rem)] max-w-5xl gap-0 overflow-hidden p-0'>
        <DialogHeader>
          <DialogTitle>{shot?.title ?? 'Shot Images'}</DialogTitle>
          <DialogDescription>
            Select the image used by the Shot rail and Shot Plan mosaic.
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[65vh] overflow-y-auto p-5'>
          {mutationError ? (
            <p className='mb-4 text-sm text-destructive'>{mutationError}</p>
          ) : null}
          {error ? (
            <div className='flex min-h-56 flex-col items-center justify-center gap-3'>
              <p className='text-sm text-destructive'>{error}</p>
              <Button type='button' variant='outline' size='sm' onClick={reload}>
                Retry
              </Button>
            </div>
          ) : !resource ? (
            <p className='min-h-56 py-8 text-sm text-muted-foreground'>
              Loading Shot images...
            </p>
          ) : resource.items.length === 0 ? (
            <p className='min-h-56 py-8 text-sm text-muted-foreground'>
              No images for this Shot.
            </p>
          ) : (
            <MediaCardGrid minimumCardWidthPx={220}>
              {resource.items.map((asset, index) => {
                const file = asset.files.find(
                  (candidate) => candidate.mediaKind === 'image'
                );
                const selected = asset.id === resource.selectedAssetId;
                return (
                  <MediaCard
                    key={asset.id}
                    media={
                      file
                        ? {
                            kind: 'image',
                            src: file.url,
                            alt: `Image candidate ${index + 1} for ${shot?.title ?? 'Shot'}`,
                            fit: 'cover',
                            effect: 'zoom-on-hover',
                          }
                        : null
                    }
                    frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
                    presentation={{ kind: 'overlay' }}
                    selection={{
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
                            assetId: asset.id,
                          });
                          setMutationError(null);
                          reload();
                          onShotPlansChange();
                        } catch (selectionError) {
                          setMutationError(
                            selectionError instanceof Error
                              ? selectionError.message
                              : 'Unable to select the image.'
                          );
                        }
                      },
                    }}
                    deleteAction={
                      selected
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
                                assetId: asset.id,
                              });
                              reload();
                              onShotPlansChange();
                            },
                          }
                    }
                    emptyState={{ kind: 'image' }}
                  />
                );
              })}
            </MediaCardGrid>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
