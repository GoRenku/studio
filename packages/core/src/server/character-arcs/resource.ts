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
import { characterArcFreshness, characterArcFreshnessHelp } from './freshness.js';
import {
  listCastMembersSharingCharacterArc,
  readStoredCharacterArc,
  type StoredCharacterArcRecord,
} from './persistence.js';
import { readCharacterArcPresence } from './presence.js';
import { readCharacterArcStoryStructure } from './story-structure.js';

export async function readCastMemberCharacterArcResource(
  input: ReadCastMemberResourceInput
): Promise<CastMemberCharacterArcResource> {
  const { session } = await openProjectSession(input);
  try {
    const viewed = requireStoredCharacterArc(session, input.castMemberId);
    const owner = viewed.arc.kind === 'characterArcReference'
      ? requireStoredCharacterArc(session, viewed.arc.castMemberId)
      : viewed;
    const arc = owner.arc as CharacterArc;
    const sharingIds = new Set([
      owner.castMemberId,
      ...listCastMembersSharingCharacterArc(session, owner.castMemberId).map((record) => record.castMemberId),
    ]);
    const freshness = characterArcFreshness(session, owner.writtenAt);
    return {
      castMember: { id: viewed.castMemberId, name: viewed.name, ...(viewed.role ? { role: viewed.role } : {}) },
      arc,
      sharedWith: owner === viewed ? null : { ownerCastMemberId: owner.castMemberId, ownerName: owner.name },
      scenes: readCanonicalScreenplay(session).scenes.map((scene) => ({
        id: scene.id,
        heading: scene.heading,
        ...(scene.productionNumber ? { productionNumber: scene.productionNumber } : {}),
        ...(scene.title ? { title: scene.title } : {}),
      })),
      presence: readCharacterArcPresence(session, sharingIds),
      structure: readCharacterArcStoryStructure(session),
      looks: readLooks(session, arc),
      freshness,
      freshnessHelp: characterArcFreshnessHelp(freshness),
    };
  } finally {
    session.close();
  }
}

/** Whether the Cast Member has an own or shared arc; decides if the Arc tab shows. */
export function readCastMemberCharacterArcSummary(
  session: DatabaseSession,
  castMemberId: string
): CastMemberCharacterArcSummary {
  const stored = readStoredCharacterArc(session, castMemberId);
  if (!stored) {
    return null;
  }
  if (stored.arc.kind === 'characterArc') {
    return { kind: 'own' };
  }
  const owner = readStoredCharacterArc(session, stored.arc.castMemberId);
  return owner?.arc.kind === 'characterArc'
    ? { kind: 'shared', ownerCastMemberId: owner.castMemberId, ownerName: owner.name }
    : null;
}

function readLooks(session: DatabaseSession, arc: CharacterArc): AssetFile[] {
  const ids = [...new Set(arc.turningPoints.flatMap((point) => point.lookAssetFileId ? [point.lookAssetFileId] : []))];
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
