import type { AssetFileOwner, AssetFileSelectionTarget } from '../../client/asset-files.js';
import { assetFileSelectionResourceKeys, selectableAssetFileTarget } from '../asset-files/selection.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

/**
 * An imported edit becomes the selection of its target when its type has one (ADR 0113).
 * Sheets and Shot Plan images have no selection and stay as they are.
 */
export function imageEditResultSelection(
  session: DatabaseSession,
  input: { owner: AssetFileOwner; assetFileType: string }
): { target: AssetFileSelectionTarget; resourceKeys: string[] } | null {
  const target = selectableAssetFileTarget(input.owner, input.assetFileType);
  return target ? { target, resourceKeys: assetFileSelectionResourceKeys(session, target) } : null;
}
