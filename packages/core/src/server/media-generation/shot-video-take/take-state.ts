import type {
  SceneShot,
  SceneShotWithLegacyShotSpecs,
  ShotSpecs,
  ShotVideoTakeGenerationProduction,
} from '../../../client/scene-shot-list.js';
import type {
  SceneShotVideoTakeReferenceSelections,
  SceneShotVideoTakeShotDesign,
  SceneShotVideoTakeState,
} from '../../../client/shot-video-take-generation.js';
import { deriveShotSpecPromptStrings } from '../../../client/shot-spec-labels.js';

export function emptySceneShotVideoTakeState(
  production: ShotVideoTakeGenerationProduction = {}
): SceneShotVideoTakeState {
  return {
    version: 1,
    shotDesignByShotId: {},
    referenceSelections: emptyReferenceSelections(),
    production,
  };
}

export function buildSceneShotVideoTakeState(input: {
  shots: SceneShot[];
  shotIds: string[];
  production?: ShotVideoTakeGenerationProduction;
}): SceneShotVideoTakeState {
  const state = emptySceneShotVideoTakeState(input.production ?? {});
  for (const shot of input.shots) {
    if (!input.shotIds.includes(shot.shotId)) {
      continue;
    }
    const design = shotSpecsToTakeShotDesign(
      (shot as SceneShotWithLegacyShotSpecs).shotSpecs
    );
    if (Object.keys(design).length > 0) {
      state.shotDesignByShotId[shot.shotId] = design;
    }
    copyShotReferenceSelections(
      state.referenceSelections,
      (shot as SceneShotWithLegacyShotSpecs).shotSpecs
    );
  }
  return state;
}

export function updateSceneShotVideoTakeStateProduction(input: {
  state: SceneShotVideoTakeState;
  production: ShotVideoTakeGenerationProduction;
}): SceneShotVideoTakeState {
  return {
    ...input.state,
    production: input.production,
  };
}

export function carrySceneShotVideoTakeStateForShotMembership(input: {
  state: SceneShotVideoTakeState;
  shots: SceneShot[];
  shotIds: string[];
  production: ShotVideoTakeGenerationProduction;
}): SceneShotVideoTakeState {
  const shotsById = new Map(input.shots.map((shot) => [shot.shotId, shot]));
  const shotDesignByShotId: SceneShotVideoTakeState['shotDesignByShotId'] = {};
  for (const shotId of input.shotIds) {
    const existing = input.state.shotDesignByShotId[shotId];
    if (existing) {
      shotDesignByShotId[shotId] = existing;
      continue;
    }
    const shot = shotsById.get(shotId);
    const design = shotSpecsToTakeShotDesign(
      (shot as SceneShotWithLegacyShotSpecs | undefined)?.shotSpecs
    );
    if (Object.keys(design).length > 0) {
      shotDesignByShotId[shotId] = design;
    }
  }
  return {
    ...input.state,
    shotDesignByShotId,
    production: input.production,
  };
}

export function updateSceneShotVideoTakeShotSpecs(input: {
  state: SceneShotVideoTakeState;
  shotId: string;
  shotSpecs: ShotSpecs | null;
}): SceneShotVideoTakeState {
  const shotDesignByShotId = { ...input.state.shotDesignByShotId };
  const design = shotSpecsToTakeShotDesign(input.shotSpecs ?? undefined);
  if (input.shotSpecs && Object.keys(design).length > 0) {
    shotDesignByShotId[input.shotId] = design;
  } else {
    delete shotDesignByShotId[input.shotId];
  }
  return {
    ...input.state,
    shotDesignByShotId,
    referenceSelections: referenceSelectionsForShotSpecs({
      current: input.state.referenceSelections,
      shotSpecs: input.shotSpecs,
    }),
  };
}

export function takeShotDesignToShotSpecs(
  design: SceneShotVideoTakeShotDesign | undefined
): ShotSpecs | undefined {
  if (!design) {
    return undefined;
  }
  const shotSpecs: ShotSpecs = {};
  if (design.composition) {
    shotSpecs.shotSize = design.composition.shotSize;
    shotSpecs.subjectFraming = design.composition.subjectFraming;
    shotSpecs.cameraAngle = design.composition.cameraAngle;
    shotSpecs.dutch = design.composition.dutch;
    shotSpecs.lens = design.composition.lens;
    if (design.composition.customComposition) {
      shotSpecs.custom = {
        ...shotSpecs.custom,
        composition: design.composition.customComposition,
      };
    }
  }
  if (design.motion) {
    shotSpecs.movement = {
      movement: design.motion.movement,
      secondary: design.motion.secondary,
      directions: design.motion.directions,
      track: design.motion.track,
      rig: design.motion.rig,
    };
    if (design.motion.customMotion) {
      shotSpecs.custom = {
        ...shotSpecs.custom,
        movement: design.motion.customMotion,
      };
    }
  }
  if (design.cast) {
    shotSpecs.castReferences = {
      castMemberIds: design.cast.castMemberIds,
      characterSheetAssetIds: design.cast.characterSheetAssetIds,
    };
  }
  if (design.location) {
    shotSpecs.location = {
      locationId: design.location.locationId,
      environmentSheetAssetId: design.location.environmentSheetAssetId,
      viewIds: design.location.viewIds,
    };
  }
  if (design.lookbook) {
    shotSpecs.lookbookReference = {
      lookbookSheetId: design.lookbook.lookbookSheetId,
    };
  }
  if (design.referenceImages) {
    shotSpecs.referenceImages = {
      customReferenceInputIds: design.referenceImages.customMediaInputIds,
    };
  }
  return pruneShotSpecs(shotSpecs);
}

