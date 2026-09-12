import { ArrowLeft, ArrowRight, Film, Link2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Button } from '@/ui/button';
import { VideoPlayer } from '@/ui/video-player';
import type { StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';
import type { useMonitorPlayback } from './use-monitor-playback';
import { MonitorTransport } from './transport';
import { ClipReview } from './clip-review';

export function PrevisMonitor({ revision, revisions, projectName, onRevision, playback, reload, status }: {
  revision: StudioPrevisRevision | null; revisions: StudioPrevisRevision[]; projectName: string;
  onRevision: (id: string) => void; playback: ReturnType<typeof useMonitorPlayback>; reload: () => void; status?: string;
}) {
  const index = revisions.findIndex((entry) => entry.id === revision?.id);
  const previsFile = revision?.render?.files.find((file) => file.role === 'primary' && file.mediaKind === 'video');
  const { previs, generation } = playback;
  return <section className='shrink-0 rounded-xl border border-border/40 bg-sidebar-bg p-3'>
    <div className='mb-3 flex h-9 items-center gap-5'>
      <Button variant='outline' size='sm' disabled={index <= 0} onClick={() => onRevision(revisions[index - 1]!.id)}><ArrowLeft className='size-4' />Prev</Button>
      <span className='text-xs'>{revision ? `Revision ${revision.number} of ${revisions.length}` : 'No revisions'}</span>
      <Button variant='outline' size='sm' disabled={index < 0 || index >= revisions.length - 1} onClick={() => onRevision(revisions[index + 1]!.id)}>Next<ArrowRight className='size-4' /></Button>
      <Tooltip><TooltipTrigger asChild><Button variant={playback.linked ? 'secondary' : 'ghost'} size='icon' className='ml-auto size-8' aria-label='Link playback' aria-pressed={playback.linked} onClick={playback.toggleLink}><Link2 className='size-4' /></Button></TooltipTrigger><TooltipContent>Link</TooltipContent></Tooltip>
    </div>
    <div className='grid grid-cols-2 items-start gap-3'>
      <div className='relative min-w-0 rounded-lg border border-border/30 bg-background/40 p-1.5'>
        <div className='flex h-10 items-center justify-between px-3'><h2 className='text-[11px] font-semibold uppercase tracking-widest'>Previs</h2><span className='font-mono text-[10px] text-muted-foreground'>{previs.duration.toFixed(2)}s</span></div>
        <div className='aspect-video overflow-hidden rounded-md'>
          {previsFile ? <VideoPlayer ref={(player) => previs.attachPrevis(player)} src={previsFile.url} title='Previs' controls='external' className='h-full w-full object-contain'
            onDurationChange={previs.onPrevisDuration} onPlaybackRequest={() => playback.toggle('previs')} playing={previs.playing} onEnded={previs.onPrevisEnded}
            onSeek={(time) => playback.seek('previs', time)} onError={previs.onPrevisError} /> : <MonitorPlaceholder text={status ?? 'No visualization yet'} />}
        </div>
        <MonitorTransport label='Previs' {...previs} muted={previs.muted || (playback.linked && !playback.auditioning && playback.audible !== 'previs')}
          toggle={() => playback.toggle('previs')} seek={(time) => playback.seek('previs', time)} toggleMute={() => playback.toggleMute('previs')} />
      </div>
      <div className='min-w-0 rounded-lg border border-border/30 bg-background/40 p-1.5'>
        <div className='flex h-10 items-center justify-between gap-4 px-3'><h2 className='text-[11px] font-semibold uppercase tracking-widest'>Generation</h2>{revision ? <ClipReview revision={revision} projectName={projectName} playback={playback} reload={reload} /> : null}</div>
        <div className='aspect-video overflow-hidden rounded-md'>
          {generation.file ? <VideoPlayer ref={(player) => generation.attach(player)} src={generation.file.url} title='Generation' controls='external' className='h-full w-full object-contain'
            onDurationChange={generation.onDuration} onTimeChange={generation.onTime} onEnded={generation.onEnded}
            onPlaybackRequest={() => playback.toggle('generation')} playing={generation.playing} onError={generation.onError}
            onSeek={(time) => playback.seek('generation', time + (generation.auditionId ? 0 : generation.segment?.start ?? 0))} /> : <MonitorPlaceholder text={status ?? 'Choose a clip take to review'} />}
        </div>
        <MonitorTransport label='Generation' {...generation} timelineDuration={Math.max(previs.duration, generation.duration)} muted={generation.muted || (playback.linked && !playback.auditioning && playback.audible !== 'generation')}
          toggle={() => playback.toggle('generation')} seek={(time) => playback.seek('generation', time)} toggleMute={() => playback.toggleMute('generation')}
          previewDuration={generation.auditionId ? generation.duration : undefined} segments={generation.auditionId ? [] : generation.segments} />
      </div>
    </div>
    {previs.error || generation.error ? <p role='alert' className='mt-2 text-xs text-destructive'>{previs.error ?? generation.error}</p> : null}
  </section>;
}

function MonitorPlaceholder({ text }: { text: string }) {
  return <div className='flex h-full flex-col items-center justify-center gap-3 bg-muted/20 text-muted-foreground'><Film className='size-7 opacity-35' /><p className='text-xs'>{text}</p></div>;
}
