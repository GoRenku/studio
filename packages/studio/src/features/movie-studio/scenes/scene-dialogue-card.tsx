import type { ReactNode } from 'react';
import type { Block } from '@gorenku/studio-core/client';
import { Pause, Volume2 } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SceneNarrativeResourceResponse } from '@/services/studio-project-contracts';
import type { SceneDialogueAudioContextWithUrls } from '@/services/studio-scene-dialogue-audio-api';
import type { SceneDialogueAudioPlayer } from './use-scene-dialogue-audio';

interface SceneDialogueCardProps {
  block: Extract<Block, { type: 'dialogue' }>;
  player: SceneDialogueAudioPlayer;
  resource: SceneNarrativeResourceResponse;
  selected: boolean;
  textPreview?: string | null;
  onOpenDialogueAudio: (dialogueId: string) => void;
  renderInlineText: (text: string, interactive?: boolean) => ReactNode;
}

export function SceneDialogueCard({
  block,
  player,
  resource,
  selected,
  textPreview,
  onOpenDialogueAudio,
  renderInlineText,
}: SceneDialogueCardProps) {
  const castMemberId = block.castMemberId;
  const fallbackName = block.castMemberReference?.key ?? 'Dialogue';
  const characterName = castMemberId
    ? resource.castMemberLabels[castMemberId] ?? fallbackName
    : fallbackName;
  const dialogueId = block.dialogueId ?? null;
  const dialogueAudio =
    resource.dialogueAudio as SceneDialogueAudioContextWithUrls;
  const savedAudio = dialogueId
    ? dialogueAudio.audioByDialogueId[dialogueId] ?? null
    : null;
  const pickedTake = dialogueId
    ? savedAudio?.takes.find((take) => take.picked)
    : null;
  const pickedTakeUrl = pickedTake?.url ?? null;
  const displayText =
    textPreview ??
    (savedAudio
      ? savedAudio.modelChoice === 'elevenlabs/eleven_v3'
        ? savedAudio.v3Text
        : savedAudio.plainText
      : null);
  const displayLines = displayText ? displayText.split('\n') : block.lines;
  const profileImage = castMemberId
    ? resource.castMemberImages[castMemberId] ?? null
    : null;
  const nameControl = dialogueId ? (
    <Button
      type='button'
      variant='link'
      onClick={() => onOpenDialogueAudio(dialogueId)}
      className='h-auto p-0 align-baseline font-[inherit] text-[inherit] leading-[inherit] hover:text-foreground'
    >
      {characterName}
    </Button>
  ) : (
    <span>{characterName}</span>
  );
  const isPickedTakePlaying =
    Boolean(pickedTakeUrl) && player.playingUrl === pickedTakeUrl;

  return (
    <div
      className={cn(
        'group relative mx-auto max-w-[28rem] rounded-lg border px-6 py-4 transition-colors',
        selected
          ? 'border-item-active-border bg-item-active-bg'
          : 'border-transparent bg-foreground/[0.035] hover:border-item-active-border/60 hover:bg-item-hover-bg/60 dark:bg-muted/30'
      )}
    >
      <div className='grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-2 text-center text-[12.5px] font-semibold uppercase tracking-[0.18em] text-primary'>
        <span className='flex h-7 items-center justify-center'>
          {pickedTakeUrl ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className={cn(
                'h-7 w-7 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                selected ? 'opacity-100' : 'opacity-0'
              )}
              onClick={() => player.toggle(pickedTakeUrl)}
              aria-label={
                isPickedTakePlaying
                  ? 'Pause dialogue audio'
                  : 'Play dialogue audio'
              }
            >
              {isPickedTakePlaying ? (
                <Pause className='h-3.5 w-3.5' aria-hidden />
              ) : (
                <Volume2 className='h-3.5 w-3.5' aria-hidden />
              )}
            </Button>
          ) : null}
        </span>
        <span className='min-w-0 truncate'>
          {castMemberId && profileImage ? (
            <Tooltip>
              <TooltipTrigger asChild>{nameControl}</TooltipTrigger>
              <TooltipContent side='right' align='center' className='p-2'>
                <img
                  src={profileImage.url}
                  alt={`${characterName} profile image`}
                  className='h-40 w-40 rounded-md object-cover'
                />
              </TooltipContent>
            </Tooltip>
          ) : (
            nameControl
          )}
          {block.extension ? (
            <span className='ml-1 font-normal text-muted-foreground'>
              ({block.extension})
            </span>
          ) : null}
        </span>
        <span aria-hidden />
      </div>

      {block.parenthetical ? (
        <div className='mt-1 text-center text-[13px] italic text-muted-foreground'>
          ({block.parenthetical})
        </div>
      ) : null}

      <div className='mt-2 flex flex-col gap-2 text-[15px] leading-7 text-foreground/95'>
        {displayLines.map((line, index) => (
          <p key={index}>{renderInlineText(line, false)}</p>
        ))}
      </div>

      {!dialogueId ? (
        <p className='mt-2 text-center text-xs text-destructive'>
          Dialogue audio needs the project database migration to add dialogue IDs.
        </p>
      ) : null}
    </div>
  );
}
