import type {
  SceneBeatSheetListReport,
  SceneBeatSheetReadReport,
  SceneBeatSheetValidationReport,
  SceneBeatSheetWriteReport,
} from '../../client/scene-beats/index.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import {
  listSceneBeatSheetRecords,
  readActiveSceneBeatSheetId,
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
  requireSceneBeatSheetRecord,
  setActiveSceneBeatSheetRecord,
  toSceneBeatSheetSummary,
  writeSceneBeatSheetRecord,
} from '../database/access/scene-beat-sheets.js';
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
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { sceneBeatSheetResourceKeys } from './storyboard-status.js';
import { assertSceneBeatSheetDocument } from './validator.js';

export async function listSceneBeatSheets(
  input: SceneBeatSheetProjectInput & { sceneId: string }
): Promise<SceneBeatSheetListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    return {
      valid: true,
      warnings: [],
      project: {
        projectName: currentProject.projectName,
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
      }),
      activeBeatSheetId: readActiveSceneBeatSheetId(session, input.sceneId),
    };
  });
}

export async function readSceneBeatSheet(
  input: ReadSceneBeatSheetInput
): Promise<SceneBeatSheetReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
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
          projectName: currentProject.projectName,
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
        projectName: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: row.sceneId,
        beatSheetId: row.id,
      }),
      beatSheet: readSceneBeatSheetDocument({ row }),
      summary: toSceneBeatSheetSummary({
        row,
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
    const screenplay = requireScreenplay(session);
    const warnings = assertSceneBeatSheetDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    return {
      valid: true,
      warnings,
      project: {
        projectName: currentProject.projectName,
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
    const screenplay = requireScreenplay(session);
    const warnings = assertSceneBeatSheetDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
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
        projectName: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.document.sceneId,
        beatSheetId,
      }),
      beatSheet: toSceneBeatSheetSummary({
        row,
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
        projectName: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.sceneId,
        beatSheetId: input.beatSheetId,
      }),
      beatSheet: toSceneBeatSheetSummary({
        row,
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

function requireScreenplay(
  session: Parameters<typeof readCanonicalScreenplay>[0]
): Screenplay {
  return readCanonicalScreenplay(session);
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
