import type { CharacterArcFreshness } from '../../client/character-arcs/model.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readLatestScreenplayRevisionSummary } from '../screenplay/persistence/revisions.js';

export const CHARACTER_ARC_NEEDS_REFRESH_HELP = 'Screenplay changed since these arcs were written.';

export function characterArcFreshness(session: DatabaseSession, writtenAt: string): CharacterArcFreshness {
  const revision = readLatestScreenplayRevisionSummary(session);
  return revision && revision.createdAt > writtenAt ? 'needsRefresh' : 'current';
}

export function characterArcFreshnessHelp(freshness: CharacterArcFreshness): string | null {
  return freshness === 'needsRefresh' ? CHARACTER_ARC_NEEDS_REFRESH_HELP : null;
}
