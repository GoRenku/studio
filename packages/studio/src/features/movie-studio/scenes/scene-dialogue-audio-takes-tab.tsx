import { Pause, Play, Trash2 } from 'lucide-react';
import type { SceneDialogueAudioTakeWithUrl } from '@/services/studio-scene-dialogue-audio-api';
import { Button } from '@/ui/button';
import { Slider } from '@/ui/slider';
import { cn } from '@/lib/utils';
import type { SceneDialogueAudioPlayer } from './use-scene-dialogue-audio';
import {
  formatSceneDialogueAudioDuration,
  formatSceneDialogueAudioTimestamp,
  sceneDialogueAudioTakeLabels,
} from './scene-dialogue-audio-take-format';

interface SceneDialogueAudioTakesTabProps {
  actionDisabled: boolean;
  player: SceneDialogueAudioPlayer;
  takes: SceneDialogueAudioTakeWithUrl[];
  onDeleteTake?: (takeId: string) => void;
  onPickTake?: (takeId: string) => void;
}

export function SceneDialogueAudioTakesTab({
  actionDisabled,
  player,
  takes,
  onDeleteTake,
  onPickTake,
}: SceneDialogueAudioTakesTabProps) {
  if (!takes.length) {
    return (
      <div className='rounded-md border border-dashed border-border/45 bg-muted/15 px-3 py-4 text-sm text-muted-foreground'>
        No takes yet.
      </div>
    );
  }

  const labels = sceneDialogueAudioTakeLabels(takes);
  const orderedTakes = [...takes].sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.takeId.localeCompare(left.takeId)
  );

  return (
    <div className='flex flex-col gap-3'>
      {orderedTakes.map((take) => (
        <SceneDialogueAudioTakeRow
          key={take.takeId}
          actionDisabled={actionDisabled}
          label={labels.get(take.takeId) ?? 'Take'}
          player={player}
          selected={false}
          take={take}
          onDeleteTake={onDeleteTake}
          onPickTake={onPickTake}
        />
      ))}
    </div>
  );
}

export function SceneDialogueAudioTakeRow({
  actionDisabled,
  label,
  player,
  selected = false,
  take,
  onDeleteTake,
  onPickTake,
}: {
  actionDisabled: boolean;
  label: string;
  player: SceneDialogueAudioPlayer;
  selected?: boolean;
  take: SceneDialogueAudioTakeWithUrl;
  onDeleteTake?: (takeId: string) => void;
  onPickTake?: (takeId: string) => void;
}) {
  const progress = player.progressByUrl[take.url] ?? 0;
  const duration = player.durationByUrl[take.url] ?? 0;
  const isPlaying = player.playingUrl === take.url;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md border bg-muted/15 px-3 py-3',
        selected
          ? 'border-item-active-border bg-item-active-bg/70'
          : 'border-border/45'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-semibold text-foreground'>{label}</span>
            {selected ? (
              <span className='rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary'>
                Selected
              </span>
            ) : null}
          </div>
          <span className='text-xs text-muted-foreground'>
            {formatSceneDialogueAudioTimestamp(take.createdAt)}
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => player.toggle(take.url)}
            aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
          >
            {isPlaying ? (
              <Pause className='h-4 w-4' aria-hidden />
            ) : (
              <Play className='h-4 w-4' aria-hidden />
            )}
          </Button>
          {onPickTake ? (
            <Button
              type='button'
              variant={selected ? 'secondary' : 'outline'}
              size='sm'
              disabled={actionDisabled || selected}
              onClick={() => onPickTake(take.takeId)}
            >
              Pick
            </Button>
          ) : null}
          {onDeleteTake ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={actionDisabled}
              onClick={() => onDeleteTake(take.takeId)}
              aria-label={`Delete ${label}`}
            >
              <Trash2 className='h-4 w-4' aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className='flex items-center gap-3'>
        <Slider
          min={0}
          max={duration || 100}
          step={0.1}
          value={[duration ? Math.min(progress, duration) : 0]}
          disabled={!duration}
          sliderSize='sm'
          aria-label={`${label} playback position`}
          onValueChange={([seconds]) => {
            if (seconds !== undefined) {
              player.seek(take.url, seconds);
            }
          }}
        />
        <span className='w-12 shrink-0 text-right text-xs text-muted-foreground'>
          {duration ? formatSceneDialogueAudioDuration(duration) : '--:--'}
        </span>
      </div>
    </div>
  );
}
