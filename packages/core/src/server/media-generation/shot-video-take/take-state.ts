import type {
  SceneShot,
  SceneShotVideoTakeProductionState,
} from '../../../client/scene-shot-list.js';
import type {
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeReferenceSelections,
  SceneShotVideoTakeState,
  SceneShotVideoTakeStructure,
  SceneShotVideoTakeStructureMode,
} from '../../../client/shot-video-take.js';
import {
  sceneShotVideoTakeDirectionHasPromptFields,
} from '../../../client/shot-video-take.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { deriveTakeDirectionPromptStrings } from '../../../client/shot-spec-labels.js';
import { ProjectDataError } from '../../project-data-error.js';
import { carryTakeProductionStateForShotMembership } from './take-production-state.js';

export function emptySceneShotVideoTakeState(
  production: SceneShotVideoTakeProductionState = {}
): SceneShotVideoTakeState {
  return {
    version: 2,
    structure: {
      mode: 'continuous',
      sharedDirection: emptySceneShotVideoTakeDirection(),
    },
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
  return {
    ...input.state,
    structure: carrySceneShotVideoTakeStructureForShotMembership({
      structure: input.state.structure,
      shotIds: input.shotIds,
    }),
    production: carryTakeProductionStateForShotMembership({
      production: input.state.production,
      previousShotIds: input.previousShotIds,
      nextShotIds: input.shotIds,
    }),
  };
}

export function updateSceneShotVideoTakeDirection(input: {
  state: SceneShotVideoTakeState;
  shotId?: string;
  direction: SceneShotVideoTakeDirection | null;
}): SceneShotVideoTakeState {
  if (input.state.structure.mode === 'continuous') {
    if (input.shotId) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
        message: 'Continuous shot video take direction updates must not specify a shot id.',
        path: ['take', 'state', 'structure'],
        suggestion:
          'Update the shared direction for a continuous take, or switch the take to multi-cut first.',
      });
    }
    const direction = directionWithReferenceSelections({
      direction: input.direction,
      referenceSelections: sceneShotVideoTakeDirectionReferenceSelections(
        input.state.structure.sharedDirection
      ),
    });
    return {
      ...input.state,
      structure: {
        mode: 'continuous',
        sharedDirection: direction,
      },
    };
  }
  if (!input.shotId) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: 'Multi-cut shot video take direction updates must specify a shot id.',
      path: ['take', 'state', 'structure'],
      suggestion: 'Send the grouped shot id whose direction should be updated.',
    });
  }
  if (!Object.hasOwn(input.state.structure.directionsByShotId, input.shotId)) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: `Shot id is not in the multi-cut direction map: ${input.shotId}.`,
      path: ['take', 'state', 'structure', 'directionsByShotId'],
      suggestion: 'Refresh the take and update a direction for one of its grouped shots.',
    });
  }
  const direction = directionWithReferenceSelections({
    direction: input.direction,
    referenceSelections: sceneShotVideoTakeDirectionReferenceSelections(
      input.state.structure.directionsByShotId[input.shotId]
    ),
  });
  const directionsByShotId = {
    ...input.state.structure.directionsByShotId,
    [input.shotId]: direction,
  };
  return {
    ...input.state,
    structure: {
      mode: 'multi-cut',
      directionsByShotId,
    },
  };
}

