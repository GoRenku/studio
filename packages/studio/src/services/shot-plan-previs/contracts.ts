import type { PrevisCue, PrevisPlayback, PrevisRevision } from '@gorenku/studio-core/client';
import type { StudioShotAsset } from '../studio-shot-plans-contracts';

export type StudioPrevisDialogue = Omit<Extract<PrevisCue, { kind: 'dialogue' }>, 'audio'> & {
  audio?: NonNullable<Extract<PrevisCue, { kind: 'dialogue' }>['audio']> & { url: string };
};
export type StudioPrevisCue = Exclude<PrevisCue, { kind: 'dialogue' }> | StudioPrevisDialogue;
export type StudioPrevisPlayback = Omit<PrevisPlayback, 'cues'> & { cues: StudioPrevisCue[] };

export interface StudioPrevisRevision extends Omit<PrevisRevision, 'sourceDirectory' | 'render' | 'generations' | 'playback'> {
  render: StudioShotAsset | null;
  generations: StudioShotAsset[];
  playback: StudioPrevisPlayback | null;
}

export interface StudioShotPlanPrevis {
  shotPlanId: string;
  revisions: StudioPrevisRevision[];
  resourceKeys: string[];
}
