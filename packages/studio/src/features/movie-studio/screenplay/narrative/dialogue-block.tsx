import type {
  DialogueTurn,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { ReferenceText } from './reference-text';
import { SubjectPreview } from './subject-preview';

export function NarrativeDialogueBlock({
  projectName,
  turn,
  turnNumber,
  references,
  onSelect,
  compact = false,
}: {
  projectName: string;
  turn: DialogueTurn;
  turnNumber: number;
  references: ScreenplayReference[];
  onSelect: (selection: StudioSelection) => void;
  compact?: boolean;
}) {
  const speakerReference = references.find(
    (reference) =>
      reference.target.type === 'dialogueCue' &&
      reference.target.turnId === turn.id &&
      reference.role === 'speaker'
  );
  const cueControl = (
    <Button
      type='button'
      variant='link'
      className='h-auto p-0 align-baseline font-[inherit] text-[inherit] leading-[inherit] hover:text-foreground'
    >
      {turn.characterName}
    </Button>
  );

  return (
    <div
      role='group'
      aria-label={`Dialogue by ${turn.characterName}`}
      className={cn(
        'group relative mx-auto w-full rounded-lg border border-transparent bg-foreground/[0.035] px-6 py-4 transition-colors hover:border-item-active-border/60 hover:bg-item-hover-bg/60 dark:bg-muted/30',
        compact ? 'max-w-none' : 'max-w-[28rem]'
      )}
    >
      <span
        data-dialogue-turn-number={turnNumber}
        className='absolute right-3 top-3 text-[10px] font-semibold tabular-nums text-muted-foreground/70'
      >
        {turnNumber}
      </span>
      <div className='text-center text-[12.5px] font-semibold uppercase tracking-[0.18em] text-primary'>
        <span className='min-w-0 truncate'>
          {speakerReference ? (
            <SubjectPreview
              projectName={projectName}
              subject={speakerReference.subject}
              trigger={cueControl}
            />
          ) : (
            <span>{turn.characterName}</span>
          )}
          {turn.extensions.length ? (
            <span className='ml-1 font-normal text-muted-foreground'>
              ({turn.extensions.join(', ')})
            </span>
          ) : null}
        </span>
      </div>

      <div className='mt-2 flex flex-col gap-2 text-[15px] leading-7 text-foreground/95'>
        {turn.parts.map((part) => (
          <p
            key={part.id}
            className={
              part.type === 'parenthetical'
                ? 'text-center text-[13px] italic text-muted-foreground'
                : undefined
            }
          >
            {part.type === 'parenthetical' ? '(' : null}
            <ReferenceText
              projectName={projectName}
              text={part.text}
              references={references.filter(
                (reference) =>
                  reference.target.type === 'dialoguePart' &&
                  reference.target.turnId === turn.id &&
                  reference.target.partId === part.id
              )}
              onSelect={onSelect}
            />
            {part.type === 'parenthetical' ? ')' : null}
          </p>
        ))}
      </div>
    </div>
  );
}
