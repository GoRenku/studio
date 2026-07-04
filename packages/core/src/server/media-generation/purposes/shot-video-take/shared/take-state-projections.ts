import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeReferenceSelections,
  SceneShotVideoTakeState,
  SceneShotVideoTakeStructure,
} from '../../../../../client/shot-video-take.js';
import { ProjectDataError } from '../../../../project-data-error.js';

export function emptyReferenceSelections(): SceneShotVideoTakeReferenceSelections {
  return {
    dependencyInclusions: {},
    selectedCharacterSheetAssetIds: {},
    selectedLocationSheetAssetIds: {},
    selectedLookbookSheetIds: [],
    selectedDialogueAudioTakeIds: {},
  };
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
