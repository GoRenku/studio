import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  ShotPlanCoverage,
  ShotPlanCoveredBeat,
} from '../../client/shot-plans.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import {
  readActiveSceneBeatsRevisionId,
  readSceneBeats,
  readSceneBeatsRevisionRecord,
} from '../database/access/scene-beats.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export function resolveShotPlanBeatContext(input: {
  session: DatabaseSession;
  sceneId: string;
  coverage: ShotPlanCoverage | null;
}): { coveredBeats: ShotPlanCoveredBeat[]; warnings: DiagnosticIssue[] } {
  if (input.coverage === null) {
    return { coveredBeats: [], warnings: [] };
  }
  const revision = readSceneBeatsRevisionRecord(
    input.session,
    input.coverage.sceneBeatsRevisionId
  );
  if (!revision) {
    return {
      coveredBeats: [],
      warnings: [
        warning(
          'CORE_SHOT_PLAN_SCENE_BEATS_REVISION_MISSING',
          `Referenced Scene Beats revision is unavailable: ${input.coverage.sceneBeatsRevisionId}.`
        ),
      ],
    };
  }

  const warnings: DiagnosticIssue[] = [];
  if (revision.sceneId !== input.sceneId) {
    warnings.push(
      warning(
        'CORE_SHOT_PLAN_SCENE_BEATS_REVISION_SCENE_MISMATCH',
        `Referenced Scene Beats revision belongs to Scene ${revision.sceneId}, not ${input.sceneId}.`
      )
    );
  }
  if (
    readActiveSceneBeatsRevisionId(input.session, revision.sceneId) !== revision.id
  ) {
    warnings.push(
      warning(
        'CORE_SHOT_PLAN_SCENE_BEATS_REVISION_INACTIVE',
        `Referenced Scene Beats revision is not active: ${revision.id}.`
      )
    );
  }
  const document = readSceneBeats({
    row: revision,
  });
  const beatsById = new Map(document.beats.map((beat) => [beat.id, beat]));
  const coveredBeats: ShotPlanCoveredBeat[] = [];
  input.coverage.beatIds.forEach((beatId, position) => {
    const beat = beatsById.get(beatId);
    if (beat) {
      const owner = {
        kind: 'sceneBeat' as const,
        sceneId: revision.sceneId,
        beatId,
      };
      const selectedAssetFileId = readSelectedAssetFileRecord(
        input.session,
        assetFileSelectionTargetKey(owner)
      )?.assetFileId;
      const storyboardImage = selectedAssetFileId
        ? readOwnedAssetFile(input.session, { owner, assetFileId: selectedAssetFileId })
        : null;
      const storyboardFile = storyboardImage ?? null;
      coveredBeats.push({
        beat,
        position,
        storyboardImage: storyboardImage && storyboardFile
          ? {
              assetFileId: storyboardFile.id,
            }
          : null,
      });
    } else {
      warnings.push(
        warning(
          'CORE_SHOT_PLAN_BEAT_MISSING',
          `Referenced Beat is unavailable in Scene Beats revision ${revision.id}: ${beatId}.`
        )
      );
    }
  });
  return { coveredBeats, warnings };
}

function warning(code: string, message: string): DiagnosticIssue {
  return createDiagnosticWarning(
    code,
    message,
    { path: ['shotPlan', 'coverage'] }
  );
}
