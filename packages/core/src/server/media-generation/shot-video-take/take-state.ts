import type {
  SceneShot,
  SceneShotVideoTakeProductionState,
} from '../../../client/scene-shot-list.js';
import type {
  SceneShotVideoTakeReferenceSelections,
  SceneShotVideoTakeShotDesign,
  SceneShotVideoTakeState,
} from '../../../client/shot-video-take.js';
import { deriveTakeShotDesignPromptStrings } from '../../../client/shot-spec-labels.js';
import { carryTakeProductionStateForShotMembership } from './take-production-state.js';

export function emptySceneShotVideoTakeState(
  production: SceneShotVideoTakeProductionState = {}
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
  production?: SceneShotVideoTakeProductionState;
}): SceneShotVideoTakeState {
  return emptySceneShotVideoTakeState(input.production ?? {});
}

export function updateSceneShotVideoTakeStateProduction(input: {
  state: SceneShotVideoTakeState;
  production: SceneShotVideoTakeProductionState;
}): SceneShotVideoTakeState {
  return {
    ...input.state,
    production: input.production,
  };
}

export function carrySceneShotVideoTakeStateForShotMembership(input: {
  state: SceneShotVideoTakeState;
  shots: SceneShot[];
  previousShotIds: string[];
  shotIds: string[];
}): SceneShotVideoTakeState {
  const shotDesignByShotId: SceneShotVideoTakeState['shotDesignByShotId'] = {};
  for (const shotId of input.shotIds) {
    const existing = input.state.shotDesignByShotId[shotId];
    if (existing) {
      shotDesignByShotId[shotId] = existing;
    }
  }
  return {
    ...input.state,
    shotDesignByShotId,
    production: carryTakeProductionStateForShotMembership({
      production: input.state.production,
      previousShotIds: input.previousShotIds,
      nextShotIds: input.shotIds,
    }),
  };
}

export function updateSceneShotVideoTakeShotDesign(input: {
  state: SceneShotVideoTakeState;
  shotId: string;
  shotDesign: SceneShotVideoTakeShotDesign | null;
}): SceneShotVideoTakeState {
  const shotDesignByShotId = { ...input.state.shotDesignByShotId };
  const design = pruneTakeShotDesign(input.shotDesign ?? {});
  if (input.shotDesign && Object.keys(design).length > 0) {
    shotDesignByShotId[input.shotId] = design;
  } else {
    delete shotDesignByShotId[input.shotId];
  }
  return {
    ...input.state,
    shotDesignByShotId,
  };
}

export function applyTakeStateToShot(input: {
  shot: SceneShot;
  state: SceneShotVideoTakeState;
}): SceneShot {
  const design = input.state.shotDesignByShotId[input.shot.shotId];
  const shot: SceneShot = { ...input.shot };
  if (design?.cast?.castMemberIds) {
    shot.castMemberIds = [...design.cast.castMemberIds];
  }
  if (design?.location?.locationId) {
    shot.locationIds = [design.location.locationId];
  }
  const derived = deriveTakeShotDesignPromptStrings(design);
  if (derived.shotType) {
    shot.shotType = derived.shotType;
  } else if (design && !derived.shotType) {
    shot.shotType = 'Unspecified';
  }
  setOptionalString(shot, 'cameraAngle', derived.cameraAngle);
  setOptionalString(shot, 'framing', derived.framing);
  setOptionalString(shot, 'lensIntent', derived.lensIntent);
  setOptionalString(shot, 'cameraMovement', derived.cameraMovement);
  return shot;
}

function emptyReferenceSelections(): SceneShotVideoTakeReferenceSelections {
  return {
    dependencyInclusions: {},
    selectedCharacterSheetAssetIds: {},
    referencedLocationSheetAssetIds: {},
    selectedLookbookSheetIds: [],
    selectedDialogueAudioTakeIds: {},
  };
}

function pruneTakeShotDesign(
  design: SceneShotVideoTakeShotDesign
): SceneShotVideoTakeShotDesign {
  const pruned = JSON.parse(
    JSON.stringify(design)
  ) as SceneShotVideoTakeShotDesign;
  pruneCustomString(pruned.composition, 'customComposition');
  if (
    pruned.composition?.lens &&
    Object.keys(pruned.composition.lens).length === 0
  ) {
    delete pruned.composition.lens;
  }
  if (pruned.composition && Object.keys(pruned.composition).length === 0) {
    delete pruned.composition;
  }
  pruneCustomString(pruned.motion, 'customMotion');
  if (pruned.motion && Object.keys(pruned.motion).length === 0) {
    delete pruned.motion;
  }
  return pruned;
}

function pruneCustomString(
  owner: Record<string, unknown> | undefined,
  key: string
): void {
  if (!owner) {
    return;
  }
  const values = owner as Record<string, string | undefined>;
  const trimmed = values[key]?.trim();
  if (trimmed) {
    values[key] = trimmed;
  } else {
    delete values[key];
  }
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
