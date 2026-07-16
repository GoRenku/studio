import type {
  SceneBeatSheetDocument,
  SceneBeatSheetListReport,
  SceneBeatSheetReadReport,
  SceneBeatSheetValidationReport,
  SceneBeatSheetWriteReport,
} from '../../client/scene-beat-sheet.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import {
  listSceneBeatSheetRecords,
  readActiveSceneBeatSheetId,
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
  requireSceneBeatSheetRecord,
  requireSceneBeatSheetForScene,
  setActiveSceneBeatSheetRecord,
  toSceneBeatSheetSummary,
  writeSceneBeatSheetRecord,
} from '../database/access/scene-beat-sheets.js';
import { beatContentFingerprint } from '../database/access/scene-beat-storyboard-images.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ReadSceneBeatSheetInput,
  SceneBeatSheetProjectInput,
  SetActiveSceneBeatSheetInput,
  ValidateSceneBeatSheetInput,
  WriteSceneBeatSheetInput,
} from '../project-data-service-contracts.js';
import { carryForwardStoryboardImages } from './operations.js';
import { sceneBeatSheetResourceKeys } from './storyboard-status.js';
import { assertSceneBeatSheetDocument } from './validator.js';

export async function listSceneBeatSheets(
  input: SceneBeatSheetProjectInput & { sceneId: string }
): Promise<SceneBeatSheetListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    requireSceneHierarchy(screenplay, input.sceneId);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.sceneId,
        beatSheetId: readActiveSceneBeatSheetId(session, input.sceneId),
      }),
      sceneId: input.sceneId,
      beatSheets: listSceneBeatSheetRecords({
        session,
        sceneId: input.sceneId,
        screenplay,
      }),
      activeBeatSheetId: readActiveSceneBeatSheetId(session, input.sceneId),
    };
  });
}

export async function readSceneBeatSheet(
  input: ReadSceneBeatSheetInput
): Promise<SceneBeatSheetReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const row = input.active
      ? readActiveSceneBeatSheetRecord(
          session,
          requiredSceneId(input.sceneId, '--scene')
        )
      : requireSceneBeatSheetRecord(
          session,
          requiredBeatSheetId(input.beatSheetId)
        );
    const activeBeatSheetId = input.sceneId
      ? readActiveSceneBeatSheetId(session, input.sceneId)
      : row
        ? readActiveSceneBeatSheetId(session, row.sceneId)
        : null;
    if (!row) {
      return {
        valid: true,
        warnings: [],
        project: {
          name: currentProject.projectName,
          id: currentProject.projectId,
          projectFolder: currentProject.projectFolder,
        },
        resourceKeys: sceneBeatSheetResourceKeys({
          sceneId: requiredSceneId(input.sceneId, '--scene'),
          beatSheetId: null,
        }),
        beatSheet: null,
        summary: null,
        activeBeatSheetId: null,
      };
    }
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: row.sceneId,
        beatSheetId: row.id,
      }),
      beatSheet: readSceneBeatSheetDocument({ row, screenplay }),
      summary: toSceneBeatSheetSummary({
        row,
        screenplay,
        activeBeatSheetId,
      }),
      activeBeatSheetId,
    };
  });
}

export async function validateSceneBeatSheet(
  input: ValidateSceneBeatSheetInput
): Promise<SceneBeatSheetValidationReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneBeatSheetDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    return {
      valid: true,
      warnings,
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.document.sceneId,
        beatSheetId: readActiveSceneBeatSheetId(session, input.document.sceneId),
      }),
      beatSheet: input.document,
    };
  });
}

