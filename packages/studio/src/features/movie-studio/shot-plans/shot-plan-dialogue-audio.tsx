import type { ReactNode } from 'react';
import { Button } from '@/ui/button';
import { MediaCardAudioTake } from '@/ui/media-card/media-card-audio-take';
import {
  clearShotPlanDialogueAudioTakeSelection,
  deleteShotPlanDialogueAudioTake,
  selectShotPlanDialogueAudioTake,
  type StudioShotPlanDialogueAudioTake,
} from '@/services/studio-shot-plan-dialogue-audio-api';
import {
  groupShotPlanDialogueAudio,
  type DialogueAudioLineGroup,
  type DialogueAudioRangeGroup,
} from './shot-plan-dialogue-audio-groups';
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
  const groups = groupShotPlanDialogueAudio(resource);
  const renderTake = (take: StudioShotPlanDialogueAudioTake, index: number) => (
    <DialogueAudioTakeCard
      key={take.id}
      take={take}
      label={`Take ${index + 1}`}
      projectName={input.projectName}
      shotPlanId={input.shotPlanId}
      reload={reload}
    />
  );
  return (
    <div className='h-full overflow-y-auto p-6'>
      <div className='mx-auto flex max-w-[1120px] flex-col gap-10'>
        {groups.byLine.length > 0 ? (
          <DialogueAudioSection title='By line'>
            {groups.byLine.map((group) => (
              <DialogueAudioGroup key={group.number} heading={<LineHeading group={group} />}>
                {group.takes.map((take, index) => renderTake(take, group.takes.length - 1 - index))}
              </DialogueAudioGroup>
            ))}
          </DialogueAudioSection>
        ) : null}
        {groups.multiLine.length > 0 ? (
          <DialogueAudioSection title='Multi-line'>
            {groups.multiLine.map((group) => (
              <DialogueAudioGroup key={`${group.start}-${group.end}`} heading={<RangeHeading group={group} />}>
                {group.takes.map((take, index) => renderTake(take, group.takes.length - 1 - index))}
              </DialogueAudioGroup>
            ))}
          </DialogueAudioSection>
        ) : null}
      </div>
    </div>
  );
}

function DialogueAudioSection(input: { title: string; children: ReactNode }) {
  return (
    <section className='flex flex-col gap-6'>
      <h2 className='text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
        {input.title}
      </h2>
      {input.children}
    </section>
  );
}

function DialogueAudioGroup(input: { heading: ReactNode; children: ReactNode }) {
  return (
    <div className='flex flex-col gap-3 border-t border-border/60 pt-4'>
      {input.heading}
      <div className='flex flex-col gap-4'>{input.children}</div>
    </div>
  );
}

function LineHeading({ group }: { group: DialogueAudioLineGroup }) {
  const speakerName = group.line?.speakerName ?? group.takes[0]?.speakers[0]?.speakerName;
  return (
    <div className='flex items-baseline gap-3'>
      <span className='w-14 shrink-0 font-mono text-xs text-muted-foreground'>{group.number}</span>
      <div className='min-w-0'>
        {speakerName ? (
          <p className='text-xs font-semibold uppercase tracking-[0.08em]'>{speakerName}</p>
        ) : null}
        {group.line ? (
          <p className='mt-1 font-mono text-sm text-foreground/90'>{group.line.plainText}</p>
        ) : null}
      </div>
    </div>
  );
}

function RangeHeading({ group }: { group: DialogueAudioRangeGroup }) {
  const speakers = [...new Set(group.takes[0]?.speakers.map((speaker) => speaker.speakerName) ?? [])];
  return (
    <div className='flex items-baseline gap-3'>
      <span className='w-14 shrink-0 font-mono text-xs text-muted-foreground'>
        {group.start}–{group.end}
      </span>
      <div className='min-w-0'>
        <p className='text-xs font-semibold uppercase tracking-[0.08em]'>Lines {group.start}–{group.end}</p>
        {speakers.length > 0 ? (
          <p className='mt-1 text-sm text-muted-foreground'>{speakers.join(', ')}</p>
        ) : null}
      </div>
    </div>
  );
}

function DialogueAudioTakeCard(input: {
  take: StudioShotPlanDialogueAudioTake;
  label: string;
  projectName: string;
  shotPlanId: string;
  reload: () => void;
}) {
  const { take } = input;
  const mutation = { projectName: input.projectName, shotPlanId: input.shotPlanId, takeId: take.id };
  return (
    <MediaCardAudioTake
      turnLabel={input.label}
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
        selectedLabel: `Remove ${input.label} of ${rangeLabel(take.turnRange)} from selected audio`,
        unselectedLabel: `Select ${input.label} of ${rangeLabel(take.turnRange)} as audio context`,
        onToggle: async () => {
          if (take.selected) await clearShotPlanDialogueAudioTakeSelection(mutation);
          else await selectShotPlanDialogueAudioTake(mutation);
          input.reload();
        },
      }}
      deleteAction={{
        label: `Delete ${input.label} of ${rangeLabel(take.turnRange)}`,
        confirmationTitle: 'Delete Dialogue Audio?',
        confirmationMessage: 'This audio will move to Trash. You can restore it later.',
        onDelete: async () => {
          await deleteShotPlanDialogueAudioTake(mutation);
          input.reload();
        },
      }}
    />
  );
}

function rangeLabel(range: { start: number; end: number }) {
  return range.start === range.end ? `Line ${range.start}` : `Lines ${range.start}–${range.end}`;
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
