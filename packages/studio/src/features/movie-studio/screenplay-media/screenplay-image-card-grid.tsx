import type { ReactNode } from 'react';

interface ScreenplayImageCardGridProps {
  children: ReactNode;
}

export function ScreenplayImageCardGrid({ children }: ScreenplayImageCardGridProps) {
  return (
    <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {children}
    </div>
  );
}
