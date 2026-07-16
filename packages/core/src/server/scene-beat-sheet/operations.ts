import type {
  Beat,
  SceneBeatSheetApplyChange,
  SceneBeatSheetApplyReport,
  SceneBeatSheetDocument,
  SceneBeatSheetOperation,
  SceneBeatSheetOperationDocument,
} from '../../client/scene-beat-sheet.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import {
  readActiveSceneBeatSheetId,
  readSceneBeatSheetDocument,
  requireSceneBeatSheetRecord,
  requireSceneBeatSheetForScene,
  setActiveSceneBeatSheetRecord,
  toSceneBeatSheetSummary,
  writeSceneBeatSheetRecord,
} from '../database/access/scene-beat-sheets.js';
import {
  insertSceneBeatStoryboardImageRecord,
} from '../database/access/scene-beat-storyboard-images.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ApplySceneBeatSheetOperationsInput } from '../project-data-service-contracts.js';
import {
  assertSceneBeatSheetDocument,
  assertSceneBeatSheetOperationDocument,
} from './validator.js';
import {
  readCurrentBaseStoryboardImageForBeat,
  readDryRunSceneBeatSheetStoryboardStatusFromSession,
  readSceneBeatSheetStoryboardStatusFromSession,
  sceneBeatSheetResourceKeys,
} from './storyboard-status.js';

export async function validateSceneBeatSheetOperations(
  input: ApplySceneBeatSheetOperationsInput
): Promise<SceneBeatSheetApplyReport> {
  return applySceneBeatSheetOperations({ ...input, dryRun: true });
}

export async function applySceneBeatSheetOperations(
  input: ApplySceneBeatSheetOperationsInput
): Promise<SceneBeatSheetApplyReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneBeatSheetOperationDocument({
      document: input.document,
      filePath: input.filePath,
    });
    requireSceneHierarchy(screenplay, input.document.sceneId);
    const baseRow = requireSceneBeatSheetForScene({
      session,
      sceneId: input.document.sceneId,
      beatSheetId: input.document.baseBeatSheetId,
    });
    const baseDocument = readSceneBeatSheetDocument({
      row: baseRow,
      screenplay,
    });
    const operationResult = buildBeatSheetDocumentFromOperations({
      base: baseDocument,
      operationsDocument: input.document,
    });
    const nextDocument = operationResult.document;
    const documentWarnings = assertSceneBeatSheetDocument({
      document: nextDocument,
      screenplay,
      filePath: input.filePath,
    });
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const createdBeatSheetId = input.dryRun
      ? `${input.document.baseBeatSheetId}_dry_run`
      : ids('scene_beat_sheet');
    const now = new Date().toISOString();

    if (!input.dryRun) {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        writeSceneBeatSheetRecord({
          session: txSession,
          id: createdBeatSheetId,
          document: nextDocument,
          screenplay,
          now,
          filePath: input.filePath,
        });
        carryForwardStoryboardImages({
          session: txSession,
          baseBeatSheetId: input.document.baseBeatSheetId,
          createdBeatSheetId,
          sceneId: input.document.sceneId,
          beats: nextDocument.beats,
          preservedBeatIds: operationResult.preservedBeatIds,
          ids,
          now,
        });
        if (input.document.activate) {
          setActiveSceneBeatSheetRecord(txSession, {
            sceneId: input.document.sceneId,
            beatSheetId: createdBeatSheetId,
            now,
          });
        }
      });
    }

    const summaryRow = input.dryRun
      ? {
          id: createdBeatSheetId,
          sceneId: input.document.sceneId,
          title: nextDocument.title,
          document: JSON.stringify(nextDocument),
          createdAt: now,
          updatedAt: now,
        }
      : requireSceneBeatSheetRecord(session, createdBeatSheetId);
    const storyboard = input.dryRun
      ? readDryRunSceneBeatSheetStoryboardStatusFromSession({
          session,
          currentProject,
          sceneId: input.document.sceneId,
          baseBeatSheetId: input.document.baseBeatSheetId,
          beatSheetId: createdBeatSheetId,
          document: nextDocument,
          preservedBeatIds: operationResult.preservedBeatIds,
        })
      : readSceneBeatSheetStoryboardStatusFromSession({
          session,
          currentProject,
          sceneId: input.document.sceneId,
          beatSheetId: createdBeatSheetId,
          document: nextDocument,
        });
    const changedBeatIds = [
      ...operationResult.insertedBeatIds,
      ...operationResult.removedBeatIds,
      ...operationResult.updatedBeatIds,
      ...storyboard.missingBeatIds,
      ...storyboard.staleBeatIds,
    ].filter((beatId, index, ids) => ids.indexOf(beatId) === index);
    return {
      valid: true,
      warnings: [...warnings, ...documentWarnings],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.document.sceneId,
        beatSheetId: createdBeatSheetId,
        beatIds: changedBeatIds,
      }),
      sceneId: input.document.sceneId,
      baseBeatSheetId: input.document.baseBeatSheetId,
      createdBeatSheetId,
      activatedBeatSheetId:
        !input.dryRun && input.document.activate ? createdBeatSheetId : null,
      beatSheet: toSceneBeatSheetSummary({
        row: summaryRow,
        screenplay,
        activeBeatSheetId:
          !input.dryRun && input.document.activate
            ? createdBeatSheetId
            : readActiveSceneBeatSheetId(session, input.document.sceneId),
      }),
      changes: operationResult.changes,
      storyboard,
    };
  });
}

