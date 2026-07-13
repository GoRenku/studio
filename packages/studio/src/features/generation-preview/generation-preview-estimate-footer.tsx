import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { Badge } from '@/ui/badge';
import { formatEstimateUsd } from '../movie-studio/scenes/shot-video-take-production-projection';

export function GenerationPreviewEstimateFooter({
  preview,
}: {
  preview: GenerationPreviewResource;
}) {
  const estimate = preview.estimate;
  if (!estimate) {
    return null;
  }
  return (
    <div className='flex min-w-0 items-end gap-3'>
      <div className='flex min-w-0 flex-col gap-0.5'>
        <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Estimated total
        </span>
        <span className='font-mono text-lg leading-none text-foreground'>
          {estimate.state === 'estimated'
            ? formatEstimateUsd(estimate.estimatedCostUsd)
            : estimate.state === 'unpriced'
              ? 'Unpriced'
              : 'Not estimated'}
        </span>
      </div>
      {estimate.warnings?.length ? (
        <Badge variant='outline' className='shrink-0'>
          {estimate.warnings.length === 1
            ? '1 warning'
            : `${estimate.warnings.length} warnings`}
        </Badge>
      ) : null}
    </div>
  );
}
