import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { Beat } from '../../client/scene-beat-sheet.js';
import type { ShotPlanCoverage } from '../../client/shot-plans.js';
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
}): { resolvedBeats: Beat[]; warnings: DiagnosticIssue[] } {
  if (input.coverage === null) {
    return { resolvedBeats: [], warnings: [] };
  }
  const beatSheet = readSceneBeatSheetRecord(
    input.session,
    input.coverage.beatSheetId
  );
  if (!beatSheet) {
    return {
      resolvedBeats: [],
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
      resolvedBeats: [],
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
  const resolvedBeats: Beat[] = [];
  input.coverage.beatIds.forEach((beatId) => {
    const beat = beatsById.get(beatId);
    if (beat) {
      resolvedBeats.push(beat);
    } else {
      warnings.push(
        warning(
          'CORE_SHOT_PLAN_BEAT_MISSING',
          `Referenced Beat is unavailable in Scene Beat Sheet ${beatSheet.id}: ${beatId}.`
        )
      );
    }
  });
  return { resolvedBeats, warnings };
}

function warning(code: string, message: string): DiagnosticIssue {
  return createDiagnosticWarning(
    code,
    message,
    { path: ['shotPlan', 'coverage'] }
  );
}
