import type {
  SceneBeatsRevisionListReport,
  SceneBeatsRevisionReadReport,
  SceneBeatsRevisionWriteReport,
  SceneBeatsValidationReport,
} from '../../client/scene-beats/index.js';
import {
  listSceneBeatsRevisionRecords,
  allocateSceneBeatsRevisionId,
  readActiveSceneBeatsRevisionId,
  readActiveSceneBeatsRevisionRecord,
  readSceneBeats,
  readReservedSceneBeatIds,
  requireSceneBeatsRevisionRecord,
  setActiveSceneBeatsRevisionRecord,
  toSceneBeatsRevisionSummary,
  writeSceneBeatsRevisionRecord,
} from '../database/access/scene-beats.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  CreateSceneBeatsRevisionInput,
  ListSceneBeatsRevisionsInput,
  ReadSceneBeatsRevisionInput,
  ResetSceneBeatsInput,
  SetActiveSceneBeatsRevisionInput,
  ValidateSceneBeatsInput,
} from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { numberFreshBeats } from './numbering.js';
import { sceneBeatsResourceKeys } from './storyboard-status.js';
import { assertSceneBeatsInput } from './validator.js';

export async function listSceneBeatsRevisions(
  input: ListSceneBeatsRevisionsInput
): Promise<SceneBeatsRevisionListReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => ({
    valid: true,
    warnings: [],
    project: projectReport(currentProject),
    resourceKeys: sceneBeatsResourceKeys({
      sceneId: input.sceneId,
      sceneBeatsRevisionId: readActiveSceneBeatsRevisionId(session, input.sceneId),
    }),
    sceneId: input.sceneId,
    revisions: listSceneBeatsRevisionRecords({ session, sceneId: input.sceneId }),
    activeRevisionId: readActiveSceneBeatsRevisionId(session, input.sceneId),
  }));
}

export async function readSceneBeatsRevision(
  input: ReadSceneBeatsRevisionInput
): Promise<SceneBeatsRevisionReadReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const row = input.active
      ? readActiveSceneBeatsRevisionRecord(session, requiredSceneId(input.sceneId))
      : requireSceneBeatsRevisionRecord(session, requiredRevisionId(input.revisionId));
    if (!row) {
      return {
        valid: true,
        warnings: [],
        project: projectReport(currentProject),
        resourceKeys: sceneBeatsResourceKeys({ sceneId: requiredSceneId(input.sceneId) }),
        sceneBeats: null,
        revision: null,
        activeRevisionId: null,
      };
    }
    const activeRevisionId = readActiveSceneBeatsRevisionId(session, row.sceneId);
    return {
      valid: true,
      warnings: [],
      project: projectReport(currentProject),
      resourceKeys: sceneBeatsResourceKeys({
        sceneId: row.sceneId,
        sceneBeatsRevisionId: row.id,
      }),
      sceneBeats: readSceneBeats({ row }),
      revision: toSceneBeatsRevisionSummary({ row, activeRevisionId }),
      activeRevisionId,
    };
  });
}

export async function validateSceneBeats(
  input: ValidateSceneBeatsInput
): Promise<SceneBeatsValidationReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => ({
    valid: true,
    warnings: assertSceneBeatsInput({
      document: input.document,
      screenplay: readCanonicalScreenplay(session),
      filePath: input.filePath,
    }),
    project: projectReport(currentProject),
    resourceKeys: sceneBeatsResourceKeys({ sceneId: input.document.sceneId }),
    sceneBeats: input.document,
  }));
}

export async function createSceneBeatsRevision(
  input: CreateSceneBeatsRevisionInput
): Promise<SceneBeatsRevisionWriteReport> {
  return writeFreshRevision({ ...input, reset: false });
}

export async function resetSceneBeats(
  input: ResetSceneBeatsInput
): Promise<SceneBeatsRevisionWriteReport> {
  return writeFreshRevision({ ...input, reset: true });
}

async function writeFreshRevision(
  input: CreateSceneBeatsRevisionInput & { reset: boolean }
): Promise<SceneBeatsRevisionWriteReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertSceneBeatsInput({
      document: input.document,
      screenplay: readCanonicalScreenplay(session),
      filePath: input.filePath,
    });
    const active = readActiveSceneBeatsRevisionRecord(session, input.document.sceneId);
    if (!input.reset && active) {
      throw new ProjectDataError(
        'SCENE_BEATS_ALREADY_EXISTS',
        'Scene Beats already exist for this Scene. Use focused operations or reset.'
      );
    }
    if (input.reset && !active) {
      throw new ProjectDataError(
        'SCENE_BEATS_NOT_FOUND',
        'Scene Beats must exist before they can be reset.'
      );
    }
    const idGenerator = input.idGenerator ?? createRandomIdGenerator();
    const numbered = numberFreshBeats({
      beats: input.document.beats,
      idGenerator,
      reservedBeatIds: readReservedSceneBeatIds(session, input.document.sceneId),
    });
    const revisionId = allocateSceneBeatsRevisionId(session, idGenerator);
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      writeSceneBeatsRevisionRecord({
        session: txSession,
        id: revisionId,
        sceneBeats: { sceneId: input.document.sceneId, beats: numbered.beats },
        ...(active ? { baseRevisionId: active.id } : {}),
        reservedNumbers: numbered.reservedNumbers,
        now,
      });
      setActiveSceneBeatsRevisionRecord(txSession, {
        sceneId: input.document.sceneId,
        revisionId,
        now,
      });
    });
    const row = requireSceneBeatsRevisionRecord(session, revisionId);
    return {
      valid: true,
      warnings,
      project: projectReport(currentProject),
      resourceKeys: sceneBeatsResourceKeys({
        sceneId: input.document.sceneId,
        sceneBeatsRevisionId: revisionId,
      }),
      revision: toSceneBeatsRevisionSummary({ row, activeRevisionId: revisionId }),
      activeRevisionId: revisionId,
      changes: [
        { type: 'sceneBeats.revisionCreated', sceneId: input.document.sceneId, revisionId },
        { type: 'sceneBeats.activeRevisionSet', sceneId: input.document.sceneId, revisionId },
      ],
    };
  });
}

export async function setActiveSceneBeatsRevision(
  input: SetActiveSceneBeatsRevisionInput
): Promise<SceneBeatsRevisionWriteReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const now = new Date().toISOString();
    setActiveSceneBeatsRevisionRecord(session, {
      sceneId: input.sceneId,
      revisionId: input.revisionId,
      now,
    });
    const row = requireSceneBeatsRevisionRecord(session, input.revisionId);
    return {
      valid: true,
      warnings: [],
      project: projectReport(currentProject),
      resourceKeys: sceneBeatsResourceKeys({
        sceneId: input.sceneId,
        sceneBeatsRevisionId: input.revisionId,
      }),
      revision: toSceneBeatsRevisionSummary({ row, activeRevisionId: input.revisionId }),
      activeRevisionId: input.revisionId,
      changes: [{
        type: 'sceneBeats.activeRevisionSet',
        sceneId: input.sceneId,
        revisionId: input.revisionId,
      }],
    };
  });
}

function projectReport(currentProject: {
  projectName: string;
  projectId?: string;
  projectFolder?: string;
}) {
  return {
    projectName: currentProject.projectName,
    id: currentProject.projectId,
    projectFolder: currentProject.projectFolder,
  };
}

function requiredSceneId(value: string | undefined): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('SCENE_BEATS_NOT_FOUND', 'Scene id is required.');
}

function requiredRevisionId(value: string | undefined): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('SCENE_BEATS_REVISION_NOT_FOUND', 'Scene Beats revision id is required.');
}
