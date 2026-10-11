import { listAssetFileRecordsForOwnerTypeIncludingDiscarded } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

/**
 * 1-based creation order among every file of the same owner and type, discarded files
 * included, so a number never shifts after a delete.
 */
export function assetFileTakeNumber(
  session: DatabaseSession,
  input: { assetFileId: string; ownerKey: string; type: string }
): number {
  const siblings = listAssetFileRecordsForOwnerTypeIncludingDiscarded(session, input);
  return siblings.findIndex((record) => record.id === input.assetFileId) + 1;
}
