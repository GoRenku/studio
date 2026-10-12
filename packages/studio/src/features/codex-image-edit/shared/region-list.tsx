import { Trash2 } from 'lucide-react';
import type { ImageEditRegion, ImageEditRegionMode } from '@gorenku/studio-codex/image-edit';
import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';
import { ImageEditSectionHeading } from './image-edit-panel-frame';
import { regionColor } from './region-geometry';

export function RegionList(input: {
  regions: ImageEditRegion[];
  /** The route's region modes, in display order. */
  modes: ImageEditRegionMode[];
  selectedNumber: number | null;
  focusNumber: number | null;
  disabled: boolean;
  onSelect: (number: number) => void;
  onModeChange: (number: number, mode: string) => void;
  onInstructionChange: (number: number, instruction: string) => void;
  onDelete: (number: number) => void;
  onSubmit: () => void;
}) {
  return (
    <section className='flex flex-col gap-2.5'>
      <ImageEditSectionHeading count={input.regions.length}>Regions</ImageEditSectionHeading>
      {input.regions.length === 0 ? (
        <p className='m-0 rounded-[10px] border border-dashed border-[var(--dd-border)] p-3 text-xs leading-relaxed text-[var(--dd-muted-fg)]'>Drag on the image to mark an area. Each region gets its own instruction.</p>
      ) : input.regions.map((region) => (
        <RegionCard
          key={region.number}
          region={region}
          modes={input.modes}
          selected={region.number === input.selectedNumber}
          autoFocus={region.number === input.focusNumber}
          disabled={input.disabled}
          onSelect={() => input.onSelect(region.number)}
          onModeChange={(mode) => input.onModeChange(region.number, mode)}
          onInstructionChange={(instruction) => input.onInstructionChange(region.number, instruction)}
          onDelete={() => input.onDelete(region.number)}
          onSubmit={input.onSubmit}
        />
      ))}
    </section>
  );
}

function RegionCard(input: {
  region: ImageEditRegion;
  modes: ImageEditRegionMode[];
  selected: boolean;
  autoFocus: boolean;
  disabled: boolean;
  onSelect: () => void;
  onModeChange: (mode: string) => void;
  onInstructionChange: (instruction: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
}) {
  const color = regionColor(input.region.number);
  const mode = input.modes.find((option) => option.id === input.region.mode) ?? input.modes[0]!;
  const missingInstruction = mode.instructionRequired && !input.region.instruction.trim();
  return (
    <div
      className={cn('flex flex-col gap-2 rounded-[10px] border border-[var(--dd-border)] bg-[var(--dd-card)] p-2.5')}
      style={input.selected ? { borderColor: color.stroke, boxShadow: `0 0 0 1px ${color.stroke}` } : undefined}
    >
      <div className='flex items-center gap-2'>
        <span className='grid h-5 min-w-5 place-items-center rounded-[5px] px-1 font-mono text-[11px] font-bold text-white' style={{ background: color.stroke }}>{input.region.number}</span>
        <div role='group' aria-label={`Region ${input.region.number} action`} className='inline-flex overflow-hidden rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)]'>
          {input.modes.map((option) => (
            <Button
              key={option.id}
              type='button'
              variant='ghost'
              aria-pressed={option.id === input.region.mode}
              disabled={input.disabled}
              onClick={() => input.onModeChange(option.id)}
              className={cn(
                'h-auto rounded-none px-2.5 py-1 text-[11.5px] font-medium text-[var(--dd-muted-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)] [&+&]:border-l [&+&]:border-[var(--dd-border)]',
                option.id === input.region.mode && 'bg-[var(--dd-active)] font-semibold text-[var(--dd-fg)]',
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button type='button' variant='ghost' size='icon' aria-label={`Delete region ${input.region.number}`} disabled={input.disabled} onClick={input.onDelete} className='ml-auto size-6 rounded-full text-[var(--dd-muted-fg)] hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)]'>
          <Trash2 className='size-3.5' />
        </Button>
      </div>
      <Textarea
        aria-label={`Region ${input.region.number} instruction`}
        rows={2}
        autoFocus={input.autoFocus}
        disabled={input.disabled}
        placeholder={mode.placeholder}
        value={input.region.instruction}
        onFocus={input.onSelect}
        onChange={(event) => input.onInstructionChange(event.target.value)}
        onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); input.onSubmit(); } }}
        className='min-h-14 resize-none rounded-lg border-[var(--dd-border)] bg-[var(--dd-editor)] text-[12.5px] leading-normal text-[var(--dd-card-fg)] shadow-none [field-sizing:content] placeholder:text-[var(--dd-muted-fg)] focus-visible:ring-[var(--dd-primary)]'
      />
      {missingInstruction && !input.selected ? <span className='text-[11px] text-[var(--dd-destructive)]'>Needs an instruction</span> : null}
    </div>
  );
}
