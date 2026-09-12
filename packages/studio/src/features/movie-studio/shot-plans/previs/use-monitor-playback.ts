import { useEffect, useRef, useState } from 'react';
import type { StudioPrevisDialogue, StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';
import { usePrevisPlayback } from './use-previs-playback';
import { useClipPlayback } from './use-clip-playback';

type Side = 'previs' | 'generation';

export function useMonitorPlayback(revision: StudioPrevisRevision | null) {
  const [linked, setLinked] = useState(false);
  const [audible, setAudible] = useState<Side>('generation');
  const [auditioning, setAuditioning] = useState(false);
  const leader = useRef<Side>('previs');
  const previs = usePrevisPlayback(revision?.playback, linked && !auditioning && audible !== 'previs');
  const generation = useClipPlayback(revision?.clips, linked && !auditioning && audible !== 'generation');
  const selectionKey = JSON.stringify(revision?.clips.clips.map((clip) => clip.selectedTakeId));
  const pausePrevis = previs.pause;
  useEffect(() => { if (linked) pausePrevis(); }, [selectionKey, linked, pausePrevis]);
  const position = (side: Side) => side === 'previs' ? previs.time : generation.time;
  const align = (value: number) => {
    previs.seek(Math.min(value, previs.duration));
    generation.seek(Math.min(value, generation.duration));
  };
  const seek = (side: Side, value: number, selected: string | null = null) => {
    leader.current = side; setAuditioning(false);
    if (side === 'previs') previs.seek(Math.min(value, previs.duration), selected);
    else generation.seek(value);
    if (linked) {
      if (side === 'previs') generation.seek(Math.min(value, generation.duration));
      else previs.seek(Math.min(value, previs.duration));
    }
  };
  const toggle = (side: Side) => {
    leader.current = side;
    if (!linked) { (side === 'previs' ? previs : generation).toggle(); return; }
    const wasAuditioning = auditioning;
    setAuditioning(false);
    if (!wasAuditioning && (previs.playing || generation.playing)) { previs.pause(); generation.pause(); return; }
    let time = wasAuditioning ? position(side) : Math.max(previs.time, generation.time);
    if (time >= Math.max(previs.duration, generation.duration)) time = 0;
    align(time);
    if (time < previs.duration) previs.play();
    if (time < generation.duration) generation.play(time);
  };
  return {
    previs, generation, linked, audible, auditioning,
    seek, toggle,
    toggleLink: () => {
      if (!linked) {
        setAuditioning(false);
        align(position(leader.current));
        setAudible(generation.file ? 'generation' : 'previs');
      }
      setLinked((value) => !value);
    },
    toggleMute: (side: Side) => {
      const playback = side === 'previs' ? previs : generation;
      if (linked && audible !== side) { setAudible(side); if (playback.muted) playback.toggleMute(); }
      else { if (playback.muted) setAudible(side); playback.toggleMute(); }
    },
    playDialogue: (cue: StudioPrevisDialogue) => { generation.pause(); setAuditioning(true); leader.current = 'previs'; previs.playDialogue(cue); },
    audition: (id: string) => { leader.current = 'generation'; if (linked) previs.pause(); generation.audition(id); },
    backToClips: (id?: string) => { leader.current = 'generation'; if (linked) previs.pause(); generation.backToClips(id); },
    pause: () => { previs.pause(); generation.pause(); },
  };
}
