import type { DirectorVisualLanguageReadiness } from '../../client/index.js';
import { listAllInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import {
  listLookbookRecords,
  readLookbookRecordByKind,
} from '../database/access/lookbook.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export function readVisualLanguageReadiness(
  session: DatabaseSession
): DirectorVisualLanguageReadiness {
  const productionLookbookId = readLookbookRecordByKind(session, 'production')?.id ?? null;
  const storyboardLookbookId = readLookbookRecordByKind(session, 'storyboard')?.id ?? null;
  return {
    inspirationFolderCount: listAllInspirationFolderRecords(session).length,
    lookbookCount: listLookbookRecords(session).length,
    productionLookbookId,
    storyboardLookbookId,
    productionLookbookReadyForGeneration: productionLookbookId !== null,
    storyboardLookbookReadyForGeneration: storyboardLookbookId !== null,
  };
}