function buildBeatSheetDocumentFromOperations(input: {
  base: SceneBeatSheetDocument;
  operationsDocument: SceneBeatSheetOperationDocument;
}): {
  document: SceneBeatSheetDocument;
  changes: SceneBeatSheetApplyChange[];
  insertedBeatIds: string[];
  removedBeatIds: string[];
  updatedBeatIds: string[];
  preservedBeatIds: string[];
} {
  const draft: SceneBeatSheetDocument = {
    ...structuredClone(input.base),
    sceneId: input.operationsDocument.sceneId,
    baseBeatSheetId: input.operationsDocument.baseBeatSheetId,
    ...(input.operationsDocument.title ? { title: input.operationsDocument.title } : {}),
    ...(input.operationsDocument.summary
      ? { summary: input.operationsDocument.summary }
      : {}),
    ...(input.operationsDocument.narrativeProgression
      ? { narrativeProgression: input.operationsDocument.narrativeProgression }
      : {}),
    ...(input.operationsDocument.lookbookInfluence
      ? { lookbookInfluence: input.operationsDocument.lookbookInfluence }
      : {}),
    ...(input.operationsDocument.openQuestions
      ? { openQuestions: input.operationsDocument.openQuestions }
      : {}),
  };
  const originalBeatIds = new Set(input.base.beats.map((beat) => beat.id));
  const touchedBeatIds = new Set<string>();
  for (const operation of input.operationsDocument.operations) {
    applyBeatSheetOperation(draft, operation, touchedBeatIds);
  }
  const nextBeatIds = new Set(draft.beats.map((beat) => beat.id));
  const insertedBeatIds = draft.beats
    .filter((beat) => !originalBeatIds.has(beat.id))
    .map((beat) => beat.id);
  const removedBeatIds = input.base.beats
    .filter((beat) => !nextBeatIds.has(beat.id))
    .map((beat) => beat.id);
  const updatedBeatIds = [...touchedBeatIds].filter(
    (beatId) => originalBeatIds.has(beatId) && nextBeatIds.has(beatId)
  );
  const preservedBeatIds = draft.beats
    .filter(
      (beat) =>
        originalBeatIds.has(beat.id) && !touchedBeatIds.has(beat.id)
    )
    .map((beat) => beat.id);
  return {
    document: draft,
    changes: [
      { type: 'inserted', beatIds: insertedBeatIds },
      { type: 'removed', beatIds: removedBeatIds },
      { type: 'updated', beatIds: updatedBeatIds },
      { type: 'preserved', beatIds: preservedBeatIds },
    ],
    insertedBeatIds,
    removedBeatIds,
    updatedBeatIds,
    preservedBeatIds,
  };
}

