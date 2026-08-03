import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  ShotPlanCoverage,
  ShotPlanCoveredBeat,
} from '../../client/shot-plans.js';
import { assetOwnerKey } from '../assets/owner-keys.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import {
  readActiveSceneBeatSheetId,
  readSceneBeatSheetDocument,
  readSceneBeatSheetRecord,
} from '../database/access/scene-beat-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';

export function resolveShotPlanBeatContext(input: {
  session: DatabaseSession;
  sceneId: string;
  coverage: ShotPlanCoverage | null;
}): { coveredBeats: ShotPlanCoveredBeat[]; warnings: DiagnosticIssue[] } {
  if (input.coverage === null) {
    return { coveredBeats: [], warnings: [] };
  }
  const beatSheet = readSceneBeatSheetRecord(
    input.session,
    input.coverage.beatSheetId
  );
  if (!beatSheet) {
    return {
      coveredBeats: [],
      warnings: [
        warning(
          'CORE_SHOT_PLAN_BEAT_SHEET_MISSING',
          `Referenced Scene Beat Sheet is unavailable: ${input.coverage.beatSheetId}.`
        ),
      ],
    };
  }

  const warnings: DiagnosticIssue[] = [];
  if (beatSheet.sceneId !== input.sceneId) {
    warnings.push(
      warning(
        'CORE_SHOT_PLAN_BEAT_SHEET_SCENE_MISMATCH',
        `Referenced Scene Beat Sheet belongs to Scene ${beatSheet.sceneId}, not ${input.sceneId}.`
      )
    );
  }
  if (
    readActiveSceneBeatSheetId(input.session, beatSheet.sceneId) !== beatSheet.id
  ) {
    warnings.push(
      warning(
        'CORE_SHOT_PLAN_BEAT_SHEET_STALE',
        `Referenced Scene Beat Sheet is not the current sheet: ${beatSheet.id}.`
      )
    );
  }
  const screenplay = readCanonicalScreenplay(input.session);
  const document = readSceneBeatSheetDocument({
    row: beatSheet,
    screenplay,
  });
  const beatsById = new Map(document.beats.map((beat) => [beat.id, beat]));
  const coveredBeats: ShotPlanCoveredBeat[] = [];
  input.coverage.beatIds.forEach((beatId, position) => {
    const beat = beatsById.get(beatId);
    if (beat) {
      const owner = {
        kind: 'sceneBeat' as const,
        sceneId: beatSheet.sceneId,
        beatId,
      };
      const selectedAssetId = readSelectedAssetRecord(
        input.session,
        assetOwnerKey(owner)
      )?.assetId;
      const storyboardImage = selectedAssetId
        ? readOwnedAsset(input.session, { owner, assetId: selectedAssetId })
        : null;
      const storyboardFile = storyboardImage?.files[0] ?? null;
      coveredBeats.push({
        beat,
        position,
        storyboardImage: storyboardImage && storyboardFile
          ? {
              assetId: storyboardImage.id,
              assetFileId: storyboardFile.id,
            }
          : null,
      });
    } else {
      warnings.push(
        warning(
          'CORE_SHOT_PLAN_BEAT_MISSING',
          `Referenced Beat is unavailable in Scene Beat Sheet ${beatSheet.id}: ${beatId}.`
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
