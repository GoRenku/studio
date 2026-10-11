import { listAssetFileRecordsForOwnerTypeIncludingDiscarded, readAssetFileRecordIncludingDiscarded, type AssetFileRecord } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { readImageEditTargets, type ImageEditTarget } from './targets.js';

/** One image in a source's edit lineage, with the image it was edited from (null for the source). */
export interface ImageEditLineageEntry {
  target: ImageEditTarget;
  parentAssetFileId: string | null;
}

/**
 * The source image and every active image of the same owner and type edited from it, directly or
 * through earlier edits, in creation order. Core records the exact source on attachment; other
 * request references never establish parentage. Discarded images link descendants but are not returned.
 */
export function readImageEditLineage(input: { session: DatabaseSession; sourceAssetFileId: string }): ImageEditLineageEntry[] {
  const source = readAssetFileRecordIncludingDiscarded(input.session, input.sourceAssetFileId);
  if (!source || source.mediaKind !== 'image') {
    throw new ProjectDataError('CORE_IMAGE_EDIT_TARGET_INVALID', `Asset File ${input.sourceAssetFileId} is not an image.`);
  }
  const siblings = listAssetFileRecordsForOwnerTypeIncludingDiscarded(input.session, { ownerKey: source.ownerKey, type: source.type });
  const children = new Map<string, AssetFileRecord[]>();
  for (const record of siblings) {
    if (!record.imageEditSourceAssetFileId) {
      continue;
    }
    const entries = children.get(record.imageEditSourceAssetFileId) ?? [];
    entries.push(record);
    children.set(record.imageEditSourceAssetFileId, entries);
  }
  const lineage = new Map<string, { record: AssetFileRecord; parentAssetFileId: string | null }>([[source.id, { record: source, parentAssetFileId: null }]]);
  // Traverse relationships independently of timestamp/id ties in creation ordering.
  for (const parentAssetFileId of lineage.keys()) {
    for (const record of children.get(parentAssetFileId) ?? []) {
      if (!lineage.has(record.id)) {
        lineage.set(record.id, { record, parentAssetFileId });
      }
    }
  }
  const ordered = [source, ...siblings.filter((record) => record.id !== source.id && lineage.has(record.id))];
  const active = ordered.filter((record) => !record.discardedAt).map((record) => lineage.get(record.id)!);
  const targets = readImageEditTargets({ session: input.session, assetFileIds: active.map((entry) => entry.record.id) });
  return active.map((entry, index) => ({ target: targets[index]!, parentAssetFileId: entry.parentAssetFileId }));
}
