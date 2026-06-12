import type {
  MediaGenerationDependencyPricing,
  ShotVideoTakeReferenceCardPlan,
} from '@gorenku/studio-core/client';
import { Badge } from '@/ui/badge';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { SHOT_REFERENCE_COST_BADGE_OVERLAY_CLASS } from './scene-shot-reference-layout';
import { formatEstimateUsd } from './shot-video-take-production-projection';

interface SceneShotReferenceCardProps {
  title?: string;
  description?: string;
  imageUrl: string | null;
  imageAlt: string;
  card: ShotVideoTakeReferenceCardPlan;
  selected?: boolean;
  selectable?: boolean;
  aspectRatio?: number;
  aspectClassName?: string;
  detectImageAspectRatio?: boolean;
  onOpen?: () => void;
  onToggleSelected?: () => Promise<void>;
}

export function SceneShotReferenceCard({
  title,
  description,
  imageUrl,
  imageAlt,
  card,
  selected = false,
  selectable = true,
  aspectRatio = 16 / 10,
  aspectClassName = 'aspect-[16/10]',
  detectImageAspectRatio = false,
  onOpen,
  onToggleSelected,
}: SceneShotReferenceCardProps) {
  const needsGeneration = card.state === 'selected-planned';

  return (
    <ImageOverlayCard
      title={title}
      description={description}
      imageUrl={imageUrl}
      imageAlt={imageAlt}
      aspectRatio={aspectRatio}
      aspectClassName={aspectClassName}
      detectImageAspectRatio={detectImageAspectRatio}
      selected={selected}
      topRightAction={
        needsGeneration ? <ReferenceCostBadge pricing={card.pricing} /> : null
      }
      topRightActionClassName={SHOT_REFERENCE_COST_BADGE_OVERLAY_CLASS}
      topRightActionPersistent={needsGeneration}
      bottomRightControl={
        selectable && onToggleSelected ? (
          <ImageSelectionControl
            selected={selected}
            selectedLabel={`Clear ${title ?? 'reference'} pick`}
            unselectedLabel={`Set ${title ?? 'reference'} pick`}
            onToggleSelected={onToggleSelected}
          />
        ) : null
      }
      onOpen={onOpen ?? (() => {})}
    />
  );
}

function ReferenceCostBadge({
  pricing,
}: {
  pricing: MediaGenerationDependencyPricing;
}) {
  if (pricing.state === 'priced' && pricing.estimatedUsd > 0) {
    return (
      <Badge
        variant='accent'
        className='border-transparent bg-transparent px-2.5 py-1 text-[10px] tracking-normal text-foreground tabular-nums'
      >
        {formatEstimateUsd(pricing.estimatedUsd)}
      </Badge>
    );
  }
  if (pricing.state === 'unpriced') {
    return (
      <Badge
        variant='outline'
        className='border-transparent bg-transparent px-2.5 py-1 text-[10px] tracking-normal tabular-nums'
      >
        Unpriced
      </Badge>
    );
  }
  return null;
}
