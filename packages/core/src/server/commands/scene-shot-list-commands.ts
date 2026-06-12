import type {
  SceneShot,
  SceneShotListApplyChange,
  SceneShotListApplyReport,
  SceneShotListContextReport,
  SceneShotListDocument,
  SceneShotListListReport,
  SceneShotListOperation,
  SceneShotListOperationDocument,
  SceneShotListReadReport,
  SceneShotListStoryboardShotStatus,
  SceneShotListStoryboardStatus,
  SceneShotListValidationReport,
  SceneShotListWriteReport,
} from '../../client/scene-shot-list.js';
import type {
  CastMember,
  Location,
  Scene,
  ScreenplayDocument,
} from '../../client/screenplay.js';
import {
  listSceneShotListRecords,
  readActiveSceneShotListId,
  readActiveSceneShotListRecord,
  insertSceneShotStoryboardImageRecord,
  readLatestSceneShotStoryboardImage,
  type SceneShotStoryboardImageRecord,
  readSceneShotListDocument,
  requireSceneShotListRecord,
  requireSceneShotListForScene,
  setActiveSceneShotListRecord,
  shotContentFingerprint,
  toSceneShotListSummary,
  writeSceneShotListRecord,
} from '../database/access/scene-shot-lists.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import {
  readActiveLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../database/access/lookbook.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ReadSceneShotListContextInput,
  ReadSceneShotListInput,
  SceneShotListProjectInput,
  SetActiveSceneShotListInput,
  ApplySceneShotListOperationsInput,
  ReadSceneShotListStoryboardStatusInput,
  ValidateSceneShotListInput,
  WriteSceneShotListInput,
} from '../project-data-service-contracts.js';
import {
  assertSceneShotListDocument,
  assertSceneShotListOperationDocument,
} from '../scene-shot-list-json/validator.js';
import {
  studioSceneNarrativeResourceKey,
  studioSceneShotListResourceKey,
  studioSceneShotResourceKey,
  studioSceneShotsResourceKey,
} from '../studio-coordination/resource-keys.js';

export const SCENE_SHOT_LIST_RESOURCE_KEY = 'scene-shot-list';

export async function readSceneShotListContext(
  input: ReadSceneShotListContextInput
): Promise<SceneShotListContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const hierarchy = requireSceneHierarchy(screenplay, input.sceneId);
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const activeShotList = readActiveSceneShotListRecord(session, input.sceneId);
    const activeShotListId = activeShotList?.id ?? null;
    const activeLookbook = readActiveLookbookContext(session);
    const references = collectSceneReferences(hierarchy.scene, screenplay);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
        title: projectInfo.title,
        aspectRatio: projectInfo.aspectRatio ?? '16:9',
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: activeShotListId,
      }),
      screenplay: {
        title: screenplay.screenplay.title,
        logline: screenplay.screenplay.logline,
        summary: screenplay.screenplay.summary,
        genrePrimary: screenplay.screenplay.genrePrimary,
        genreSecondary: screenplay.screenplay.genreSecondary,
        tone: screenplay.screenplay.tone,
        themes: screenplay.screenplay.themes,
      },
      act: {
        id: hierarchy.act.id as string,
        title: hierarchy.act.title,
        purpose: hierarchy.act.purpose,
      },
      sequence: {
        id: hierarchy.sequence.id as string,
        title: hierarchy.sequence.title,
        purpose: hierarchy.sequence.purpose,
      },
      scene: {
        id: hierarchy.scene.id as string,
        title: hierarchy.scene.title,
        setting: hierarchy.scene.setting,
        storyFunction: hierarchy.scene.storyFunction ?? [],
        blocks: hierarchy.scene.blocks,
      },
      cast: references.cast.map((castMember) => ({
        id: castMember.id as string,
        handle: castMember.handle,
        name: castMember.name,
        isVoiceOver: castMember.isVoiceOver,
        role: castMember.role,
        description: castMember.description,
      })),
      locations: references.locations.map((location) => ({
        id: location.id as string,
        handle: location.handle,
        name: location.name,
        timePeriod: location.timePeriod,
        description: location.description,
        visualNotes: location.visualNotes,
      })),
      activeLookbook,
      activeShotList: activeShotList
        ? toSceneShotListSummary({
            row: activeShotList,
            screenplay,
            activeShotListId,
          })
        : null,
      ...(input.includeVisualReferences
        ? {
            visualReferences: {
              note: 'Visual reference metadata is not included in v1 context; inspect project assets separately when the user explicitly asks for visual inspection.',
            },
          }
        : {}),
    };
  });
}

