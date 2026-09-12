import { Check, CornerUpLeft, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { useState } from 'react';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import type { StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';
import { selectStudioClipTake } from '@/services/shot-plan-previs/api';
import type { useMonitorPlayback } from './use-monitor-playback';
import { clipTakeLabel } from './clip-playback-sequence';

export function ClipReview({ revision, projectName, playback, reload }: {
  revision: StudioPrevisRevision; projectName: string; playback: ReturnType<typeof useMonitorPlayback>; reload: () => void;
}) {
  const generation = playback.generation;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = revision.clips;
  const auditionTake = report.clips.flatMap((clip) => clip.takes).find((take) => take.id === generation.auditionId);
  const clip = report.clips.find((entry) => entry.id === auditionTake?.clipId)
    ?? generation.segment?.clip ?? report.clips[0];
  const take = auditionTake ?? clip?.takes.find((entry) => entry.id === clip.selectedTakeId);
  const source = report.sources.find((entry) => entry.takeId === take?.sourceTakeId);
  const choose = async () => {
    if (!clip || !take) return;
    setSaving(true); setError(null); playback.pause();
    try {
      await selectStudioClipTake({ projectName, clipId: clip.id, takeId: take.id });
      playback.backToClips(clip.id); reload();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not select this take.'); }
    finally { setSaving(false); }
  };
  const candidates = report.clips.flatMap((entry) => entry.takes.map((candidate) => ({ id: candidate.id, label: clipTakeLabel(entry, candidate) })));
  const unassigned = report.unassignedAssets.flatMap((asset) => asset.files.filter((file) => file.mediaKind === 'video').map((file) => ({ id: file.id, label: asset.title || 'Untitled video' })));
  const options = [...candidates, ...unassigned];
  if (!options.length) return null;
  return <div className='ml-auto flex min-w-0 flex-1 items-center justify-end gap-1'>
    <Select value={generation.auditionId ?? take?.id ?? ''} onValueChange={playback.audition}>
      <SelectTrigger aria-label='Generation take' className='min-w-0 flex-1 px-2 py-0 text-xs data-[size=default]:h-6 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate'><SelectValue placeholder='Generation take' /></SelectTrigger>
      <SelectContent position='popper' align='end' className='max-w-[min(36rem,calc(100vw-2rem))]'>{options.map((candidate) => <SelectItem key={candidate.id} value={candidate.id} className='whitespace-normal break-words'>{candidate.label}</SelectItem>)}</SelectContent>
    </Select>
    {take && take.id !== clip?.selectedTakeId ? <Tooltip><TooltipTrigger asChild><Button variant='ghost' size='icon' className='size-6 shrink-0' aria-label='Use this take' disabled={saving} onClick={() => void choose()}><Check className='size-3.5' /></Button></TooltipTrigger><TooltipContent>Use this take</TooltipContent></Tooltip> : null}
    {generation.auditionId && report.clips.length ? <Tooltip><TooltipTrigger asChild><Button variant='ghost' size='icon' className='size-6 shrink-0' aria-label='Back to clips' onClick={() => playback.backToClips(clip?.id)}><CornerUpLeft className='size-3.5' /></Button></TooltipTrigger><TooltipContent>Back to clips</TooltipContent></Tooltip> : null}
    {source ? <Tooltip><TooltipTrigger asChild><Button variant='ghost' size='icon' className='size-6 shrink-0' aria-label='Source take'><Info className='size-3.5' /></Button></TooltipTrigger><TooltipContent>Source: Clip {source.clipNumber}.{source.takeNumber}{source.selectedTakeNumber !== source.takeNumber ? `; selected: ${source.selectedTakeNumber === null ? 'none' : `Clip ${source.clipNumber}.${source.selectedTakeNumber}`}` : ''}{source.shotPlanId !== report.shotPlanId || source.revisionNumber !== revision.number ? ` (${source.shotPlanTitle}, revision ${source.revisionNumber})` : ''}</TooltipContent></Tooltip> : null}
    {error ? <span role='alert' className='text-xs text-destructive'>{error}</span> : null}
  </div>;
}
