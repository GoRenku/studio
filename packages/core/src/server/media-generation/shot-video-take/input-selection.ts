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
  selectShotVideoTakeInputRecord,
  clearShotVideoTakeInputRecordSelection,
  deleteShotVideoTakeInputRecord,
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
  deleteProjectRelativeFile,
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
    const shotInput = requireShotVideoTakeInput(session, input.inputId);
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

    await deleteProjectRelativeFile(projectFolder, deleting.projectRelativePath);
    deleteShotVideoTakeInputRecord(session, input.inputId);

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

    return buildContextFromPrepared({ session, projectFolder, project, prepared });
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
