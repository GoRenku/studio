import type {
  SceneShot,
  SceneShotVideoTakeState,
} from '../../../client/index.js';
import type { SceneReferenceScope } from './reference-scope.js';

export function selectedCastIdsForShots(
  shots: SceneShot[]
): Set<string> {
  return new Set(shots.flatMap((shot) => shot.castMemberIds));
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
  shots: SceneShot[]
): Set<string> {
  const selected = new Set<string>();
  shots.forEach((shot) => {
    shot.locationIds.forEach((locationId) => selected.add(locationId));
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



export function selectedLookbookSheetIdsForTakeState(
  state: SceneShotVideoTakeState
): Set<string> {
  return new Set(state.referenceSelections.selectedLookbookSheetIds);
}



export function selectedCharacterSheetAssetIdForTakeState(
  state: SceneShotVideoTakeState,
  castMemberId: string
): string | null {
  return state.referenceSelections.selectedCharacterSheetAssetIds[castMemberId] ?? null;
}



export function referencedEnvironmentSheetAssetIdsForTakeState(
  state: SceneShotVideoTakeState,
  locationId: string
): string[] {
  return state.referenceSelections.referencedLocationSheetAssetIds[locationId] ?? [];
}
