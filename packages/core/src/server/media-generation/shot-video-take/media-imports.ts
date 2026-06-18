import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
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
  insertShotVideoTakeRecord,
} from '../../database/access/shot-video-takes.js';
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
  updatePreparedInputSelection,
} from './input-selection.js';
import {
  assertResolvedPathInsideProject,
  hashFile,
  mimeTypeForPath,
  statExistingFile,
} from './project-media-files.js';
import {
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
} from './take-generation-context.js';



export async function importShotInputMedia(
  input: ImportShotVideoTakeInputMediaInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<ShotVideoTakeInputMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? PURPOSE_CONFIG[purpose].title,
      mediaKind: 'image',
      assetType: purpose,
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const subject =
      PURPOSE_CONFIG[purpose].outputInputKind === 'multi-shot-storyboard-sheet'
        ? {
            subjectKind: 'take' as const,
            subjectId: prepared.take.takeId,
          }
        : {
            subjectKind: 'shot' as const,
            subjectId: prepared.orderedShotIds[0] as string,
          };
    const relationship = insertShotVideoTakeInputRecord(session, {
      id: imported.nextId('scene_shot_video_take_media_input'),
      sceneId: prepared.sceneId,
      takeId: prepared.take.takeId,
      inputKind: PURPOSE_CONFIG[purpose].outputInputKind,
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
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'shotVideoTake.inputImported', inputId: relationship.inputId }],
      purpose,
      target: prepared.target,
      imported: imported.asset,
      mediaInput: relationship,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: shotVideoTakeResourceKeys(prepared).concat([
        `scene-shot-video-take-input:${relationship.inputId}`,
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


export const importShotMultiShotStoryboardSheet = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE);



export async function importShotVideoTake(
  input: ImportShotVideoTakeMediaInput
): Promise<ShotVideoTakeMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
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
    const output = insertShotVideoTakeRecord(session, {
      id: imported.nextId('scene_shot_video_take_output'),
      sceneId: prepared.sceneId,
      takeId: prepared.take.takeId,
      assetId: imported.assetId,
      assetFileId: imported.assetFileId,
      mediaGenerationRunId: receiptRunId(input.receipt),
      shotIds: prepared.orderedShotIds,
      isSelected: input.isSelected ?? true,
      now,
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'shotVideoTakeOutput.imported', outputId: output.outputId }],
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: prepared.target,
      imported: imported.asset,
      output,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: shotVideoTakeResourceKeys(prepared).concat([
        `asset:${imported.assetId}`,
      ]),
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
