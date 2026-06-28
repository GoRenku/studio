import type {
  SceneShot,
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeState,
} from '../../../client/index.js';
import type { SceneReferenceScope } from './reference-scope.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
  sceneShotVideoTakeGenerationDirections,
} from './take-state.js';

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



export function selectedLookbookSheetIdsForGenerationTakeState(
  state: SceneShotVideoTakeState,
  shotIds: string[]
): Set<string> {
  return new Set(
    sceneShotVideoTakeGenerationDirections({
      structure: state.structure,
      shotIds,
    }).flatMap(
      (direction) =>
        sceneShotVideoTakeDirectionReferenceSelections(direction)
          .selectedLookbookSheetIds
    )
  );
}

export function selectedLookbookSheetIdForEditorDirection(
  direction: SceneShotVideoTakeDirection
): string | null {
  return (
    sceneShotVideoTakeDirectionReferenceSelections(direction)
      .selectedLookbookSheetIds[0] ?? null
  );
}

export function selectedCharacterSheetAssetIdForEditorDirection(
  direction: SceneShotVideoTakeDirection,
  castMemberId: string
): string | null {
  return (
    sceneShotVideoTakeDirectionReferenceSelections(direction)
      .selectedCharacterSheetAssetIds[castMemberId] ?? null
  );
}

export function selectedCharacterSheetAssetIdsForGenerationTakeState(
  state: SceneShotVideoTakeState,
  shotIds: string[],
  castMemberId: string
): string[] {
  return [
    ...new Set(
      sceneShotVideoTakeGenerationDirections({
        structure: state.structure,
        shotIds,
      }).flatMap((direction) => {
        const selected = sceneShotVideoTakeDirectionReferenceSelections(direction)
          .selectedCharacterSheetAssetIds[castMemberId];
        return selected ? [selected] : [];
      })
    ),
  ];
}



export function selectedLocationSheetAssetIdForEditorDirection(
  direction: SceneShotVideoTakeDirection,
  locationId: string
): string | null {
  return (
    sceneShotVideoTakeDirectionReferenceSelections(direction)
      .selectedLocationSheetAssetIds[locationId] ?? null
  );
}

export function selectedLocationSheetAssetIdsForGenerationTakeState(
  state: SceneShotVideoTakeState,
  shotIds: string[],
  locationId: string
): string[] {
  return [
    ...new Set(
      sceneShotVideoTakeGenerationDirections({
        structure: state.structure,
        shotIds,
      }).flatMap(
        (direction) => {
          const selected = sceneShotVideoTakeDirectionReferenceSelections(direction)
            .selectedLocationSheetAssetIds[locationId];
          return selected ? [selected] : [];
        }
      )
    ),
  ];
}
