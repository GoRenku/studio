import type {
  ProjectRelativePath,
  ShotVideoTakeProductionContext,
  SceneShotVideoTakeMediaInput,
} from '../../../../../client/index.js';
import {
  readAssetFileRecord,
} from '../../../../database/access/asset-files.js';
import {
  insertShotVideoTakeInputRecord,
  requireShotVideoTakeInput,
  readShotVideoTakeVideo,
  selectShotVideoTakeInputRecord,
  clearShotVideoTakeInputRecordSelection,
  listShotVideoTakeInputs as listShotVideoTakeInputRecords,
} from '../../../../database/access/shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  resolveProjectRelativePath,
} from '../../../../files/project-relative-paths.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../../../entity-ids.js';
import type {
  ShotVideoTakeContextInput,
  ResolveShotVideoTakeInputFileInput,
  ResolvedShotVideoTakeInputFile,
  ResolveShotVideoTakeVideoFileInput,
  ResolvedShotVideoTakeVideoFile,
  SelectShotVideoTakeInputInput,
  ClearShotVideoTakeInputSelectionInput,
  DeleteShotVideoTakeInputInput,
} from '../../../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
  buildShotVideoTakeContext,
} from '../authoring/context.js';
import {
  assertResolvedPathInsideProject,
} from '../shared/project-media-files.js';
import {
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  PreparedSceneShotVideoTake,
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
  sameShotIds,
} from '../authoring/take-context.js';
import {
  contextWithIterationResourceKeys,
  continueSceneShotVideoTakeIteration,
  type SceneShotVideoTakeIterationTarget,
} from '../authoring/take-iteration.js';
import {
  updateSceneShotVideoTakeProductionRecord,
} from '../../../../database/access/scene-shot-video-takes.js';
import {
  requireScreenplayDocument,
} from '../shared/project-session.js';
import { discardTrashObject } from '../../../../trash/trash-lifecycle-service.js';



export async function listShotVideoTakeInputs(input: ShotVideoTakeContextInput) {
  const context = await buildShotVideoTakeContext(input);
  return {
    inputs: context.mediaInputs,
    resourceKeys: context.resourceKeys,
  };
}



export async function resolveShotVideoTakeInputFile(
  input: ResolveShotVideoTakeInputFileInput
): Promise<ResolvedShotVideoTakeInputFile> {
  return withShotProjectSession(input, ({ session, projectFolder }) => {
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    const shotInput = requireShotVideoTakeInput(session, input.inputId);
    if (
      shotInput.takeId !== prepared.take.takeId ||
      !sameShotIds(shotInput.shotIds, prepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different Shot Video Take.'
      );
    }
    if (shotInput.assetFileId !== input.assetFileId) {
      throw new ProjectDataError(
        'PROJECT_DATA409',
        `Shot video take input file is not attached to the requested input: ${input.assetFileId}.`
      );
    }
    const fileRecord = readAssetFileRecord(session, {
      assetId: shotInput.assetId,
      assetFileId: input.assetFileId,
    });
    if (!fileRecord) {
      throw new ProjectDataError(
        'PROJECT_DATA410',
        `Shot video take input asset file was not found: ${input.assetFileId}.`
      );
    }
    const absolutePath = resolveProjectRelativePath(
      projectFolder,
      fileRecord.projectRelativePath as ProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    return {
      input: shotInput,
      file: {
        id: fileRecord.id,
        role: fileRecord.role,
        projectRelativePath: fileRecord.projectRelativePath as ProjectRelativePath,
        mediaKind: fileRecord.mediaKind,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        contentHash: fileRecord.contentHash,
        width: fileRecord.width,
        height: fileRecord.height,
        durationSeconds: fileRecord.durationSeconds,
      },
      absolutePath,
    };
  });
}

export async function resolveShotVideoTakeVideoFile(
  input: ResolveShotVideoTakeVideoFileInput
): Promise<ResolvedShotVideoTakeVideoFile> {
  return withShotProjectSession(input, ({ session, projectFolder }) => {
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    const video = readShotVideoTakeVideo(session, prepared.take.takeId);
    if (!video) {
      throw new ProjectDataError(
        'PROJECT_DATA424',
        `Shot video take has no final video: ${prepared.take.takeId}.`
      );
    }
    if (video.assetFileId !== input.assetFileId) {
      throw new ProjectDataError(
        'PROJECT_DATA425',
        `Shot video take video file is not attached to the requested take: ${input.assetFileId}.`
      );
    }
    const fileRecord = readAssetFileRecord(session, {
      assetId: video.assetId,
      assetFileId: input.assetFileId,
    });
    if (!fileRecord) {
      throw new ProjectDataError(
        'PROJECT_DATA426',
        `Shot video take video asset file was not found: ${input.assetFileId}.`
      );
    }
    if (fileRecord.mediaKind !== 'video') {
      throw new ProjectDataError(
        'PROJECT_DATA427',
        `Shot video take video asset file is not video media: ${input.assetFileId}.`
      );
    }
    const absolutePath = resolveProjectRelativePath(
      projectFolder,
      fileRecord.projectRelativePath as ProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    return {
      take: prepared.take,
      file: {
        id: fileRecord.id,
        role: fileRecord.role,
        projectRelativePath: fileRecord.projectRelativePath as ProjectRelativePath,
        mediaKind: fileRecord.mediaKind,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        contentHash: fileRecord.contentHash,
        width: fileRecord.width,
        height: fileRecord.height,
        durationSeconds: fileRecord.durationSeconds,
      },
      absolutePath,
    };
  });
}



export async function selectShotVideoTakeInput(
  input: SelectShotVideoTakeInputInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const sourcePrepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(sourcePrepared.take);
    const selectedBeforeMutation = requireShotVideoTakeInput(session, input.inputId);
    if (
      selectedBeforeMutation.takeId !== sourcePrepared.take.takeId ||
      !sameShotIds(selectedBeforeMutation.shotIds, sourcePrepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different Shot Video Take.'
      );
    }
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    const targetInput = inputForIterationSelection({
      session,
      input,
      iteration,
      sourceInput: selectedBeforeMutation,
      now,
    });
    const selected = targetInput.selected
      ? targetInput
      : selectShotVideoTakeInputRecord(session, {
          inputId: targetInput.inputId,
          now,
        });
    updatePreparedInputSelection({
      session,
      prepared: iteration.prepared,
      now,
      input: selected,
      selected: true,
    });
    return contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshedPreparedForIteration({
          session,
          input,
          iteration,
        }),
      }),
      iteration
    );
  });
}



