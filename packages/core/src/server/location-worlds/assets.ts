import type { Asset, Location, LocationWorldResource } from '../../client/index.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readOwnedAsset } from '../assets/projection.js';
import { assetSelectionTargetKey } from '../assets/selection-targets.js';
import { ProjectDataError } from '../project-data-error.js';
import { readLocationRecord } from '../database/access/locations.js';
import { withGenerationProject } from '../generation/project-operation.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function readLocationWorldResource(
  input: RenkuConfigPathOptions & { projectName?: string; locationId: string }
): Promise<LocationWorldResource> {
  return withGenerationProject(input, ({ session }) => {
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
): Asset | null {
  const owner = { kind: 'location' as const, id: locationId };
  const selected = readSelectedAssetRecord(
    session,
    assetSelectionTargetKey({ kind: 'locationWorld', id: locationId })
  );
  if (!selected) {
    return null;
  }
  const asset = readOwnedAsset(session, { owner, assetId: selected.assetId });
  if (
    !asset
    || asset.type !== 'location_world'
    || asset.mediaKind !== 'model'
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Selected Location World is invalid: ${selected.assetId}.`
    );
  }
  return asset;
}

export function locationWorldTitle(location: Location): string {
  return `${location.name} 3D World`;
}
