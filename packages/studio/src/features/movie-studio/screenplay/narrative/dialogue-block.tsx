import type {
  DialogueTurn,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { Volume2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import type { SceneDialogueAudioWorkspaceWithUrls } from '@/services/screenplay';
import { ReferenceText } from './reference-text';
import { SubjectPreview } from './subject-preview';

export function NarrativeDialogueBlock({
  projectName,
  turn,
  references,
  audio,
  selected,
  textPreview,
  onOpenAudio,
  onSelect,
  compact = false,
}: {
  projectName: string;
  turn: DialogueTurn;
  references: ScreenplayReference[];
  audio: SceneDialogueAudioWorkspaceWithUrls;
  selected: boolean;
  textPreview: string | null;
  onOpenAudio: (turnId: string) => void;
  onSelect: (selection: StudioSelection) => void;
  compact?: boolean;
}) {
  const savedAudio = audio.audioByTurnId[turn.id] ?? null;
  const hasGeneratedAudio = Boolean(savedAudio?.takes.length);
  const displayText =
    textPreview ??
    (savedAudio
      ? savedAudio.modelChoice === 'elevenlabs/eleven_v3'
        ? savedAudio.v3Text
        : savedAudio.plainText
      : null);
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
      onClick={() => onOpenAudio(turn.id)}
      className='h-auto p-0 align-baseline font-[inherit] text-[inherit] leading-[inherit] hover:text-foreground'
    >
      {turn.characterName}
    </Button>
  );

  return (
    <div
      className={cn(
        'group relative mx-auto w-full rounded-lg border px-6 py-4 transition-colors',
        compact ? 'max-w-none' : 'max-w-[28rem]',
        selected
          ? 'border-item-active-border bg-item-active-bg'
          : 'border-transparent bg-foreground/[0.035] hover:border-item-active-border/60 hover:bg-item-hover-bg/60 dark:bg-muted/30'
      )}
    >
      <div className='grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-2 text-center text-[12.5px] font-semibold uppercase tracking-[0.18em] text-primary'>
        <span className='flex h-7 items-center justify-center'>
          {hasGeneratedAudio ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className={cn(
                'h-7 w-7 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                selected ? 'opacity-100' : 'opacity-0'
              )}
              onClick={() => onOpenAudio(turn.id)}
              aria-label={`Open ${turn.characterName} dialogue audio takes`}
            >
              <Volume2 className='h-3.5 w-3.5' aria-hidden />
            </Button>
          ) : null}
        </span>
        <span className='min-w-0 truncate'>
          {speakerReference ? (
            <SubjectPreview
              projectName={projectName}
              subject={speakerReference.subject}
              trigger={cueControl}
            />
          ) : (
            cueControl
          )}
          {turn.extensions.length ? (
            <span className='ml-1 font-normal text-muted-foreground'>
              ({turn.extensions.join(', ')})
            </span>
          ) : null}
        </span>
        <span aria-hidden />
      </div>

      <div className='mt-2 flex flex-col gap-2 text-[15px] leading-7 text-foreground/95'>
        {displayText
          ? displayText.split('\n').map((line, index) => (
              <p key={index}>
                <ReferenceText
                  projectName={projectName}
                  text={line}
                  references={[]}
                  onSelect={onSelect}
                  interactive={false}
                />
              </p>
            ))
          : turn.parts.map((part) => (
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
