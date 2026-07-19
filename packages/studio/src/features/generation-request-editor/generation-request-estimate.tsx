import { Loader2 } from 'lucide-react';
import type { GenerationPreviewEstimate } from '@gorenku/studio-core/client';

export function GenerationRequestEstimate({
  estimate,
  pending = false,
}: {
  estimate?: GenerationPreviewEstimate;
  pending?: boolean;
}) {
  if (pending) {
    return <span className='inline-flex items-center gap-2 text-sm text-muted-foreground'><Loader2 className='h-3.5 w-3.5 animate-spin' />Estimating...</span>;
  }
  if (estimate?.state === 'estimated') {
    return (
      <span className='inline-flex items-baseline gap-2'>
        <span className='text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
          Estimate:
        </span>
        <strong className='text-sm font-semibold tabular-nums text-foreground'>
          ${estimate.estimatedCostUsd.toFixed(2)}
        </strong>
      </span>
    );
  }
  if (estimate?.state === 'unpriced') {
    return <span className='text-sm text-muted-foreground'>Estimate unavailable</span>;
  }
  return null;
}
