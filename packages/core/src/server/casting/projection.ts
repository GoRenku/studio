import type { CastCostume, CastLook } from '../../client/casting/model.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import type { CastCostumeRecord } from '../database/access/casting/costumes.js';
import type { CastLookRecord } from '../database/access/casting/looks.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';

/** Scene id to its position in the current screenplay. */
export function readSceneOrder(session: DatabaseSession): Map<string, number> {
  return new Map(readCanonicalScreenplay(session).scenes.map((scene, index) => [scene.id, index]));
}

export function toCastLook(session: DatabaseSession, record: CastLookRecord, sceneOrder: Map<string, number>): CastLook {
  return {
    id: record.id,
    castMemberId: record.castMemberId,
    name: record.name,
    description: record.description,
    sceneIds: inScreenplayOrder(record.sceneIds, sceneOrder),
    castCandidateAssetFileId:
      readSelectedAssetFileRecord(session, assetFileSelectionTargetKey({ kind: 'castLook', id: record.id }))?.assetFileId ?? null,
  };
}

export function toCastCostume(session: DatabaseSession, record: CastCostumeRecord, sceneOrder: Map<string, number>): CastCostume {
  return {
    id: record.id,
    castMemberId: record.castMemberId,
    lookId: record.lookId,
    name: record.name,
    wardrobe: record.wardrobe,
    continuityNotes: record.continuityNotes,
    sceneIds: inScreenplayOrder(record.sceneIds, sceneOrder),
    characterSheetAssetFileId:
      readSelectedAssetFileRecord(session, assetFileSelectionTargetKey({ kind: 'castCostume', id: record.id }))?.assetFileId ?? null,
  };
}

function inScreenplayOrder(sceneIds: string[], sceneOrder: Map<string, number>): string[] {
  return [...sceneIds].sort((a, b) => (sceneOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (sceneOrder.get(b) ?? Number.MAX_SAFE_INTEGER));
}
