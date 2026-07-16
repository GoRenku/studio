import { MediaCard } from './media-card/media-card';
import { MediaCardGrid } from './media-card/media-card-grid';

export interface OptionTileItem {
  id: string;
  label: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface OptionTileGroupProps {
  options: OptionTileItem[];
  /** Currently selected ids (single-select callers pass 0 or 1). */
  selectedIds: string[];
  onToggle: (id: string) => void;
  aspect?: 'video' | 'square';
  ariaLabel?: string;
  /** Minimum tile width in px for the responsive auto-fill grid. */
  minTileWidth?: number;
}

/**
 * Presentational grid of visual option cards (0036). Selection semantics
 * remain owned by the caller's `onToggle`.
 */
export function OptionTileGroup({
  options,
  selectedIds,
  onToggle,
  aspect = 'video',
  ariaLabel,
  minTileWidth,
}: OptionTileGroupProps) {
  const min = minTileWidth ?? (aspect === 'square' ? 84 : 116);
  return (
    <div role='group' aria-label={ariaLabel}>
      <MediaCardGrid minimumCardWidthPx={min} gap='compact'>
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          const toggle = () => onToggle(option.id);
          return (
            <MediaCard
              key={option.id}
              media={
                option.imageUrl
                  ? option.videoUrl
                    ? {
                        kind: 'video',
                        src: option.videoUrl,
                        title: option.label,
                        posterSrc: option.imageUrl,
                        playback: 'hover-muted-loop',
                      }
                    : {
                        kind: 'image',
                        src: option.imageUrl,
                        alt: '',
                        fit: 'cover',
                        loading: 'lazy',
                        effect: 'desaturate-until-hover-or-selected',
                      }
                  : null
              }
              frame={{
                kind: 'ratio',
                aspectRatio: aspect === 'square' ? 1 : 16 / 9,
              }}
              presentation={{
                kind: 'thumbnail',
                footer: { title: option.label },
              }}
              selected={selected}
              selection={{
                selected,
                selectedLabel: `Deselect ${option.label}`,
                unselectedLabel: `Select ${option.label}`,
                onToggle: toggle,
              }}
              activation={{
                label: option.label,
                onActivate: toggle,
              }}
              emptyState={{ kind: 'film' }}
            />
          );
        })}
      </MediaCardGrid>
    </div>
  );
}
