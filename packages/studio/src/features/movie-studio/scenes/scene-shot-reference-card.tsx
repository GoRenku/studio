import type { ShotVideoTakeReferenceCard } from '@gorenku/studio-core/client';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { ImageRevisionCardAction } from '@/features/image-revision/image-revision-card-action';

interface SceneShotReferenceCardProps {
  title?: string;
  description?: string;
  imageUrl: string | null;
  imageAlt: string;
  card: ShotVideoTakeReferenceCard;
  selected?: boolean;
  selectable?: boolean;
  controlMode?: 'selection' | 'inclusion';
  aspectRatio?: number;
  aspectClassName?: string;
  detectImageAspectRatio?: boolean;
  onOpen?: () => void;
  onToggleSelected?: () => Promise<void>;
  selectedActionLabel?: string;
  unselectedActionLabel?: string;
  onEditImage?: () => void;
}

export function SceneShotReferenceCard({
  title,
  description,
  imageUrl,
  imageAlt,
  card,
  selected = false,
  selectable = true,
  controlMode = 'selection',
  aspectRatio = 16 / 10,
  aspectClassName = 'aspect-[16/10]',
  detectImageAspectRatio = false,
  onOpen,
  onToggleSelected,
  selectedActionLabel,
  unselectedActionLabel,
  onEditImage,
}: SceneShotReferenceCardProps) {
  const selectedLabel =
    selectedActionLabel ??
    (controlMode === 'inclusion'
      ? `Exclude ${title ?? 'reference'}`
      : `Clear ${title ?? 'reference'} pick`);
  const unselectedLabel =
    unselectedActionLabel ??
    (controlMode === 'inclusion'
      ? `Include ${title ?? 'reference'}`
      : `Set ${title ?? 'reference'} pick`);

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
      bottomRightActions={
        selectable || onEditImage ? (
          <>
            {selectable && !card.required && onToggleSelected ? (
              <ImageSelectionControl
                selected={selected}
                selectedLabel={selectedLabel}
                unselectedLabel={unselectedLabel}
                onToggleSelected={onToggleSelected}
              />
            ) : null}
            {onEditImage ? (
              <ImageRevisionCardAction onEdit={onEditImage} />
            ) : null}
          </>
        ) : null
      }
      onOpen={onOpen ?? (() => {})}
    />
  );
}
