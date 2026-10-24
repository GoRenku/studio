import type { ReactNode } from 'react';

/** The uppercase micro-heading every Casting tab section uses. */
export function CastingSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className='text-[11px] font-bold uppercase tracking-[0.12em] text-primary'>{children}</h2>
  );
}
