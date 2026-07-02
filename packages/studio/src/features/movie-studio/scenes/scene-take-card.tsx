import { ImageOff, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { VideoPreview } from '@/ui/video-preview';

export const TAKE_CARD_GRID_MIN_WIDTH_PX = 280;
export const TAKE_CARD_ASPECT_RATIO = 16 / 9;

interface SceneTakeCardProps {
  title: string;
  description: string;
  picked: boolean;
  videoUrl?: string | null;
  previewShots: SceneTakePreviewShot[];
  onOpen: () => void;
  onDelete: () => Promise<void>;
  onTogglePicked: () => Promise<void>;
}

export interface SceneTakePreviewShot {
  shotId: string;
  label: string;
  image: ScreenplayImageReferenceWithHttp | null;
}

export function SceneTakeCard({
  title,
  description,
  picked,
  videoUrl,
  previewShots,
  onOpen,
  onDelete,
  onTogglePicked,
}: SceneTakeCardProps) {
  const preview = videoUrl
    ? takeVideoPreview(videoUrl, title)
    : takePreview(previewShots);
  return (
    <ImageOverlayCard
      title={title}
      description={description}
      imageUrl={preview.imageUrl}
      imageAlt={preview.imageAlt}
      previewContent={preview.content}
      aspectClassName='aspect-video'
      aspectRatio={TAKE_CARD_ASPECT_RATIO}
      selected={picked}
      onOpen={onOpen}
      topRightAction={
        <DeleteConfirmDialog
          title='Delete Take?'
          message='Remove this take and its take-owned media. This cannot be undone.'
          onDelete={onDelete}
          trigger={
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
              aria-label={`Delete ${title}`}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          }
        />
      }
      bottomRightControl={
        <ImageSelectionControl
          selected={picked}
          selectedLabel={`Clear ${title} pick`}
          unselectedLabel={`Set ${title} pick`}
          onToggleSelected={onTogglePicked}
        />
      }
    />
  );
}

function takeVideoPreview(videoUrl: string, title: string): {
  imageUrl: string | null;
  imageAlt: string;
  content?: ReactNode;
} {
  return {
    imageUrl: null,
    imageAlt: title,
    content: (
      <VideoPreview
        src={videoUrl}
        title={title}
        className='h-full w-full object-cover'
      />
    ),
  };
}

function takePreview(previewShots: SceneTakePreviewShot[]): {
  imageUrl: string | null;
  imageAlt: string;
  content?: ReactNode;
} {
  const visibleShots = previewShots.slice(0, 4);
  const shotsWithImages = visibleShots.filter((shot) => shot.image);
  if (visibleShots.length === 1 && shotsWithImages[0]?.image) {
    return {
      imageUrl: shotsWithImages[0].image.url,
      imageAlt: `Storyboard image for ${shotsWithImages[0].label}`,
    };
  }
  if (shotsWithImages.length > 0) {
    return {
      imageUrl: null,
      imageAlt: 'Storyboard images for take',
      content: <TakeStoryboardGrid shots={visibleShots} />,
    };
  }
  return {
    imageUrl: null,
    imageAlt: 'Take preview',
  };
}

function TakeStoryboardGrid({ shots }: { shots: SceneTakePreviewShot[] }) {
  const multiRow = shots.length > 2;
  return (
    <div
      className={
        multiRow
          ? 'grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-background'
          : 'grid h-full w-full grid-cols-2 gap-0.5 bg-background'
      }
    >
      {shots.map((shot) =>
        shot.image ? (
          <img
            key={shot.shotId}
            src={shot.image.url}
            alt={`Storyboard image for ${shot.label}`}
            className='h-full w-full object-cover'
          />
        ) : (
          <span
            key={shot.shotId}
            className='flex h-full w-full items-center justify-center bg-muted text-muted-foreground'
          >
            <ImageOff className='h-5 w-5' />
          </span>
        )
      )}
    </div>
  );
}
