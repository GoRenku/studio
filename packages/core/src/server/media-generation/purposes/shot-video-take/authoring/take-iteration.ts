import type {
  ProjectRelativePath,
  SceneShotVideoTake,
  SceneShotVideoTakeMediaInput,
  SceneShotVideoTakeProductionState,
  SceneShotVideoTakeState,
  ShotVideoTakePreparedInput,
  ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import type {
  ScreenplayDocument,
} from '../../../../../client/screenplay.js';
import {
  insertSceneShotVideoTakeRecord,
  updateSceneShotVideoTakeProductionRecord,
} from '../../../../database/access/scene-shot-video-takes.js';
import {
  insertShotVideoTakeInputRecord,
  listShotVideoTakeInputs,
} from '../../../../database/access/shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../../../entity-ids.js';
import type {
  EntityIdPrefix,
} from '../../../../entity-ids.js';
import type {
  ShotVideoTakeContextInput,
} from '../../../../project-data-service-contracts.js';
import {
  sceneShotVideoTakeResourceKeys,
} from '../shared/resource-keys.js';
import {
  retargetTakeScopedProductionState,
} from './take-production-state.js';
import {
  copyTakeOwnedMediaAssetFile,
  isShotVideoTakeOwnedMediaAsset,
  removeCopiedTakeOwnedMediaAssetFile,
} from '../ownership/take-owned-media.js';
import {
  resolveShotVideoTakeFolder,
} from '../shared/take-media-paths.js';
import {
  assertEditableSceneShotVideoTake,
  type PreparedSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
} from './take-context.js';

export interface SceneShotVideoTakeIterationTarget {
  sourcePrepared: PreparedSceneShotVideoTake;
  prepared: PreparedSceneShotVideoTake;
  sourceTake: SceneShotVideoTake;
  take: SceneShotVideoTake;
  createdIterationTake: boolean;
  copiedInputs: CopiedShotVideoTakeInputRecord[];
  resourceKeys: string[];
}

export interface CopiedShotVideoTakeInputRecord {
  sourceInput: SceneShotVideoTakeMediaInput;
  input: SceneShotVideoTakeMediaInput;
}

export function continueSceneShotVideoTakeIteration(input: {
  session: DatabaseSession;
  projectFolder: string;
  contextInput: ShotVideoTakeContextInput;
  screenplay: ScreenplayDocument;
  now: string;
  title?: string;
  productionForOwnedMediaCopy?: SceneShotVideoTakeProductionState;
}): SceneShotVideoTakeIterationTarget {
  const sourcePrepared = prepareSceneShotVideoTakeInSession({
    session: input.session,
    input: input.contextInput,
  });
  assertEditableSceneShotVideoTake(sourcePrepared.take);
  if (!sourcePrepared.take.video) {
    return {
      sourcePrepared,
      prepared: sourcePrepared,
      sourceTake: sourcePrepared.take,
      take: sourcePrepared.take,
      createdIterationTake: false,
      copiedInputs: [],
      resourceKeys: sceneShotVideoTakeResourceKeys({
        sceneId: sourcePrepared.sceneId,
        takeId: sourcePrepared.take.takeId,
      }),
    };
  }

  const ids = createUniqueIdAllocator(
    input.contextInput.idGenerator ?? createRandomIdGenerator()
  );
  const targetTakeId = ids('scene_shot_video_take');
  const copiedState = sceneShotVideoTakeStateForIteration({
    state: sourcePrepared.take.state,
    targetTakeId,
  });
  const copiedOwnedMediaPaths: ProjectRelativePath[] = [];
  try {
    return input.session.db.transaction((tx) => {
      const transactionSession = {
        ...input.session,
        db: tx as DatabaseSession['db'],
      };
      const targetTake = insertSceneShotVideoTakeRecord(transactionSession, {
        id: targetTakeId,
        sceneId: sourcePrepared.sceneId,
        shotListId: sourcePrepared.sourceShotListId,
        title: input.title ?? `${sourcePrepared.take.title} iteration`,
        shotIds: sourcePrepared.orderedShotIds,
        state: copiedState,
        regeneratedFromTakeId: sourcePrepared.take.takeId,
        screenplay: input.screenplay,
        now: input.now,
      });
      const copiedInputs = copyShotVideoTakeInputRecordsForIteration(
        transactionSession,
        {
          projectFolder: input.projectFolder,
          sourceSceneId: sourcePrepared.sceneId,
          sourceTakeId: sourcePrepared.take.takeId,
          sourceState: sourcePrepared.take.state,
          productionForOwnedMediaCopy: input.productionForOwnedMediaCopy,
          targetSceneId: targetTake.sceneId,
          targetTakeId: targetTake.takeId,
          targetTakeFolder: resolveShotVideoTakeFolder({
            session: transactionSession,
            projectFolder: input.projectFolder,
            take: targetTake,
            now: input.now,
          }),
          now: input.now,
          nextId: ids,
          onCopiedOwnedMediaFile: (copy) => {
            copiedOwnedMediaPaths.push(copy.projectRelativePath);
          },
        }
      );
      updateSceneShotVideoTakeProductionRecord(transactionSession, {
        takeId: targetTake.takeId,
        production: sceneShotVideoTakeStateWithCopiedOwnedMedia({
          state: copiedState,
          copiedInputs,
        }).production,
        screenplay: input.screenplay,
        now: input.now,
      });
      const prepared = prepareSceneShotVideoTakeInSession({
        session: transactionSession,
        input: {
          ...input.contextInput,
          sceneId: targetTake.sceneId,
          takeId: targetTake.takeId,
        },
      });

      return {
        sourcePrepared,
        prepared,
        sourceTake: sourcePrepared.take,
        take: prepared.take,
        createdIterationTake: true,
        copiedInputs,
        resourceKeys: [
          ...sceneShotVideoTakeResourceKeys({
            sceneId: sourcePrepared.sceneId,
            takeId: sourcePrepared.take.takeId,
          }),
          ...sceneShotVideoTakeResourceKeys({
            sceneId: prepared.sceneId,
            takeId: prepared.take.takeId,
            inputIds: copiedInputs.map((copy) => copy.input.inputId),
            assetIds: copiedInputs.map((copy) => copy.input.assetId),
          }),
        ],
      };
    });
  } catch (error) {
    removeCopiedOwnedMediaFiles({
      projectFolder: input.projectFolder,
      projectRelativePaths: copiedOwnedMediaPaths,
    });
    throw error;
  }
}

function copyShotVideoTakeInputRecordsForIteration(
  session: DatabaseSession,
  input: {
    projectFolder: string;
    sourceSceneId: string;
    sourceTakeId: string;
    sourceState: SceneShotVideoTakeState;
    productionForOwnedMediaCopy?: SceneShotVideoTakeProductionState;
    targetSceneId: string;
    targetTakeId: string;
    targetTakeFolder: ProjectRelativePath;
    now: string;
    nextId: (prefix: EntityIdPrefix) => string;
    onCopiedOwnedMediaFile: (copy: { projectRelativePath: ProjectRelativePath }) => void;
  }
): CopiedShotVideoTakeInputRecord[] {
  const preparedInputs = preparedInputsForOwnedMediaCopy({
    sourceState: input.sourceState,
    production: input.productionForOwnedMediaCopy,
  });
  return listShotVideoTakeInputs(session, {
    sceneId: input.sourceSceneId,
    takeId: input.sourceTakeId,
  })
    .filter((mediaInput) =>
      shouldCopyInputForIteration({
        session,
        mediaInput,
        preparedInputs,
        sourceTakeId: input.sourceTakeId,
        targetTakeId: input.targetTakeId,
      })
    )
    .map((mediaInput) => {
      const takeOwnedAsset = isShotVideoTakeOwnedMediaAsset(session, {
        inputKind: mediaInput.kind,
        assetId: mediaInput.assetId,
      });
      let copiedAsset: { assetId: string; assetFileId: string };
      if (takeOwnedAsset) {
        const copiedOwnedMedia = copyTakeOwnedMediaAssetFile({
          session,
          projectFolder: input.projectFolder,
          sourceAssetId: mediaInput.assetId,
          sourceAssetFileId: mediaInput.assetFileId,
          targetTakeId: input.targetTakeId,
          targetTakeFolder: input.targetTakeFolder,
          inputKind: mediaInput.kind,
          now: input.now,
          nextId: input.nextId,
        });
        input.onCopiedOwnedMediaFile(copiedOwnedMedia);
        copiedAsset = copiedOwnedMedia;
      } else {
        copiedAsset = {
          assetId: mediaInput.assetId,
          assetFileId: mediaInput.assetFileId,
        };
      }
      return {
        sourceInput: mediaInput,
        input: insertShotVideoTakeInputRecord(session, {
          id: input.nextId('scene_shot_video_take_media_input'),
          sceneId: input.targetSceneId,
          takeId: input.targetTakeId,
          inputKind: mediaInput.kind,
          subjectKind: mediaInput.subjectKind,
          subjectId:
            mediaInput.subjectKind === 'take'
              ? input.targetTakeId
              : mediaInput.subjectId,
          assetId: copiedAsset.assetId,
          assetFileId: copiedAsset.assetFileId,
          mediaGenerationRunId: mediaInput.mediaGenerationRunId ?? null,
          selection: mediaInput.selected ? 'select' : 'take',
          shotIds: mediaInput.shotIds,
          now: input.now,
        }),
      };
    });
}

function shouldCopyInputForIteration(input: {
  session: DatabaseSession;
  mediaInput: SceneShotVideoTakeMediaInput;
  preparedInputs: ShotVideoTakePreparedInput[];
  sourceTakeId: string;
  targetTakeId: string;
}): boolean {
  if (input.mediaInput.selected) {
    return true;
  }
  if (
    !isShotVideoTakeOwnedMediaAsset(input.session, {
      inputKind: input.mediaInput.kind,
      assetId: input.mediaInput.assetId,
    })
  ) {
    return false;
  }
  return input.preparedInputs.some((preparedInput) =>
    preparedInputReferencesMediaInput({
      preparedInput,
      mediaInput: input.mediaInput,
      sourceTakeId: input.sourceTakeId,
      targetTakeId: input.targetTakeId,
    })
  );
}

function preparedInputsForOwnedMediaCopy(input: {
  sourceState: SceneShotVideoTakeState;
  production?: SceneShotVideoTakeProductionState;
}): ShotVideoTakePreparedInput[] {
  return [
    ...(input.sourceState.production.preparedInputs ?? []),
    ...(input.production?.preparedInputs ?? []),
  ];
}

function preparedInputReferencesMediaInput(input: {
  preparedInput: ShotVideoTakePreparedInput;
  mediaInput: SceneShotVideoTakeMediaInput;
  sourceTakeId: string;
  targetTakeId: string;
}): boolean {
  return (
    input.preparedInput.kind === input.mediaInput.kind &&
    input.preparedInput.assetId === input.mediaInput.assetId &&
    preparedInputAssetFileMatchesInput(input) &&
    input.preparedInput.subjectKind === input.mediaInput.subjectKind &&
    preparedInputSubjectMatchesInput(input)
  );
}

function preparedInputAssetFileMatchesInput(input: {
  preparedInput: ShotVideoTakePreparedInput;
  mediaInput: SceneShotVideoTakeMediaInput;
}): boolean {
  return (
    !input.preparedInput.assetFileId ||
    input.preparedInput.assetFileId === input.mediaInput.assetFileId
  );
}

function preparedInputSubjectMatchesInput(input: {
  preparedInput: ShotVideoTakePreparedInput;
  mediaInput: SceneShotVideoTakeMediaInput;
  sourceTakeId: string;
  targetTakeId: string;
}): boolean {
  if (input.mediaInput.subjectKind === 'take') {
    return (
      input.preparedInput.subjectId === input.sourceTakeId ||
      input.preparedInput.subjectId === input.targetTakeId
    );
  }
  return input.preparedInput.subjectId === input.mediaInput.subjectId;
}

function removeCopiedOwnedMediaFiles(input: {
  projectFolder: string;
  projectRelativePaths: ProjectRelativePath[];
}): void {
  for (const projectRelativePath of input.projectRelativePaths) {
    try {
      removeCopiedTakeOwnedMediaAssetFile({
        projectFolder: input.projectFolder,
        projectRelativePath,
      });
    } catch {
      // Preserve the original iteration failure for callers.
    }
  }
}

export function contextWithIterationResourceKeys(
  context: ShotVideoTakeProductionContext,
  iteration: SceneShotVideoTakeIterationTarget
): ShotVideoTakeProductionContext {
  return {
    ...context,
    resourceKeys: uniqueResourceKeys([
      ...iteration.resourceKeys,
      ...context.resourceKeys,
    ]),
  };
}

function sceneShotVideoTakeStateForIteration(input: {
  state: SceneShotVideoTakeState;
  targetTakeId: string;
}): SceneShotVideoTakeState {
  const state = structuredClone(input.state);
  return {
    ...state,
    production: retargetTakeScopedProductionState({
      production: state.production,
      targetTakeId: input.targetTakeId,
    }),
  };
}

export function sceneShotVideoTakeStateWithCopiedOwnedMedia(input: {
  state: SceneShotVideoTakeState;
  copiedInputs: CopiedShotVideoTakeInputRecord[];
}): SceneShotVideoTakeState {
  if (!input.state.production.preparedInputs) {
    return input.state;
  }
  return {
    ...input.state,
    production: {
      ...input.state.production,
      preparedInputs: input.state.production.preparedInputs.map(
        (preparedInput) => {
          const copiedInput = input.copiedInputs.find(
            (candidate) =>
              preparedInputReferencesMediaInput({
                preparedInput,
                mediaInput: candidate.sourceInput,
                sourceTakeId: candidate.sourceInput.takeId,
                targetTakeId: candidate.input.takeId,
              })
          );
          if (!copiedInput) {
            return preparedInput;
          }
          return {
            ...preparedInput,
            assetId: copiedInput.input.assetId,
            assetFileId: copiedInput.input.assetFileId,
          };
        }
      ),
    },
  };
}

function uniqueResourceKeys(resourceKeys: string[]): string[] {
  return [...new Set(resourceKeys)];
}