export async function clearShotVideoTakeInputSelection(
  input: ClearShotVideoTakeInputSelectionInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    clearShotVideoTakeInputRecordSelection(session, {
      sceneId: iteration.prepared.sceneId,
      takeId: iteration.take.takeId,
      inputKind: input.kind,
      subjectKind: input.subjectKind,
      subjectId: subjectIdForIterationTake({
        iteration,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
      }),
      now,
    });
    updatePreparedInputSelection({
      session,
      prepared: iteration.prepared,
      now,
      input: {
        kind: input.kind,
        assetId: '',
        assetFileId: '',
        subjectKind: input.subjectKind,
        subjectId: subjectIdForIterationTake({
          iteration,
          subjectKind: input.subjectKind,
          subjectId: input.subjectId,
        }),
      },
      selected: false,
    });
    return contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshedPreparedForIteration({
          session,
          input,
          iteration,
        }),
      }),
      iteration
    );
  });
}



export async function deleteShotVideoTakeInput(
  input: DeleteShotVideoTakeInputInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const sourcePrepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(sourcePrepared.take);
    const deleting = requireShotVideoTakeInput(session, input.inputId);
    if (
      deleting.takeId !== sourcePrepared.take.takeId ||
      !sameShotIds(deleting.shotIds, sourcePrepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different Shot Video Take.'
      );
    }
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    const targetDeleting = inputForIterationDelete({
      iteration,
      sourceInput: deleting,
    });

    const discardReport = targetDeleting
      ? discardTrashObject({
          session,
          project,
          projectFolder,
          itemKind: 'shotVideoTakeInput',
          itemId: targetDeleting.inputId,
          commandName: 'shotVideoTake.input.discard',
          changes: [
            {
              type: 'shotVideoTakeInput.discarded',
              inputId: targetDeleting.inputId,
            },
          ],
        })
      : null;

    if (targetDeleting?.selected) {
      const replacement = listShotVideoTakeInputRecords(session, {
        sceneId: iteration.prepared.sceneId,
        takeId: iteration.take.takeId,
        shotIds: iteration.prepared.orderedShotIds,
      }).find(
        (candidate) =>
          candidate.kind === targetDeleting.kind &&
          candidate.subjectKind === targetDeleting.subjectKind &&
          candidate.subjectId === targetDeleting.subjectId
      );
      if (replacement) {
        const selected = selectShotVideoTakeInputRecord(session, {
          inputId: replacement.inputId,
          now,
        });
        updatePreparedInputSelection({
          session,
          prepared: iteration.prepared,
          now,
          input: selected,
          selected: true,
        });
      } else {
        updatePreparedInputSelection({
          session,
          prepared: iteration.prepared,
          now,
          input: targetDeleting,
          selected: false,
        });
      }
    }

    const context = contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshedPreparedForIteration({
          session,
          input,
          iteration,
        }),
      }),
      iteration
    );
    return {
      ...context,
      ...(discardReport ? { recovery: discardReport.recovery } : {}),
    };
  });
}


