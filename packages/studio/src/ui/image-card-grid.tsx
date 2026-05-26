import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ImageCardGridProps {
  children: ReactNode;
  className?: string;
}

export function ImageCardGrid({ children, className }: ImageCardGridProps) {
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
