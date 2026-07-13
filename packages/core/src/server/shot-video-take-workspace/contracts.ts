import type { SceneShot } from '../../client/scene-shot-list.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../project-data-error.js';

export function requireContiguousShotIds(input: {
  shots: SceneShot[];
  shotIds: string[];
}): string[] {
  const order = new Map(input.shots.map((shot, index) => [shot.shotId, index]));
  const unique = new Set(input.shotIds);
  const canonical = input.shots
    .filter((shot) => unique.has(shot.shotId))
    .map((shot) => shot.shotId);
  const valid =
    input.shotIds.length > 0 &&
    unique.size === input.shotIds.length &&
    canonical.length === input.shotIds.length &&
    canonical.every((shotId, index) =>
      index === 0 || order.get(shotId) === (order.get(canonical[index - 1]!) ?? -2) + 1
    );
  if (!valid) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_SHOTS_INVALID',
      'Shot Video Takes require one or more unique, contiguous Shots from their source Shot List.',
      {
        issues: [
          createDiagnosticError(
            'CORE_SHOT_VIDEO_TAKE_SHOTS_INVALID',
            'Choose a contiguous run of Shots from the source Shot List.',
            { path: ['shotIds'] }
          ),
        ],
      }
    );
  }
  return canonical;
}
