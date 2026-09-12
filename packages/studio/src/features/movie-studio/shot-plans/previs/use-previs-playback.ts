import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoPlayerHandle } from '@/ui/video-player';
import type { StudioPrevisDialogue, StudioPrevisPlayback } from '@/services/shot-plan-previs/contracts';

type Transport = { dialogue: StudioPrevisDialogue | null; playing: boolean };

export function usePrevisPlayback(timeline?: StudioPrevisPlayback | null, suppressed = false) {
  const previs = useRef<VideoPlayerHandle>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const current = useRef<Transport>({ dialogue: null, playing: false });
  const [transport, setTransport] = useState<Transport>({ dialogue: null, playing: false });
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const playAttempt = useRef(0);
  const previousTimeline = useRef(timeline);
  const attachPrevis = useCallback((player: VideoPlayerHandle | null) => { previs.current = player; }, []);
  const seconds = useCallback((frame: number) => timeline ? frame * timeline.frameRate.denominator / timeline.frameRate.numerator : 0, [timeline]);
  const update = useCallback((next: Transport) => { current.current = next; setTransport(next); }, []);

  const applyMute = useCallback(() => {
    previs.current?.setMuted(muted || suppressed || Boolean(audio.current));
    if (audio.current) audio.current.muted = muted;
  }, [muted, suppressed]);

  const pause = useCallback(() => {
    playAttempt.current++;
    update({ ...current.current, playing: false });
    previs.current?.pause();
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
    setTime(value);
  }, []);

  const seek = useCallback((value: number, selected: string | null = null) => {
    if (duration <= 0 || !Number.isFinite(value) || value < 0 || value > duration) return;
    pause();
    stopAudition();
    setSelection(selected);
    position(value);
  }, [duration, pause, stopAudition, position]);

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
  }, [duration, update, applyMute, pause]);

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
    let frame: number;
    const tick = () => {
      if (current.current.playing) {
        const value = previs.current?.getCurrentTime() ?? 0;
        setTime(value);
        const cue = current.current.dialogue;
        const end = cue?.endFrame === undefined ? duration : Math.min(seconds(cue.endFrame), duration);
        if (value >= end) finish();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, seconds, finish]);
  useEffect(() => () => { playAttempt.current++; audio.current?.pause(); }, []);

  return {
    attachPrevis, time, duration, playing: transport.playing, muted, error,
    activeCue: transport.dialogue?.id ?? null, selection, seconds, seek, playDialogue, pause,
    cancel: () => { pause(); stopAudition(); },
    play,
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
  };
}
