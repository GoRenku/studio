import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MediaCardGridProps {
  children: ReactNode;
  minimumCardWidthPx: number;
  gap?: 'compact' | 'standard' | 'roomy';
}

export function MediaCardGrid({
  children,
  minimumCardWidthPx,
  gap = 'standard',
}: MediaCardGridProps) {
  return (
    <div
      data-media-card-grid=''
      className={cn(
        'grid',
        gap === 'compact'
          ? 'gap-2'
          : gap === 'roomy'
            ? 'gap-4'
            : 'gap-3'
      )}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minimumCardWidthPx}px, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}
