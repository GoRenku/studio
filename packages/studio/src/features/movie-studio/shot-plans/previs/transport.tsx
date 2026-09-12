import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/ui/button';
import { Slider } from '@/ui/slider';
import type { ClipPlaybackSegment } from './clip-playback-sequence';

export function MonitorTransport({ label, time, duration, playing, muted, toggle, seek, toggleMute, timelineDuration = duration, previewDuration, segments = [] }: {
  label: string; time: number; duration: number; playing: boolean; muted: boolean;
  toggle: () => void; seek: (time: number) => void; toggleMute: () => void;
  segments?: ClipPlaybackSegment[]; timelineDuration?: number; previewDuration?: number;
}) {
  const colors = ['bg-timeline-clip-1', 'bg-timeline-clip-2', 'bg-timeline-clip-3'];
  const playable = segments.filter((segment) => !segment.blocked && segment.duration && segment.file);
  return <div className='mt-2 flex min-h-9 items-center gap-2 px-1'>
    <Button variant='ghost' size='icon' className='size-7 shrink-0' aria-label={`${playing ? 'Pause' : 'Play'} ${label}`} disabled={!duration} onClick={toggle}>{playing ? <Pause className='size-3.5' /> : <Play className='size-3.5' />}</Button>
    <span className='shrink-0 font-mono text-[10px] tabular-nums'>{time.toFixed(2)} / {timelineDuration.toFixed(2)}</span>
    <div className='relative min-w-0 flex-1'>
      <div className='pointer-events-none absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-sm' aria-hidden>
        {previewDuration ? <span className='absolute inset-y-0 left-0 bg-foreground/10' style={{ width: `${previewDuration / timelineDuration * 100}%` }} /> : playable.map((segment) => <span key={segment.clip.id} data-clip-number={segment.clip.number} className={`absolute inset-y-0 border-r border-background/80 ${colors[(segment.clip.number - 1) % colors.length]}`} style={{ left: `${segment.start / timelineDuration * 100}%`, width: `${segment.duration! / timelineDuration * 100}%` }} />)}
      </div>
      <Slider aria-label={`${label} timeline`} sliderSize='sm' min={0} max={timelineDuration || 1} step={0.01} value={[time]} disabled={!duration} onValueChange={([value]) => seek(value!)} className='relative z-10 [&_[role=slider]]:size-3 [&_[role=slider]]:bg-primary [&>span:first-child]:h-1' />
    </div>
    <Button variant='ghost' size='icon' className='size-7 shrink-0' aria-label={`${muted ? 'Unmute' : 'Mute'} ${label}`} onClick={toggleMute}>{muted ? <VolumeX className='size-3.5' /> : <Volume2 className='size-3.5' />}</Button>
  </div>;
}