export async function writeSceneBeatSheet(
  input: WriteSceneBeatSheetInput
): Promise<SceneBeatSheetWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneBeatSheetDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    const baseBeatSheetId = input.document.baseBeatSheetId ?? null;
    const preservedBeatIds = baseBeatSheetId
      ? readPreservedBeatIdsForReplacement({
          session,
          screenplay,
          sceneId: input.document.sceneId,
          baseBeatSheetId,
          nextDocument: input.document,
        })
      : [];
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const beatSheetId = ids('scene_beat_sheet');
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      writeSceneBeatSheetRecord({
        session: txSession,
        id: beatSheetId,
        document: input.document,
        screenplay,
        now,
        filePath: input.filePath,
      });
      if (baseBeatSheetId) {
        carryForwardStoryboardImages({
          session: txSession,
          baseBeatSheetId,
          createdBeatSheetId: beatSheetId,
          sceneId: input.document.sceneId,
          beats: input.document.beats,
          preservedBeatIds,
          ids,
          now,
        });
      }
      setActiveSceneBeatSheetRecord(txSession, {
        sceneId: input.document.sceneId,
        beatSheetId,
        now,
      });
    });
    const row = requireSceneBeatSheetRecord(session, beatSheetId);
    return {
      valid: true,
      warnings,
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.document.sceneId,
        beatSheetId,
      }),
      beatSheet: toSceneBeatSheetSummary({
        row,
        screenplay,
        activeBeatSheetId: beatSheetId,
      }),
      activeBeatSheetId: beatSheetId,
      changes: [
        {
          type: 'sceneBeatSheet.created',
          sceneId: input.document.sceneId,
          beatSheetId,
        },
        {
          type: 'sceneBeatSheet.activeSet',
          sceneId: input.document.sceneId,
          beatSheetId,
        },
      ],
    };
  });
}

export async function setActiveSceneBeatSheet(
  input: SetActiveSceneBeatSheetInput
): Promise<SceneBeatSheetWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    setActiveSceneBeatSheetRecord(session, {
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
      now,
    });
    const row = requireSceneBeatSheetRecord(session, input.beatSheetId);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.sceneId,
        beatSheetId: input.beatSheetId,
      }),
      beatSheet: toSceneBeatSheetSummary({
        row,
        screenplay,
        activeBeatSheetId: input.beatSheetId,
      }),
      activeBeatSheetId: input.beatSheetId,
      changes: [
        {
          type: 'sceneBeatSheet.activeSet',
          sceneId: input.sceneId,
          beatSheetId: input.beatSheetId,
        },
      ],
    };
  });
}

function readPreservedBeatIdsForReplacement(input: {
  session: Parameters<typeof readActiveSceneBeatSheetId>[0];
  screenplay: ScreenplayDocument;
  sceneId: string;
  baseBeatSheetId: string;
  nextDocument: SceneBeatSheetDocument;
}): string[] {
  const baseRow = requireSceneBeatSheetForScene({
    session: input.session,
    sceneId: input.sceneId,
    beatSheetId: input.baseBeatSheetId,
  });
  const baseDocument = readSceneBeatSheetDocument({
    row: baseRow,
    screenplay: input.screenplay,
  });
  const baseFingerprints = new Map(
    baseDocument.beats.map((beat) => [
      beat.id,
      beatContentFingerprint(beat),
    ])
  );
  return input.nextDocument.beats
    .filter(
      (beat) =>
        baseFingerprints.get(beat.id) === beatContentFingerprint(beat)
    )
    .map((beat) => beat.id);
}

function requireScreenplayDocument(
  session: Parameters<typeof readScreenplayDocumentFromSession>[0]
): ScreenplayDocument {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Use `renku screenplay create` first.',
    });
  }
  return screenplay;
}

function requireSceneHierarchy(
  screenplay: ScreenplayDocument,
  sceneId: string
): void {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      if (sequence.scenes.some((scene) => scene.id === sceneId)) {
        return;
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA326',
    `Scene was not found: ${sceneId}.`,
    {
      suggestion:
        'Use a scene id from `renku screenplay scene list --sequence <sequence-id> --json`.',
    }
  );
}

function requiredSceneId(value: string | undefined, flag: string): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA327', 'Scene id is required.', {
    suggestion: `Pass ${flag} <scene-id>.`,
  });
}

function requiredBeatSheetId(value: string | undefined): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA328', 'Scene Beat Sheet id is required.', {
    suggestion: 'Pass --beat-sheet <beat-sheet-id>.',
  });
}
