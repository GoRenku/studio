import { useEffect } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { deleteStudioShotPlan } from '@/services/studio-shot-plans-api';
import type {
  StudioShot,
  StudioShotPlanListItem,
} from '@/services/studio-shot-plans-contracts';
import { useSceneShotPlans } from './use-scene-shot-plans';

export function SceneShotPlansTab({
  projectName,
  sceneId,
  onSelect,
  onPlanActivate,
  restoreFocusPlanId,
  onFocusRestored,
}: {
  projectName: string;
  sceneId: string;
  onSelect: (selection: StudioSelection) => void;
  onPlanActivate: (shotPlanId: string) => void;
  restoreFocusPlanId?: string | null;
  onFocusRestored?: () => void;
}) {
  const { resource, error, reload } = useSceneShotPlans(projectName, sceneId);

  useEffect(() => {
    if (!resource || !restoreFocusPlanId) {
      return;
    }
    const wrapper = document.querySelector<HTMLElement>(
      `[data-shot-plan-card="${restoreFocusPlanId}"]`
    );
    const button = wrapper?.querySelector<HTMLButtonElement>(
      `button[aria-label^="Open Shot Plan"]`
    );
    if (button) {
      button.focus();
      onFocusRestored?.();
    }
  }, [onFocusRestored, resource, restoreFocusPlanId]);

  if (error) {
    return (
      <div className='flex h-full flex-col items-start justify-center gap-3 p-8'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button type='button' variant='outline' size='sm' onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }
  if (!resource) {
    return (
      <p className='p-8 text-sm text-muted-foreground'>
        Loading Shot Plans...
      </p>
    );
  }
  if (resource.shotPlans.length === 0) {
    return (
      <p className='p-8 text-sm text-muted-foreground'>
        No Shot Plans for this Scene.
      </p>
    );
  }

  return (
    <div className='h-full w-full overflow-y-auto px-6 py-7'>
      <MediaCardGrid minimumCardWidthPx={300} gap='roomy'>
        {resource.shotPlans.map((item) => {
          const open = () => {
            onPlanActivate(item.shotPlan.id);
            onSelect({
              type: 'scene',
              id: sceneId,
              sceneTab: 'shotPlans',
              shotPlanId: item.shotPlan.id,
              ...(item.shotPlan.shots[0]
                ? { shotId: item.shotPlan.shots[0].id }
                : {}),
            });
          };
          return (
            <div key={item.shotPlan.id} data-shot-plan-card={item.shotPlan.id}>
              <MediaCard
                media={shotPlanMosaic(item)}
                frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
                presentation={{
                  kind: 'overlay',
                  copy: {
                    title: item.shotPlan.title,
                    description: coveredBeatCopy(item),
                  },
                }}
                activation={{
                  label: `Open Shot Plan ${item.shotPlan.title}`,
                  onActivate: open,
                }}
                cornerAction={{
                  kind: 'inspect',
                  label: `Inspect Shot Plan ${item.shotPlan.title}`,
                  visibility: 'always',
                  onAction: open,
                }}
                deleteAction={{
                  label: `Delete Shot Plan ${item.shotPlan.title}`,
                  confirmationTitle: 'Delete Shot Plan?',
                  confirmationMessage:
                    'This Shot Plan and its Shot images will move to Trash. You can restore them later.',
                  onDelete: async () => {
                    await deleteStudioShotPlan({
                      projectName,
                      shotPlanId: item.shotPlan.id,
                    });
                    reload();
                  },
                }}
                emptyState={{ kind: 'image' }}
              />
            </div>
          );
        })}
      </MediaCardGrid>
    </div>
  );
}

function shotPlanMosaic(item: StudioShotPlanListItem) {
  const selected = item.shotPlan.shots.flatMap((shot) => {
    const asset = selectedShotAsset(shot);
    const file = asset?.files.find((candidate) => candidate.mediaKind === 'image');
    if (!asset || !file) {
      return [];
    }
    return [
      {
        key: asset.id,
        imageUrl: file.url,
        alt: `Selected image for Shot ${shot.position + 1}`,
      },
    ];
  });
  return selected.length > 0
    ? { kind: 'mosaic-grid' as const, items: selected }
    : null;
}

function selectedShotAsset(shot: StudioShot) {
  return shot.images.find((asset) => asset.id === shot.selectedImageId) ?? null;
}

function coveredBeatCopy(item: StudioShotPlanListItem): string | undefined {
  return item.coveredBeats.length
    ? item.coveredBeats
        .map((coveredBeat) => `Beat ${coveredBeat.position + 1}`)
        .join(' · ')
    : undefined;
}
