import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SHOT_INPUT_MEDIA_IMPORT_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  ShotVideoTakeImageInputImportKind,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeMediaImportReport,
  ProjectRelativePath,
} from '../../../../../client/index.js';
import {
  insertAssetFileRecord,
} from '../../../../database/access/asset-files.js';
import {
  insertAssetRecord,
} from '../../../../database/access/assets.js';
import type {
  ProjectRecord,
} from '../../../../database/access/project.js';
import {
  insertShotVideoTakeVideoRecord,
  listShotVideoTakeInputs,
  insertShotVideoTakeInputRecord,
} from '../../../../database/access/shot-video-takes.js';
import {
  requireSceneShotVideoTake,
} from '../../../../database/access/scene-shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../../../entity-ids.js';
import type {
  ProjectIdGenerator,
} from '../../../../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../../../files/project-relative-paths.js';
import {
  allocateProjectRelativeFilePath,
  extensionForMediaSource,
} from '../../../../files/asset-paths.js';
import type {
  ImportShotVideoTakeInputMediaInput,
  ImportShotVideoTakeMediaInput,
} from '../../../../project-data-service-contracts.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  discardTrashObject,
} from '../../../../trash/trash-lifecycle-service.js';
import {
  updatePreparedInputSelection,
} from '../selection/input-selection.js';
import {
  assertResolvedPathInsideProject,
  hashFile,
  mimeTypeForPath,
  statExistingFile,
} from '../shared/project-media-files.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  shotVideoTakeResourceKeys,
} from '../shared/resource-keys.js';
import {
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
  sceneShotVideoTakeTarget,
} from '../authoring/take-context.js';
import {
  continueSceneShotVideoTakeIteration,
} from '../authoring/take-iteration.js';
import {
  resolveShotVideoTakeFolder,
} from '../shared/take-media-paths.js';


export async function importShotInputMedia(
  input: ImportShotVideoTakeInputMediaInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  const inputKind = requireShotInputMediaImportKind(input.inputKind);
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const sourcePrepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(sourcePrepared.take);
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      projectFolder,
      contextInput: input,
      screenplay,
      now,
    });
    const prepared = iteration.prepared;
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      destinationFolder: resolveShotVideoTakeFolder({
        session,
        screenplay,
        take: prepared.take,
      }),
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? shotInputTitle(inputKind),
      mediaKind: 'image',
      assetType: SHOT_INPUT_MEDIA_IMPORT_PURPOSE,
      fileBaseName: shotInputFileBaseName(inputKind),
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const subject =
      inputKind === 'video-prompt-sheet'
        ? {
            subjectKind: 'take' as const,
            subjectId: prepared.take.takeId,
          }
        : {
            subjectKind: 'shot' as const,
            subjectId: prepared.orderedShotIds[0] as string,
          };
    const replacedInput = input.replaceSelected && (input.selection ?? 'select') === 'select'
      ? listShotVideoTakeInputs(session, {
          sceneId: prepared.sceneId,
          takeId: prepared.take.takeId,
          shotIds: prepared.orderedShotIds,
        }).find(
          (candidate) =>
            candidate.selected &&
            candidate.kind === inputKind &&
            candidate.subjectKind === subject.subjectKind &&
            candidate.subjectId === subject.subjectId
        )
      : undefined;
    const relationship = insertShotVideoTakeInputRecord(session, {
      id: imported.nextId('scene_shot_video_take_media_input'),
      sceneId: prepared.sceneId,
      takeId: prepared.take.takeId,
      inputKind,
      ...subject,
      assetId: imported.assetId,
      assetFileId: imported.assetFileId,
      mediaGenerationRunId: receiptRunId(input.receipt),
      selection: input.selection ?? 'select',
      shotIds: prepared.orderedShotIds,
      now,
    });
    if (relationship.selected) {
      updatePreparedInputSelection({
        session,
        prepared,
        now,
        input: relationship,
        selected: true,
      });
    }
    if (replacedInput) {
      discardTrashObject({
        session,
        project,
        projectFolder,
        itemKind: 'shotVideoTakeInput',
        itemId: replacedInput.inputId,
        commandName: 'shotVideoTake.input.replaceSelected',
        changes: [
          {
            type: 'shotVideoTakeInput.discarded',
            inputId: replacedInput.inputId,
          },
        ],
      });
    }
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [
        { type: 'shotVideoTake.inputImported', inputId: relationship.inputId },
        ...(replacedInput
          ? [
              {
                type: 'shotVideoTakeInput.discarded',
                inputId: replacedInput.inputId,
              },
            ]
          : []),
      ],
      purpose: SHOT_INPUT_MEDIA_IMPORT_PURPOSE,
      target: prepared.target,
      imported: imported.asset,
      mediaInput: relationship,
      ...(replacedInput ? { replacedInput } : {}),
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: shotVideoTakeResourceKeys(prepared).concat([
        ...iteration.resourceKeys,
        `scene-shot-video-take-input:${relationship.inputId}`,
        ...(replacedInput
          ? [`scene-shot-video-take-input:${replacedInput.inputId}`]
          : []),
        `asset:${imported.assetId}`,
      ]),
    };
  });
}



