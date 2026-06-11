import type {
  MediaGenerationDependencyPricing,
  ShotVideoTakeReferenceCardPlan,
} from '@gorenku/studio-core/client';
import { Badge } from '@/ui/badge';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { ImageSelectionControl } from '@/ui/image-selection-control';
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
  const needsGeneration = card.previews.length === 0;

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
    return <Badge variant='accent'>{formatEstimateUsd(pricing.estimatedUsd)}</Badge>;
  }
  if (pricing.state === 'unpriced') {
    return <Badge variant='outline'>Unpriced</Badge>;
  }
  return null;
}
