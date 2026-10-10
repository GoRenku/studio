import { cn } from '@/lib/utils';

/** Warning-only character counter; exceeding the limit never blocks generation. */
export function CharacterCount(input: { count: number; limit: number }) {
  const over = input.count > input.limit;
  return (
    <span data-over-limit={over ? '' : undefined} className={cn('font-[family-name:var(--dd-font-mono)] text-[11px] tabular-nums', over ? 'text-[var(--dd-destructive)]' : 'text-[var(--dd-muted-fg)]')}>
      {input.count.toLocaleString('en-US')} / {input.limit.toLocaleString('en-US')}
    </span>
  );
}
