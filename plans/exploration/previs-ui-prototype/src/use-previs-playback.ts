import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoPlayerHandle } from '@/ui/video-player';

export function usePrevisPlayback() {
  const previs = useRef<VideoPlayerHandle>(null);
  const generation = useRef<VideoPlayerHandle>(null);
  const durationRef = useRef(0);
  const generationDurationRef = useRef(0);
  const playingRef = useRef(false);
  const cueAudio = useRef<HTMLAudioElement | null>(null);
  const cueEnd = useRef<number | null>(null);
  const [time, setTime] = useState(8);
  const [duration, setDuration] = useState(0);
  const [generationDuration, setGenerationDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { cueAudio.current?.pause(); }, []);

  const seek = useCallback((seconds: number) => {
    const position = Math.max(0, Math.min(seconds, durationRef.current));
    setTime(position);
    previs.current?.seek(position);
    generation.current?.seek(position);
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    previs.current?.pause();
    generation.current?.pause();
    cueAudio.current?.pause();
    cueEnd.current = null;
  }, []);

  const play = useCallback(async () => {
    setError('');
    if ((previs.current?.getCurrentTime() ?? 0) >= durationRef.current - 0.02) {
      seek(0);
    }
    playingRef.current = true;
    setPlaying(true);
    try {
      const follower = generation.current;
      await Promise.all([
        previs.current?.play(),
        follower && follower.getCurrentTime() < generationDurationRef.current - 0.02
          ? follower.play()
          : undefined,
      ]);
    } catch {
      pause();
      setError('Playback could not start. Try again.');
    }
  }, [pause, seek]);

  const updateTime = useCallback((seconds: number) => {
    setTime(seconds);
    if (cueEnd.current !== null && seconds >= cueEnd.current) pause();
    const follower = generation.current;
    if (!follower || generationDurationRef.current === 0) return;
    const target = Math.min(seconds, generationDurationRef.current);
    if (Math.abs(follower.getCurrentTime() - target) > 0.3) {
      follower.seek(target);
    }
  }, [pause]);

  const playCue = async (cue: { start: number; end: number; audio?: string }) => {
    pause();
    seek(cue.start);
    cueEnd.current = cue.end;
    await play();
    if (cue.audio && playingRef.current) {
      cueAudio.current = new Audio(cue.audio);
      cueAudio.current.muted = muted;
      try { await cueAudio.current.play(); }
      catch { setError('Voice playback could not start.'); }
    }
  };

  const readyPrevis = useCallback((seconds: number) => {
    durationRef.current = seconds;
    setDuration(seconds);
    previs.current?.seek(Math.min(8, seconds));
  }, []);

  const readyGeneration = useCallback((seconds: number) => {
    generationDurationRef.current = seconds;
    setGenerationDuration(seconds);
    generation.current?.seek(Math.min(previs.current?.getCurrentTime() || 8, seconds));
  }, []);

  // Fullscreen controls are the existing player's controls. Keep them linked too.
  const nativePlayingChange = useCallback((source: 'previs' | 'generation', value: boolean) => {
    if (source === 'generation' && !value &&
      (generation.current?.getCurrentTime() ?? 0) >= generationDurationRef.current - 0.03) return;
    if (value === playingRef.current) return;
    if (value) void play();
    else pause();
  }, [pause, play]);

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    previs.current?.setMuted(next);
    generation.current?.setMuted(next);
    if (cueAudio.current) cueAudio.current.muted = next;
  };

  return {
    previs, generation, time, duration, generationDuration, playing, muted, error,
    seek, pause, playCue, updateTime, readyPrevis, readyGeneration, nativePlayingChange, toggleMuted,
    togglePlayback: () => { if (playingRef.current) pause(); else void play(); },
  };
}
