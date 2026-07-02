import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ShotVideoTakeInputGenerationPurpose,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeMediaImportReport,
} from '../../../client/index.js';
import {
  insertAssetFileRecord,
} from '../../database/access/asset-files.js';
import {
  insertAssetRecord,
} from '../../database/access/assets.js';
import type {
  ProjectRecord,
} from '../../database/access/project.js';
import {
  insertShotVideoTakeInputRecord,
  insertShotVideoTakeVideoRecord,
  listShotVideoTakeInputs,
  copySelectedShotVideoTakeInputRecords,
} from '../../database/access/shot-video-takes.js';
import {
  insertSceneShotVideoTakeRecord,
  requireSceneShotVideoTake,
} from '../../database/access/scene-shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../entity-ids.js';
import type {
  ProjectIdGenerator,
} from '../../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import type {
  ImportShotVideoTakeInputMediaInput,
  ImportShotVideoTakeMediaInput,
} from '../../project-data-service-contracts.js';
import {
  discardTrashObject,
} from '../../trash/trash-lifecycle-service.js';
import {
  updatePreparedInputSelection,
} from './input-selection.js';
import {
  assertResolvedPathInsideProject,
  hashFile,
  mimeTypeForPath,
  statExistingFile,
} from './project-media-files.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  PURPOSE_CONFIG,
} from './purpose-config.js';
import {
  shotVideoTakeResourceKeys,
} from './resource-keys.js';
import {
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
  sceneShotVideoTakeTarget,
} from './take-context.js';


export async function importShotInputMedia(
  input: ImportShotVideoTakeInputMediaInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<ShotVideoTakeInputMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    const config = PURPOSE_CONFIG[purpose];
    const subject =
      config.outputInputKind === 'video-prompt-sheet'
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
            candidate.kind === config.outputInputKind &&
            candidate.subjectKind === subject.subjectKind &&
            candidate.subjectId === subject.subjectId
        )
      : undefined;
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? config.title,
      mediaKind: 'image',
      assetType: purpose,
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const relationship = insertShotVideoTakeInputRecord(session, {
      id: imported.nextId('scene_shot_video_take_media_input'),
      sceneId: prepared.sceneId,
      takeId: prepared.take.takeId,
      inputKind: config.outputInputKind,
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
      purpose,
      target: prepared.target,
      imported: imported.asset,
      mediaInput: relationship,
      ...(replacedInput ? { replacedInput } : {}),
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: shotVideoTakeResourceKeys(prepared).concat([
        `scene-shot-video-take-input:${relationship.inputId}`,
        ...(replacedInput
          ? [`scene-shot-video-take-input:${replacedInput.inputId}`]
          : []),
        `asset:${imported.assetId}`,
      ]),
    };
  });
}



export const importShotFirstFrame = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_FIRST_FRAME_GENERATION_PURPOSE);


export const importShotLastFrame = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_LAST_FRAME_GENERATION_PURPOSE);


export const importShotReferenceImage = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE);


export const importShotVideoPromptSheet = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE);



export async function importShotVideoTake(
  input: ImportShotVideoTakeMediaInput
): Promise<ShotVideoTakeMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? 'Shot video take',
      mediaKind: 'video',
      assetType: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const targetTake = prepared.take.video
      ? insertSceneShotVideoTakeRecord(session, {
          id: imported.nextId('scene_shot_video_take'),
          sceneId: prepared.sceneId,
          shotListId: prepared.sourceShotListId,
          title: input.title ?? `${prepared.take.title} regeneration`,
          shotIds: prepared.orderedShotIds,
          state: structuredClone(prepared.take.state),
          regeneratedFromTakeId: prepared.take.takeId,
          screenplay,
          now,
        })
      : prepared.take;
    if (prepared.take.video) {
      copySelectedShotVideoTakeInputRecords(session, {
        sourceTakeId: prepared.take.takeId,
        targetTakeId: targetTake.takeId,
        now,
        nextId: imported.nextId,
      });
    }
    const video = insertShotVideoTakeVideoRecord(session, {
      takeId: targetTake.takeId,
      assetId: imported.assetId,
      assetFileId: imported.assetFileId,
      mediaGenerationRunId: receiptRunId(input.receipt),
      now,
    });
    const refreshedSourceTake = requireSceneShotVideoTake(session, {
      takeId: prepared.take.takeId,
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
          type: prepared.take.video
            ? 'shotVideoTake.regeneratedVideoImported'
            : 'shotVideoTake.videoImported',
          takeId: refreshedTargetTake.takeId,
        },
      ],
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: sceneShotVideoTakeTarget(refreshedTargetTake),
      sourceTake: refreshedSourceTake,
      take: refreshedTargetTake,
      createdRegeneratedTake: Boolean(prepared.take.video),
      imported: imported.asset,
      video,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: [
        ...shotVideoTakeResourceKeys(prepared),
        ...shotVideoTakeResourceKeys({
          ...prepared,
          take: refreshedTargetTake,
        }),
        `asset:${imported.assetId}`,
      ],
    };
  });
}



export async function importGeneratedFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceProjectRelativePath: string;
  title: string;
  mediaKind: 'image' | 'video';
  assetType: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const sourceProjectRelativePath = normalizeProjectRelativePath(input.sourceProjectRelativePath);
  const sourcePath = resolveProjectRelativePath(input.projectFolder, sourceProjectRelativePath);
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const stats = await statExistingFile(sourcePath);
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
    projectRelativePath: sourceProjectRelativePath,
    mimeType: mimeTypeForPath(sourceProjectRelativePath, input.mediaKind),
    mediaKind: input.mediaKind,
    sizeBytes: stats.size,
    contentHash: await hashFile(sourcePath),
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
          projectRelativePath: sourceProjectRelativePath,
          mimeType: mimeTypeForPath(sourceProjectRelativePath, input.mediaKind),
          mediaKind: input.mediaKind,
          sizeBytes: stats.size,
          contentHash: await hashFile(sourcePath),
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
