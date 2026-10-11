import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { AssetFile, AssetFileOwner } from '../../client/asset-files.js';
import { parseAssetFileOwnerKey } from '../asset-files/owner-keys.js';
import { toAssetFile } from '../asset-files/projection.js';
import { selectableAssetFileTarget } from '../asset-files/selection.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import { readAssetFileRecordIncludingDiscarded, type AssetFileRecord } from '../database/access/asset-files.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetFileOwnerName } from './owner-names.js';
import { assetFileTakeNumber } from './take-numbers.js';

/** One existing image a user may choose to edit, with its place among its siblings. */
export interface ImageEditTarget {
  assetFile: AssetFile;
  owner: AssetFileOwner;
  ownerName: string | null;
  takeNumber: number;
  selectable: boolean;
  selected: boolean;
  selectedAssetFileId: string | null;
}

export function readImageEditTargets(input: { session: DatabaseSession; assetFileIds: string[] }): ImageEditTarget[] {
  const records = input.assetFileIds.map((id) => readAssetFileRecordIncludingDiscarded(input.session, id));
  const issues = targetIssues(input.assetFileIds, records);
  if (issues.length > 0) {
    throw new ProjectDataError('CORE_IMAGE_EDIT_TARGET_INVALID', 'Some images cannot be edited.', { issues });
  }
  return (records as AssetFileRecord[]).map((record) => projectTarget(input.session, record));
}

function projectTarget(session: DatabaseSession, record: AssetFileRecord): ImageEditTarget {
  const owner = parseAssetFileOwnerKey(record.ownerKey);
  const target = selectableAssetFileTarget(owner, record.type);
  const selectedAssetFileId = target
    ? readSelectedAssetFileRecord(session, assetFileSelectionTargetKey(target))?.assetFileId ?? null
    : null;
  return {
    assetFile: toAssetFile(record),
    owner,
    ownerName: assetFileOwnerName(session, owner),
    takeNumber: assetFileTakeNumber(session, { assetFileId: record.id, ownerKey: record.ownerKey, type: record.type }),
    selectable: target !== null,
    selected: selectedAssetFileId === record.id,
    selectedAssetFileId,
  };
}

function targetIssues(ids: string[], records: Array<AssetFileRecord | null>): DiagnosticIssue[] {
  return ids.flatMap((id, index) => {
    const path = ['assetFileIds', String(index)];
    const record = records[index];
    if (ids.indexOf(id) !== index) {
      return [issue(path, `Asset File ${id} is listed more than once.`)];
    }
    if (!record) {
      return [issue(path, `Asset File ${id} does not exist.`)];
    }
    if (record.discardedAt) {
      return [issue(path, `Asset File ${id} is in the Trash.`)];
    }
    if (record.mediaKind !== 'image') {
      return [issue(path, `Asset File ${id} is not an image.`)];
    }
    return [];
  });
}

function issue(path: string[], message: string): DiagnosticIssue {
  return createDiagnosticError('CORE_IMAGE_EDIT_TARGET_INVALID', message, { path });
}