export function updateSceneShotVideoTakeDirectionReferenceSelections(input: {
  state: SceneShotVideoTakeState;
  shotId?: string;
  referenceSelections: SceneShotVideoTakeReferenceSelections;
}): SceneShotVideoTakeState {
  if (input.state.structure.mode === 'continuous') {
    if (input.shotId) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
        message: 'Continuous shot video take reference updates must not specify a shot id.',
        path: ['take', 'state', 'structure'],
        suggestion:
          'Update the shared references for a continuous take, or switch the take to multi-cut first.',
      });
    }
    return {
      ...input.state,
      structure: {
        mode: 'continuous',
        sharedDirection: directionWithReferenceSelections({
          direction: input.state.structure.sharedDirection,
          referenceSelections: input.referenceSelections,
        }),
      },
    };
  }
  if (!input.shotId) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: 'Multi-cut shot video take reference updates must specify a shot id.',
      path: ['take', 'state', 'structure'],
      suggestion: 'Send the grouped shot id whose references should be updated.',
    });
  }
  if (!Object.hasOwn(input.state.structure.directionsByShotId, input.shotId)) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: `Shot id is not in the multi-cut direction map: ${input.shotId}.`,
      path: ['take', 'state', 'structure', 'directionsByShotId'],
      suggestion: 'Refresh the take and update references for one of its grouped shots.',
    });
  }
  return {
    ...input.state,
    structure: {
      mode: 'multi-cut',
      directionsByShotId: {
        ...input.state.structure.directionsByShotId,
        [input.shotId]: directionWithReferenceSelections({
          direction: input.state.structure.directionsByShotId[input.shotId],
          referenceSelections: input.referenceSelections,
        }),
      },
    },
  };
}

export function setSceneShotVideoTakeStructureMode(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
  mode: SceneShotVideoTakeStructureMode;
  sourceShotId?: string;
}): SceneShotVideoTakeState {
  const structure = input.state.structure;
  if (structure.mode === input.mode) {
    return input.state;
  }
  if (structure.mode === 'continuous' && input.mode === 'multi-cut') {
    const directionsByShotId = Object.fromEntries(
      input.shotIds.map((shotId) => [
        shotId,
        cloneSceneShotVideoTakeDirection(structure.sharedDirection),
      ])
    );
    return {
      ...input.state,
      structure: {
        mode: 'multi-cut',
        directionsByShotId,
      },
    };
  }
  if (structure.mode === 'multi-cut' && input.mode === 'continuous') {
    const directions = input.shotIds.map(
      (shotId) => structure.directionsByShotId[shotId] ?? emptySceneShotVideoTakeDirection()
    );
    const firstDirection = directions[0] ?? emptySceneShotVideoTakeDirection();
    if (
      directions.every((direction) =>
        sceneShotVideoTakeDirectionsEquivalent(direction, firstDirection)
      )
    ) {
      return {
        ...input.state,
        structure: {
          mode: 'continuous',
          sharedDirection: cloneSceneShotVideoTakeDirection(firstDirection),
        },
      };
    }
    if (!input.sourceShotId) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT',
        message:
          'Divergent multi-cut directions require a source shot before switching to continuous.',
        path: ['take', 'state', 'structure'],
        suggestion:
          'Choose which grouped shot should become the shared Continuous Move direction.',
      });
    }
    if (!input.shotIds.includes(input.sourceShotId)) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
        message: `Source shot is not in the Scene Shot Video Take: ${input.sourceShotId}.`,
        path: ['sourceShotId'],
        suggestion: 'Choose a source shot from the grouped take.',
      });
    }
    return {
      ...input.state,
      structure: {
        mode: 'continuous',
        sharedDirection: cloneSceneShotVideoTakeDirection(
          structure.directionsByShotId[input.sourceShotId] ??
            emptySceneShotVideoTakeDirection()
        ),
      },
    };
  }
  throwStructureError({
    code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_UNKNOWN_MODE',
    message: `Unknown shot video take structure mode: ${input.mode}.`,
    path: ['mode'],
    suggestion: 'Use continuous or multi-cut.',
  });
}

export function applyTakeStateToShot(input: {
  shot: SceneShot;
  state: SceneShotVideoTakeState;
}): SceneShot {
  const design = sceneShotVideoTakeDirectionForShot({
    state: input.state,
    shotId: input.shot.shotId,
  });
  const shot: SceneShot = { ...input.shot };
  if (design?.cast?.castMemberIds) {
    shot.castMemberIds = [...design.cast.castMemberIds];
  }
  if (design?.location?.locationId) {
    shot.locationIds = [design.location.locationId];
  }
  const hasPromptFields = sceneShotVideoTakeDirectionHasPromptFields(design);
  if (!hasPromptFields) {
    return shot;
  }
  const derived = deriveTakeDirectionPromptStrings(
    design
  );
  if (derived.shotType) {
    shot.shotType = derived.shotType;
  } else if (!derived.shotType) {
    shot.shotType = 'Unspecified';
  }
  setOptionalString(shot, 'cameraAngle', derived.cameraAngle);
  setOptionalString(shot, 'framing', derived.framing);
  setOptionalString(shot, 'lensIntent', derived.lensIntent);
  setOptionalString(shot, 'cameraMovement', derived.cameraMovement);
  return shot;
}