function inputForIterationSelection(input: {
  session: DatabaseSession;
  input: SelectShotVideoTakeInputInput;
  iteration: SceneShotVideoTakeIterationTarget;
  sourceInput: SceneShotVideoTakeMediaInput;
  now: string;
}): SceneShotVideoTakeMediaInput {
  if (!input.iteration.createdIterationTake) {
    return input.sourceInput;
  }
  const copiedInput = input.iteration.copiedInputs.find(
    (copy) => copy.sourceInput.inputId === input.sourceInput.inputId
  );
  if (copiedInput) {
    return copiedInput.input;
  }
  const ids = createUniqueIdAllocator(
    input.input.idGenerator ?? createRandomIdGenerator()
  );
  return insertShotVideoTakeInputRecord(input.session, {
    id: ids('scene_shot_video_take_media_input'),
    sceneId: input.iteration.prepared.sceneId,
    takeId: input.iteration.take.takeId,
    inputKind: input.sourceInput.kind,
    subjectKind: input.sourceInput.subjectKind,
    subjectId: subjectIdForIterationTake({
      iteration: input.iteration,
      subjectKind: input.sourceInput.subjectKind,
      subjectId: input.sourceInput.subjectId,
    }),
    assetId: input.sourceInput.assetId,
    assetFileId: input.sourceInput.assetFileId,
    mediaGenerationRunId: input.sourceInput.mediaGenerationRunId ?? null,
    selection: 'select',
    shotIds: input.sourceInput.shotIds,
    now: input.now,
  });
}

function inputForIterationDelete(input: {
  iteration: SceneShotVideoTakeIterationTarget;
  sourceInput: SceneShotVideoTakeMediaInput;
}): SceneShotVideoTakeMediaInput | null {
  if (!input.iteration.createdIterationTake) {
    return input.sourceInput;
  }
  return (
    input.iteration.copiedInputs.find(
      (copy) => copy.sourceInput.inputId === input.sourceInput.inputId
    )?.input ?? null
  );
}

function refreshedPreparedForIteration(input: {
  session: DatabaseSession;
  input: ShotVideoTakeContextInput;
  iteration: SceneShotVideoTakeIterationTarget;
}): PreparedSceneShotVideoTake {
  return prepareSceneShotVideoTakeInSession({
    session: input.session,
    input: {
      ...input.input,
      sceneId: input.iteration.take.sceneId,
      takeId: input.iteration.take.takeId,
    },
  });
}

function subjectIdForIterationTake(input: {
  iteration: SceneShotVideoTakeIterationTarget;
  subjectKind: string;
  subjectId: string;
}): string {
  return input.subjectKind === 'take'
    ? input.iteration.take.takeId
    : input.subjectId;
}


export function updatePreparedInputSelection(input: {
  session: DatabaseSession;
  prepared: PreparedSceneShotVideoTake;
  now: string;
  input: Pick<
    SceneShotVideoTakeMediaInput,
    'kind' | 'assetId' | 'assetFileId' | 'subjectKind' | 'subjectId'
  >;
  selected: boolean;
}): void {
  const plan = input.prepared.take.state.production;
  const preparedInputs = (plan.preparedInputs ?? []).filter(
    (candidate) =>
      candidate.kind !== input.input.kind ||
      candidate.subjectKind !== input.input.subjectKind ||
      candidate.subjectId !== input.input.subjectId
  );
  if (input.selected) {
    preparedInputs.push({
      kind: input.input.kind,
      assetId: input.input.assetId,
      assetFileId: input.input.assetFileId,
      subjectKind: input.input.subjectKind,
      subjectId: input.input.subjectId,
    });
  }
  const screenplay = requireScreenplayDocument(input.session);
  updateSceneShotVideoTakeProductionRecord(input.session, {
    takeId: input.prepared.take.takeId,
    production: { ...plan, preparedInputs },
    screenplay,
    now: input.now,
  });
}
