import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import { Badge } from '@/ui/badge';

const STATE_LABELS: Record<GenerationCostEstimate['state'], string> = {
  quoted: 'Provider quote',
  computed: 'Estimated from the current price',
  missingPrice: 'No price is known for this route',
  expired: 'The recorded price has expired',
  unpriced: 'This price cannot be estimated',
  hostPlanUsage: 'Plan usage',
};

/**
 * The one place an estimate is formatted. Amounts come from Engines; an
 * unknown price never shows as $0.
 */
export function GenerationCostEstimateView({ estimate, outdated = false, refreshing = false }: {
  estimate: GenerationCostEstimate | null;
  outdated?: boolean;
  refreshing?: boolean;
}) {
  if (!estimate) {
    return null;
  }
  const amount = estimate.amountUsd === null ? null : formatUsd(estimate.amountUsd);
  return (
    <section aria-label='Estimated cost' className='flex min-w-0 flex-col gap-0.5 text-left'>
      <div className='flex items-center gap-2'>
        <span className='text-xs text-muted-foreground'>Estimated cost</span>
        {amount ? <span className='text-sm font-semibold tabular-nums text-foreground'>{amount}</span> : null}
        {outdated ? <Badge variant='outline'>Estimate outdated</Badge> : null}
        {refreshing ? <span role='status' className='text-xs text-muted-foreground'>Updating…</span> : null}
      </div>
      <p className='m-0 truncate text-xs text-muted-foreground' title={estimate.basis}>
        {estimate.state === 'hostPlanUsage' || estimate.state === 'unpriced' ? estimate.basis : amount ? `${STATE_LABELS[estimate.state]} · ${estimate.basis}` : STATE_LABELS[estimate.state]}
      </p>
      {estimate.notes.map((note) => <p key={note} className='m-0 text-xs text-muted-foreground'>{note}</p>)}
      {estimate.sourceUrl ? <a className='text-xs text-muted-foreground underline' href={estimate.sourceUrl} target='_blank' rel='noreferrer'>Price source</a> : null}
    </section>
  );
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
}
