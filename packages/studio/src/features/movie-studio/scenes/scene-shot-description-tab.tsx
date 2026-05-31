import type { ReactNode } from 'react';
import type { SceneShot } from '@gorenku/studio-core/client';

interface SceneShotDescriptionTabProps {
  shot: SceneShot;
  label: string;
  castMemberLabels: Record<string, string>;
  locationLabels: Record<string, string>;
}

export function SceneShotDescriptionTab({
  shot,
  label,
  castMemberLabels,
  locationLabels,
}: SceneShotDescriptionTabProps) {
  const castNames = shot.castMemberIds
    .map((id) => castMemberLabels[id])
    .filter((name): name is string => Boolean(name));
  const locationNames = shot.locationIds
    .map((id) => locationLabels[id])
    .filter((name): name is string => Boolean(name));
  const dialogueSummary = summarizeDialogue(shot);

  return (
    <div className='space-y-6 px-1 py-4'>
      <div>
        <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {label}
        </p>
        <h3 className='mt-1 text-base font-semibold text-foreground'>
          {shot.title}
        </h3>
      </div>

      <Field label='Story beat'>{shot.storyBeat}</Field>
      <Field label='Narrative purpose'>{shot.narrativePurpose}</Field>
      <Field label='Description'>{shot.description}</Field>
      <Field label='Subject'>{shot.subject}</Field>
      <Field label='Action'>{shot.action}</Field>
      <Field label='Dialogue coverage'>{dialogueSummary}</Field>

      {castNames.length ? (
        <ChipField label='Cast' values={castNames} />
      ) : null}
      {locationNames.length ? (
        <ChipField label='Locations' values={locationNames} />
      ) : null}
    </div>
  );
}

function summarizeDialogue(shot: SceneShot): string {
  if (!shot.dialogue.length) {
    return 'No dialogue coverage.';
  }
  const purposes = shot.dialogue
    .map((reference) => reference.purpose.trim())
    .filter(Boolean);
  const count =
    shot.dialogue.length === 1
      ? '1 dialogue beat'
      : `${shot.dialogue.length} dialogue beats`;
  return purposes.length ? `${count}: ${purposes.join('; ')}` : count;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className='space-y-1'>
      <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </p>
      <p className='text-sm leading-6 text-foreground/90'>{children}</p>
    </div>
  );
}

function ChipField({ label, values }: { label: string; values: string[] }) {
  return (
    <div className='space-y-1.5'>
      <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </p>
      <div className='flex flex-wrap gap-1.5'>
        {values.map((value) => (
          <span
            key={value}
            className='rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-xs text-foreground/80'
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
