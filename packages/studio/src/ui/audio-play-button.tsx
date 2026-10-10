import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export function AudioPlayButton(input: {
  label: string;
  className?: string;
  loadSource: () => Promise<string>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const audio = audioRef.current;
    if (audio) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    setLoading(true);
    input.loadSource().then(setSrc, () => setFailed(true)).finally(() => setLoading(false));
  };
  return (
    <>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
      <Button
        type='button'
        variant='outline'
        size='icon'
        className={cn('size-7 shrink-0 rounded-full', input.className)}
        aria-label={failed ? `${input.label} unavailable` : `${playing ? 'Pause' : 'Play'} ${input.label}`}
        disabled={loading || failed}
        onClick={toggle}
      >
        {playing ? <Pause className='size-3' /> : <Play className='ml-px size-3' />}
      </Button>
    </>
  );
}