export async function importShotVideoTake(
  input: ImportShotVideoTakeMediaInput
): Promise<ShotVideoTakeMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const sourcePrepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(sourcePrepared.take);
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      projectFolder,
      contextInput: input,
      screenplay,
      now,
      title: input.title ?? `${sourcePrepared.take.title} regeneration`,
    });
    const targetTake = iteration.take;
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      destinationFolder: resolveShotVideoTakeFolder({
        session,
        screenplay,
        take: targetTake,
      }),
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? 'Shot video take',
      mediaKind: 'video',
      assetType: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      fileBaseName: 'video',
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const video = insertShotVideoTakeVideoRecord(session, {
      takeId: targetTake.takeId,
      assetId: imported.assetId,
      assetFileId: imported.assetFileId,
      mediaGenerationRunId: receiptRunId(input.receipt),
      now,
    });
    const refreshedSourceTake = requireSceneShotVideoTake(session, {
      takeId: iteration.sourceTake.takeId,
      screenplay,
    });
    const refreshedTargetTake = requireSceneShotVideoTake(session, {
      takeId: targetTake.takeId,
      screenplay,
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [
        {
          type: iteration.createdIterationTake
            ? 'shotVideoTake.regeneratedVideoImported'
            : 'shotVideoTake.videoImported',
          takeId: refreshedTargetTake.takeId,
        },
      ],
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: sceneShotVideoTakeTarget(refreshedTargetTake),
      sourceTake: refreshedSourceTake,
      take: refreshedTargetTake,
      createdRegeneratedTake: iteration.createdIterationTake,
      imported: imported.asset,
      video,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: [
        ...iteration.resourceKeys,
        ...shotVideoTakeResourceKeys({
          ...iteration.prepared,
          take: refreshedTargetTake,
        }),
        `asset:${imported.assetId}`,
      ],
    };
  });
}


function requireShotInputMediaImportKind(
  inputKind: unknown
): ShotVideoTakeImageInputImportKind {
  if (
    inputKind === 'first-frame' ||
    inputKind === 'last-frame' ||
    inputKind === 'reference-image' ||
    inputKind === 'video-prompt-sheet'
  ) {
    return inputKind;
  }
  throw new ProjectDataError(
    'CORE_SHOT_INPUT_IMPORT_KIND_UNSUPPORTED',
    `Shot input media import does not support input kind: ${String(inputKind)}.`
  );
}

function shotInputTitle(inputKind: ShotVideoTakeImageInputImportKind): string {
  if (inputKind === 'first-frame') {
    return 'Shot first frame';
  }
  if (inputKind === 'last-frame') {
    return 'Shot last frame';
  }
  if (inputKind === 'video-prompt-sheet') {
    return 'Shot video prompt sheet';
  }
  return 'Shot reference image';
}

function shotInputFileBaseName(inputKind: ShotVideoTakeImageInputImportKind): string {
  return inputKind === 'reference-image' ? 'reference-image' : inputKind;
}


export async function importGeneratedFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  destinationFolder: ProjectRelativePath;
  sourceProjectRelativePath: string;
  title: string;
  mediaKind: 'image' | 'video';
  assetType: string;
  fileBaseName: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const sourceProjectRelativePath = normalizeProjectRelativePath(input.sourceProjectRelativePath);
  const sourcePath = resolveProjectRelativePath(input.projectFolder, sourceProjectRelativePath);
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  await statExistingFile(sourcePath);
  const destinationProjectRelativePath = await allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: input.destinationFolder,
    baseName: input.fileBaseName,
    extension: extensionForMediaSource(sourceProjectRelativePath),
  });
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }
  const destinationStats = await statExistingFile(destinationPath);
  const contentHash = await hashFile(destinationPath);
  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const assetId = ids('asset');
  const assetFileId = ids('asset_file');
  insertAssetRecord(input.session, {
    id: assetId,
    type: input.assetType,
    mediaKind: input.mediaKind,
    title: input.title,
    origin: input.origin,
    availability: 'ready',
    createdAt: input.now,
    updatedAt: input.now,
  });
  insertAssetFileRecord(input.session, {
    id: assetFileId,
    assetId,
    role: 'primary',
    projectRelativePath: destinationProjectRelativePath,
    mimeType: mimeTypeForPath(destinationProjectRelativePath, input.mediaKind),
    mediaKind: input.mediaKind,
    sizeBytes: destinationStats.size,
    contentHash,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    assetId,
    assetFileId,
    nextId: ids,
    asset: {
      assetId,
      relationshipId: assetId,
      target: { kind: 'project' as const },
      localeId: null,
      id: assetId,
      type: input.assetType,
      mediaKind: input.mediaKind,
      title: input.title,
      oneLineSummary: null,
      origin: input.origin,
      selection: { kind: 'take' as const },
      availability: 'ready' as const,
      role: 'shot-video-take',
      referenceName: null,
      purpose: null,
      sortOrder: 0,
      createdAt: input.now,
      updatedAt: input.now,
      files: [
        {
          id: assetFileId,
          role: 'primary',
          projectRelativePath: destinationProjectRelativePath,
          mimeType: mimeTypeForPath(destinationProjectRelativePath, input.mediaKind),
          mediaKind: input.mediaKind,
          sizeBytes: destinationStats.size,
          contentHash,
          width: null,
          height: null,
          durationSeconds: null,
          createdAt: input.now,
          updatedAt: input.now,
        },
      ],
    },
  };
}



export function toProjectReport(project: Pick<ProjectRecord, 'id' | 'name'>, projectFolder: string) {
  return { id: project.id, name: project.name, projectFolder };
}



export function receiptRunId(receipt: unknown): string | null {
  if (receipt && typeof receipt === 'object' && 'run' in receipt) {
    const run = (receipt as { run?: { id?: unknown } }).run;
    return typeof run?.id === 'string' ? run.id : null;
  }
  if (receipt && typeof receipt === 'object' && 'id' in receipt) {
    const id = (receipt as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}