function applyBeatSheetOperation(
  draft: SceneBeatSheetDocument,
  operation: SceneBeatSheetOperation,
  touchedBeatIds: Set<string>
): void {
  switch (operation.operation) {
    case 'beats.insert':
      insertBeatsByPlacement(draft.beats, operation.placement, operation.beats);
      operation.beats.forEach((beat) => touchedBeatIds.add(beat.id));
      return;
    case 'beats.replace': {
      const firstIndex = firstBeatIndex(draft.beats, operation.beatIds);
      removeBeatIds(draft.beats, operation.beatIds);
      draft.beats.splice(firstIndex, 0, ...operation.beats);
      operation.beatIds.forEach((beatId) => touchedBeatIds.add(beatId));
      operation.beats.forEach((beat) => touchedBeatIds.add(beat.id));
      return;
    }
    case 'beat.update': {
      const index = draft.beats.findIndex(
        (beat) => beat.id === operation.beat.id
      );
      if (index === -1) {
        throw new ProjectDataError(
          'PROJECT_DATA326',
          `Beat update references a beat id that is not in the base Scene Beat List: ${operation.beat.id}.`,
          { suggestion: 'Use a beat id from the explicit base beat list.' }
        );
      }
      draft.beats[index] = operation.beat;
      touchedBeatIds.add(operation.beat.id);
      return;
    }
    case 'beats.delete':
      removeBeatIds(draft.beats, operation.beatIds);
      operation.beatIds.forEach((beatId) => touchedBeatIds.add(beatId));
      return;
    case 'beatSheet.replace':
      draft.beats = [...operation.beats];
      operation.beats.forEach((beat) => touchedBeatIds.add(beat.id));
      return;
  }
}

function insertBeatsByPlacement(
  beats: Beat[],
  placement: Extract<
    SceneBeatSheetOperation,
    { operation: 'beats.insert' }
  >['placement'],
  inserted: Beat[]
): void {
  if (placement.position === 'start') {
    beats.splice(0, 0, ...inserted);
    return;
  }
  if (placement.position === 'end') {
    beats.push(...inserted);
    return;
  }
  const index = beats.findIndex((beat) => beat.id === placement.beatId);
  if (index === -1) {
    throw new ProjectDataError(
      'PROJECT_DATA326',
      `Beat insertion placement was not found: ${placement.beatId}.`,
      { suggestion: 'Use a placement beat id from the explicit base beat list.' }
    );
  }
  beats.splice(placement.position === 'before' ? index : index + 1, 0, ...inserted);
}

function firstBeatIndex(beats: Beat[], beatIds: string[]): number {
  const targetIds = new Set(beatIds);
  const index = beats.findIndex((beat) => targetIds.has(beat.id));
  if (index === -1) {
    throw new ProjectDataError(
      'PROJECT_DATA326',
      'Beat replacement references no beat ids in the base Scene Beat List.',
      { suggestion: 'Use beat ids from the explicit base beat list.' }
    );
  }
  return index;
}

function removeBeatIds(beats: Beat[], beatIds: string[]): void {
  for (const beatId of beatIds) {
    const index = beats.findIndex((beat) => beat.id === beatId);
    if (index === -1) {
      throw new ProjectDataError(
        'PROJECT_DATA326',
        `Beat operation references a beat id that is not in the base Scene Beat List: ${beatId}.`,
        { suggestion: 'Use beat ids from the explicit base beat list.' }
      );
    }
    beats.splice(index, 1);
  }
}

export function carryForwardStoryboardImages(input: {
  session: Parameters<typeof readActiveSceneBeatSheetId>[0];
  baseBeatSheetId: string;
  createdBeatSheetId: string;
  sceneId: string;
  beats: Beat[];
  preservedBeatIds: string[];
  ids: ReturnType<typeof createUniqueIdAllocator>;
  now: string;
}): void {
  const preserved = new Set(input.preservedBeatIds);
  for (const beat of input.beats) {
    if (!preserved.has(beat.id)) {
      continue;
    }
    const image = readCurrentBaseStoryboardImageForBeat({
      session: input.session,
      baseBeatSheetId: input.baseBeatSheetId,
      beat,
    });
    if (!image) {
      continue;
    }
    insertSceneBeatStoryboardImageRecord(input.session, {
      id: input.ids('scene_beat_storyboard_image'),
      sceneId: input.sceneId,
      beatSheetId: input.createdBeatSheetId,
      beatId: beat.id,
      assetId: image.assetId,
      assetFileId: image.assetFileId,
      sourcePurpose: image.sourcePurpose,
      beatContentFingerprint: image.beatContentFingerprint,
      now: input.now,
    });
  }
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
