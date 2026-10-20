import { useEffect, useRef, useState } from 'react';

export function useCastVoiceSamplePlayer(sampleUrl: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    const stop = () => setPlaying(false);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', stop);
    return () => {
      audio.pause();
      audio.removeEventListener('pause', stop);
      audio.removeEventListener('ended', stop);
    };
  }, [sampleUrl]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    await audio.play();
    setPlaying(true);
  };

  return { audioRef, playing, toggle };
}