export async function listSceneShotLists(
  input: SceneShotListProjectInput & { sceneId: string }
): Promise<SceneShotListListReport> {
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
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: readActiveSceneShotListId(session, input.sceneId),
      }),
      sceneId: input.sceneId,
      shotLists: listSceneShotListRecords({
        session,
        sceneId: input.sceneId,
        screenplay,
      }),
      activeShotListId: readActiveSceneShotListId(session, input.sceneId),
    };
  });
}

export async function readSceneShotList(
  input: ReadSceneShotListInput
): Promise<SceneShotListReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const row = input.active
      ? readActiveSceneShotListRecord(
          session,
          requiredSceneId(input.sceneId, '--scene')
        )
      : requireSceneShotListRecord(
          session,
          requiredShotListId(input.shotListId)
        );
    const activeShotListId = input.sceneId
      ? readActiveSceneShotListId(session, input.sceneId)
      : row
        ? readActiveSceneShotListId(session, row.sceneId)
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
        resourceKeys: sceneShotListResourceKeys({
          sceneId: requiredSceneId(input.sceneId, '--scene'),
          shotListId: null,
        }),
        shotList: null,
        summary: null,
        activeShotListId: null,
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
      resourceKeys: sceneShotListResourceKeys({
        sceneId: row.sceneId,
        shotListId: row.id,
      }),
      shotList: readSceneShotListDocument({ row, screenplay }),
      summary: toSceneShotListSummary({
        row,
        screenplay,
        activeShotListId,
      }),
      activeShotListId,
    };
  });
}

export async function validateSceneShotList(
  input: ValidateSceneShotListInput
): Promise<SceneShotListValidationReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneShotListDocument({
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
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.document.sceneId,
        shotListId: readActiveSceneShotListId(session, input.document.sceneId),
      }),
      shotList: input.document,
    };
  });
}

export async function writeSceneShotList(
  input: WriteSceneShotListInput
): Promise<SceneShotListWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneShotListDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const shotListId = ids('scene_shot_list');
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      writeSceneShotListRecord({
        session: txSession,
        id: shotListId,
        document: input.document,
        screenplay,
        now,
        filePath: input.filePath,
      });
      setActiveSceneShotListRecord(txSession, {
        sceneId: input.document.sceneId,
        shotListId,
        now,
      });
    });
    const row = requireSceneShotListRecord(session, shotListId);
    return {
      valid: true,
      warnings,
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.document.sceneId,
        shotListId,
      }),
      shotList: toSceneShotListSummary({
        row,
        screenplay,
        activeShotListId: shotListId,
      }),
      activeShotListId: shotListId,
      changes: [
        {
          type: 'sceneShotList.created',
          sceneId: input.document.sceneId,
          shotListId,
        },
        {
          type: 'sceneShotList.activeSet',
          sceneId: input.document.sceneId,
          shotListId,
        },
      ],
    };
  });
}

export async function setActiveSceneShotList(
  input: SetActiveSceneShotListInput
): Promise<SceneShotListWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    setActiveSceneShotListRecord(session, {
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      now,
    });
    const row = requireSceneShotListRecord(session, input.shotListId);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: input.shotListId,
      }),
      shotList: toSceneShotListSummary({
        row,
        screenplay,
        activeShotListId: input.shotListId,
      }),
      activeShotListId: input.shotListId,
      changes: [
        {
          type: 'sceneShotList.activeSet',
          sceneId: input.sceneId,
          shotListId: input.shotListId,
        },
      ],
    };
  });
}

