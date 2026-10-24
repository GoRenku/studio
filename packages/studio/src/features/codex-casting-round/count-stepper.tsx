import { Minus, Plus } from 'lucide-react';
import { Button } from '@/ui/button';

/** A − value + control for a candidate count. */
export function CountStepper(input: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  const stepClass = 'h-6 w-6 rounded-md p-0 text-[var(--dd-muted-fg)] hover:bg-[var(--dd-hover)]';
  return (
    <span role='group' aria-label={input.label} className='inline-flex items-center gap-0.5 rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)] px-0.5'>
      <Button type='button' variant='ghost' aria-label={`Fewer · ${input.label}`} disabled={input.disabled || input.value <= input.min} className={stepClass} onClick={() => input.onChange(input.value - 1)}>
        <Minus className='size-3' />
      </Button>
      <output aria-label={input.label} className='min-w-6 text-center font-mono text-[12.5px] font-semibold tabular-nums'>{input.value}</output>
      <Button type='button' variant='ghost' aria-label={`More · ${input.label}`} disabled={input.disabled || input.value >= input.max} className={stepClass} onClick={() => input.onChange(input.value + 1)}>
        <Plus className='size-3' />
      </Button>
    </span>
  );
}
