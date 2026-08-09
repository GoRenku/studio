import { Timer } from 'lucide-react';
import { MediaCard } from '@/ui/media-card/media-card';
import type {
  StudioShot,
  StudioShotPlan,
} from '@/services/studio-shot-plans-contracts';

export function ShotPlanShotRail({
  shotPlan,
  selectedShotId,
  onSelectShot,
  onManageImages,
}: {
  shotPlan: StudioShotPlan;
  selectedShotId?: string;
  onSelectShot: (shot: StudioShot) => void;
  onManageImages: (shot: StudioShot) => void;
}) {
  return (
    <div className='h-full overflow-y-auto px-3 py-4'>
      <p className='mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
        Selected Shot
      </p>
      <div className='space-y-3'>
        {shotPlan.shots.map((shot) => {
          const number = shot.number;
          const selectedAsset =
            shot.images.find((asset) => asset.id === shot.selectedImageId) ??
            null;
          const imageFile =
            selectedAsset?.files.find((file) => file.mediaKind === 'image') ??
            null;
          const hasImageCandidates = shot.images.some((asset) =>
            asset.files.some((file) => file.mediaKind === 'image')
          );
          const selected = shot.id === selectedShotId;
          return (
            <div
              key={shot.id}
              className={[
                'relative rounded-lg',
                selected
                  ? 'border-[3px] border-primary shadow-[0_0_0_1px_rgba(217,177,70,0.2),0_8px_20px_rgba(0,0,0,0.32)]'
                  : imageFile
                    ? 'border border-transparent p-0.5'
                    : 'border border-border/70 p-0.5',
              ].join(' ')}
            >
              <MediaCard
                media={
                  imageFile
                    ? {
                        kind: 'image',
                        src: imageFile.url,
                        alt: `Selected image for Shot ${number}`,
                        fit: 'cover',
                        effect: 'zoom-on-hover',
                      }
                    : null
                }
                frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
                presentation={{ kind: 'overlay' }}
                activation={{
                  kind: 'callback',
                  label: `Select Shot ${number}`,
                  onActivate: () => onSelectShot(shot),
                }}
                cornerAction={
                  hasImageCandidates
                    ? {
                        kind: 'edit',
                        label: `Manage images for Shot ${number}`,
                        visibility: 'hover-or-focus',
                        onAction: () => onManageImages(shot),
                      }
                    : undefined
                }
                emptyState={{ kind: 'image' }}
              />
              <span className='pointer-events-none absolute left-2 top-2 z-40 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/70 text-xs font-semibold text-white shadow-md'>
                {number}
              </span>
              {shot.brief.durationSeconds !== undefined ? (
                <span
                  className='pointer-events-none absolute bottom-2 left-2 z-40 inline-flex h-6 items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 text-[10px] font-semibold text-white shadow-md'
                  aria-label={`Approximate duration ${formatDurationAccessible(shot.brief.durationSeconds)}`}
                >
                  <Timer className='h-3 w-3' />
                  {formatDuration(shot.brief.durationSeconds)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(value: number): string {
  return `${Number(value.toFixed(2))}s`;
}

function formatDurationAccessible(value: number): string {
  return `${Number(value.toFixed(2))} ${value === 1 ? 'second' : 'seconds'}`;
}
