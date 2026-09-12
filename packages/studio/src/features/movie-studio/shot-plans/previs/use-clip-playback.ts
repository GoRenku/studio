import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoPlayerHandle } from '@/ui/video-player';
import type { StudioShotPlanClips } from '@/services/shot-plan-previs/contracts';
import { clipPlaybackSequence, locateClip } from './clip-playback-sequence';
import { useClipDurations } from './use-clip-durations';

export function useClipPlayback(report?: StudioShotPlanClips, suppressed = false) {
  const measured = useClipDurations(report);
  const segments = clipPlaybackSequence(report, measured);
  const [returnClip, setReturnClip] = useState<string | undefined>(undefined);
  const player = useRef<VideoPlayerHandle | null>(null);
  const [inspectedTakeId, setAuditionId] = useState<string | null>(null);
  const auditionId = inspectedTakeId ?? (!report?.clips.length ? report?.unassignedAssets.flatMap((asset) => asset.files).find((file) => file.mediaKind === 'video')?.id ?? null : null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const pending = useRef(0);
  const attempt = useRef(0);
  const ready = useRef(false);
  const available = segments.filter((segment) => !segment.blocked && segment.duration !== null && segment.file);
  const chainDuration = available.reduce((sum, segment) => sum + segment.duration!, 0);
  const take = report?.clips.flatMap((clip) => clip.takes).find((entry) => entry.id === auditionId);
  const auditionFile = [...(report?.assets ?? []), ...(report?.unassignedAssets ?? [])]
    .flatMap((asset) => asset.files).find((file) => file.id === (take?.assetFileId ?? auditionId));
  const segment = locateClip(segments, time);
  const file = auditionId ? auditionFile ?? null : segment?.file ?? null;
  const auditionDuration = auditionFile ? measured[auditionFile.url] ?? auditionFile.durationSeconds : null;
  const duration = auditionId ? (typeof auditionDuration === 'number' && auditionDuration > 0 ? auditionDuration : 0) : chainDuration;
  const url = file?.url;
  const activeUrl = useRef(url);
  const state = useRef({ playing, muted });
  useEffect(() => { state.current = { playing, muted: muted || suppressed }; }, [playing, muted, suppressed]);
  const pause = useCallback(() => { attempt.current++; setPlaying(false); player.current?.pause(); }, [setPlaying]);
  const start = useCallback(() => {
    if (!ready.current) return;
    const id = ++attempt.current;
    void player.current?.play().catch(() => {
      if (attempt.current !== id) return;
      setPlaying(false); setError('This clip could not play. Try again or inspect another take.');
    });
  }, [setPlaying, setError]);
  const attach = useCallback((value: VideoPlayerHandle | null) => { player.current = value; }, []);
  useEffect(() => {
    activeUrl.current = url;
    ready.current = false;
    attempt.current++;
  }, [url]);
  const selectionKey = JSON.stringify(report?.clips.map((clip) => [clip.id, clip.selectedTakeId]));
  const [observedSelection, setObservedSelection] = useState(selectionKey);
  if (observedSelection !== selectionKey) {
    setObservedSelection(selectionKey);
    setAuditionId(null); setPlaying(false); setEnded(false); setError(null);
    setTime(segments.find((entry) => entry.clip.id === returnClip && !entry.blocked)?.start ?? 0);
  }
  useEffect(() => { player.current?.pause(); attempt.current++; pending.current = 0; }, [selectionKey]);
  useEffect(() => { player.current?.setMuted(muted || suppressed); }, [muted, suppressed, url]);
  useEffect(() => () => { attempt.current++; player.current?.pause(); }, [setPlaying]);

  const seek = (value: number) => {
    pause();
    const target = Math.min(Math.max(0, value), duration);
    setTime(target); setEnded(target === duration && duration > 0);
    const next = auditionId ? null : locateClip(segments, target);
    pending.current = auditionId ? target : target - (next?.start ?? 0);
    if ((auditionId ? url : next?.file?.url) === url) player.current?.seek(pending.current);
    else ready.current = false;
  };
  const audition = (id: string) => { pause(); setAuditionId(id); setTime(0); pending.current = 0; setEnded(false); player.current?.seek(0); };
  const backToClips = (clipId?: string) => {
    pause(); setAuditionId(null); setReturnClip(clipId);
    const target = segments.find((entry) => entry.clip.id === clipId && !entry.blocked)?.start ?? 0;
    setTime(target); pending.current = 0; setEnded(false); player.current?.seek(0);
  };
  const play = (resumeTime = time) => {
    if (!url || !duration) return;
    if (resumeTime >= duration) { seek(0); }
    setPlaying(true); setEnded(false); setError(null); start();
  };
  return {
    attach, file, segments, segment, time, duration, playing, muted, error, ended, auditionId,
    pause, play, seek, audition, backToClips,
    toggle: () => playing ? pause() : play(),
    toggleMute: () => setMuted((value) => !value),
    onDuration: () => {
      if (url !== activeUrl.current) return;
      ready.current = true; player.current?.seek(pending.current); player.current?.setMuted(state.current.muted);
      if (state.current.playing) start();
    },
    onTime: (value: number) => {
      if (url !== activeUrl.current || !ready.current) return;
      const local = !auditionId && segment?.duration ? Math.min(value, segment.duration - 0.00001) : value;
      setTime(auditionId ? local : (segment?.start ?? 0) + local);
    },
    onEnded: () => {
      if (url !== activeUrl.current) return;
      const next = !auditionId && segment ? available.find((entry) => entry.clip.number > segment.clip.number) : null;
      if (next) { pending.current = 0; setTime(next.start); }
      else { pause(); setTime(duration); setEnded(true); }
    },
    onError: () => { if (url === activeUrl.current) { pause(); ready.current = false; setError('This clip is unavailable. Other takes remain available for inspection.'); } },
  };
}