export async function validateSceneShotListOperations(
  input: ApplySceneShotListOperationsInput
): Promise<SceneShotListApplyReport> {
  return applySceneShotListOperations({ ...input, dryRun: true });
}

export async function applySceneShotListOperations(
  input: ApplySceneShotListOperationsInput
): Promise<SceneShotListApplyReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneShotListOperationDocument({
      document: input.document,
      filePath: input.filePath,
    });
    requireSceneHierarchy(screenplay, input.document.sceneId);
    const baseRow = requireSceneShotListForScene({
      session,
      sceneId: input.document.sceneId,
      shotListId: input.document.baseShotListId,
    });
    const baseDocument = readSceneShotListDocument({
      row: baseRow,
      screenplay,
    });
    const operationResult = buildShotListDocumentFromOperations({
      base: baseDocument,
      operationsDocument: input.document,
    });
    const nextDocument = operationResult.document;
    const documentWarnings = assertSceneShotListDocument({
      document: nextDocument,
      screenplay,
      filePath: input.filePath,
    });
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const createdShotListId = input.dryRun
      ? `${input.document.baseShotListId}_dry_run`
      : ids('scene_shot_list');
    const now = new Date().toISOString();

    if (!input.dryRun) {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        writeSceneShotListRecord({
          session: txSession,
          id: createdShotListId,
          document: nextDocument,
          screenplay,
          now,
          filePath: input.filePath,
        });
        carryForwardStoryboardImages({
          session: txSession,
          baseShotListId: input.document.baseShotListId,
          createdShotListId,
          sceneId: input.document.sceneId,
          shots: nextDocument.shots,
          preservedShotIds: operationResult.preservedShotIds,
          ids,
          now,
        });
        if (input.document.activate) {
          setActiveSceneShotListRecord(txSession, {
            sceneId: input.document.sceneId,
            shotListId: createdShotListId,
            now,
          });
        }
      });
    }

    const summaryRow = input.dryRun
      ? {
          id: createdShotListId,
          sceneId: input.document.sceneId,
          title: nextDocument.title,
          document: JSON.stringify(nextDocument),
          createdAt: now,
          updatedAt: now,
        }
      : requireSceneShotListRecord(session, createdShotListId);
    const storyboard = input.dryRun
      ? readDryRunSceneShotListStoryboardStatusFromSession({
          session,
          currentProject,
          sceneId: input.document.sceneId,
          baseShotListId: input.document.baseShotListId,
          shotListId: createdShotListId,
          document: nextDocument,
          preservedShotIds: operationResult.preservedShotIds,
        })
      : readSceneShotListStoryboardStatusFromSession({
          session,
          currentProject,
          sceneId: input.document.sceneId,
          shotListId: createdShotListId,
          document: nextDocument,
        });
    const changedShotIds = [
      ...operationResult.insertedShotIds,
      ...operationResult.removedShotIds,
      ...operationResult.updatedShotIds,
      ...storyboard.missingShotIds,
      ...storyboard.staleShotIds,
    ].filter((shotId, index, ids) => ids.indexOf(shotId) === index);
    return {
      valid: true,
      warnings: [...warnings, ...documentWarnings],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.document.sceneId,
        shotListId: createdShotListId,
        shotIds: changedShotIds,
      }),
      sceneId: input.document.sceneId,
      baseShotListId: input.document.baseShotListId,
      createdShotListId,
      activatedShotListId:
        !input.dryRun && input.document.activate ? createdShotListId : null,
      shotList: toSceneShotListSummary({
        row: summaryRow,
        screenplay,
        activeShotListId:
          !input.dryRun && input.document.activate
            ? createdShotListId
            : readActiveSceneShotListId(session, input.document.sceneId),
      }),
      changes: operationResult.changes,
      storyboard,
      prunedVideoTakeRailGroupIds: operationResult.prunedVideoTakeRailGroupIds,
      prunedVideoTakeProductionGroupIds:
        operationResult.prunedVideoTakeProductionGroupIds,
    };
  });
}

