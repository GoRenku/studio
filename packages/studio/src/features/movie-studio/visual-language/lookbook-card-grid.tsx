import type { ReactNode } from 'react';

export function LookbookCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
      {children}
    </div>
  );
}
