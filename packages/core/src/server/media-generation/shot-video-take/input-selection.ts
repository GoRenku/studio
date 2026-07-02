import type {
  ProjectRelativePath,
  ShotVideoTakeProductionContext,
  SceneShotVideoTakeMediaInput,
} from '../../../client/index.js';
import {
  readAssetFileRecord,
} from '../../database/access/asset-files.js';
import {
  requireShotVideoTakeInput,
  readShotVideoTakeVideo,
  selectShotVideoTakeInputRecord,
  clearShotVideoTakeInputRecordSelection,
  listShotVideoTakeInputs as listShotVideoTakeInputRecords,
} from '../../database/access/shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ShotVideoTakeContextInput,
  ResolveShotVideoTakeInputFileInput,
  ResolvedShotVideoTakeInputFile,
  ResolveShotVideoTakeVideoFileInput,
  ResolvedShotVideoTakeVideoFile,
  SelectShotVideoTakeInputInput,
  ClearShotVideoTakeInputSelectionInput,
  DeleteShotVideoTakeInputInput,
} from '../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
  buildShotVideoTakeContext,
} from './context.js';
import {
  assertResolvedPathInsideProject,
} from './project-media-files.js';
import {
  withShotProjectSession,
} from './project-session.js';
import {
  PreparedSceneShotVideoTake,
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
  sameShotIds,
} from './take-context.js';
import {
  updateSceneShotVideoTakeProductionRecord,
} from '../../database/access/scene-shot-video-takes.js';
import {
  requireScreenplayDocument,
} from './project-session.js';
import { discardTrashObject } from '../../trash/trash-lifecycle-service.js';



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
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    const selectedBeforeMutation = requireShotVideoTakeInput(session, input.inputId);
    if (
      selectedBeforeMutation.takeId !== prepared.take.takeId ||
      !sameShotIds(selectedBeforeMutation.shotIds, prepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different Shot Video Take.'
      );
    }
    const selected = selectShotVideoTakeInputRecord(session, {
      inputId: input.inputId,
      now,
    });
    updatePreparedInputSelection({
      session,
      prepared,
      now,
      input: selected,
      selected: true,
    });
    return buildContextFromPrepared({ session, projectFolder, project, prepared });
  });
}



export async function clearShotVideoTakeInputSelection(
  input: ClearShotVideoTakeInputSelectionInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    clearShotVideoTakeInputRecordSelection(session, {
      sceneId: prepared.sceneId,
      takeId: prepared.take.takeId,
      inputKind: input.kind,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      now,
    });
    updatePreparedInputSelection({
      session,
      prepared,
      now,
      input: {
        kind: input.kind,
        assetId: '',
        assetFileId: '',
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
      },
      selected: false,
    });
    return buildContextFromPrepared({ session, projectFolder, project, prepared });
  });
}



export async function deleteShotVideoTakeInput(
  input: DeleteShotVideoTakeInputInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    const deleting = requireShotVideoTakeInput(session, input.inputId);
    if (
      deleting.takeId !== prepared.take.takeId ||
      !sameShotIds(deleting.shotIds, prepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different Shot Video Take.'
      );
    }

    const discardReport = discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'shotVideoTakeInput',
      itemId: input.inputId,
      commandName: 'shotVideoTake.input.discard',
      changes: [
        {
          type: 'shotVideoTakeInput.discarded',
          inputId: input.inputId,
        },
      ],
    });

    if (deleting.selected) {
      const replacement = listShotVideoTakeInputRecords(session, {
        sceneId: prepared.sceneId,
        takeId: prepared.take.takeId,
        shotIds: prepared.orderedShotIds,
      }).find(
        (candidate) =>
          candidate.kind === deleting.kind &&
          candidate.subjectKind === deleting.subjectKind &&
          candidate.subjectId === deleting.subjectId
      );
      if (replacement) {
        const selected = selectShotVideoTakeInputRecord(session, {
          inputId: replacement.inputId,
          now,
        });
        updatePreparedInputSelection({
          session,
          prepared,
          now,
          input: selected,
          selected: true,
        });
      } else {
        updatePreparedInputSelection({
          session,
          prepared,
          now,
          input: deleting,
          selected: false,
        });
      }
    }

    return {
      ...buildContextFromPrepared({ session, projectFolder, project, prepared }),
      recovery: discardReport.recovery,
    };
  });
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
