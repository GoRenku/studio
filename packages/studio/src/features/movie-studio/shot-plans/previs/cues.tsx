import { Camera, Circle, MessageSquare, Pause, Play } from 'lucide-react';
import { Button } from '@/ui/button';
import type { StudioPrevisDialogue, StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';
import { PrevisTimeline } from './timeline';

type CueProps = {
  revision: StudioPrevisRevision | null;
  time: number;
  duration: number;
  activeCue: string | null;
  selection: string | null;
  playing: boolean;
  seek: (seconds: number, selection?: string | null) => void;
  playDialogue: (cue: StudioPrevisDialogue) => void;
};

export function PrevisLegend({ revision }: { revision: StudioPrevisRevision | null }) {
  const used = new Set(revision?.playback?.cues.flatMap((cue) => cue.kind === 'dialogue' ? [cue.speaker] : cue.kind === 'action' && cue.subject ? [cue.subject] : []));
  return <div className='flex h-11 shrink-0 items-center gap-7 overflow-x-auto px-2'>
    {revision?.playback?.subjects.filter((subject) => used.has(subject.key)).map((subject) => <span key={subject.key} className='flex shrink-0 items-center gap-2 text-[10px] font-medium uppercase tracking-widest'><span className='size-3 rounded-full' style={{ backgroundColor: subject.color }} />{subject.label}</span>)}
  </div>;
}

export function PrevisCues({ revision, time, duration, activeCue, selection, playing, seek, playDialogue }: CueProps) {
  const timeline = revision?.playback;
  const cues = (timeline?.cues ?? []).map((cue, index) => ({ cue, index })).sort((a, b) => a.cue.startFrame - b.cue.startFrame || a.index - b.index);
  const seconds = (frame: number) => timeline ? frame * timeline.frameRate.denominator / timeline.frameRate.numerator : 0;
  const annotationWarning = revision?.warnings.find((warning) => warning.location.path[0] === 'playback' && warning.location.path.length === 1);
  return <section className='flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border/40 bg-sidebar-bg p-4'>
    <h2 className='h-5 text-[11px] font-semibold uppercase tracking-widest'>Direction cues</h2>
    {timeline ? <div className='h-36 shrink-0 overflow-y-auto'><PrevisTimeline timeline={timeline} time={time} disabled={!duration} selection={selection} seek={seek} /></div> : null}
    <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto'>
      {annotationWarning ? <p role='status' className='text-xs text-muted-foreground'>{annotationWarning.message}</p> : null}
      {!cues.length && !annotationWarning ? <p className='text-xs text-muted-foreground'>No direction cues</p> : null}
      {cues.map(({ cue, index }) => {
        const subjectKey = cue.kind === 'dialogue' ? cue.speaker : cue.kind === 'action' ? cue.subject : undefined;
        const subject = timeline?.subjects.find((entry) => entry.key === subjectKey);
        const auditioning = cue.kind === 'dialogue' && activeCue === cue.id && playing;
        const selected = selection === `cue:${cue.id}`;
        const canSeek = duration > 0 && seconds(cue.startFrame) < duration;
        const unavailableAudio = revision?.warnings.some((warning) => warning.code === 'CORE_PREVIS_AUDIO_UNAVAILABLE' && warning.location.path[2] === String(index));
        const Icon = cue.kind === 'camera' ? Camera : cue.kind === 'dialogue' ? MessageSquare : Circle;
        return <div key={cue.id} data-cue-id={cue.id} data-auditioning={auditioning} className={`flex min-h-10 items-center gap-3 rounded-lg border px-2 py-1.5 ${auditioning ? 'border-primary/80 bg-primary/5' : selected ? 'border-foreground/50 bg-muted/15' : 'border-border/30 bg-muted/15'}`}>
          {cue.kind === 'dialogue' ? <Button variant='ghost' size='icon' className='size-6 shrink-0 rounded-full bg-background/50'
            aria-label={auditioning ? `Pause dialogue: ${cue.text}` : `Play dialogue: ${cue.text}`}
            title={cue.endFrame === undefined ? 'Dialogue end is not set.' : cue.audio ? 'Audition recorded dialogue' : 'Rehearse Previs dialogue'}
            disabled={!canSeek || cue.endFrame === undefined} onClick={() => playDialogue(cue)} style={{ color: subject?.color }}>
            {auditioning ? <Pause className='size-3' /> : <Play className='size-3 fill-current' />}
          </Button> : <Icon aria-label={cue.kind === 'camera' ? 'Camera' : 'Action'} className='mx-1.5 size-3 shrink-0' style={{ color: subject?.color }} />}
          <Button variant='ghost' size='sm' className='h-auto w-16 shrink-0 justify-start p-0 font-mono text-[10px]' disabled={!canSeek}
            onClick={() => seek(seconds(cue.startFrame), `cue:${cue.id}`)} aria-label={`Seek ${cue.kind} to frame ${cue.startFrame}`}>{seconds(cue.startFrame).toFixed(2)}s</Button>
          {subject ? <span className='w-20 shrink-0 truncate text-[11px]' style={{ color: subject.color }}>{subject.label}</span> : null}
          <div className='min-w-0 text-xs leading-relaxed'><p>{cue.text}</p>{unavailableAudio ? <p className='text-[10px] text-muted-foreground'>Recording unavailable</p> : null}{cue.kind === 'dialogue' && cue.endFrame === undefined ? <p className='text-[10px] text-muted-foreground'>Dialogue end is not set.</p> : null}</div>
        </div>;
      })}
    </div>
  </section>;
}
