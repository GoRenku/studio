import type {
  GenerationPreviewVideoInputMode,
  ShotPlanVideoInputMode,
} from '@gorenku/studio-core/client';
import { Image, Images, Layers3, Type } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export function GenerationRequestVideoInputList({
  modes,
  value,
  disabled,
  onChange,
}: {
  modes: GenerationPreviewVideoInputMode[];
  value: ShotPlanVideoInputMode;
  disabled: boolean;
  onChange: (value: ShotPlanVideoInputMode) => void;
}) {
  return (
    <section className='border-r border-border/40 p-5'>
      <h3 className='mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Input
      </h3>
      <div className='space-y-2'>
        {modes.map((mode) => {
          const Icon = inputModeIcon(mode.id);
          const selected = mode.id === value;
          return (
            <Button
              key={mode.id}
              type='button'
              variant='ghost'
              disabled={disabled || !mode.available}
              aria-pressed={selected}
              className={cn(
                'h-11 w-full justify-start gap-2.5 border border-transparent px-3 text-xs font-normal',
                selected
                  ? 'border border-primary/60 bg-primary/10 text-foreground hover:bg-primary/15'
                  : null,
              )}
              onClick={() => onChange(mode.id)}
            >
              <Icon className='size-3.5' />
              {mode.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function inputModeIcon(mode: ShotPlanVideoInputMode) {
  if (mode === 'first-frame') return Image;
  if (mode === 'first-last-frame') return Images;
  if (mode === 'reference') return Layers3;
  return Type;
}