export function emptySceneShotVideoTakeDirection(): SceneShotVideoTakeDirection {
  return {
    referenceSelections: emptyReferenceSelections(),
  };
}

export function sceneShotVideoTakeDirectionForShot(input: {
  state: SceneShotVideoTakeState;
  shotId: string;
}): SceneShotVideoTakeDirection {
  if (input.state.structure.mode === 'continuous') {
    return input.state.structure.sharedDirection;
  }
  return (
    input.state.structure.directionsByShotId[input.shotId] ??
    emptySceneShotVideoTakeDirection()
  );
}

export function resolveSceneShotVideoTakeEditorDirection(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
  selectedShotId?: string;
}): SceneShotVideoTakeDirection {
  if (input.state.structure.mode === 'continuous') {
    if (input.selectedShotId) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
        message: 'Continuous shot video take editor reads must not specify a shot id.',
        path: ['selectedShotId'],
        suggestion:
          'Read the shared direction for a continuous take, or switch the take to multi-cut first.',
      });
    }
    return input.state.structure.sharedDirection;
  }
  if (!input.selectedShotId) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: 'Multi-cut shot video take editor reads must specify a grouped shot id.',
      path: ['selectedShotId'],
      suggestion: 'Send the grouped shot id whose editor direction should be read.',
    });
  }
  if (!input.shotIds.includes(input.selectedShotId)) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: `Selected shot id is not in the Scene Shot Video Take: ${input.selectedShotId}.`,
      path: ['selectedShotId'],
      suggestion: 'Refresh the take and select one of its grouped shots.',
    });
  }
  const direction = input.state.structure.directionsByShotId[input.selectedShotId];
  if (!direction) {
    throwStructureError({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
      message: `Selected shot id is missing from the multi-cut direction map: ${input.selectedShotId}.`,
      path: ['take', 'state', 'structure', 'directionsByShotId'],
      suggestion: 'Refresh the take and select one of its grouped shots.',
    });
  }
  return direction;
}

export function resolveSceneShotVideoTakeReferenceMutationScope(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
  shotId?: string;
}): {
  shotId?: string;
  direction: SceneShotVideoTakeDirection;
  referenceSelections: SceneShotVideoTakeReferenceSelections;
} {
  const direction = resolveSceneShotVideoTakeEditorDirection({
    state: input.state,
    shotIds: input.shotIds,
    selectedShotId: input.shotId,
  });
  return {
    ...(input.state.structure.mode === 'multi-cut' ? { shotId: input.shotId } : {}),
    direction,
    referenceSelections: sceneShotVideoTakeDirectionReferenceSelections(direction),
  };
}

export function sceneShotVideoTakeDirectionReferenceSelections(
  direction: SceneShotVideoTakeDirection
): SceneShotVideoTakeReferenceSelections {
  return direction.referenceSelections ?? emptyReferenceSelections();
}

export function sceneShotVideoTakeGenerationDirections(input: {
  structure: SceneShotVideoTakeStructure;
  shotIds: string[];
}): SceneShotVideoTakeDirection[] {
  const structure = input.structure;
  if (structure.mode === 'continuous') {
    return [structure.sharedDirection];
  }
  return input.shotIds.map((shotId) => {
    const direction = structure.directionsByShotId[shotId];
    if (!direction) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
        message: `Shot id is missing from the multi-cut direction map: ${shotId}.`,
        path: ['take', 'state', 'structure', 'directionsByShotId'],
        suggestion: 'Repair the take state so every grouped shot has one direction.',
      });
    }
    return direction;
  });
}

export function sceneShotVideoTakeStructureDirections(
  structure: SceneShotVideoTakeStructure
): SceneShotVideoTakeDirection[] {
  if (structure.mode === 'continuous') {
    return [structure.sharedDirection];
  }
  return Object.values(structure.directionsByShotId);
}

