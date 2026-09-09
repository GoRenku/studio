import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoPlayerHandle } from '@/ui/video-player';
import type { StudioPrevisCue } from '@/services/shot-plan-previs/contracts';

export function usePrevisPlayback(generationUrl?: string) {
  const previs = useRef<VideoPlayerHandle>(null);
  const generation = useRef<VideoPlayerHandle>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audition = useRef<StudioPrevisCue | null>(null);
  const activeCueIndex = useRef<number | null>(null);
  const [activeCue, setActiveCue] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [generationDuration, setGenerationDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPlaying = useRef(false);
  const playAttempt = useRef(0);
  const attachPrevis = useCallback((player: VideoPlayerHandle | null) => { previs.current = player; }, []);
  const attachGeneration = useCallback((player: VideoPlayerHandle | null) => { generation.current = player; }, []);

  const applyMute = useCallback(() => {
    previs.current?.setMuted(muted || Boolean(generationUrl) || Boolean(audio.current));
    generation.current?.setMuted(muted || Boolean(audio.current));
    if (audio.current) audio.current.muted = muted;
  }, [muted, generationUrl]);

  const stopAudition = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    audition.current = null;
    activeCueIndex.current = null;
    setActiveCue(null);
  }, []);

  const pause = useCallback(() => {
    playAttempt.current++;
    isPlaying.current = false;
    previs.current?.pause();
    generation.current?.pause();
    stopAudition();
    setPlaying(false);
  }, [stopAudition]);

  const play = useCallback(() => {
    if (duration <= 0) return;
    const attempt = ++playAttempt.current;
    isPlaying.current = true;
    setPlaying(true);
    setError(null);
    applyMute();
    const players = [previs.current?.play()];
    if ((previs.current?.getCurrentTime() ?? 0) < generationDuration) players.push(generation.current?.play());
    const recording = audio.current;
    if (recording) {
      void recording.play().catch(() => {
        if (audio.current !== recording) return;
        recording.pause();
        audio.current = null;
        applyMute();
        setError('Recorded audio is unavailable; video playback remains available.');
      });
    }
    void Promise.all(players).catch(() => {
      if (attempt !== playAttempt.current) return;
      pause();
      setError('Playback could not start. Try playing again.');
    });
  }, [duration, generationDuration, applyMute, pause]);

  const seek = useCallback((seconds: number) => {
    if (duration <= 0 || seconds < 0 || seconds > duration) return;
    previs.current?.seek(seconds);
    generation.current?.seek(seconds);
    setTime(seconds);
    const cue = audition.current;
    if (cue && (seconds < cue.startSeconds || seconds >= (cue.endSeconds ?? duration))) {
      stopAudition();
    } else if (cue?.audio && audio.current) {
      audio.current.currentTime = (cue.audio.offsetSeconds ?? 0) + seconds - cue.startSeconds;
    }
    if (isPlaying.current && seconds < generationDuration) {
      void generation.current?.play().catch(() => setError('Generation playback is unavailable.'));
    }
  }, [duration, generationDuration, stopAudition]);

  const playCue = useCallback((cue: StudioPrevisCue, index: number) => {
    if (activeCueIndex.current === index && isPlaying.current) { pause(); return; }
    pause();
    if (duration <= 0 || cue.startSeconds >= duration) return;
    seek(cue.startSeconds);
    audition.current = cue;
    activeCueIndex.current = index;
    setActiveCue(index);
    if (cue.audio) {
      const recording = new Audio(cue.audio.url);
      audio.current = recording;
      recording.currentTime = cue.audio.offsetSeconds ?? 0;
      recording.onended = () => { if (audio.current === recording) pause(); };
      recording.onerror = () => {
        if (audio.current !== recording) return;
        recording.pause();
        audio.current = null;
        applyMute();
        setError('Recorded audio is unavailable; video playback remains available.');
      };
    }
    play();
  }, [pause, duration, seek, play, applyMute]);

  useEffect(() => { applyMute(); }, [applyMute, activeCue]);
  useEffect(() => {
    let frame: number;
    const tick = () => {
      if (isPlaying.current) {
        const seconds = previs.current?.getCurrentTime() ?? 0;
        setTime(seconds);
        const end = audition.current?.endSeconds ?? duration;
        if (seconds >= end) {
          previs.current?.seek(end);
          generation.current?.seek(end);
          setTime(end);
          pause();
        } else if (seconds >= generationDuration) {
          generation.current?.pause();
        } else if (Math.abs((generation.current?.getCurrentTime() ?? seconds) - seconds) > 0.2) {
          generation.current?.seek(seconds);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, generationDuration, pause]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  return {
    attachPrevis, attachGeneration, time, duration, generationDuration, playing, muted, error, activeCue,
    seek, playCue, pause,
    toggle: () => {
      if (playing) pause();
      else { if (time >= duration) seek(0); play(); }
    },
    toggleMute: () => setMuted((value) => !value),
    onPrevisDuration: (seconds: number) => { setDuration(seconds); applyMute(); },
    onPrevisError: () => { pause(); setDuration(0); },
    onGenerationDuration: (seconds: number) => {
      setGenerationDuration(seconds);
      generation.current?.seek(previs.current?.getCurrentTime() ?? 0);
      applyMute();
      if (isPlaying.current && (previs.current?.getCurrentTime() ?? 0) < seconds) {
        void generation.current?.play().catch(() => setError('Generation playback is unavailable.'));
      }
    },
    onPrevisPlaying: (value: boolean) => {
      if (value && !isPlaying.current) play();
      if (!value && isPlaying.current) pause();
    },
    onGenerationPlaying: (value: boolean) => {
      if (value && !isPlaying.current) play();
      if (!value && isPlaying.current && (generation.current?.getCurrentTime() ?? 0) < generationDuration - 0.1) pause();
    },
  };
}
