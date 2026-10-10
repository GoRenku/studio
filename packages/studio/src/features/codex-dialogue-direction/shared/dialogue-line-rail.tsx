import { useState, type MouseEvent } from 'react';
import type { DialogueDirectionLine, DialogueDirectionTake, DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { adjustDialogueLineRange, dialogueLineGutterAction, dialogueLineRangeContains } from './dialogue-line-range';
import { SpeakerAvatar } from './speaker-avatar';
import type { DirectionMediaLibrary } from './use-direction-media';

export function DialogueLineRail(input: {
  lines: DialogueDirectionLine[];
  takes: DialogueDirectionTake[];
  selection: DialogueLineRange;
  media: DirectionMediaLibrary;
  speakerBadge?: (line: DialogueDirectionLine) => number | null;
  onSelectionChange: (selection: DialogueLineRange) => void;
}) {
  const [anchor, setAnchor] = useState(input.selection.start);
  const adjust = (line: number) => input.onSelectionChange(adjustDialogueLineRange(input.selection, anchor, line));
  const choose = (event: MouseEvent<HTMLButtonElement>, line: number) => {
    if (event.shiftKey) {
      adjust(line);
      return;
    }
    setAnchor(line);
    input.onSelectionChange({ start: line, end: line });
  };
  return (
    <nav aria-label='Dialogue lines' className='flex min-h-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--dd-border)] bg-[var(--dd-rail)] px-2 py-2.5 max-[860px]:max-h-[240px] max-[860px]:border-b max-[860px]:border-r-0'>
      {input.lines.map((line) => {
        const selected = dialogueLineRangeContains(input.selection, line.number);
        const covering = input.takes.filter((take) => dialogueLineRangeContains(take.turnRange, line.number));
        const matchingCount = covering.filter((take) => take.matchesRoute).length;
        const coveredBySelectedTake = covering.some((take) => take.selected);
        const gutter = dialogueLineGutterAction(input.selection, line.number);
        const first = selected && line.number === input.selection.start;
        const last = selected && line.number === input.selection.end;
        return (
          <div key={line.number} className='group relative'>
            <Button
              type='button'
              variant='ghost'
              aria-pressed={selected}
              className={cn(
                'grid h-auto w-full cursor-pointer grid-cols-[18px_26px_minmax(0,1fr)_auto] items-center justify-normal gap-2 whitespace-normal rounded-none border border-transparent px-2 py-[7px] text-left text-[13px] font-normal leading-normal text-[var(--dd-fg)] outline-none transition-none hover:text-[var(--dd-fg)] focus-visible:ring-2 focus-visible:ring-[var(--dd-primary)]',
                selected ? 'bg-[var(--dd-active)] hover:bg-[var(--dd-active)]' : 'rounded-lg hover:bg-[var(--dd-hover)]',
                first && 'rounded-t-lg',
                last && 'rounded-b-lg',
              )}
              onClick={(event) => choose(event, line.number)}
            >
              <span className='text-right font-[family-name:var(--dd-font-mono)] text-[11px] font-medium text-[var(--dd-muted-fg)]'>{line.number}</span>
              <SpeakerAvatar speaker={line} media={input.media} badge={selected ? input.speakerBadge?.(line) : null} />
              <span className='min-w-0'>
                <span className='block text-xs font-semibold'>{line.speakerName}</span>
                <span className='block truncate text-[11.5px] text-[var(--dd-muted-fg)]'>{line.plainText}</span>
              </span>
              <span className='flex items-center gap-1 font-[family-name:var(--dd-font-mono)] text-[10.5px] font-medium text-[var(--dd-muted-fg)]'>
                {matchingCount > 0 ? matchingCount : null}
                <span
                  data-selected-take={coveredBySelectedTake ? '' : undefined}
                  className={cn(
                    'size-[7px] rounded-full border-[1.5px]',
                    coveredBySelectedTake ? 'border-[var(--dd-ok)] bg-[var(--dd-ok)]' : 'border-[var(--dd-border)] bg-transparent',
                  )}
                />
              </span>
            </Button>
            {gutter ? (
              <Button
                type='button'
                variant='ghost'
                className='absolute left-1.5 top-1/2 hidden h-[22px] w-[22px] -translate-y-1/2 place-items-center rounded-md border border-[var(--dd-border)] bg-[var(--dd-card)] p-0 font-[family-name:var(--dd-font-mono)] text-xs font-semibold text-[var(--dd-fg)] shadow-none hover:border-[var(--dd-primary)] hover:bg-[var(--dd-card)] hover:text-[var(--dd-fg)] focus-visible:grid group-hover:grid'
                aria-label={gutter === 'add' ? `Add line ${line.number} to the selection` : `Remove line ${line.number} from the selection`}
                onClick={() => adjust(line.number)}
              >
                {gutter === 'add' ? '+' : '−'}
              </Button>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
