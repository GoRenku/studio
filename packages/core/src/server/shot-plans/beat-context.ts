import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  ShotPlanCoverage,
  ShotPlanCoveredBeat,
} from '../../client/shot-plans.js';
import { readLatestSceneBeatStoryboardImage } from '../database/access/scene-beat-storyboard-images.js';
import {
  readActiveSceneBeatSheetId,
  readSceneBeatSheetDocument,
  readSceneBeatSheetRecord,
} from '../database/access/scene-beat-sheets.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

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
  const screenplay = readScreenplayDocumentFromSession(input.session);
  if (!screenplay) {
    return {
      coveredBeats: [],
      warnings: [
        ...warnings,
        warning(
          'CORE_SHOT_PLAN_BEAT_SHEET_MISSING',
          `Referenced Scene Beat Sheet context is unavailable: ${beatSheet.id}.`
        ),
      ],
    };
  }
  const document = readSceneBeatSheetDocument({
    row: beatSheet,
    screenplay,
  });
  const beatsById = new Map(document.beats.map((beat) => [beat.id, beat]));
  const coveredBeats: ShotPlanCoveredBeat[] = [];
  input.coverage.beatIds.forEach((beatId, position) => {
    const beat = beatsById.get(beatId);
    if (beat) {
      const storyboardImage = readLatestSceneBeatStoryboardImage({
        session: input.session,
        beatSheetId: beatSheet.id,
        beatId,
      });
      coveredBeats.push({
        beat,
        position,
        storyboardImage: storyboardImage
          ? {
              assetId: storyboardImage.assetId,
              assetFileId: storyboardImage.assetFileId,
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