export async function readSceneShotListStoryboardStatus(
  input: ReadSceneShotListStoryboardStatusInput
): Promise<SceneShotListStoryboardStatus> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    requireSceneHierarchy(screenplay, input.sceneId);
    const row = requireSceneShotListForScene({
      session,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
    });
    return readSceneShotListStoryboardStatusFromSession({
      session,
      currentProject,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      document: readSceneShotListDocument({ row, screenplay }),
    });
  });
}

function buildShotListDocumentFromOperations(input: {
  base: SceneShotListDocument;
  operationsDocument: SceneShotListOperationDocument;
}): {
  document: SceneShotListDocument;
  changes: SceneShotListApplyChange[];
  insertedShotIds: string[];
  removedShotIds: string[];
  updatedShotIds: string[];
  preservedShotIds: string[];
  prunedVideoTakeRailGroupIds: string[];
  prunedVideoTakeProductionGroupIds: string[];
} {
  const draft: SceneShotListDocument = {
    ...structuredClone(input.base),
    sceneId: input.operationsDocument.sceneId,
    baseShotListId: input.operationsDocument.baseShotListId,
    ...(input.operationsDocument.title ? { title: input.operationsDocument.title } : {}),
    ...(input.operationsDocument.summary
      ? { summary: input.operationsDocument.summary }
      : {}),
    ...(input.operationsDocument.coverageStrategy
      ? { coverageStrategy: input.operationsDocument.coverageStrategy }
      : {}),
    ...(input.operationsDocument.lookbookInfluence
      ? { lookbookInfluence: input.operationsDocument.lookbookInfluence }
      : {}),
    ...(input.operationsDocument.openQuestions
      ? { openQuestions: input.operationsDocument.openQuestions }
      : {}),
  };
  const originalShotIds = new Set(input.base.shots.map((shot) => shot.shotId));
  const touchedShotIds = new Set<string>();
  for (const operation of input.operationsDocument.operations) {
    applyShotListOperation(draft, operation, touchedShotIds);
  }
  const nextShotIds = new Set(draft.shots.map((shot) => shot.shotId));
  const insertedShotIds = draft.shots
    .filter((shot) => !originalShotIds.has(shot.shotId))
    .map((shot) => shot.shotId);
  const removedShotIds = input.base.shots
    .filter((shot) => !nextShotIds.has(shot.shotId))
    .map((shot) => shot.shotId);
  const updatedShotIds = [...touchedShotIds].filter(
    (shotId) => originalShotIds.has(shotId) && nextShotIds.has(shotId)
  );
  const preservedShotIds = draft.shots
    .filter(
      (shot) =>
        originalShotIds.has(shot.shotId) && !touchedShotIds.has(shot.shotId)
    )
    .map((shot) => shot.shotId);
  const pruned = pruneInvalidVideoTakeGroups(draft, nextShotIds);
  const changes: SceneShotListApplyChange[] = [
    { type: 'inserted', shotIds: insertedShotIds },
    { type: 'removed', shotIds: removedShotIds },
    { type: 'updated', shotIds: updatedShotIds },
    { type: 'preserved', shotIds: preservedShotIds },
  ];
  return {
    document: draft,
    changes,
    insertedShotIds,
    removedShotIds,
    updatedShotIds,
    preservedShotIds,
    ...pruned,
  };
}

