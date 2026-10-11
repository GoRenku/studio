import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ImageEditTargetCandidate, ImageEditTargetChooser as ImageEditTargetChooserSession } from '@gorenku/studio-codex/image-edit';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { usePanelMediaLibrary, usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { imageTypeLabel } from '../shared/image-type-label';
import { useImageEditTargetChooser } from './use-image-edit-target-chooser';

interface CandidateGroup {
  key: string;
  label: string;
  candidates: ImageEditTargetCandidate[];
}

function sharedOwnerName(candidates: ImageEditTargetCandidate[]): string | null {
  const names = new Set(candidates.map((candidate) => candidate.owner.name));
  return names.size === 1 ? candidates[0]?.owner.name ?? null : null;
}

/** One group per owner and image type, in the agent's order; the owner name is added only when owners differ. */
function candidateGroups(candidates: ImageEditTargetCandidate[]): CandidateGroup[] {
  const shared = sharedOwnerName(candidates);
  const groups = new Map<string, CandidateGroup>();
  for (const candidate of candidates) {
    const key = `${candidate.owner.kind}:${candidate.owner.name ?? ''}:${candidate.imageType}`;
    const type = imageTypeLabel(candidate.imageType);
    const group = groups.get(key) ?? { key, label: shared || !candidate.owner.name ? type : `${candidate.owner.name} · ${type}`, candidates: [] };
    group.candidates.push(candidate);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function candidateLabel(candidate: ImageEditTargetCandidate): string {
  return `${imageTypeLabel(candidate.imageType)} · Take ${candidate.takeNumber}`;
}

function choiceSubject(chooser: ImageEditTargetChooserSession): string | null {
  const choice = chooser.choice;
  const candidate = choice?.status === 'chosen' ? chooser.candidates.find((entry) => entry.assetFileId === choice.assetFileId) : undefined;
  if (!candidate) return null;
  return candidate.owner.name ? `${candidate.owner.name} · ${candidateLabel(candidate)}` : candidateLabel(candidate);
}

export function ImageEditTargetChooser() {
  const interaction = useImageEditTargetChooser('Renku image edit chooser', choiceSubject);
  const media = usePanelMediaLibrary(interaction.bridge);
  const { chooser } = interaction;
  if (!chooser) {
    return (
      <section className='image-edit p-4'>
        {interaction.error
          ? <Alert variant='destructive'><AlertDescription>{interaction.error}</AlertDescription></Alert>
          : <p role='status' className='m-0 text-sm text-[var(--dd-muted-fg)]'>Loading images…</p>}
      </section>
    );
  }
  return <ChooserCard key={chooser.chooserId} chooser={chooser} interaction={interaction} media={media} />;
}

function ChooserCard(input: { chooser: ImageEditTargetChooserSession; interaction: ReturnType<typeof useImageEditTargetChooser>; media: PanelMediaLibrary }) {
  const { chooser, interaction, media } = input;
  const [choice, setChoice] = useState(chooser.suggestedAssetFileId);
  const chosen = chooser.candidates.find((candidate) => candidate.assetFileId === choice);
  const owner = sharedOwnerName(chooser.candidates);
  const disabled = !interaction.connected || interaction.busy;
  const submit = (assetFileId: string) => { void interaction.respond({ status: 'chosen', assetFileId }); };
  const notice = <CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />;

  if (chooser.choice?.status === 'canceled') {
    return <section aria-label='Image choice' className='image-edit rounded-xl border border-[var(--dd-border)]'>{notice}<p className='m-0 px-4 py-3 text-[13px] text-[var(--dd-muted-fg)]'>Image choice canceled.</p></section>;
  }
  if (chooser.choice?.status === 'chosen') {
    const answered = chooser.candidates.find((candidate) => candidate.assetFileId === (chooser.choice as { assetFileId: string }).assetFileId)!;
    return (
      <section aria-label='Image choice' className='image-edit overflow-hidden rounded-xl border border-[var(--dd-border)]'>
        {notice}
        <div className='flex items-center gap-3 px-4 py-3'>
          <CandidateThumbnail candidate={answered} media={media} className='size-11 rounded-md' />
          <div>
            <b className='block text-[12.5px]'>{candidateLabel(answered)}</b>
            <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>Chosen for editing</span>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section aria-label='Choose an image to edit' className='image-edit overflow-hidden rounded-xl border border-[var(--dd-border)]'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>Choose an image to edit</h1>
        {owner ? <span className='text-xs text-[var(--dd-muted-fg)]'>{owner}</span> : null}
      </header>
      {notice}
      <div role='radiogroup' aria-label='Images' className='flex flex-wrap gap-x-[22px] gap-y-3.5 px-[18px] pb-4 pt-1'>
        {candidateGroups(chooser.candidates).map((group) => (
          <div key={group.key} className='flex flex-col gap-2'>
            <h2 className='m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>{group.label}</h2>
            <div className='flex flex-wrap gap-2.5'>
              {group.candidates.map((candidate) => (
                <Button
                  key={candidate.assetFileId}
                  type='button'
                  variant='ghost'
                  role='radio'
                  aria-checked={candidate.assetFileId === choice}
                  aria-label={candidateLabel(candidate)}
                  disabled={disabled}
                  onClick={() => setChoice(candidate.assetFileId)}
                  onDoubleClick={() => submit(candidate.assetFileId)}
                  className={cn(
                    'relative h-auto w-[164px] flex-col items-stretch gap-1.5 rounded-[10px] border border-[var(--dd-border)] bg-[var(--dd-card)] p-1.5 text-left text-[var(--dd-fg)] shadow-none hover:border-[var(--dd-active-border)] hover:bg-[var(--dd-card)]',
                    candidate.assetFileId === choice && 'border-[var(--dd-primary)] ring-2 ring-[var(--dd-primary)]',
                  )}
                >
                  {candidate.assetFileId === choice ? <span aria-hidden className='absolute left-3 top-3 z-10 grid size-5 place-items-center rounded-full bg-[var(--dd-primary)] text-[var(--dd-primary-fg)]'><Check className='size-3' /></span> : null}
                  <CandidateThumbnail candidate={candidate} media={media} className='aspect-[4/3] w-full rounded-md' />
                  <span className='flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-0.5 pb-0.5'>
                    <b className='whitespace-nowrap text-xs font-semibold'>Take {candidate.takeNumber}</b>
                    {candidate.selected ? <span className='rounded-full border border-[var(--dd-sel-border)] bg-[var(--dd-sel-bg)] px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[var(--dd-sel-fg)]'>Selected</span> : null}
                    <span className='ml-auto whitespace-nowrap font-mono text-[11px] font-normal text-[var(--dd-muted-fg)]'>{shortDate(candidate.createdAt)}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <span className='min-w-0 flex-1 text-[11.5px] text-[var(--dd-muted-fg)]'>{chosen ? candidateLabel(chosen) : ''}</span>
        <Button type='button' variant='outline' size='sm' disabled={disabled} onClick={() => { void interaction.respond({ status: 'canceled' }); }}>Cancel</Button>
        <Button type='button' size='sm' disabled={disabled || !chosen} onClick={() => chosen && submit(chosen.assetFileId)} className='bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105'>Edit this image</Button>
      </footer>
    </section>
  );
}

function CandidateThumbnail(input: { candidate: ImageEditTargetCandidate; media: PanelMediaLibrary; className: string }) {
  const { url } = usePanelMediaUrl(input.media, input.candidate.imageUri);
  return (
    <span className={cn('block flex-none overflow-hidden bg-[var(--dd-muted)]', input.className)}>
      {url ? <img alt='' src={url} className='size-full object-cover' /> : null}
    </span>
  );
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
