import { Check, Pause, Play } from 'lucide-react';
import type { ShotDialogueChoice } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { cn } from '@/lib/utils';

export interface ShotDialogueAudioTake {
  id: string;
  label: string;
  durationLabel?: string;
}

export interface ShotDialogueAudioChoice {
  dialogueId: string;
  speakerName: string;
  plainText: string;
  profileImageUrl?: string | null;
  selectedTakeId?: string | null;
  takes: ShotDialogueAudioTake[];
}

interface ShotDialogsTabProps {
  dialogues: ShotDialogueAudioChoice[];
  values: ShotDialogueChoice[];
  playingTakeId?: string | null;
  disabled?: boolean;
  onChange: (values: ShotDialogueChoice[]) => void;
  onSelectTake: (dialogueId: string, takeId: string) => void;
  onTogglePlayback?: (takeId: string) => void;
}

export function ShotDialogsTab({
  dialogues,
  values,
  playingTakeId = null,
  disabled = false,
  onChange,
  onSelectTake,
  onTogglePlayback,
}: ShotDialogsTabProps) {
  if (dialogues.length === 0) {
    return (
      <div className='py-4'>
        <p className='text-sm text-muted-foreground'>
          No dialogue in this scene.
        </p>
      </div>
    );
  }

  const changeInclusion = (
    dialogueId: string,
    inclusion: ShotDialogueChoice['inclusion']
  ) => {
    const existing = values.find((value) => value.dialogueId === dialogueId);
    onChange([
      ...values.filter((value) => value.dialogueId !== dialogueId),
      { ...existing, dialogueId, inclusion },
    ]);
  };

  return (
    <div className='flex flex-col gap-3 py-4'>
      {dialogues.map((dialogue) => {
        const inclusion =
          values.find((value) => value.dialogueId === dialogue.dialogueId)
            ?.inclusion ?? 'include';
        const selectedTake =
          dialogue.takes.find((take) => take.id === dialogue.selectedTakeId) ??
          dialogue.takes[0] ??
          null;
        return (
          <div
            key={dialogue.dialogueId}
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3',
              inclusion === 'include'
                ? 'border-item-active-border bg-item-active-bg/70'
                : 'border-border/45 bg-muted/15'
            )}
          >
            <div className='min-w-0'>
              <p className='text-sm font-medium text-foreground'>
                {dialogue.speakerName}
              </p>
              <p className='mt-1 text-sm text-muted-foreground'>
                {dialogue.plainText}
              </p>
              {selectedTake ? (
                <div className='mt-3 flex items-center gap-2'>
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    disabled={disabled || !onTogglePlayback}
                    aria-label={
                      playingTakeId === selectedTake.id
                        ? 'Pause dialogue audio'
                        : 'Play dialogue audio'
                    }
                    onClick={() => onTogglePlayback?.(selectedTake.id)}
                  >
                    {playingTakeId === selectedTake.id ? (
                      <Pause data-icon='inline-start' />
                    ) : (
                      <Play data-icon='inline-start' />
                    )}
                  </Button>
                  {dialogue.takes.length > 1 ? (
                    <DialogueTakePicker
                      dialogue={dialogue}
                      selectedTakeId={selectedTake.id}
                      disabled={disabled}
                      onSelectTake={onSelectTake}
                    />
                  ) : (
                    <span className='text-xs text-muted-foreground'>
                      {selectedTake.label}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled}
              aria-label={`${inclusion === 'include' ? 'Exclude' : 'Include'} ${dialogue.speakerName} dialogue audio`}
              onClick={() =>
                changeInclusion(
                  dialogue.dialogueId,
                  inclusion === 'include' ? 'exclude' : 'include'
                )
              }
            >
              {inclusion === 'include' ? 'Included' : 'Excluded'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function DialogueTakePicker({
  dialogue,
  selectedTakeId,
  disabled,
  onSelectTake,
}: {
  dialogue: ShotDialogueAudioChoice;
  selectedTakeId: string;
  disabled: boolean;
  onSelectTake: (dialogueId: string, takeId: string) => void;
}) {
  const selectedTake = dialogue.takes.find(
    (take) => take.id === selectedTakeId
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type='button' variant='outline' size='sm' disabled={disabled}>
          {selectedTake?.label ?? 'Choose audio'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogue.speakerName}</DialogTitle>
          <DialogDescription>
            Choose the Scene Dialogue Audio Take for this Shot draft.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          {dialogue.takes.map((take) => (
            <Button
              key={take.id}
              type='button'
              variant='outline'
              className='justify-between'
              onClick={() => onSelectTake(dialogue.dialogueId, take.id)}
            >
              <span>{take.label}</span>
              {take.durationLabel ? (
                <span className='text-muted-foreground'>
                  {take.durationLabel}
                </span>
              ) : null}
              {take.id === selectedTakeId ? <Check /> : null}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
