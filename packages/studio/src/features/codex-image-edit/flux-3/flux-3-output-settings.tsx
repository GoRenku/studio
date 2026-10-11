import type { ImageEditResolution } from '@gorenku/studio-codex/image-edit';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { ImageEditSectionHeading } from '../shared/image-edit-panel-frame';

const RESOLUTIONS: ImageEditResolution[] = ['1k', '2k', '4k'];

/** FLUX 3 output: resolution only; edits keep the source aspect ratio so regions stay in place. */
export function Flux3OutputSettings(input: { resolution: ImageEditResolution; disabled: boolean; onResolutionChange: (resolution: ImageEditResolution) => void }) {
  return (
    <section className='flex flex-col gap-2.5'>
      <ImageEditSectionHeading>Output</ImageEditSectionHeading>
      <div className='flex flex-wrap items-center gap-2.5'>
        <span className='min-w-[74px] text-xs text-[var(--dd-muted-fg)]'>Resolution</span>
        <div role='group' aria-label='Resolution' className='inline-flex overflow-hidden rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)]'>
          {RESOLUTIONS.map((resolution) => (
            <Button
              key={resolution}
              type='button'
              variant='ghost'
              aria-pressed={resolution === input.resolution}
              disabled={input.disabled}
              onClick={() => input.onResolutionChange(resolution)}
              className={cn(
                'h-auto rounded-none px-2.5 py-1 text-[11.5px] font-medium text-[var(--dd-muted-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)] [&+&]:border-l [&+&]:border-[var(--dd-border)]',
                resolution === input.resolution && 'bg-[var(--dd-active)] font-semibold text-[var(--dd-fg)]',
              )}
            >
              {resolution.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
