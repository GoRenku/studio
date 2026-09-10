import { ArrowLeft, ArrowRight, Film, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/ui/button';
import { Slider } from '@/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { VideoPlayer } from '@/ui/video-player';
import type { StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';
import type { StudioShotAsset } from '@/services/studio-shot-plans-contracts';
import type { usePrevisPlayback } from './use-previs-playback';

export function PrevisMonitor({ revision, revisions, generation, onRevision, onGeneration, playback, status }: {
  revision: StudioPrevisRevision | null;
  revisions: StudioPrevisRevision[];
  generation: StudioShotAsset | null;
  onRevision: (id: string) => void;
  onGeneration: (id: string) => void;
  playback: ReturnType<typeof usePrevisPlayback>;
  status?: string;
}) {
  const index = revisions.findIndex((entry) => entry.id === revision?.id);
  const previsFile = revision?.render?.files.find((file) => file.role === 'primary' && file.mediaKind === 'video');
  const generationFile = generation?.files.find((file) => file.role === 'primary' && file.mediaKind === 'video');
  return (
    <section className='shrink-0 rounded-xl border border-border/40 bg-sidebar-bg p-3'>
      <div className='mb-3 flex h-9 items-center gap-5'>
        <Button variant='outline' size='sm' disabled={index <= 0} onClick={() => onRevision(revisions[index - 1]!.id)}><ArrowLeft className='size-4' />Prev</Button>
        <span className='text-xs'>{revision ? `Revision ${revision.number} of ${revisions.length}` : 'No revisions'}</span>
        <Button variant='outline' size='sm' disabled={index < 0 || index >= revisions.length - 1} onClick={() => onRevision(revisions[index + 1]!.id)}>Next<ArrowRight className='size-4' /></Button>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <div className='min-w-0 rounded-lg border border-border/30 bg-background/40 p-1.5'>
          <div className='flex h-7 items-center justify-between px-2'>
            <h2 className='text-[11px] font-semibold uppercase tracking-widest'>Previs</h2>
            <span className='font-mono text-[10px] text-muted-foreground'>{playback.duration.toFixed(2)}s</span>
          </div>
          <div className='aspect-video overflow-hidden rounded-md'>
            {previsFile ? <VideoPlayer ref={(player) => playback.attachPrevis(player)} src={previsFile.url} title='Previs' controls='external' className='h-full w-full object-contain'
              onDurationChange={playback.onPrevisDuration} onPlaybackRequest={playback.toggle} playing={playback.playing} onEnded={playback.onPrevisEnded} onSeek={playback.seek}
              onError={playback.onPrevisError} /> : <MonitorPlaceholder text={status ?? (revision ? 'Visualization unavailable' : 'No visualization yet')} />}
          </div>
        </div>
        <div className='min-w-0 rounded-lg border border-border/30 bg-background/40 p-1.5'>
          <div className='flex h-7 items-center justify-between gap-2 px-2'>
            <h2 className='text-[11px] font-semibold uppercase tracking-widest'>Generation</h2>
            {(revision?.generations.length ?? 0) > 1 ? (
              <Select value={generation?.id} onValueChange={onGeneration}>
                <SelectTrigger aria-label='Generation take' className='h-6 max-w-48 text-xs'><SelectValue /></SelectTrigger>
                <SelectContent>{revision!.generations.map((take) => <SelectItem key={take.id} value={take.id}>{take.title}</SelectItem>)}</SelectContent>
              </Select>
            ) : null}
            <span className='font-mono text-[10px] text-muted-foreground'>{generationFile ? `${playback.generationDuration.toFixed(2)}s` : '—'}</span>
          </div>
          <div className='aspect-video overflow-hidden rounded-md'>
            {generationFile ? <VideoPlayer ref={(player) => playback.attachGeneration(player)} src={generationFile.url} title='Generation' controls='external' className='h-full w-full object-contain'
              onDurationChange={playback.onGenerationDuration} onPlaybackRequest={playback.toggle} playing={playback.playing} onError={playback.onGenerationError} onSeek={playback.seek} />
              : <MonitorPlaceholder text={status ?? (generation ? 'Generation unavailable' : 'No generation for this revision')} />}
          </div>
        </div>
      </div>
      <div className='mt-3 flex h-8 items-center gap-5'>
        <Button variant='ghost' size='icon' className='size-8' aria-label={playback.playing ? 'Pause Previs' : 'Play Previs'} disabled={!playback.duration} onClick={playback.toggle}>{playback.playing ? <Pause className='size-4' /> : <Play className='size-4' />}</Button>
        <span className='shrink-0 font-mono text-[11px] tabular-nums'>{playback.time.toFixed(2)} / {playback.duration.toFixed(2)}</span>
        <div className='min-w-0 flex-1'><Slider aria-label='Previs timeline' sliderSize='sm' min={0} max={playback.duration || 1} step={0.01} value={[playback.time]} disabled={!playback.duration} onValueChange={([time]) => playback.seek(time!)} className='[&_[role=slider]]:size-3 [&_[role=slider]]:bg-primary [&>span:first-child]:h-1' /></div>
        <Button variant='ghost' size='icon' className='size-8' aria-label={playback.muted ? 'Unmute playback' : 'Mute playback'} onClick={playback.toggleMute}>{playback.muted ? <VolumeX className='size-4' /> : <Volume2 className='size-4' />}</Button>
      </div>
      {playback.error ? <p role='alert' className='mt-2 text-xs text-destructive'>{playback.error}</p> : null}
    </section>
  );
}

function MonitorPlaceholder({ text }: { text: string }) {
  return <div className='flex h-full flex-col items-center justify-center gap-3 bg-muted/20 text-muted-foreground'><Film className='size-7 opacity-35' /><p className='text-xs'>{text}</p></div>;
}
