import type { MediaGenerationSceneWardrobe } from '../../client/media-generation-context.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import { readSceneCostumeRecord } from '../database/access/casting/costumes.js';
import { readSceneLookRecord } from '../database/access/casting/looks.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

/** The Look, costume and picked Character Sheet of a Cast Member in one scene. */
export function readSceneWardrobe(
  session: DatabaseSession,
  input: { castMemberId: string; sceneId: string }
): MediaGenerationSceneWardrobe | null {
  const look = readSceneLookRecord(session, input);
  if (!look) {
    return null;
  }
  const costume = readSceneCostumeRecord(session, input);
  return {
    look: { id: look.id, name: look.name },
    costume: costume
      ? { id: costume.id, name: costume.name, wardrobe: costume.wardrobe, continuityNotes: costume.continuityNotes }
      : null,
    characterSheetAssetFileId: costume
      ? readSelectedAssetFileRecord(session, assetFileSelectionTargetKey({ kind: 'castCostume', id: costume.id }))?.assetFileId ?? null
      : null,
  };
}
