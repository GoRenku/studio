import { Camera, Circle, MessageSquare, Scissors } from 'lucide-react';
import { Button } from '@/ui/button';
import type { StudioPrevisCue, StudioPrevisPlayback } from '@/services/shot-plan-previs/contracts';

export function PrevisTimeline({ timeline, time, disabled, selection, seek }: {
  timeline: StudioPrevisPlayback;
  time: number;
  disabled: boolean;
  selection: string | null;
  seek: (seconds: number, selection: string) => void;
}) {
  const seconds = (frame: number) => frame * timeline.frameRate.denominator / timeline.frameRate.numerator;
  const subjectKey = (cue: StudioPrevisCue) => cue.kind === 'dialogue' ? cue.speaker : cue.kind === 'action' ? cue.subject : undefined;
  const lanes = [
    ...timeline.subjects.map((subject) => ({ key: `subject:${subject.key}`, label: subject.label, color: subject.color, cues: timeline.cues.filter((cue) => subjectKey(cue) === subject.key) })),
    { key: 'action', label: 'Action', color: undefined, cues: timeline.cues.filter((cue) => cue.kind === 'action' && !cue.subject) },
    { key: 'camera', label: 'Camera', color: undefined, cues: timeline.cues.filter((cue) => cue.kind === 'camera') },
  ].filter((lane) => lane.cues.length);
  return <div className='min-h-0 overflow-y-auto' aria-label='Direction timeline'>
    <div className='relative ml-20 mr-3 h-5 font-mono text-[9px] text-muted-foreground'>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <span key={ratio} className='absolute' style={{ left: `${ratio * 100}%`, transform: `translateX(-${ratio * 100}%)` }}>{seconds(timeline.frameCount * ratio).toFixed(1)}s</span>)}
    </div>
    <div className='relative ml-20 mr-3 flex h-7 border-b border-border/40'>
      {timeline.segments.map((segment, index) => <Button key={segment.id} variant='ghost' size='sm'
        aria-label={`${index ? 'Cut to' : 'Seek shot'} ${segment.label}, frame ${segment.startFrame}`}
        title={`${segment.label} · frame ${segment.startFrame}`} disabled={disabled}
        onClick={() => seek(seconds(segment.startFrame), `segment:${segment.id}`)}
        className={`h-6 min-w-0 justify-start gap-1 rounded-none px-1 text-[10px] ${selection === `segment:${segment.id}` ? 'outline outline-1 outline-foreground/50' : ''}`}
        style={{ width: `${((timeline.segments[index + 1]?.startFrame ?? timeline.frameCount) - segment.startFrame) / timeline.frameCount * 100}%` }}>
        {index ? <Scissors className='size-3 shrink-0' /> : null}<span className='truncate'>{segment.label}</span>
      </Button>)}
    </div>
    <div className='relative'>
      <div className='pointer-events-none absolute inset-y-0 left-20 right-3'>
        {timeline.segments.slice(1).map((segment) => <div key={segment.id} className='absolute inset-y-0 border-l border-dashed border-muted-foreground/60' style={{ left: `${segment.startFrame / timeline.frameCount * 100}%` }} />)}
        <div className='absolute inset-y-0 z-20 w-px bg-primary' style={{ left: `${Math.min(time / seconds(timeline.frameCount), 1) * 100}%` }} />
      </div>
      {lanes.map((lane) => {
        const rowEnds: number[] = [];
        const markers = [...lane.cues].sort((a, b) => a.startFrame - b.startFrame).map((cue) => {
          const end = cue.kind === 'dialogue' && cue.endFrame !== undefined ? cue.endFrame : cue.startFrame;
          let row = rowEnds.findIndex((last) => last + timeline.frameCount * 0.035 < cue.startFrame);
          if (row < 0) row = rowEnds.length;
          rowEnds[row] = end;
          return { cue, row };
        });
        return <div key={lane.key} className='flex items-start gap-2 py-1'>
          <span className='w-[72px] shrink-0 truncate pt-1 text-[10px]' title={lane.label}>{lane.label}</span>
          <div className='relative mr-3 flex-1' style={{ height: Math.max(1, rowEnds.length) * 22 }}>
            {markers.map(({ cue, row }) => {
              const Icon = cue.kind === 'dialogue' ? MessageSquare : cue.kind === 'camera' ? Camera : Circle;
              return <Button key={cue.id} variant='ghost' size='sm' disabled={disabled}
                aria-label={`Seek ${cue.kind}: ${cue.text}`} title={`${cue.text} · frame ${cue.startFrame}`}
                onClick={() => seek(seconds(cue.startFrame), `cue:${cue.id}`)}
                className={`absolute h-5 min-w-4 justify-start rounded-sm p-0 ${selection === `cue:${cue.id}` ? 'outline outline-1 outline-foreground/50' : ''}`}
                style={{ top: row * 22, left: `${cue.startFrame / timeline.frameCount * 100}%`, color: lane.color,
                  width: cue.kind === 'dialogue' && cue.endFrame !== undefined ? `${(cue.endFrame - cue.startFrame) / timeline.frameCount * 100}%` : 16,
                  backgroundColor: cue.kind === 'dialogue' && lane.color ? `${lane.color}18` : undefined }}>
                <Icon className='size-3 shrink-0' />
              </Button>;
            })}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
