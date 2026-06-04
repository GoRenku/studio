import { useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  MediaGenerationDependencyPricing,
  ShotVideoTakeReferenceCardPlan,
} from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { formatEstimateUsd } from './shot-video-take-production-projection';

export interface ShotReferenceCardChoice {
  id: string;
  title: string;
  selected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
  imageUrl: string | null;
  previewImages: PreviewImage[];
  onSelect?: () => void;
}

interface SceneShotReferenceCardGridProps {
  choices: ShotReferenceCardChoice[];
  columnsClassName?: string;
}

export function SceneShotReferenceCardGrid({
  choices,
  columnsClassName = 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]',
}: SceneShotReferenceCardGridProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const previewChoices = useMemo(
    () => choices.flatMap((choice) => choice.previewImages),
    [choices]
  );

  return (
    <>
      <div className={cn('grid gap-3', columnsClassName)}>
        {choices.map((choice) => (
          <Button
            key={choice.id}
            type='button'
            variant={null}
            size={null}
            aria-pressed={choice.selected}
            onClick={choice.onSelect}
            className={cn(
              'group flex min-h-[132px] flex-col gap-2 rounded-md border bg-muted/20 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              choice.selected
                ? 'border-primary ring-1 ring-primary'
                : 'border-border/50 hover:border-border'
            )}
          >
            <span
              className='relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm bg-background/60'
              onClick={(event) => {
                if (choice.previewImages.length === 0) {
                  return;
                }
                event.stopPropagation();
                setPreviewImages(choice.previewImages);
              }}
            >
              {choice.imageUrl ? (
                <img
                  src={choice.imageUrl}
                  alt={choice.previewImages[0]?.alt ?? choice.title}
                  className='h-full w-full object-cover'
                  loading='lazy'
                />
              ) : (
                <ImageOff className='h-5 w-5 text-muted-foreground/50' />
              )}
              <ReferenceCostBadge pricing={choice.card.pricing} />
            </span>
            <span className='text-center text-[11px] font-medium text-foreground/80'>
              {choice.title}
            </span>
          </Button>
        ))}
      </div>
      <ImagePreviewDialog
        images={previewImages.length > 0 ? previewImages : previewChoices.slice(0, 0)}
        currentIndex={0}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImages([]);
          }
        }}
      />
    </>
  );
}

function ReferenceCostBadge({
  pricing,
}: {
  pricing: MediaGenerationDependencyPricing;
}) {
  if (pricing.state !== 'priced' || pricing.estimatedUsd <= 0) {
    return null;
  }
  return (
    <span className='absolute right-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground shadow-sm'>
      {formatEstimateUsd(pricing.estimatedUsd)}
    </span>
  );
}
