import { Button } from '@/ui/button';
import { MediaCardAudioTake } from '@/ui/media-card/media-card-audio-take';
import {
  clearShotPlanDialogueAudioTakeSelection,
  deleteShotPlanDialogueAudioTake,
  selectShotPlanDialogueAudioTake,
} from '@/services/studio-shot-plan-dialogue-audio-api';
import { useShotPlanDialogueAudio } from './use-shot-plan-dialogue-audio';

export function ShotPlanDialogueAudio(input: {
  projectName: string;
  shotPlanId: string;
}) {
  const { resource, error, reload } = useShotPlanDialogueAudio(input);
  if (error) {
    return (
      <div className='flex h-full flex-col items-start justify-center gap-3 p-8'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button type='button' variant='outline' size='sm' onClick={reload}>Retry</Button>
      </div>
    );
  }
  if (!resource) return <p className='p-8 text-sm text-muted-foreground'>Loading audio...</p>;
  if (resource.takes.length === 0) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <p className='text-sm text-muted-foreground'>No audio yet.</p>
      </div>
    );
  }
  return (
    <div className='h-full overflow-y-auto p-6'>
      <div className='mx-auto flex max-w-[1120px] flex-col gap-4'>
        {resource.takes.map((take) => (
          <MediaCardAudioTake
            key={take.id}
            turnLabel={take.turnRange.start === take.turnRange.end
              ? `Turn ${take.turnRange.start}`
              : `Turns ${take.turnRange.start}–${take.turnRange.end}`}
            audioUrl={take.audioUrl}
            durationSeconds={take.durationSeconds}
            speakers={take.speakers.map((speaker, index) => ({
              key: speaker.castMemberId ?? `${speaker.speakerName}-${index}`,
              name: speaker.speakerName,
              profileUrl: speaker.profileUrl,
              isVoiceOver: speaker.isVoiceOver,
            }))}
            provenance={formatProvenance(take.provenance)}
            date={`Generated ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(take.createdAt))}`}
            selected={take.selected}
            selection={{
              kind: 'toggle',
              selected: take.selected,
              selectedLabel: `Remove ${rangeLabel(take.turnRange)} from selected audio`,
              unselectedLabel: `Select ${rangeLabel(take.turnRange)} as audio context`,
              onToggle: async () => {
                if (take.selected) await clearShotPlanDialogueAudioTakeSelection({ ...input, takeId: take.id });
                else await selectShotPlanDialogueAudioTake({ ...input, takeId: take.id });
                reload();
              },
            }}
            deleteAction={{
              label: `Delete ${rangeLabel(take.turnRange)} audio`,
              confirmationTitle: 'Delete Dialogue Audio?',
              confirmationMessage: 'This audio will move to Trash. You can restore it later.',
              onDelete: async () => {
                await deleteShotPlanDialogueAudioTake({ ...input, takeId: take.id });
                reload();
              },
            }}
          />
        ))}
      </div>
    </div>
  );
}

function rangeLabel(range: { start: number; end: number }) {
  return range.start === range.end ? `Turn ${range.start}` : `Turns ${range.start}–${range.end}`;
}

function formatProvenance(provenance: { provider: string; model: string } | null) {
  if (!provenance) return 'Generated audio';
  return `${humanize(provenance.model)} · ${humanize(provenance.provider)}`;
}

function humanize(value: string) {
  return value
    .split('/').at(-1)!
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
