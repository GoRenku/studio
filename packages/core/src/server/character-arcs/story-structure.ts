import type { CastMemberCharacterArcResource } from '../../client/character-arcs/model.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  readActiveScreenplayAnalysisRecord,
  readStoredScreenplayAnalysis,
} from '../screenplay-analysis/persistence.js';

/** Acts and key beats from the active Screenplay Analysis, or null without one. */
export function readCharacterArcStoryStructure(
  session: DatabaseSession
): CastMemberCharacterArcResource['structure'] {
  const row = readActiveScreenplayAnalysisRecord(session);
  if (!row) {
    return null;
  }
  const analysis = readStoredScreenplayAnalysis({ row });
  return {
    actSegments: analysis.actSegments.map((act) => ({ role: act.role, title: act.title, sceneIds: act.sceneIds })),
    keyBeats: analysis.keyBeats.map((beat) => ({ key: beat.key, ...(beat.sceneId ? { sceneId: beat.sceneId } : {}) })),
  };
}