function applyShotListOperation(
  draft: SceneShotListDocument,
  operation: SceneShotListOperation,
  touchedShotIds: Set<string>
): void {
  switch (operation.operation) {
    case 'shots.insert':
      insertShotsByPlacement(draft.shots, operation.placement, operation.shots);
      operation.shots.forEach((shot) => touchedShotIds.add(shot.shotId));
      return;
    case 'shots.replace': {
      const firstIndex = firstShotIndex(draft.shots, operation.shotIds);
      removeShotIds(draft.shots, operation.shotIds);
      draft.shots.splice(firstIndex, 0, ...operation.shots);
      operation.shotIds.forEach((shotId) => touchedShotIds.add(shotId));
      operation.shots.forEach((shot) => touchedShotIds.add(shot.shotId));
      return;
    }
    case 'shot.update': {
      const index = draft.shots.findIndex(
        (shot) => shot.shotId === operation.shot.shotId
      );
      if (index === -1) {
        throw new ProjectDataError(
          'PROJECT_DATA326',
          `Shot update references a shot id that is not in the base Scene Shot List: ${operation.shot.shotId}.`,
          { suggestion: 'Use a shot id from the explicit base shot list.' }
        );
      }
      draft.shots[index] = operation.shot;
      touchedShotIds.add(operation.shot.shotId);
      return;
    }
    case 'shots.delete':
      removeShotIds(draft.shots, operation.shotIds);
      operation.shotIds.forEach((shotId) => touchedShotIds.add(shotId));
      return;
    case 'shotList.replace':
      draft.shots = [...operation.shots];
      [...new Set([...draft.shots.map((shot) => shot.shotId)])].forEach((shotId) =>
        touchedShotIds.add(shotId)
      );
      return;
  }
}

function insertShotsByPlacement(
  shots: SceneShot[],
  placement: Extract<
    SceneShotListOperation,
    { operation: 'shots.insert' }
  >['placement'],
  inserted: SceneShot[]
): void {
  if (placement.position === 'start') {
    shots.splice(0, 0, ...inserted);
    return;
  }
  if (placement.position === 'end') {
    shots.push(...inserted);
    return;
  }
  const index = shots.findIndex((shot) => shot.shotId === placement.shotId);
  if (index === -1) {
    throw new ProjectDataError(
      'PROJECT_DATA326',
      `Shot insertion placement was not found: ${placement.shotId}.`,
      { suggestion: 'Use a placement shot id from the explicit base shot list.' }
    );
  }
  shots.splice(placement.position === 'before' ? index : index + 1, 0, ...inserted);
}

function firstShotIndex(shots: SceneShot[], shotIds: string[]): number {
  const targetIds = new Set(shotIds);
  const index = shots.findIndex((shot) => targetIds.has(shot.shotId));
  if (index === -1) {
    throw new ProjectDataError(
      'PROJECT_DATA326',
      'Shot replacement references no shot ids in the base Scene Shot List.',
      { suggestion: 'Use shot ids from the explicit base shot list.' }
    );
  }
  return index;
}

function removeShotIds(shots: SceneShot[], shotIds: string[]): void {
  for (const shotId of shotIds) {
    const index = shots.findIndex((shot) => shot.shotId === shotId);
    if (index === -1) {
      throw new ProjectDataError(
        'PROJECT_DATA326',
        `Shot operation references a shot id that is not in the base Scene Shot List: ${shotId}.`,
        { suggestion: 'Use shot ids from the explicit base shot list.' }
      );
    }
    shots.splice(index, 1);
  }
}

function pruneInvalidVideoTakeGroups(
  document: SceneShotListDocument,
  validShotIds: Set<string>
): {
  prunedVideoTakeRailGroupIds: string[];
  prunedVideoTakeProductionGroupIds: string[];
} {
  const prunedVideoTakeRailGroupIds: string[] = [];
  const prunedVideoTakeProductionGroupIds: string[] = [];
  document.videoTakeRailGroups = (document.videoTakeRailGroups ?? [])
    .map((group) => ({
      ...group,
      shotIds: group.shotIds.filter((shotId) => validShotIds.has(shotId)),
    }))
    .filter((group) => {
      const keep = group.shotIds.length > 0;
      if (!keep) {
        prunedVideoTakeRailGroupIds.push(group.productionGroupId);
      }
      return keep;
    });
  document.videoTakeProductionGroups = (document.videoTakeProductionGroups ?? [])
    .map((group) => ({
      ...group,
      shotIds: group.shotIds.filter((shotId) => validShotIds.has(shotId)),
    }))
    .filter((group) => {
      const keep = group.shotIds.length > 0;
      if (!keep) {
        prunedVideoTakeProductionGroupIds.push(group.productionGroupId);
      }
      return keep;
    });
  if (document.videoTakeRailGroups.length === 0) {
    delete document.videoTakeRailGroups;
  }
  if (document.videoTakeProductionGroups.length === 0) {
    delete document.videoTakeProductionGroups;
  }
  return { prunedVideoTakeRailGroupIds, prunedVideoTakeProductionGroupIds };
}

