import type { AssetFile } from '../../client/asset-files.js';
import type {
  CastMemberCharacterArcResource,
  CastMemberCharacterArcSummary,
  CharacterArc,
} from '../../client/character-arcs/model.js';
import { isAssetFileAvailableInSession, toAssetFile } from '../asset-files/projection.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadCastMemberResourceInput } from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { readActiveScreenplayAnalysisId } from '../screenplay-analysis/persistence.js';
import { characterArcFreshness, characterArcFreshnessHelp } from './freshness.js';
import { readStoredCharacterArc, type StoredCharacterArcRecord } from './persistence.js';
import { readCharacterArcPresence } from './presence.js';
import { readCharacterArcStoryStructure } from './story-structure.js';

export async function readCastMemberCharacterArcResource(
  input: ReadCastMemberResourceInput
): Promise<CastMemberCharacterArcResource> {
  const { session } = await openProjectSession(input);
  try {
    const stored = requireStoredCharacterArc(session, input.castMemberId);
    const freshness = characterArcFreshness(session, stored.writtenAt);
    return {
      castMember: { id: stored.castMemberId, name: stored.name, ...(stored.role ? { role: stored.role } : {}) },
      arc: stored.arc,
      scenes: readCanonicalScreenplay(session).scenes.map((scene) => ({
        id: scene.id,
        heading: scene.heading,
        ...(scene.productionNumber ? { productionNumber: scene.productionNumber } : {}),
        ...(scene.title ? { title: scene.title } : {}),
      })),
      presence: readCharacterArcPresence(session, stored.castMemberId),
      structure: readCharacterArcStoryStructure(session),
      characterSheets: readCharacterSheets(session, stored.arc),
      freshness,
      freshnessHelp: characterArcFreshnessHelp(freshness),
    };
  } finally {
    session.close();
  }
}

/** Whether the Cast Member has an arc, or why it has none yet. */
export function readCastMemberCharacterArcSummary(
  session: DatabaseSession,
  castMemberId: string
): CastMemberCharacterArcSummary {
  if (readStoredCharacterArc(session, castMemberId)) {
    return { kind: 'own' };
  }
  return { kind: 'notWritten', screenplayAnalyzed: readActiveScreenplayAnalysisId(session) !== null };
}

function readCharacterSheets(session: DatabaseSession, arc: CharacterArc): AssetFile[] {
  const ids = [...new Set(arc.turningPoints.flatMap((point) => point.characterSheetAssetFileId ? [point.characterSheetAssetFileId] : []))];
  return ids.flatMap((id) => {
    const record = readAssetFileRecordIncludingDiscarded(session, id);
    return record && isAssetFileAvailableInSession(session, record) ? [toAssetFile(record)] : [];
  });
}

function requireStoredCharacterArc(session: DatabaseSession, castMemberId: string): StoredCharacterArcRecord {
  const stored = readStoredCharacterArc(session, castMemberId);
  if (!stored) {
    throw new ProjectDataError('CHARACTER_ARC_NOT_FOUND', `Cast Member ${castMemberId} has no character arc.`, {
      suggestion: 'Character arcs are written when the screenplay is analyzed.',
    });
  }
  return stored;
}
