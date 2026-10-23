import type { DirectorProductionDesignReadiness } from '../../client/index.js';
import { listAssetFilePageInSession } from '../asset-files/projection.js';
import { readActiveLocationDesignId } from '../database/access/location-designs.js';
import { listLocationRecords } from '../database/access/locations.js';
import { readActivePropDesignId } from '../database/access/prop-designs.js';
import { listPropRecords } from '../database/access/props.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export function readProductionDesignReadiness(
  session: DatabaseSession
): DirectorProductionDesignReadiness {
  const locations = listLocationRecords(session);
  const missingEnvironmentSheetLocationIds: string[] = [];
  const missingActiveLocationDesignLocationIds: string[] = [];
  let locationSheetCount = 0;
  let activeLocationDesignCount = 0;
  const props = listPropRecords(session);
  const missingPropSheetPropIds: string[] = [];
  const missingActivePropDesignPropIds: string[] = [];
  let propSheetCount = 0;
  let activePropDesignCount = 0;

  for (const location of locations) {
    if (readActiveLocationDesignId(session, location.id)) {
      activeLocationDesignCount += 1;
    } else {
      missingActiveLocationDesignLocationIds.push(location.id);
    }
    const assetFiles = listAssetFilePageInSession(session, {
      owner: { kind: 'location', id: location.id },
      type: 'location_sheet',
      limit: 200,
    }).items;
    locationSheetCount += assetFiles.length;
    if (assetFiles.length === 0) {
      missingEnvironmentSheetLocationIds.push(location.id);
    }
  }

  for (const prop of props) {
    if (readActivePropDesignId(session, prop.id)) {
      activePropDesignCount += 1;
    } else {
      missingActivePropDesignPropIds.push(prop.id);
    }
    const assetFiles = listAssetFilePageInSession(session, {
      owner: { kind: 'prop', id: prop.id },
      type: 'prop_sheet',
      limit: 200,
    }).items;
    propSheetCount += assetFiles.length;
    if (assetFiles.length === 0) {
      missingPropSheetPropIds.push(prop.id);
    }
  }

  return {
    locationCount: locations.length,
    activeLocationDesignCount,
    missingActiveLocationDesignLocationIds,
    locationSheetCount,
    missingEnvironmentSheetLocationIds,
    everyLocationHasEnvironmentSheet:
      locations.length > 0 &&
      missingEnvironmentSheetLocationIds.length === 0,
    propCount: props.length,
    activePropDesignCount,
    missingActivePropDesignPropIds,
    propSheetCount,
    missingPropSheetPropIds,
    everyPropHasPropSheet:
      props.length === 0 || missingPropSheetPropIds.length === 0,
  };
}
