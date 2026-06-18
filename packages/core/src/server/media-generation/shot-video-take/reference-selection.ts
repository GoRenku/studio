import type {
  LocationAzimuthViewId,
  SceneShot,
  SceneShotWithLegacyShotSpecs,
} from '../../../client/index.js';
import type { SceneReferenceScope } from './reference-scope.js';



type SceneShotReferenceCarrier = SceneShotWithLegacyShotSpecs;

export function selectedCastIdsForShots(
  shots: SceneShotReferenceCarrier[]
): Set<string> {
  return new Set(
    shots.flatMap(
      (shot) => shot.shotSpecs?.castReferences?.castMemberIds ?? shot.castMemberIds
    )
  );
}

export function selectedNarrativeCastIdsForShots(input: {
  shots: SceneShot[];
  narrativeScope: SceneReferenceScope;
}): string[] {
  const narrativeCastMemberIds = new Set(
    input.narrativeScope.castMembers.flatMap((castMember) =>
      castMember.id ? [castMember.id] : []
    )
  );
  return [...selectedCastIdsForShots(input.shots)].filter((castMemberId) =>
    narrativeCastMemberIds.has(castMemberId)
  );
}



export function defaultCastIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(shots.flatMap((shot) => shot.castMemberIds));
}



export function selectedLocationIdsForShots(
  shots: SceneShotReferenceCarrier[]
): Set<string> {
  const selected = new Set<string>();
  shots.forEach((shot) => {
    shot.locationIds.forEach((locationId) => selected.add(locationId));
    if (shot.shotSpecs?.location?.locationId) {
      selected.add(shot.shotSpecs.location.locationId);
    }
  });
  return selected;
}



export function defaultLocationIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(shots.flatMap((shot) => shot.locationIds));
}



export function effectiveScopedLocationSelectionForShots(
  shots: SceneShot[],
  scopedLocationIds: Set<string>
): { locationIds: Set<string>; hasSelectedScopedLocation: boolean } {
  const selectedScopedLocationIds = new Set(
    [...selectedLocationIdsForShots(shots)].filter((locationId) =>
      scopedLocationIds.has(locationId)
    )
  );
  if (selectedScopedLocationIds.size > 0) {
    return {
      locationIds: selectedScopedLocationIds,
      hasSelectedScopedLocation: true,
    };
  }
  return {
    locationIds: new Set(
      [...defaultLocationIdsForShots(shots)].filter((locationId) =>
        scopedLocationIds.has(locationId)
      )
    ),
    hasSelectedScopedLocation: false,
  };
}



export function selectedLookbookSheetIdsForShots(
  shots: SceneShotReferenceCarrier[]
): Set<string> {
  const selected = new Set<string>();
  for (const shot of shots) {
    const lookbookSheetId = shot.shotSpecs?.lookbookReference?.lookbookSheetId;
    if (lookbookSheetId) {
      selected.add(lookbookSheetId);
    }
  }
  return selected;
}



export function selectedCharacterSheetAssetIdForShots(
  shots: SceneShotReferenceCarrier[],
  castMemberId: string
): string | null {
  for (const shot of shots) {
    const assetId = shot.shotSpecs?.castReferences?.characterSheetAssetIds?.[
      castMemberId
    ];
    if (assetId) {
      return assetId;
    }
  }
  return null;
}



export function selectedEnvironmentSheetAssetIdForShots(
  shots: SceneShotReferenceCarrier[],
  locationId: string
): string | null {
  for (const shot of shots) {
    const location = shot.shotSpecs?.location;
    if (location?.locationId === locationId && location.environmentSheetAssetId) {
      return location.environmentSheetAssetId;
    }
  }
  return null;
}



export function selectedLocationViewIdsForShots(
  shots: SceneShotReferenceCarrier[],
  locationId: string
): LocationAzimuthViewId[] {
  for (const shot of shots) {
    const location = shot.shotSpecs?.location;
    if (location?.locationId === locationId && location.viewIds?.length) {
      return [...new Set(location.viewIds)];
    }
  }
  return ['front'];
}
