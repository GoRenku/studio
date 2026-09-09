import { Pause, Play } from 'lucide-react';
import { Button } from '@/ui/button';
import type { StudioPrevisCue, StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';

type CueProps = {
  revision: StudioPrevisRevision | null;
  time: number;
  duration: number;
  activeCue: number | null;
  playing: boolean;
  seek: (seconds: number) => void;
  playCue: (cue: StudioPrevisCue, index: number) => void;
};

export function PrevisLegend({ revision }: { revision: StudioPrevisRevision | null }) {
  return <div className='flex h-11 shrink-0 items-center gap-7 overflow-x-auto px-2'>
    {revision?.playback?.subjects.map((subject) => <span key={subject.key} className='flex shrink-0 items-center gap-2 text-[10px] font-medium uppercase tracking-widest'><span className='size-3 rounded-full' style={{ backgroundColor: subject.color }} />{subject.label}</span>)}
  </div>;
}

export function PrevisCues({ revision, time, duration, activeCue, playing, seek, playCue }: CueProps) {
  const subjects = revision?.playback?.subjects ?? [];
  const cues = (revision?.playback?.cues ?? []).map((cue, index) => ({ cue, index }))
    .sort((a, b) => a.cue.startSeconds - b.cue.startSeconds || a.index - b.index);
  const keys = [...new Set(cues.map(({ cue }) => cue.subject))];
  const subject = (key?: string) => subjects.find((entry) => entry.key === key);
  const color = (key?: string) => subject(key)?.color ?? '#909090';
  const label = (key?: string) => subject(key)?.label ?? key ?? 'Cues';
  const canSeek = (cue: StudioPrevisCue) => duration > 0 && cue.startSeconds < duration;
  const timelineEnd = Math.max(duration, ...cues.map(({ cue }) => cue.endSeconds ?? cue.startSeconds), 1);
  const annotationWarning = revision?.warnings.find((warning) => warning.location.path[0] === 'playback' && warning.location.path.length === 1);
  return (
    <section className='flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border/40 bg-sidebar-bg p-4'>
      <h2 className='h-5 text-[11px] font-semibold uppercase tracking-widest'>Previs cues</h2>
      <div className='shrink-0'>
        <div className='relative ml-20 mr-2 h-5 font-mono text-[9px] text-muted-foreground'>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <span key={ratio} className='absolute' style={{ left: `${ratio * 100}%`, transform: `translateX(-${ratio * 100}%)` }}>{(timelineEnd * ratio).toFixed(1)}s</span>)}
        </div>
        <div className='h-24 overflow-y-auto'>
          {keys.map((key) => <div key={key ?? '__cues'} className='flex h-7 items-center gap-2'>
            <span className='w-[72px] shrink-0 truncate text-[10px]' title={label(key)}>{label(key)}</span>
            <div className='relative mr-2 h-5 flex-1 rounded border border-border/30 bg-muted/20'>
              {cues.filter(({ cue }) => cue.subject === key).map(({ cue, index }) => <Button key={index} variant='ghost' size='sm' aria-label={`Seek cue: ${cue.text}`} title={cue.text}
                disabled={!canSeek(cue)} onClick={() => seek(cue.startSeconds)}
                className='absolute top-0 h-full min-w-1 rounded-sm border p-0 hover:brightness-125'
                style={{ left: `${cue.startSeconds / timelineEnd * 100}%`, width: cue.endSeconds === undefined ? 5 : `${(cue.endSeconds - cue.startSeconds) / timelineEnd * 100}%`, borderColor: color(key), backgroundColor: `${color(key)}55` }} />)}
              <div className='pointer-events-none absolute -top-1 bottom-[-5px] z-10 w-px bg-foreground/80' style={{ left: `${time / timelineEnd * 100}%` }} />
            </div>
          </div>)}
        </div>
      </div>
      <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto'>
        {annotationWarning ? <p role='status' className='text-xs text-muted-foreground'>{annotationWarning.message}</p> : null}
        {!cues.length && !annotationWarning ? <p className='text-xs text-muted-foreground'>No cues</p> : null}
        {cues.map(({ cue, index }, position) => {
          const nextStart = cues.slice(position + 1).find(({ cue: next }) => next.startSeconds > cue.startSeconds)?.cue.startSeconds;
          const active = duration > 0 && time >= cue.startSeconds && time < (cue.endSeconds ?? nextStart ?? duration);
          const unavailableAudio = revision?.warnings.some((warning) => warning.code === 'CORE_PREVIS_AUDIO_UNAVAILABLE' && warning.location.path[2] === String(index));
          return <div key={index} className={`flex min-h-10 items-center gap-3 rounded-lg border px-2 py-1.5 ${active ? 'border-primary/80 bg-primary/5' : 'border-border/30 bg-muted/15'}`}>
            <Button variant='ghost' size='icon' className='size-6 shrink-0 rounded-full bg-background/50' aria-label={activeCue === index && playing ? `Pause cue: ${cue.text}` : `Play cue: ${cue.text}`} disabled={!canSeek(cue)} onClick={() => playCue(cue, index)} style={{ color: color(cue.subject) }}>{activeCue === index && playing ? <Pause className='size-3' /> : <Play className='size-3 fill-current' />}</Button>
            <span className='size-2 shrink-0 rounded-full' style={{ backgroundColor: color(cue.subject) }} />
            <Button variant='ghost' size='sm' className='h-auto w-28 shrink-0 justify-start p-0 font-mono text-[10px]' disabled={!canSeek(cue)} onClick={() => seek(cue.startSeconds)} aria-label={`Seek to ${cue.startSeconds} seconds`}>{cue.startSeconds.toFixed(2)}{cue.endSeconds === undefined ? '' : `–${cue.endSeconds.toFixed(2)}`}</Button>
            <span className='w-20 shrink-0 truncate text-[11px]'>{cue.subject === undefined ? '' : label(cue.subject)}</span>
            <div className='min-w-0 text-xs leading-relaxed'><p>{cue.text}</p>{unavailableAudio ? <p className='text-[10px] text-muted-foreground'>Audio unavailable</p> : null}</div>
          </div>;
        })}
      </div>
    </section>
  );
}