export function validateSceneShotVideoTakeStructure(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
}): void {
  const structure = input.state.structure;
  if (structure.mode === 'continuous') {
    if (!structure.sharedDirection) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_INVALID_CONTINUOUS_STATE',
        message: 'Continuous shot video take state is missing its shared direction.',
        path: ['take', 'state', 'structure', 'sharedDirection'],
        suggestion: 'Repair the take state so continuous mode has one shared direction.',
      });
    }
    return;
  }
  if (structure.mode === 'multi-cut') {
    const expectedShotIds = new Set(input.shotIds);
    const actualShotIds = Object.keys(structure.directionsByShotId);
    const missingShotIds = input.shotIds.filter(
      (shotId) => !Object.hasOwn(structure.directionsByShotId, shotId)
    );
    const extraShotIds = actualShotIds.filter(
      (shotId) => !expectedShotIds.has(shotId)
    );
    if (missingShotIds.length > 0 || extraShotIds.length > 0) {
      throwStructureError({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_INVALID_MULTI_CUT_STATE',
        message: 'Multi-cut shot video take state must have one direction for every grouped shot.',
        path: ['take', 'state', 'structure', 'directionsByShotId'],
        suggestion:
          'Repair the take state so direction ids exactly match the grouped shot ids.',
      });
    }
    return;
  }
  throwStructureError({
    code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_UNKNOWN_MODE',
    message: 'Shot video take state has an unknown structure mode.',
    path: ['take', 'state', 'structure', 'mode'],
    suggestion: 'Use continuous or multi-cut.',
  });
}

export function emptyReferenceSelections(): SceneShotVideoTakeReferenceSelections {
  return {
    dependencyInclusions: {},
    selectedCharacterSheetAssetIds: {},
    referencedLocationSheetAssetIds: {},
    selectedLookbookSheetIds: [],
    selectedDialogueAudioTakeIds: {},
  };
}

function carrySceneShotVideoTakeStructureForShotMembership(input: {
  structure: SceneShotVideoTakeStructure;
  shotIds: string[];
}): SceneShotVideoTakeStructure {
  if (input.structure.mode === 'continuous') {
    return input.structure;
  }
  const directionsByShotId: Record<string, SceneShotVideoTakeDirection> = {};
  for (const shotId of input.shotIds) {
    directionsByShotId[shotId] =
      input.structure.directionsByShotId[shotId] ??
      emptySceneShotVideoTakeDirection();
  }
  return {
    mode: 'multi-cut',
    directionsByShotId,
  };
}

function pruneSceneShotVideoTakeDirection(
  direction: SceneShotVideoTakeDirection
): SceneShotVideoTakeDirection {
  const pruned = JSON.parse(
    JSON.stringify(direction)
  ) as SceneShotVideoTakeDirection;
  pruned.referenceSelections ??= emptyReferenceSelections();
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

function directionWithReferenceSelections(input: {
  direction: SceneShotVideoTakeDirection | null | undefined;
  referenceSelections: SceneShotVideoTakeReferenceSelections;
}): SceneShotVideoTakeDirection {
  const direction = pruneSceneShotVideoTakeDirection(
    input.direction ?? emptySceneShotVideoTakeDirection()
  );
  direction.referenceSelections = cloneJson(input.referenceSelections);
  return direction;
}

function cloneSceneShotVideoTakeDirection(
  direction: SceneShotVideoTakeDirection
): SceneShotVideoTakeDirection {
  return cloneJson(direction);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sceneShotVideoTakeDirectionsEquivalent(
  left: SceneShotVideoTakeDirection,
  right: SceneShotVideoTakeDirection
): boolean {
  return JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJsonValue(child)])
    );
  }
  return value;
}

function throwStructureError(input: {
  code: string;
  message: string;
  path: string[];
  suggestion: string;
}): never {
  throw new ProjectDataError(input.code, input.message, {
    issues: [
      createDiagnosticError(
        input.code,
        input.message,
        { path: input.path },
        input.suggestion
      ),
    ],
    suggestion: input.suggestion,
  });
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
