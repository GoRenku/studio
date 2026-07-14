import type { ReactNode } from 'react';

export function VisualLanguageCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4'>
      {children}
    </div>
  );
}
