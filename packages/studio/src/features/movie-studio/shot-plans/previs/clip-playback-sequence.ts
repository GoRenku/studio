import type { ShotPlanClip, ShotPlanClipTake } from '@gorenku/studio-core/client';
import type { StudioShotAssetFile } from '@/services/studio-shot-plans-contracts';
import type { StudioShotPlanClips } from '@/services/shot-plan-previs/contracts';

export const clipTakeLabel = (clip: ShotPlanClip, take: ShotPlanClipTake) =>
  `Clip ${clip.number}.${take.number}${take.title ? `: ${take.title}` : ''}`;

export interface ClipPlaybackSegment {
  clip: ShotPlanClip;
  take: ShotPlanClipTake | null;
  file: StudioShotAssetFile | null;
  duration: number | null;
  start: number;
  blocked: boolean;
}

export function clipPlaybackSequence(report: StudioShotPlanClips | undefined, measured: Record<string, number | null>): ClipPlaybackSegment[] {
  let start = 0;
  let blocked = false;
  return (report?.clips ?? []).map((clip) => {
    const take = clip.takes.find((entry) => entry.id === clip.selectedTakeId) ?? null;
    const file = report?.assets.find((asset) => asset.id === take?.assetId)?.files.find((entry) => entry.id === take?.assetFileId) ?? null;
    const value = file ? (file.url in measured ? measured[file.url] : file.durationSeconds) : null;
    const duration = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
    const segment = { clip, take, file, duration, start, blocked };
    if (!file || duration === null) blocked = true;
    if (duration !== null) start += duration;
    return segment;
  });
}

export function locateClip(segments: ClipPlaybackSegment[], time: number) {
  const available = segments.filter((segment) => !segment.blocked && segment.duration !== null && segment.file);
  return available.find((segment) => time < segment.start + segment.duration!) ?? available.at(-1) ?? null;
}
