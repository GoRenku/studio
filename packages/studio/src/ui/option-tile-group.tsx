import { OptionTile } from './option-tile';

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
 * Presentational grid of {@link OptionTile}s (0036). Selection semantics
 * (single vs multi, mutually-exclusive subgroups) are owned by the caller's
 * `onToggle`, so the same primitive serves every camera-design axis.
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
    <div
      role='group'
      aria-label={ariaLabel}
      className='grid gap-2'
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
      }}
    >
      {options.map((option) => (
        <OptionTile
          key={option.id}
          label={option.label}
          imageUrl={option.imageUrl}
          videoUrl={option.videoUrl}
          aspect={aspect}
          selected={selectedIds.includes(option.id)}
          onSelect={() => onToggle(option.id)}
        />
      ))}
    </div>
  );
}
