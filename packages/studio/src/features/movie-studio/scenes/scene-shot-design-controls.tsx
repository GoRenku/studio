import type { ReactNode } from 'react';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';
import { AutosaveStatus } from '@/ui/autosave-status';
import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';

/** A labelled shot specs section with a micro-heading. */
export function DesignSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='space-y-2.5'>
      <h4 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {title}
      </h4>
      {children}
    </section>
  );
}

/** A compact segmented toggle used for direction/track/dutch modifiers. */
export function PillToggle({
  selected,
  onClick,
  children,
  ariaLabel,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Button
      type='button'
      variant={null}
      size={null}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-start gap-1.5 whitespace-normal rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary/15 text-foreground'
          : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
      )}
    >
      {children}
    </Button>
  );
}

/** Free-text "Custom…" entry with the shared autosave indicator. */
export function CustomFieldRow({
  placeholder,
  value,
  onChange,
  status,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  status: DebouncedAutosaveStatus;
}) {
  return (
    <div className='flex items-start gap-3'>
      <Textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className='min-h-20 flex-1 resize-y'
      />
      <AutosaveStatus status={status} />
    </div>
  );
}