export function applyTakeStateToShot(input: {
  shot: SceneShot;
  state: SceneShotVideoTakeState;
}): SceneShotWithLegacyShotSpecs {
  const design = input.state.shotDesignByShotId[input.shot.shotId];
  const shotSpecs = applyReferenceSelectionsToShotSpecs({
    shot: input.shot,
    shotSpecs: takeShotDesignToShotSpecs(design),
    referenceSelections: input.state.referenceSelections,
  });
  const shot: SceneShotWithLegacyShotSpecs = { ...input.shot };
  if (shotSpecs) {
    shot.shotSpecs = shotSpecs;
  } else {
    delete shot.shotSpecs;
  }
  const derived = deriveShotSpecPromptStrings(shotSpecs);
  if (derived.shotType) {
    shot.shotType = derived.shotType;
  } else if (shotSpecs && !derived.shotType) {
    shot.shotType = 'Unspecified';
  }
  setOptionalString(shot, 'cameraAngle', derived.cameraAngle);
  setOptionalString(shot, 'framing', derived.framing);
  setOptionalString(shot, 'lensIntent', derived.lensIntent);
  setOptionalString(shot, 'cameraMovement', derived.cameraMovement);
  return shot;
}

function applyReferenceSelectionsToShotSpecs(input: {
  shot: SceneShot;
  shotSpecs: ShotSpecs | undefined;
  referenceSelections: SceneShotVideoTakeReferenceSelections;
}): ShotSpecs | undefined {
  const shotSpecs: ShotSpecs = { ...(input.shotSpecs ?? {}) };
  if (Object.keys(input.referenceSelections.dependencyInclusions).length > 0) {
    shotSpecs.referenceInclusions = {
      ...input.referenceSelections.dependencyInclusions,
    };
  }

  const selectedCastMemberIds =
    shotSpecs.castReferences?.castMemberIds ?? input.shot.castMemberIds;
  const characterSheetAssetIds = Object.fromEntries(
    selectedCastMemberIds.flatMap((castMemberId) => {
      const assetId =
        input.referenceSelections.selectedCharacterSheetAssetIds[castMemberId];
      return assetId ? [[castMemberId, assetId]] : [];
    })
  );
  if (
    selectedCastMemberIds.length > 0 ||
    Object.keys(characterSheetAssetIds).length > 0
  ) {
    shotSpecs.castReferences = {
      ...(shotSpecs.castReferences ?? {}),
      castMemberIds: selectedCastMemberIds,
      characterSheetAssetIds:
        Object.keys(characterSheetAssetIds).length > 0
          ? characterSheetAssetIds
          : shotSpecs.castReferences?.characterSheetAssetIds,
    };
  }

  const selectedLocationId =
    shotSpecs.location?.locationId ?? input.shot.locationIds[0] ?? null;
  if (selectedLocationId) {
    const environmentSheetAssetId =
      input.referenceSelections.selectedLocationSheetAssetIds[selectedLocationId];
    const viewIds =
      input.referenceSelections.selectedLocationViewIds[selectedLocationId];
    if (environmentSheetAssetId || viewIds?.length || shotSpecs.location) {
      shotSpecs.location = {
        ...(shotSpecs.location ?? {}),
        locationId: selectedLocationId,
        environmentSheetAssetId:
          environmentSheetAssetId ?? shotSpecs.location?.environmentSheetAssetId,
        viewIds: viewIds?.length ? viewIds : shotSpecs.location?.viewIds,
      };
    }
  }

  if (
    !shotSpecs.lookbookReference?.lookbookSheetId &&
    input.referenceSelections.selectedLookbookSheetIds.length > 0
  ) {
    shotSpecs.lookbookReference = {
      lookbookSheetId: input.referenceSelections.selectedLookbookSheetIds[0],
    };
  }

  return pruneShotSpecs(shotSpecs);
}

