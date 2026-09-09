import type { PrevisPlayback, PrevisRevision } from '@gorenku/studio-core/client';
import type { StudioShotAsset } from '../studio-shot-plans-contracts';

export type StudioPrevisCue = Omit<PrevisPlayback['cues'][number], 'audio'> & {
  audio?: NonNullable<PrevisPlayback['cues'][number]['audio']> & { url: string };
};

export interface StudioPrevisRevision extends Omit<PrevisRevision, 'sourceDirectory' | 'render' | 'generations' | 'playback'> {
  render: StudioShotAsset | null;
  generations: StudioShotAsset[];
  playback: { subjects: PrevisPlayback['subjects']; cues: StudioPrevisCue[] } | null;
}

export interface StudioShotPlanPrevis {
  shotPlanId: string;
  revisions: StudioPrevisRevision[];
  resourceKeys: string[];
}
