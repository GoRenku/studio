import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SceneShotReferenceCardGridProps {
  children: ReactNode;
  className?: string;
  minCardWidth?: string;
}

export function SceneShotReferenceCardGrid({
  children,
  className,
  minCardWidth = '220px',
}: SceneShotReferenceCardGridProps) {
  return (
    <div
      className={cn('grid gap-3', className)}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

export function SceneShotReferenceCardRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 gap-3 overflow-x-auto pb-2', className)}>
      {children}
    </div>
  );
}
