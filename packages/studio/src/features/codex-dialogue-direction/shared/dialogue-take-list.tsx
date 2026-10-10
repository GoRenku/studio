import { useState } from 'react';
import type { DialogueDirectionAction, DialogueDirectionTake, DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';
import { dialogueLineRangeLabel } from '@/services/codex-dialogue-direction';
import { Button } from '@/ui/button';
import { CompactAudioWaveformPlayer } from '@/ui/compact-audio-waveform-player';
import { cn } from '@/lib/utils';
import { sameDialogueLineRange } from './dialogue-line-range';
import { useDirectionMediaUrl, type DirectionMediaLibrary } from './use-direction-media';

const TAKE_ROW_CLASS = 'grid grid-cols-[22px_52px_28px_minmax(0,1fr)_44px_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-2 max-[860px]:grid-cols-[22px_28px_minmax(0,1fr)_auto]';
const ICON_BUTTON_CLASS = 'grid size-7 place-items-center rounded-full p-0 text-[var(--dd-muted-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)]';
const CONFIRM_BUTTON_CLASS = 'h-auto rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)] px-3 py-[7px] text-[12.5px] font-medium shadow-none hover:bg-[var(--dd-hover)]';

export function DialogueTakeList(input: {
  takes: DialogueDirectionTake[];
  selection: DialogueLineRange;
  action: DialogueDirectionAction | null;
  media: DirectionMediaLibrary;
  autoPlayTakeId?: string;
  disabled: boolean;
  onSelect: (takeId: string, selected: boolean) => void;
  onDiscard: (takeId: string) => void;
  onEditFromTake?: (take: DialogueDirectionTake) => void;
}) {
  const [confirmingTakeId, setConfirmingTakeId] = useState<string>();
  const rangeTakes = input.takes
    .filter((take) => take.matchesRoute && sameDialogueLineRange(take.turnRange, input.selection))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const numbered = rangeTakes.map((take, index) => ({ take, number: index + 1 })).reverse();
  const actionHere = input.action && sameDialogueLineRange(input.action.turnRange, input.selection);
  const generating = input.action && input.action.status !== 'failed';
  const failed = input.action?.status === 'failed' ? input.action : null;
  if (numbered.length === 0 && !input.action) return null;
  return (
    <div className='flex flex-col gap-1.5' aria-label='Takes' role='list'>
      {generating && actionHere ? (
        <div role='listitem' aria-label={`Generating Take ${numbered.length + 1}`} className={cn(TAKE_ROW_CLASS, 'border-dashed border-[var(--dd-border)] bg-[var(--dd-card)]')}>
          <span />
          <span className='font-[family-name:var(--dd-font-mono)] text-[11.5px] font-semibold max-[860px]:hidden'>Take {numbered.length + 1}</span>
          <span />
          <span className='h-7 animate-[dd-shimmer_1.2s_linear_infinite] rounded-md bg-[linear-gradient(90deg,var(--dd-muted),var(--dd-active),var(--dd-muted))] bg-[length:200%_100%] motion-reduce:animate-none' />
          <span className='max-[860px]:hidden' />
          <span />
        </div>
      ) : null}
      {failed ? (
        <p role='alert' className='m-0 rounded-[10px] border border-dashed border-[var(--dd-destructive)] px-3 py-2 text-xs text-[var(--dd-destructive)]'>
          {actionHere ? null : `${dialogueLineRangeLabel(failed.turnRange)}: `}{failed.message ?? 'The Take could not be generated.'}
        </p>
      ) : null}
      {numbered.map(({ take, number }) => (
        <DialogueTakeRow
          key={take.takeId}
          take={take}
          number={number}
          media={input.media}
          autoPlay={input.autoPlayTakeId === take.takeId}
          confirming={confirmingTakeId === take.takeId}
          disabled={input.disabled}
          onSelect={() => input.onSelect(take.takeId, !take.selected)}
          onConfirmDiscard={() => setConfirmingTakeId(take.takeId)}
          onKeep={() => setConfirmingTakeId(undefined)}
          onDiscard={() => { setConfirmingTakeId(undefined); input.onDiscard(take.takeId); }}
          onEditFromTake={input.onEditFromTake && take.actingScripts ? () => input.onEditFromTake!(take) : undefined}
        />
      ))}
    </div>
  );
}

function DialogueTakeRow(input: {
  take: DialogueDirectionTake;
  number: number;
  media: DirectionMediaLibrary;
  autoPlay: boolean;
  confirming: boolean;
  disabled: boolean;
  onSelect: () => void;
  onConfirmDiscard: () => void;
  onKeep: () => void;
  onDiscard: () => void;
  onEditFromTake?: () => void;
}) {
  const { take } = input;
  const audio = useDirectionMediaUrl(input.media, take.audioUri);
  const label = `Take ${input.number}`;
  return (
    <div
      role='listitem'
      aria-label={label}
      className={cn(
        TAKE_ROW_CLASS,
        take.selected ? 'border-[var(--dd-sel-border)] bg-[var(--dd-sel-bg)]' : 'border-[var(--dd-border)] bg-[var(--dd-card)]',
      )}
    >
      <Button
        type='button'
        variant='ghost'
        role='radio'
        aria-checked={take.selected}
        aria-label={take.selected ? `Clear selection of ${label}` : `Select ${label}`}
        title={take.selected ? 'Selected' : 'Select'}
        disabled={input.disabled}
        className={cn(
          'grid size-[18px] place-items-center rounded-full border-[1.5px] bg-transparent p-0 shadow-none hover:bg-transparent',
          take.selected ? 'border-[var(--dd-sel-fg)]' : 'border-[var(--dd-muted-fg)]',
        )}
        onClick={input.onSelect}
      >
        {take.selected ? <span className='size-2 rounded-full bg-[var(--dd-sel-fg)]' /> : null}
      </Button>
      <span className='font-[family-name:var(--dd-font-mono)] text-[11.5px] font-semibold max-[860px]:hidden'>{label}</span>
      <CompactAudioWaveformPlayer
        src={audio.url}
        durationSeconds={take.durationSeconds}
        label={label}
        waveformSeed={take.takeId}
        autoPlay={input.autoPlay}
        buttonClassName='border border-[var(--dd-border)] bg-[var(--dd-card)] text-[var(--dd-fg)] hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)]'
        waveColor='var(--dd-wave)'
        progressColor='var(--dd-primary)'
        durationClassName='font-[family-name:var(--dd-font-mono)] text-[11px] text-[var(--dd-muted-fg)] max-[860px]:hidden'
      />
      <span className='flex items-center gap-0.5'>
        {input.confirming ? (
          <span className='flex items-center gap-1 text-[11.5px]'>
            <Button type='button' variant='ghost' className={cn(CONFIRM_BUTTON_CLASS, 'text-[var(--dd-destructive)] hover:text-[var(--dd-destructive)]')} disabled={input.disabled} onClick={input.onDiscard}>Delete</Button>
            <Button type='button' variant='ghost' className={cn(CONFIRM_BUTTON_CLASS, 'text-[var(--dd-fg)] hover:text-[var(--dd-fg)]')} onClick={input.onKeep}>Keep</Button>
          </span>
        ) : (
          <>
            {input.onEditFromTake ? (
              <Button type='button' variant='ghost' className={ICON_BUTTON_CLASS} aria-label={`Edit from ${label}`} title='Edit from this take' onClick={input.onEditFromTake}>
                <svg viewBox='0 0 12 12' className='size-[13px] fill-current' aria-hidden><path d='M6 1.5a4.5 4.5 0 1 1-4.3 3.2l1.4.5A3 3 0 1 0 6 3v1.8L3 2.3 6 0z' /></svg>
              </Button>
            ) : null}
            <Button type='button' variant='ghost' className={ICON_BUTTON_CLASS} aria-label={`Delete ${label}`} title='Delete' disabled={input.disabled} onClick={input.onConfirmDiscard}>
              <svg viewBox='0 0 12 12' className='size-[13px] fill-current' aria-hidden><path d='M4 1h4v1h3v1.5H1V2h3zM2 4.5h8L9.3 11H2.7z' /></svg>
            </Button>
          </>
        )}
      </span>
    </div>
  );
}
