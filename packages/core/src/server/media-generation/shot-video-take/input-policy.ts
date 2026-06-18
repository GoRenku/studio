import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  ShotVideoInputPolicyMode,
  ShotVideoTakeInputPolicy,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';

const inputPolicyModes = new Set<ShotVideoInputPolicyMode>([
  'reuse-selected',
  'regenerate',
  'auto',
]);

export function validateShotVideoTakeInputPolicy(
  value: unknown,
  path: string[] = ['inputPolicy']
): ShotVideoTakeInputPolicy {
  if (!isRecord(value)) {
    throwInputPolicyError(
      `${path.join('.')} must be an object.`,
      path,
      'Send an inputPolicy object with defaultMode and optional slotModes.'
    );
  }
  const defaultMode = readInputPolicyMode(value.defaultMode, [...path, 'defaultMode']);
  const slotModes =
    value.slotModes === undefined
      ? undefined
      : readInputPolicySlotModes(value.slotModes, [...path, 'slotModes']);
  return {
    defaultMode,
    ...(slotModes ? { slotModes } : {}),
  };
}

function readInputPolicySlotModes(
  value: unknown,
  path: string[]
): Record<string, ShotVideoInputPolicyMode> {
  if (!isRecord(value)) {
    throwInputPolicyError(
      `${path.join('.')} must be an object.`,
      path,
      'Send slotModes as a dependency-id to policy-mode map.'
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([dependencyId, mode]) => [
      dependencyId,
      readInputPolicyMode(mode, [...path, dependencyId]),
    ])
  );
}

function readInputPolicyMode(
  value: unknown,
  path: string[]
): ShotVideoInputPolicyMode {
  if (typeof value === 'string' && inputPolicyModes.has(value as ShotVideoInputPolicyMode)) {
    return value as ShotVideoInputPolicyMode;
  }
  throwInputPolicyError(
    `${path.join('.')} must be reuse-selected, regenerate, or auto.`,
    path,
    'Use one of the supported shot video input policy modes.'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function throwInputPolicyError(
  message: string,
  path: string[],
  suggestion: string
): never {
  throw new ProjectDataError('PROJECT_DATA434', message, {
    issues: [
      createDiagnosticError(
        'PROJECT_DATA434',
        message,
        { path },
        suggestion
      ),
    ],
    suggestion,
  });
}