function carryForwardStoryboardImages(input: {
  session: Parameters<typeof readActiveSceneShotListId>[0];
  baseShotListId: string;
  createdShotListId: string;
  sceneId: string;
  shots: SceneShot[];
  preservedShotIds: string[];
  ids: ReturnType<typeof createUniqueIdAllocator>;
  now: string;
}): void {
  const preserved = new Set(input.preservedShotIds);
  for (const shot of input.shots) {
    if (!preserved.has(shot.shotId)) {
      continue;
    }
    const image = readCurrentBaseStoryboardImageForShot({
      session: input.session,
      baseShotListId: input.baseShotListId,
      shot,
    });
    if (!image) {
      continue;
    }
    insertSceneShotStoryboardImageRecord(input.session, {
      id: input.ids('scene_shot_storyboard_image'),
      sceneId: input.sceneId,
      shotListId: input.createdShotListId,
      shotId: shot.shotId,
      assetId: image.assetId,
      assetFileId: image.assetFileId,
      sourcePurpose: image.sourcePurpose,
      shotContentFingerprint: image.shotContentFingerprint,
      now: input.now,
    });
  }
}

function readCurrentBaseStoryboardImageForShot(input: {
  session: Parameters<typeof readActiveSceneShotListId>[0];
  baseShotListId: string;
  shot: SceneShot;
}): SceneShotStoryboardImageRecord | null {
  const image = readLatestSceneShotStoryboardImage({
    session: input.session,
    shotListId: input.baseShotListId,
    shotId: input.shot.shotId,
  });
  if (!image || image.shotContentFingerprint !== shotContentFingerprint(input.shot)) {
    return null;
  }
  return image;
}

function readDryRunSceneShotListStoryboardStatusFromSession(input: {
  session: Parameters<typeof readActiveSceneShotListId>[0];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  baseShotListId: string;
  shotListId: string;
  document: SceneShotListDocument;
  preservedShotIds: string[];
}): SceneShotListStoryboardStatus {
  const preserved = new Set(input.preservedShotIds);
  return buildSceneShotListStoryboardStatus({
    currentProject: input.currentProject,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    document: input.document,
    readImageForShot: (shot) => {
      if (!preserved.has(shot.shotId)) {
        return { image: null };
      }
      const image = readCurrentBaseStoryboardImageForShot({
        session: input.session,
        baseShotListId: input.baseShotListId,
        shot,
      });
      return image ? { image, simulated: true } : { image: null };
    },
  });
}

function readSceneShotListStoryboardStatusFromSession(input: {
  session: Parameters<typeof readActiveSceneShotListId>[0];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  shotListId: string;
  document: SceneShotListDocument;
}): SceneShotListStoryboardStatus {
  return buildSceneShotListStoryboardStatus({
    currentProject: input.currentProject,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    document: input.document,
    readImageForShot: (shot) => ({
      image: readLatestSceneShotStoryboardImage({
        session: input.session,
        shotListId: input.shotListId,
        shotId: shot.shotId,
      }),
    }),
  });
}

