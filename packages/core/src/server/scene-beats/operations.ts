import type {
  Beat,
  SceneBeatsOperationsReport,
} from '../../client/scene-beats/index.js';
import {
  readActiveSceneBeatsRevisionId,
  allocateSceneBeatsRevisionId,
  readStoredSceneBeatsRevision,
  readReservedSceneBeatIds,
  requireSceneBeatsRevisionForScene,
  requireSceneBeatsRevisionRecord,
  setActiveSceneBeatsRevisionRecord,
  toSceneBeatsRevisionSummary,
  writeSceneBeatsRevisionRecord,
} from '../database/access/scene-beats.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ApplySceneBeatsOperationsInput } from '../project-data-service-contracts.js';
import { numberInsertedBeats } from './numbering.js';
import {
  readDryRunSceneStoryboardStatusFromSession,
  readSceneStoryboardStatusFromSession,
  sceneBeatsResourceKeys,
} from './storyboard-status.js';
import { assertSceneBeatsOperationsInput } from './validator.js';

export async function validateSceneBeatsOperations(
  input: ApplySceneBeatsOperationsInput
): Promise<SceneBeatsOperationsReport> {
  return applySceneBeatsOperations({ ...input, dryRun: true });
}

export async function applySceneBeatsOperations(
  input: ApplySceneBeatsOperationsInput
): Promise<SceneBeatsOperationsReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertSceneBeatsOperationsInput({
      document: input.document,
      filePath: input.filePath,
    });
    const baseRow = requireSceneBeatsRevisionForScene({
      session,
      sceneId: input.document.sceneId,
      revisionId: input.document.baseRevisionId,
    });
    const stored = readStoredSceneBeatsRevision({ row: baseRow });
    const idGenerator = input.idGenerator ?? createRandomIdGenerator();
    const result = applyOperations({
      beats: stored.sceneBeats.beats,
      reservedNumbers: stored.reservedNumbers,
      operations: input.document.operations,
      idGenerator,
      reservedBeatIds: readReservedSceneBeatIds(session, input.document.sceneId),
    });
    const createdRevisionId = input.dryRun
      ? `${input.document.baseRevisionId}_dry_run`
      : allocateSceneBeatsRevisionId(session, idGenerator);
    const now = new Date().toISOString();

    if (!input.dryRun) {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        writeSceneBeatsRevisionRecord({
          session: txSession,
          id: createdRevisionId,
          sceneBeats: { sceneId: input.document.sceneId, beats: result.beats },
          baseRevisionId: input.document.baseRevisionId,
          reservedNumbers: result.reservedNumbers,
          now,
        });
        if (input.document.activate) {
          setActiveSceneBeatsRevisionRecord(txSession, {
            sceneId: input.document.sceneId,
            revisionId: createdRevisionId,
            now,
          });
        }
      });
    }

    const summaryRow = input.dryRun
      ? {
          id: createdRevisionId,
          sceneId: input.document.sceneId,
          document: JSON.stringify({
            sceneBeats: { sceneId: input.document.sceneId, beats: result.beats },
            baseRevisionId: input.document.baseRevisionId,
            reservedNumbers: result.reservedNumbers,
          }),
          createdAt: now,
          updatedAt: now,
        }
      : requireSceneBeatsRevisionRecord(session, createdRevisionId);
    const storyboardInput = {
      session,
      currentProject,
      sceneId: input.document.sceneId,
      sceneBeatsRevisionId: createdRevisionId,
      sceneBeats: { sceneId: input.document.sceneId, beats: result.beats },
    };
    const storyboard = input.dryRun
      ? readDryRunSceneStoryboardStatusFromSession({
          ...storyboardInput,
          persistedBeatIds: stored.sceneBeats.beats.map((beat) => beat.id),
        })
      : readSceneStoryboardStatusFromSession(storyboardInput);
    return {
      valid: true,
      warnings,
      project: {
        projectName: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatsResourceKeys({
        sceneId: input.document.sceneId,
        sceneBeatsRevisionId: createdRevisionId,
        beatIds: result.changedBeatIds,
      }),
      sceneId: input.document.sceneId,
      baseRevisionId: input.document.baseRevisionId,
      createdRevisionId,
      activatedRevisionId:
        !input.dryRun && input.document.activate ? createdRevisionId : null,
      revision: toSceneBeatsRevisionSummary({
        row: summaryRow,
        activeRevisionId: !input.dryRun && input.document.activate
          ? createdRevisionId
          : readActiveSceneBeatsRevisionId(session, input.document.sceneId),
      }),
      changes: result.changes,
      storyboard,
    };
  });
}

function applyOperations(input: {
  beats: Beat[];
  reservedNumbers: string[];
  operations: ApplySceneBeatsOperationsInput['document']['operations'];
  idGenerator: NonNullable<ApplySceneBeatsOperationsInput['idGenerator']>;
  reservedBeatIds: string[];
}) {
  const beats = structuredClone(input.beats);
  let reservedNumbers = [...input.reservedNumbers];
  const insertedBeatIds: string[] = [];
  const updatedBeatIds: string[] = [];
  const deletedBeatIds: string[] = [];

  for (const operation of input.operations) {
    if (operation.operation === 'beats.insert') {
      const numbered = numberInsertedBeats({
        current: beats,
        reservedNumbers,
        placement: operation.placement,
        beats: operation.beats,
        idGenerator: input.idGenerator,
        reservedBeatIds: input.reservedBeatIds,
      });
      beats.splice(numbered.index, 0, ...numbered.inserted);
      reservedNumbers = numbered.reservedNumbers;
      insertedBeatIds.push(...numbered.inserted.map((beat) => beat.id));
      input.reservedBeatIds.push(...numbered.inserted.map((beat) => beat.id));
      continue;
    }
    if (operation.operation === 'beat.update') {
      const index = requireBeatIndex(beats, operation.beatId);
      beats[index] = {
        ...operation.beat,
        id: beats[index]!.id,
        number: beats[index]!.number,
      };
      updatedBeatIds.push(operation.beatId);
      continue;
    }
    for (const beatId of operation.beatIds) {
      const index = requireBeatIndex(beats, beatId);
      beats.splice(index, 1);
      deletedBeatIds.push(beatId);
    }
  }

  return {
    beats,
    reservedNumbers,
    changedBeatIds: [...insertedBeatIds, ...updatedBeatIds, ...deletedBeatIds],
    changes: [
      { type: 'inserted' as const, beatIds: insertedBeatIds },
      { type: 'updated' as const, beatIds: updatedBeatIds },
      { type: 'deleted' as const, beatIds: deletedBeatIds },
    ],
  };
}

function requireBeatIndex(beats: Beat[], beatId: string): number {
  const index = beats.findIndex((beat) => beat.id === beatId);
  if (index < 0) {
    throw new ProjectDataError(
      'SCENE_BEATS_OPERATION_TARGET_NOT_FOUND',
      `Beat operation target was not found: ${beatId}.`
    );
  }
  return index;
}
