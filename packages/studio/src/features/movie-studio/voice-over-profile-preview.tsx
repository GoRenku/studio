import { cn } from '@/lib/utils';

interface VoiceOverProfilePreviewProps {
  size?: 'card' | 'compact';
}

export function VoiceOverProfilePreview({
  size = 'card',
}: VoiceOverProfilePreviewProps) {
  const compact = size === 'compact';
  const barHeights = compact
    ? [42, 62, 78, 52, 88, 65, 44]
    : [24, 44, 68, 38, 82, 54, 30, 62, 46];
  return (
    <span
      aria-hidden='true'
      data-testid='voice-over-profile-placeholder'
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_36%,rgba(217,177,102,0.18),transparent_34%),linear-gradient(145deg,rgba(28,31,32,0.96),rgba(12,13,14,1))]',
        compact ? 'border border-white/8' : null
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-1/2 h-px bg-white/8',
          compact ? 'mx-2' : null
        )}
      />
      <span
        className={cn(
          'flex items-center justify-center rounded-full border border-white/8 bg-black/18 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm',
          compact ? 'h-8 w-10 gap-1 px-2' : 'h-24 w-40 gap-2 px-8'
        )}
      >
        {barHeights.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={cn(
              'rounded-full bg-[linear-gradient(180deg,rgba(244,213,151,0.95),rgba(113,156,171,0.72))] shadow-[0_0_14px_rgba(217,177,102,0.2)]',
              compact ? 'w-0.5' : 'w-1.5'
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
    </span>
  );
}