function buildSceneShotListStoryboardStatus(input: {
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  shotListId: string;
  document: SceneShotListDocument;
  readImageForShot: (shot: SceneShot) => {
    image: SceneShotStoryboardImageRecord | null;
    simulated?: boolean;
  };
}): SceneShotListStoryboardStatus {
  const shots: SceneShotListStoryboardShotStatus[] = input.document.shots.map((shot) => {
    const { image, simulated } = input.readImageForShot(shot);
    const currentFingerprint = shotContentFingerprint(shot);
    const isCurrentForShot =
      image?.shotContentFingerprint === currentFingerprint;
    const status: SceneShotListStoryboardShotStatus = {
      shotId: shot.shotId,
      image: image
        ? {
            storyboardImageId: image.id,
            assetId: image.assetId,
            assetFileId: image.assetFileId,
            sourcePurpose: image.sourcePurpose,
            isCurrentForShot,
            ...(simulated ? { simulated } : {}),
          }
        : null,
      needsStoryboardImage: !image || !isCurrentForShot,
      ...(!image
        ? { reason: 'missing' as const }
        : !isCurrentForShot
          ? { reason: 'shot-changed' as const }
          : {}),
    };
    return status;
  });
  return {
    valid: true,
    warnings: [],
    project: {
      name: input.currentProject.projectName,
      id: input.currentProject.projectId,
      projectFolder: input.currentProject.projectFolder,
    },
    resourceKeys: sceneShotListResourceKeys({
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      shotIds: shots.map((shot) => shot.shotId),
    }),
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    shots,
    missingShotIds: shots
      .filter((shot) => shot.reason === 'missing')
      .map((shot) => shot.shotId),
    staleShotIds: shots
      .filter((shot) => shot.reason === 'shot-changed')
      .map((shot) => shot.shotId),
    readyShotIds: shots
      .filter((shot) => !shot.needsStoryboardImage)
      .map((shot) => shot.shotId),
  };
}

export function sceneShotListResourceKeys(input: {
  sceneId: string;
  shotListId?: string | null;
  shotIds?: string[];
}): string[] {
  return [
    studioSceneShotsResourceKey(input.sceneId),
    SCENE_SHOT_LIST_RESOURCE_KEY,
    ...(input.shotListId ? [studioSceneShotListResourceKey(input.shotListId)] : []),
    ...(input.shotListId
      ? (input.shotIds ?? []).map(
          (shotId) => studioSceneShotResourceKey(input.shotListId as string, shotId)
        )
      : []),
    studioSceneNarrativeResourceKey(input.sceneId),
  ];
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
) {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return { act, sequence, scene };
        }
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

function collectSceneReferences(
  scene: Scene,
  screenplay: ScreenplayDocument
): { cast: CastMember[]; locations: Location[] } {
  const castMemberIds = new Set<string>();
  const locationIds = new Set<string>(scene.setting.locationIds ?? []);
  for (const block of scene.blocks) {
    for (const castMemberId of block.castMemberIds ?? []) {
      castMemberIds.add(castMemberId);
    }
    if (block.type === 'dialogue' && block.castMemberId) {
      castMemberIds.add(block.castMemberId);
    }
    for (const locationId of block.locationIds ?? []) {
      locationIds.add(locationId);
    }
  }
  return {
    cast: screenplay.cast.filter(
      (castMember): castMember is CastMember & { id: string } =>
        Boolean(castMember.id && castMemberIds.has(castMember.id))
    ),
    locations: screenplay.locations.filter(
      (location): location is Location & { id: string } =>
        Boolean(location.id && locationIds.has(location.id))
    ),
  };
}

function readActiveLookbookContext(
  session: Parameters<typeof readActiveLookbookId>[0]
): SceneShotListContextReport['activeLookbook'] {
  const activeLookbookId = readActiveLookbookId(session);
  if (!activeLookbookId) {
    return null;
  }
  const lookbook = toLookbook(requireLookbookRecordById(session, activeLookbookId));
  return {
    id: lookbook.id,
    name: lookbook.name,
    thesis: JSON.stringify(lookbook.thesis),
    palette: JSON.stringify(lookbook.palette),
    camera: JSON.stringify(lookbook.camera),
    toneMood: JSON.stringify(lookbook.toneMood),
    texture: JSON.stringify(lookbook.texture),
    composition: JSON.stringify(lookbook.composition),
    lighting: JSON.stringify(lookbook.lighting),
  };
}

function requiredSceneId(value: string | undefined, flag: string): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA327', 'Scene id is required.', {
    suggestion: `Pass ${flag} <scene-id>.`,
  });
}

function requiredShotListId(value: string | undefined): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA328', 'Scene Shot List id is required.', {
    suggestion: 'Pass --shot-list <shot-list-id>.',
  });
}
