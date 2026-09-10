import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoPlayerHandle } from '@/ui/video-player';
import type { StudioPrevisDialogue, StudioPrevisPlayback } from '@/services/shot-plan-previs/contracts';

type Transport = { dialogue: StudioPrevisDialogue | null; playing: boolean };

export function usePrevisPlayback(generationUrl?: string, timeline?: StudioPrevisPlayback | null) {
  const previs = useRef<VideoPlayerHandle>(null);
  const generation = useRef<VideoPlayerHandle>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const current = useRef<Transport>({ dialogue: null, playing: false });
  const [transport, setTransport] = useState<Transport>({ dialogue: null, playing: false });
  const [duration, setDuration] = useState(0);
  const [generationDuration, setGenerationDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const playAttempt = useRef(0);
  const generationReady = useRef(false);
  const previousTimeline = useRef(timeline);
  const previousGeneration = useRef(generationUrl);
  const attachPrevis = useCallback((player: VideoPlayerHandle | null) => { previs.current = player; }, []);
  const attachGeneration = useCallback((player: VideoPlayerHandle | null) => { generation.current = player; }, []);
  const seconds = useCallback((frame: number) => timeline ? frame * timeline.frameRate.denominator / timeline.frameRate.numerator : 0, [timeline]);
  const update = useCallback((next: Transport) => { current.current = next; setTransport(next); }, []);

  const applyMute = useCallback(() => {
    previs.current?.setMuted(muted || Boolean(audio.current) || (!current.current.dialogue && Boolean(generationUrl) && generationReady.current));
    generation.current?.setMuted(muted || Boolean(current.current.dialogue));
    if (audio.current) audio.current.muted = muted;
  }, [muted, generationUrl]);

  const pause = useCallback(() => {
    playAttempt.current++;
    update({ ...current.current, playing: false });
    previs.current?.pause();
    generation.current?.pause();
    audio.current?.pause();
  }, [update]);

  const stopAudition = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    update({ dialogue: null, playing: false });
    applyMute();
  }, [applyMute, update]);

  const position = useCallback((value: number) => {
    previs.current?.seek(value);
    generation.current?.seek(value);
    setTime(value);
  }, []);

  const seek = useCallback((value: number, selected: string | null = null) => {
    if (duration <= 0 || !Number.isFinite(value) || value < 0 || value > duration) return;
    pause();
    stopAudition();
    setSelection(selected);
    position(value);
  }, [duration, pause, stopAudition, position]);

  const playGeneration = useCallback(() => {
    const attempt = playAttempt.current;
    void generation.current?.play().catch(() => {
      if (attempt !== playAttempt.current) return;
      generationReady.current = false;
      applyMute();
      setError('Generation playback is unavailable. Previs playback remains available.');
    });
  }, [applyMute]);

  const play = useCallback(() => {
    if (duration <= 0) return;
    const attempt = ++playAttempt.current;
    update({ ...current.current, playing: true });
    setError(null);
    applyMute();
    void previs.current?.play().catch(() => {
      if (attempt !== playAttempt.current) return;
      pause();
      setError('Previs playback could not start. Try playing again.');
    });
    if (generationReady.current && (previs.current?.getCurrentTime() ?? 0) < generationDuration) {
      playGeneration();
    }
    const recording = audio.current;
    if (recording && !recording.ended) {
      void recording.play().catch(() => {
        if (attempt !== playAttempt.current || audio.current !== recording) return;
        recording.pause();
        audio.current = null;
        applyMute();
        setError('Recorded audio is unavailable; visual rehearsal remains available.');
      });
    }
  }, [duration, generationDuration, update, applyMute, pause, playGeneration]);

  const playDialogue = useCallback((cue: StudioPrevisDialogue) => {
    if (!timeline || cue.endFrame === undefined || duration <= 0 || seconds(cue.startFrame) >= duration) return;
    if (current.current.dialogue?.id === cue.id) {
      if (current.current.playing) { pause(); return; }
      if ((previs.current?.getCurrentTime() ?? 0) < Math.min(seconds(cue.endFrame), duration)) { play(); return; }
    }
    pause();
    stopAudition();
    position(seconds(cue.startFrame));
    setSelection(`cue:${cue.id}`);
    update({ dialogue: cue, playing: false });
    if (cue.audio) {
      const recording = new Audio(cue.audio.url);
      audio.current = recording;
      recording.currentTime = cue.audio.offsetSeconds ?? 0;
      // An early recording end is silence, not the end of visual rehearsal.
      recording.onerror = () => {
        if (audio.current !== recording) return;
        recording.pause();
        audio.current = null;
        applyMute();
        setError('Recorded audio is unavailable; visual rehearsal remains available.');
      };
    }
    play();
  }, [timeline, duration, seconds, pause, play, stopAudition, position, update, applyMute]);

  const finish = useCallback(() => {
    const cue = current.current.dialogue;
    const end = cue?.endFrame === undefined ? duration : Math.min(seconds(cue.endFrame), duration);
    pause();
    position(end);
  }, [duration, seconds, pause, position]);

  useEffect(() => { applyMute(); }, [applyMute, transport]);
  useEffect(() => {
    if (previousTimeline.current === timeline) return;
    const previous = previousTimeline.current;
    previousTimeline.current = timeline;
    setSelection((selected) => {
      if (!selected) return null;
      const [kind, id] = [selected.slice(0, selected.indexOf(':')), selected.slice(selected.indexOf(':') + 1)];
      const before = kind === 'cue' ? previous?.cues.find((entry) => entry.id === id) : previous?.segments.find((entry) => entry.id === id);
      const after = kind === 'cue' ? timeline?.cues.find((entry) => entry.id === id) : timeline?.segments.find((entry) => entry.id === id);
      return after && JSON.stringify(before) === JSON.stringify(after) ? selected : null;
    });
    const cue = current.current.dialogue;
    const timingChanged = JSON.stringify(previous?.frameRate) !== JSON.stringify(timeline?.frameRate) || previous?.frameCount !== timeline?.frameCount;
    if (cue && (timingChanged || JSON.stringify(timeline?.cues.find((entry) => entry.id === cue.id)) !== JSON.stringify(cue))) {
      pause(); stopAudition();
      setSelection(null);
    }
  }, [timeline, pause, stopAudition]);
  useEffect(() => {
    if (previousGeneration.current === generationUrl) return;
    previousGeneration.current = generationUrl;
    pause(); stopAudition();
    generationReady.current = false;
    setGenerationDuration(0);
  }, [generationUrl, pause, stopAudition]);
  useEffect(() => {
    let frame: number;
    const tick = () => {
      if (current.current.playing) {
        const value = previs.current?.getCurrentTime() ?? 0;
        setTime(value);
        const cue = current.current.dialogue;
        const end = cue?.endFrame === undefined ? duration : Math.min(seconds(cue.endFrame), duration);
        if (value >= end) finish();
        else if (value >= generationDuration) generation.current?.pause();
        else if (generationReady.current && Math.abs((generation.current?.getCurrentTime() ?? value) - value) > 0.2) generation.current?.seek(value);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, generationDuration, seconds, finish]);
  useEffect(() => () => { playAttempt.current++; audio.current?.pause(); }, []);

  return {
    attachPrevis, attachGeneration, time, duration, generationDuration, playing: transport.playing, muted, error,
    activeCue: transport.dialogue?.id ?? null, selection, seconds, seek, playDialogue, pause,
    cancel: () => { pause(); stopAudition(); generationReady.current = false; setGenerationDuration(0); },
    toggle: () => {
      if (current.current.playing) { pause(); return; }
      stopAudition();
      if ((previs.current?.getCurrentTime() ?? time) >= duration - 0.001) position(0);
      play();
    },
    toggleMute: () => setMuted((value) => !value),
    onPrevisDuration: (value: number) => { setDuration(value); applyMute(); },
    onPrevisError: () => { pause(); setDuration(0); setError('Previs video is unavailable.'); },
    onPrevisEnded: finish,
    onGenerationError: () => { generationReady.current = false; applyMute(); setError('Generation video is unavailable. Previs playback remains available.'); },
    onGenerationDuration: (value: number) => {
      generationReady.current = true;
      setGenerationDuration(value);
      const position = previs.current?.getCurrentTime() ?? 0;
      generation.current?.seek(position);
      applyMute();
      if (current.current.playing && position < value) playGeneration();
    },
  };
}
