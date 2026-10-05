import type { StudioSelection } from '@gorenku/studio-core/client';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';

export interface ContinuityOverviewCard {
  id: string;
  name: string;
  description?: string;
  image?: {
    url: string;
    alt: string;
  };
  selection: StudioSelection;
  emptyKind?: 'image' | 'waveform';
}

export function ContinuityOverviewGrid({
  cards,
  aspectRatio,
  detectFromImage = false,
  onSelect,
}: {
  cards: ContinuityOverviewCard[];
  aspectRatio: number;
  detectFromImage?: boolean;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <MediaCardGrid minimumCardWidthPx={260} gap='roomy'>
      {cards.map((card) => (
        <MediaCard
          key={card.id}
          media={
            card.image
              ? {
                  kind: 'image',
                  src: card.image.url,
                  alt: card.image.alt,
                  fit: detectFromImage ? 'contain' : 'cover',
                  effect: detectFromImage ? 'none' : 'zoom-on-hover',
                }
              : null
          }
          frame={{ kind: 'ratio', aspectRatio, detectFromImage }}
          presentation={{
            kind: 'overlay',
            copy: {
              title: card.name,
              description: card.description,
            },
          }}
          activation={{
            kind: 'callback',
            label: card.name,
            onActivate: () => onSelect(card.selection),
          }}
          emptyState={{ kind: card.emptyKind ?? 'image' }}
        />
      ))}
    </MediaCardGrid>
  );
}