function shotSpecsToTakeShotDesign(
  shotSpecs: ShotSpecs | undefined
): SceneShotVideoTakeShotDesign {
  if (!shotSpecs) {
    return {};
  }
  const design: SceneShotVideoTakeShotDesign = {};
  if (
    shotSpecs.shotSize ||
    shotSpecs.subjectFraming?.length ||
    shotSpecs.cameraAngle ||
    shotSpecs.dutch ||
    shotSpecs.lens ||
    shotSpecs.custom?.composition
  ) {
    design.composition = {
      shotSize: shotSpecs.shotSize,
      subjectFraming: shotSpecs.subjectFraming,
      cameraAngle: shotSpecs.cameraAngle,
      dutch: shotSpecs.dutch,
      lens: shotSpecs.lens,
      customComposition: shotSpecs.custom?.composition,
    };
  }
  if (
    shotSpecs.movement ||
    shotSpecs.custom?.movement
  ) {
    design.motion = {
      movement: shotSpecs.movement?.movement,
      secondary: shotSpecs.movement?.secondary,
      directions: shotSpecs.movement?.directions,
      track: shotSpecs.movement?.track,
      rig: shotSpecs.movement?.rig,
      customMotion: shotSpecs.custom?.movement,
    };
  }
  if (shotSpecs.castReferences) {
    design.cast = { ...shotSpecs.castReferences };
  }
  if (shotSpecs.location) {
    design.location = { ...shotSpecs.location };
  }
  if (shotSpecs.lookbookReference) {
    design.lookbook = {
      lookbookSheetId: shotSpecs.lookbookReference.lookbookSheetId,
    };
  }
  if (shotSpecs.referenceImages) {
    design.referenceImages = {
      customMediaInputIds: shotSpecs.referenceImages.customReferenceInputIds,
    };
  }
  return pruneTakeShotDesign(design);
}

function emptyReferenceSelections(): SceneShotVideoTakeReferenceSelections {
  return {
    dependencyInclusions: {},
    selectedCharacterSheetAssetIds: {},
    selectedLocationSheetAssetIds: {},
    selectedLocationViewIds: {},
    selectedLookbookSheetIds: [],
    selectedDialogueAudioTakeIds: {},
  };
}

function referenceSelectionsForShotSpecs(input: {
  current: SceneShotVideoTakeReferenceSelections;
  shotSpecs: ShotSpecs | null;
}): SceneShotVideoTakeReferenceSelections {
  const next: SceneShotVideoTakeReferenceSelections = {
    dependencyInclusions: { ...input.current.dependencyInclusions },
    selectedCharacterSheetAssetIds: {
      ...input.current.selectedCharacterSheetAssetIds,
    },
    selectedLocationSheetAssetIds: {
      ...input.current.selectedLocationSheetAssetIds,
    },
    selectedLocationViewIds: { ...input.current.selectedLocationViewIds },
    selectedLookbookSheetIds: [...input.current.selectedLookbookSheetIds],
    selectedDialogueAudioTakeIds: {
      ...input.current.selectedDialogueAudioTakeIds,
    },
  };
  copyShotReferenceSelections(next, input.shotSpecs ?? undefined);
  return next;
}

function copyShotReferenceSelections(
  selections: SceneShotVideoTakeReferenceSelections,
  shotSpecs: ShotSpecs | undefined
): void {
  Object.assign(
    selections.dependencyInclusions,
    shotSpecs?.referenceInclusions ?? {}
  );
  Object.assign(
    selections.selectedCharacterSheetAssetIds,
    shotSpecs?.castReferences?.characterSheetAssetIds ?? {}
  );
  if (shotSpecs?.location?.locationId && shotSpecs.location.environmentSheetAssetId) {
    selections.selectedLocationSheetAssetIds[shotSpecs.location.locationId] =
      shotSpecs.location.environmentSheetAssetId;
  }
  if (shotSpecs?.location?.locationId && shotSpecs.location.viewIds) {
    selections.selectedLocationViewIds[shotSpecs.location.locationId] = [
      ...shotSpecs.location.viewIds,
    ];
  }
  if (shotSpecs?.lookbookReference?.lookbookSheetId) {
    selections.selectedLookbookSheetIds = Array.from(
      new Set([
        ...selections.selectedLookbookSheetIds,
        shotSpecs.lookbookReference.lookbookSheetId,
      ])
    );
  }
}

function pruneTakeShotDesign(
  design: SceneShotVideoTakeShotDesign
): SceneShotVideoTakeShotDesign {
  return JSON.parse(JSON.stringify(design)) as SceneShotVideoTakeShotDesign;
}

function pruneShotSpecs(shotSpecs: ShotSpecs): ShotSpecs | undefined {
  const pruned = JSON.parse(JSON.stringify(shotSpecs)) as ShotSpecs;
  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

function setOptionalString<K extends keyof SceneShot>(
  shot: SceneShot,
  key: K,
  value: string | undefined
): void {
  if (value) {
    shot[key] = value as SceneShot[K];
  } else {
    delete shot[key];
  }
}
