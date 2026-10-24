import type { CastCastingResource } from '../../client/casting/model.js';
import { listAssetFilesInSession, isAssetFileAvailableInSession, toAssetFile } from '../asset-files/projection.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { listCastCostumeRecords } from '../database/access/casting/costumes.js';
import { listCastLookRecords } from '../database/access/casting/looks.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadCastMemberResourceInput } from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { castMemberNotFound } from './diagnostics.js';
import { toCastCostume, toCastLook } from './projection.js';
import { listCastingRoundViews } from './rounds/views.js';

/** Everything Studio's Casting tab and the casting board show for one Cast Member. */
export async function readCastCastingResource(input: ReadCastMemberResourceInput): Promise<CastCastingResource> {
  const { session } = await openProjectSession(input);
  try {
    return readCastCastingResourceFromSession(session, input.castMemberId);
  } finally {
    session.close();
  }
}

export function readCastCastingResourceFromSession(session: DatabaseSession, castMemberId: string): CastCastingResource {
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throw castMemberNotFound(castMemberId);
  }
  const screenplayScenes = readCanonicalScreenplay(session).scenes;
  const sceneOrder = new Map(screenplayScenes.map((scene, index) => [scene.id, index]));
  const characterSheets = listAssetFilesInSession(session, {
    owner: { kind: 'castMember', id: castMemberId },
    type: 'character_sheet',
    mediaKind: 'image',
  });
  return {
    castMember: { id: castMember.id, name: castMember.name },
    scenes: screenplayScenes.map((scene) => ({
      id: scene.id,
      heading: scene.heading,
      ...(scene.productionNumber ? { productionNumber: scene.productionNumber } : {}),
    })),
    looks: listCastLookRecords(session, castMemberId).map((record) => {
      const look = toCastLook(session, record, sceneOrder);
      return {
        ...look,
        rounds: listCastingRoundViews(session, look.id),
        castCandidate: readActiveAssetFile(session, look.castCandidateAssetFileId),
      };
    }),
    costumes: listCastCostumeRecords(session, castMemberId).map((record) => toCastCostume(session, record, sceneOrder)),
    characterSheets,
  };
}

function readActiveAssetFile(session: DatabaseSession, assetFileId: string | null) {
  const record = assetFileId ? readAssetFileRecordIncludingDiscarded(session, assetFileId) : null;
  return record && isAssetFileAvailableInSession(session, record) ? toAssetFile(record) : null;
}
