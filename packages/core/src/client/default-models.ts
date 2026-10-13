import type { GenerationLane } from './generation-lanes.js';

/**
 * One trusted model family a user may pick as a lane default. Studio and Core
 * only list these; the Skill maps a family to the exact operation route.
 */
export interface DefaultModelListEntry {
  /** Skill model guide key. */
  model: string;
  name: string;
  providers: string[];
  /** Providers for which this family is the Skill recommendation. */
  recommendedFor: string[];
}

export type DefaultModelListLanes = Record<GenerationLane, DefaultModelListEntry[]>;

export type DefaultModelListResource =
  | { state: 'notSynced' }
  | { state: 'synced'; syncedAt: string; lanes: DefaultModelListLanes };

export interface DefaultModelListSyncReport {
  changed: boolean;
  sha256: string;
  path: string;
}
