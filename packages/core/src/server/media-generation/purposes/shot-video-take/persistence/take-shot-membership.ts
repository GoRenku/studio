import type {
  SceneShot,
} from '../../../../../client/index.js';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  buildDiagnosticResult,
} from '@gorenku/studio-diagnostics';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  issue,
} from '../shared/diagnostics.js';

export function normalizeSceneShotVideoTakeShotMembership(input: {
  shots: SceneShot[];
  shotIds: string[];
  path?: string[];
}): {
  shotIds: string[];
  issues: DiagnosticIssue[];
} {
  const path = input.path ?? ['shotIds'];
  const issues: DiagnosticIssue[] = [];
  if (input.shotIds.length === 0) {
    issues.push(
      issue(
        'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOTS_MISSING',
        'Shot Video Take requires at least one shot id.',
        path,
        'Choose one or more contiguous shot ids from the source Scene Shot List.'
      )
    );
    return { shotIds: [], issues };
  }

  const sourceOrder = new Map(
    input.shots.map((shot, index) => [shot.shotId, index])
  );
  const unique = new Set<string>();
  input.shotIds.forEach((shotId, index) => {
    if (!sourceOrder.has(shotId)) {
      issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOT_UNKNOWN',
          `Shot id is not in the source Scene Shot List: ${shotId}.`,
          [...path, String(index)],
          'Use only shot ids from the source Scene Shot List.'
        )
      );
    }
    if (unique.has(shotId)) {
      issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOT_DUPLICATE',
          `Shot id is duplicated in the Shot Video Take: ${shotId}.`,
          [...path, String(index)],
          'List each grouped shot id once.'
        )
      );
    }
    unique.add(shotId);
  });

  const canonicalShotIds = input.shots
    .filter((shot) => unique.has(shot.shotId))
    .map((shot) => shot.shotId);

  if (
    canonicalShotIds.length === input.shotIds.length &&
    !isContiguous(canonicalShotIds, sourceOrder)
  ) {
    issues.push(
      issue(
        'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOTS_NOT_CONTIGUOUS',
        'Shot Video Takes must use contiguous shot ids.',
        path,
        'Choose a continuous run of shots from the source Scene Shot List.'
      )
    );
  }

  return { shotIds: canonicalShotIds, issues };
}

export function requireNormalizedSceneShotVideoTakeShotMembership(input: {
  shots: SceneShot[];
  shotIds: string[];
  path?: string[];
}): string[] {
  const normalized = normalizeSceneShotVideoTakeShotMembership(input);
  const result = buildDiagnosticResult(normalized.issues);
  if (!result.valid) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_SHOT_MEMBERSHIP',
      'Shot Video Take shot membership is invalid.',
      {
        issues: result.issues,
        suggestion:
          'Choose one or more contiguous shot ids from the source Scene Shot List.',
      }
    );
  }
  return normalized.shotIds;
}

function isContiguous(
  shotIds: string[],
  sourceOrder: Map<string, number>
): boolean {
  if (shotIds.length < 2) {
    return true;
  }
  const indexes = shotIds.map((shotId) => sourceOrder.get(shotId) ?? -1);
  return indexes.every(
    (index, position) => position === 0 || index === indexes[position - 1] + 1
  );
}
