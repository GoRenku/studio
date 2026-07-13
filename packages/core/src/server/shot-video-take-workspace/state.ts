import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  SceneShot,
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeState,
  SceneShotVideoTakeStructureMode,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function emptyShotVideoTakeState(): SceneShotVideoTakeState {
  return {
    version: 3,
    structure: { mode: 'continuous', sharedDirection: {} },
  };
}

export function parseShotVideoTakeState(input: {
  value: string;
  shotIds: string[];
}): SceneShotVideoTakeState {
  let value: unknown;
  try {
    value = JSON.parse(input.value);
  } catch {
    throw stateError('Shot Video Take state is not valid JSON.');
  }
  if (!isRecord(value) || value.version !== 3 || !isRecord(value.structure)) {
    throw stateError('Shot Video Take state must use the current version-3 contract.');
  }
  const structure = value.structure;
  if (structure.mode === 'continuous' && isRecord(structure.sharedDirection)) {
    return {
      version: 3,
      structure: {
        mode: 'continuous',
        sharedDirection: cloneDirection(structure.sharedDirection),
      },
    };
  }
  if (structure.mode === 'multi-cut' && isRecord(structure.directionsByShotId)) {
    const directionsByShotId = structure.directionsByShotId;
    const actualIds = Object.keys(directionsByShotId);
    if (
      actualIds.length !== input.shotIds.length ||
      input.shotIds.some((shotId) => !isRecord(directionsByShotId[shotId]))
    ) {
      throw stateError(
        'Multi-cut Shot Video Take state must contain one direction for every grouped Shot.'
      );
    }
    return {
      version: 3,
      structure: {
        mode: 'multi-cut',
        directionsByShotId: Object.fromEntries(
          input.shotIds.map((shotId) => [
            shotId,
            cloneDirection(directionsByShotId[shotId] as Record<string, unknown>),
          ])
        ),
      },
    };
  }
  throw stateError('Shot Video Take state has an invalid structure.');
}

export function serializeShotVideoTakeState(state: SceneShotVideoTakeState): string {
  return JSON.stringify(state);
}

export function replaceShotVideoTakeMembershipState(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
}): SceneShotVideoTakeState {
  if (input.state.structure.mode === 'continuous') {
    return input.state;
  }
  return {
    version: 3,
    structure: {
      mode: 'multi-cut',
      directionsByShotId: Object.fromEntries(
        input.shotIds.map((shotId) => [
          shotId,
          input.state.structure.mode === 'multi-cut'
            ? input.state.structure.directionsByShotId[shotId] ?? {}
            : {},
        ])
      ),
    },
  };
}

export function setShotVideoTakeStructureState(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
  mode: SceneShotVideoTakeStructureMode;
  sourceShotId?: string;
}): SceneShotVideoTakeState {
  if (input.state.structure.mode === input.mode) {
    return input.state;
  }
  if (input.mode === 'multi-cut' && input.state.structure.mode === 'continuous') {
    const sharedDirection = input.state.structure.sharedDirection;
    return {
      version: 3,
      structure: {
        mode: 'multi-cut',
        directionsByShotId: Object.fromEntries(
          input.shotIds.map((shotId) => [
            shotId,
            structuredClone(sharedDirection),
          ])
        ),
      },
    };
  }
  if (input.state.structure.mode !== 'multi-cut') {
    throw stateError('Shot Video Take structure transition is invalid.');
  }
  const directions = input.shotIds.map(
    (shotId) => input.state.structure.mode === 'multi-cut'
      ? input.state.structure.directionsByShotId[shotId] ?? {}
      : {}
  );
  const first = directions[0] ?? {};
  const equivalent = directions.every(
    (direction) => stableJson(direction) === stableJson(first)
  );
  if (!equivalent && !input.sourceShotId) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT',
      'Divergent multi-cut directions require a source Shot before switching to Continuous Move.',
      {
        issues: [
          createDiagnosticError(
            'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT',
            'Choose which grouped Shot should become the shared direction.',
            { path: ['sourceShotId'] }
          ),
        ],
      }
    );
  }
  if (input.sourceShotId && !input.shotIds.includes(input.sourceShotId)) {
    throw stateError(`Source Shot is not in the take: ${input.sourceShotId}.`);
  }
  return {
    version: 3,
    structure: {
      mode: 'continuous',
      sharedDirection: structuredClone(
        input.sourceShotId
          ? input.state.structure.directionsByShotId[input.sourceShotId] ?? {}
          : first
      ),
    },
  };
}

export function setShotVideoTakeDirectionState(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
  shotId?: string;
  direction: SceneShotVideoTakeDirection | null;
}): SceneShotVideoTakeState {
  if (input.state.structure.mode === 'continuous') {
    if (input.shotId) {
      throw stateError('Continuous direction updates must not specify a Shot id.');
    }
    return {
      version: 3,
      structure: {
        mode: 'continuous',
        sharedDirection: pruneDirection(input.direction ?? {}),
      },
    };
  }
  if (!input.shotId || !input.shotIds.includes(input.shotId)) {
    throw stateError('Multi-cut direction updates require a grouped Shot id.');
  }
  return {
    version: 3,
    structure: {
      mode: 'multi-cut',
      directionsByShotId: {
        ...input.state.structure.directionsByShotId,
        [input.shotId]: pruneDirection(input.direction ?? {}),
      },
    },
  };
}

export function projectShotWithTakeDirection(input: {
  shot: SceneShot;
  state: SceneShotVideoTakeState;
}): SceneShot {
  const direction = input.state.structure.mode === 'continuous'
    ? input.state.structure.sharedDirection
    : input.state.structure.directionsByShotId[input.shot.shotId];
  if (!direction) {
    return input.shot;
  }
  return {
    ...input.shot,
    ...(direction.cast?.castMemberIds
      ? { castMemberIds: [...direction.cast.castMemberIds] }
      : {}),
    ...(direction.location?.locationId
      ? { locationIds: [direction.location.locationId] }
      : {}),
  };
}

function pruneDirection(direction: SceneShotVideoTakeDirection): SceneShotVideoTakeDirection {
  return JSON.parse(JSON.stringify(direction)) as SceneShotVideoTakeDirection;
}

function cloneDirection(value: Record<string, unknown>): SceneShotVideoTakeDirection {
  return structuredClone(value) as SceneShotVideoTakeDirection;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortRecord(value));
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecord);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortRecord(child)])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stateError(message: string): ProjectDataError {
  return new ProjectDataError('CORE_SHOT_VIDEO_TAKE_STATE_INVALID', message, {
    issues: [
      createDiagnosticError(
        'CORE_SHOT_VIDEO_TAKE_STATE_INVALID',
        message,
        { path: ['take', 'state'] }
      ),
    ],
  });
}
