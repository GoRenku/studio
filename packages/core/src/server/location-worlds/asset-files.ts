import type { AssetFile, Location, LocationWorldResource } from '../../client/index.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import { ProjectDataError } from '../project-data-error.js';
import { readLocationRecord } from '../database/access/locations.js';
import { withProject } from '../project-operation.js';
import type { RenkuConfigPathOptions } from '../config/index.js';

export async function readLocationWorldResource(
  input: RenkuConfigPathOptions & { projectName?: string; locationId: string }
): Promise<LocationWorldResource> {
  return withProject(input, ({ session }) => {
    const row = readLocationRecord(session, input.locationId);
    if (!row) {
      throw new ProjectDataError('PROJECT_DATA205', 'Location was not found.');
    }
    const location: Location = {
      id: row.id,
      handle: row.handle,
      name: row.name,
      ...(row.timePeriod ? { timePeriod: row.timePeriod } : {}),
      ...(row.description ? { description: row.description } : {}),
      ...(row.visualNotes ? { visualNotes: row.visualNotes } : {}),
    };
    return {
      location,
      selectedWorld: readSelectedLocationWorldInSession(session, row.id),
    };
  });
}

export function readSelectedLocationWorldInSession(
  session: DatabaseSession,
  locationId: string
): AssetFile | null {
  const owner = { kind: 'location' as const, id: locationId };
  const selected = readSelectedAssetFileRecord(
    session,
    assetFileSelectionTargetKey({ kind: 'locationWorld', id: locationId })
  );
  if (!selected) {
    return null;
  }
  const assetFile = readOwnedAssetFile(session, { owner, assetFileId: selected.assetFileId });
  if (
    !assetFile
    || assetFile.type !== 'location_world'
    || assetFile.mediaKind !== 'model'
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Selected Location World is invalid: ${selected.assetFileId}.`
    );
  }
  return assetFile;
}

export function locationWorldTitle(location: Location): string {
  return `${location.name} 3D World`;
}
