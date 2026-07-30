import type { GenerationPreviewVideoModelFamily } from '@gorenku/studio-core/client';
import { Check } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export function GenerationRequestVideoModelList({
  families,
  value,
  disabled,
  onChange,
}: {
  families: GenerationPreviewVideoModelFamily[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <section className='border-r border-border/40 p-5'>
      <div className='mb-3 grid grid-cols-[minmax(0,1fr)_auto] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        <span>Model</span>
        <span>Duration</span>
      </div>
      <div className='space-y-2'>
        {families.map((family) => {
          const selected = family.familyId === value;
          return (
            <Button
              key={family.familyId}
              type='button'
              variant='ghost'
              disabled={disabled || !family.available}
              aria-pressed={selected}
              className={cn(
                'grid h-11 w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 border border-transparent px-3 text-left text-xs font-normal',
                selected
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : null,
              )}
              onClick={() => onChange(family.familyId)}
            >
              <span
                className={cn(
                  'flex size-4 items-center justify-center rounded-full border border-border',
                  selected ? 'border-primary bg-primary text-primary-foreground' : null,
                )}
              >
                {selected ? <Check className='size-3' /> : null}
              </span>
              <span className='truncate'>{family.label}</span>
              <span className='text-muted-foreground'>
                {family.durationCapabilityLabel}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
