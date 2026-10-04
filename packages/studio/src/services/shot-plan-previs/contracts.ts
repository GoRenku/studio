import type { PrevisCue, PrevisPlayback, PrevisRevision, ShotPlanClips } from '@gorenku/studio-core/client';
import type { StudioShotAssetFile } from '../studio-shot-plans-contracts';

export type StudioPrevisDialogue = Omit<Extract<PrevisCue, { kind: 'dialogue' }>, 'audio'> & {
  audio?: NonNullable<Extract<PrevisCue, { kind: 'dialogue' }>['audio']> & { url: string };
};
export type StudioPrevisCue = Exclude<PrevisCue, { kind: 'dialogue' }> | StudioPrevisDialogue;
export type StudioPrevisPlayback = Omit<PrevisPlayback, 'cues'> & { cues: StudioPrevisCue[] };

export interface StudioPrevisRevision extends Omit<PrevisRevision, 'sourceDirectory' | 'render' | 'clips' | 'playback'> {
  render: StudioShotAssetFile | null;
  clips: StudioShotPlanClips;
  playback: StudioPrevisPlayback | null;
}

export interface StudioShotPlanPrevis {
  shotPlanId: string;
  revisions: StudioPrevisRevision[];
  resourceKeys: string[];
}

export type StudioShotPlanClips = Omit<ShotPlanClips, 'assetFiles' | 'unassignedAssetFiles'> & {
  assetFiles: StudioShotAssetFile[];
  unassignedAssetFiles: StudioShotAssetFile[];
};
