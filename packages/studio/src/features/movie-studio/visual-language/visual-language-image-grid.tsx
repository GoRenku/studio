import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface VisualLanguageImageGridProps {
  children: ReactNode;
  className?: string;
}

export function VisualLanguageImageGrid({
  children,
  className,
}: VisualLanguageImageGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}
