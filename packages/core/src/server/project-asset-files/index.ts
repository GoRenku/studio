import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  IMAGE_CREATE_GENERATION_PURPOSE,
  IMAGE_EDIT_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type MediaGenerationPurpose,
  type MediaGenerationSpecRecord,
  type MediaKind,
  type ProjectRelativePath,
  type ShotVideoTakeInputKind,
} from '../../client/index.js';
import {
  readAssetFileRecord,
  readAssetFileRecordIncludingDiscarded,
  listAssetFileRecordsForAsset,
  insertAssetFileRecord,
  type AssetFileRecord,
} from '../database/access/asset-files.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readLocationRecord } from '../database/access/locations.js';
import {
  readScreenplayDocumentFromSession,
} from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  assignSceneShotVideoTakeMediaFolder,
  listSceneShotVideoTakeStorageRecordsForScene,
  requireSceneShotVideoTakeStorageRecord,
} from '../database/access/project-asset-file-storage.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import {
  CAST_ROOT,
  LOCATIONS_ROOT,
  PROJECT_TMP_ROOT,
  SHOTS_ROOT,
  STORYBOARDS_ROOT,
  VISUAL_LANGUAGE_ROOT,
  extensionForImageOutput,
  extensionForMediaSource,
  kebabCasePathSegment,
} from '../files/asset-paths.js';

export type ShotVideoTakeMediaRole = ShotVideoTakeInputKind | 'video';

export type ProjectAssetFileDestination =
  | { kind: 'cast.characterSheet'; castMemberId: string; titleHint?: string }
  | { kind: 'cast.profile'; castMemberId: string; titleHint?: string }
  | {
      kind: 'cast.voiceSample';
      castMemberId: string;
      castVoiceId: string;
      referenceName: string;
    }
  | { kind: 'location.environmentSheet'; locationId: string; titleHint?: string }
  | { kind: 'location.hero'; locationId: string; heroName?: string }
  | { kind: 'visualLanguage.lookbookImage'; titleHint?: string }
  | { kind: 'visualLanguage.lookbookSheet'; titleHint?: string }
  | { kind: 'shotVideoTake.media'; takeId: string; role: ShotVideoTakeMediaRole }
  | {
      kind: 'scene.dialogueAudio';
      sceneId: string;
      dialogueId: string;
      sceneDialogueAudioId: string;
      dialogueAudioTakeId: string;
    }
  | { kind: 'image.editOutput'; sourceAssetId: string; sourceAssetFileId?: string };

export type ProjectTemporaryFileDestination =
  | { kind: 'generation.media'; purpose: MediaGenerationPurpose }
  | { kind: 'generation.spec' }
  | { kind: 'generation.receipt' }
  | { kind: 'operation' }
  | { kind: 'qa' }
  | { kind: 'scratch' }
  | { kind: 'scene.storyboardSourceSheet'; sceneId: string };

export interface ProjectReferenceFileValidation {
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  sizeBytes: number;
}

export interface PersistProjectAssetFileInput {
  session: DatabaseSession;
  projectFolder: string;
  assetId: string;
  assetFileId: string;
  sourceProjectRelativePath: string;
  destination: ProjectAssetFileDestination;
  fileRole: string;
  mediaKind: MediaKind;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  now: string;
}

export interface ProjectAssetFileWriteSet {
  readonly projectFolder: string;
  readonly createdProjectRelativePaths: readonly ProjectRelativePath[];
  readonly committed: boolean;
  recordCreatedFile(projectRelativePath: ProjectRelativePath): void;
  markCommitted(): void;
}

class ProjectAssetFileWriteSetState implements ProjectAssetFileWriteSet {
  readonly #createdProjectRelativePaths: ProjectRelativePath[] = [];
  #committed = false;

  constructor(readonly projectFolder: string) {}

  get createdProjectRelativePaths(): readonly ProjectRelativePath[] {
    return this.#createdProjectRelativePaths;
  }

  get committed(): boolean {
    return this.#committed;
  }

  recordCreatedFile(projectRelativePath: ProjectRelativePath): void {
    if (this.#committed) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_WRITE_SET_COMMITTED',
        'Project asset file write set is already committed.'
      );
    }
    this.#createdProjectRelativePaths.push(projectRelativePath);
  }

  markCommitted(): void {
    this.#committed = true;
  }
}

export function createProjectAssetFileWriteSet(input: {
  projectFolder: string;
}): ProjectAssetFileWriteSet {
  return new ProjectAssetFileWriteSetState(input.projectFolder);
}

export function commitProjectAssetFileWriteSet(
  writeSet: ProjectAssetFileWriteSet
): void {
  writeSet.markCommitted();
}

export async function rollbackProjectAssetFileWriteSet(
  writeSet: ProjectAssetFileWriteSet
): Promise<void> {
  if (writeSet.committed) {
    return;
  }
  for (const projectRelativePath of [...writeSet.createdProjectRelativePaths].reverse()) {
    await removeCopiedProjectAssetFile(writeSet.projectFolder, projectRelativePath);
  }
}

export function rollbackProjectAssetFileWriteSetSync(
  writeSet: ProjectAssetFileWriteSet
): void {
  if (writeSet.committed) {
    return;
  }
  for (const projectRelativePath of [...writeSet.createdProjectRelativePaths].reverse()) {
    removeCopiedProjectAssetFileSync(writeSet.projectFolder, projectRelativePath);
  }
}

export interface ProjectAssetGenerationOutputPlacement {
  projectRelativeRoot: ProjectRelativePath;
  absoluteRoot: string;
  outputNames: string[];
  persistenceIntent:
    | { kind: 'temporary' }
    | { kind: 'durableAsset'; destination: ProjectAssetFileDestination };
}

export async function validateProjectReferenceFileInput(input: {
  projectFolder: string;
  projectRelativePath: string;
  mediaKind?: MediaKind;
  role?: string;
}): Promise<ProjectReferenceFileValidation> {
  const projectRelativePath = normalizeProjectRelativePath(
    input.projectRelativePath
  );
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    projectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, absolutePath);
  const stats = await statProjectFile(absolutePath, {
    code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    message: `Project reference file was not found: ${projectRelativePath}.`,
  });
  return {
    projectRelativePath,
    absolutePath,
    sizeBytes: stats.size,
  };
}

export async function persistProjectAssetFile(
  input: PersistProjectAssetFileInput & { writeSet?: ProjectAssetFileWriteSet }
): Promise<AssetFileRecord> {
  const source = await validateProjectReferenceFileInput({
    projectFolder: input.projectFolder,
    projectRelativePath: input.sourceProjectRelativePath,
    mediaKind: input.mediaKind,
    role: input.fileRole,
  });
  const destination = await resolveDurableDestinationFile({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: input.destination,
    sourceProjectRelativePath: source.projectRelativePath,
    mediaKind: input.mediaKind,
    now: input.now,
  });
  assertDurableProjectAssetFilePath(destination);
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destination
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  let copied = false;
  try {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    if (source.absolutePath !== destinationPath) {
      await fs.copyFile(source.absolutePath, destinationPath);
      copied = true;
      input.writeSet?.recordCreatedFile(destination);
    }
    const stats = await statProjectFile(destinationPath, {
      code: 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND',
      message: `Persisted project asset file was not found: ${destination}.`,
    });
    insertAssetFileRecord(input.session, {
      id: input.assetFileId,
      assetId: input.assetId,
      role: input.fileRole,
      projectRelativePath: destination,
      mimeType: input.mimeType ?? mimeTypeForProjectPath(destination, input.mediaKind),
      mediaKind: input.mediaKind,
      sizeBytes: stats.size,
      contentHash: await hashFile(destinationPath),
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      createdAt: input.now,
      updatedAt: input.now,
    });
    const row = readAssetFileRecord(input.session, {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    });
    if (!row) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_INSERT_FAILED',
        `Project asset file record was not inserted: ${input.assetFileId}.`
      );
    }
    return row;
  } catch (error) {
    if (copied) {
      await removeCopiedProjectAssetFile(input.projectFolder, destination);
    }
    throw error;
  }
}

export function persistProjectAssetFileSync(
  input: PersistProjectAssetFileInput & { writeSet?: ProjectAssetFileWriteSet }
): AssetFileRecord {
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    input.sourceProjectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  statProjectFileSync(sourcePath, {
    code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    message: `Project reference file was not found: ${sourceProjectRelativePath}.`,
  });
  const destination = resolveDurableDestinationFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: input.destination,
    sourceProjectRelativePath,
    mediaKind: input.mediaKind,
    now: input.now,
  });
  return persistProjectAssetFileAtDestinationSync({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    fileRole: input.fileRole,
    mediaKind: input.mediaKind,
    sourcePath,
    sourceProjectRelativePath,
    destinationProjectRelativePath: destination,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    durationSeconds: input.durationSeconds,
    now: input.now,
    writeSet: input.writeSet,
  });
}

export async function writeProjectTemporaryFile(input: {
  projectFolder: string;
  destination: ProjectTemporaryFileDestination;
  fileNameHint: string;
  contents: Uint8Array;
}): Promise<{
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
}> {
  const root = await resolveTemporaryFileRoot({
    projectFolder: input.projectFolder,
    destination: input.destination,
  });
  const fileName = kebabCasePathSegment(
    path.parse(input.fileNameHint).name,
    'temporary-file'
  );
  const extension = path.extname(input.fileNameHint) || '.bin';
  const projectRelativePath = await allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: root,
    baseName: fileName,
    extension,
  });
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    projectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, absolutePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.contents);
  return { projectRelativePath, absolutePath };
}

export function persistSceneStoryboardShotFilesSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet?: ProjectAssetFileWriteSet;
  sceneId: string;
  files: Array<{
    assetId: string;
    assetFileId: string;
    shotId: string;
    shotOrdinal: number;
    sourceProjectRelativePath: ProjectRelativePath;
  }>;
  now: string;
}): Array<{
  shotId: string;
  assetFile: AssetFileRecord;
}> {
  const hierarchy = requireSceneHierarchy(input.session, input.sceneId);
  const iterationFolder = allocateProjectRelativeFolderPathSync({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      STORYBOARDS_ROOT,
      kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
      kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
    ),
    baseName: `${String(nextStoryboardIterationNumber(input.projectFolder, input.session, input.sceneId)).padStart(2, '0')}-iteration`,
  });
  return input.files.map((file) => {
    const sourceProjectRelativePath = normalizeProjectRelativePath(
      file.sourceProjectRelativePath
    );
    const destination = joinProjectRelativePath(
      iterationFolder,
      `shot-${String(file.shotOrdinal).padStart(2, '0')}${extensionForMediaSource(sourceProjectRelativePath)}`
    );
    const sourcePath = resolveProjectRelativePath(
      input.projectFolder,
      sourceProjectRelativePath
    );
    assertResolvedPathInsideProject(input.projectFolder, sourcePath);
    statProjectFileSync(sourcePath, {
      code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
      message: `Storyboard source file was not found: ${sourceProjectRelativePath}.`,
    });
    return {
      shotId: file.shotId,
      assetFile: persistProjectAssetFileAtDestinationSync({
        session: input.session,
        projectFolder: input.projectFolder,
        assetId: file.assetId,
        assetFileId: file.assetFileId,
        sourceProjectRelativePath,
        sourcePath,
        destinationProjectRelativePath: destination,
        fileRole: 'storyboard_image',
        mediaKind: 'image',
        now: input.now,
        writeSet: input.writeSet,
      }),
    };
  });
}

export async function resolveProjectAssetGenerationOutput(input: {
  session: DatabaseSession;
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord;
  outputCount: number;
}): Promise<ProjectAssetGenerationOutputPlacement> {
  const placement = await generationDestination(input);
  const names =
    placement.kind === 'temporary'
      ? temporaryOutputNames(input)
      : await durableOutputNames({
          session: input.session,
          projectFolder: input.projectFolder,
          destination: placement.destination,
          specRecord: input.specRecord,
          outputCount: input.outputCount,
        });
  const projectRelativeRoot =
    placement.kind === 'temporary'
      ? await resolveTemporaryFileRoot({
          session: input.session,
          projectFolder: input.projectFolder,
          destination: placement.destination,
        })
      : await durableDestinationRoot({
          session: input.session,
          projectFolder: input.projectFolder,
          destination: placement.destination,
          sourceProjectRelativePath: sourceProjectRelativePathForGeneration(
            input.session,
            input.specRecord
          ),
          now: new Date().toISOString(),
        });
  return {
    projectRelativeRoot,
    absoluteRoot: resolveProjectRelativePath(input.projectFolder, projectRelativeRoot),
    outputNames: names,
    persistenceIntent:
      placement.kind === 'temporary'
        ? { kind: 'temporary' }
        : { kind: 'durableAsset', destination: placement.destination },
  };
}

export async function resolveTemporaryFileRoot(input: {
  session?: DatabaseSession;
  projectFolder: string;
  destination: ProjectTemporaryFileDestination;
}): Promise<ProjectRelativePath> {
  switch (input.destination.kind) {
    case 'generation.media':
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'media');
    case 'generation.spec':
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'generation-specs');
    case 'generation.receipt':
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'generation-receipts');
    case 'operation':
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'operations');
    case 'qa':
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'qa');
    case 'scratch':
      return joinProjectRelativePath(PROJECT_TMP_ROOT, 'scratch');
    case 'scene.storyboardSourceSheet': {
      const hierarchy = requireSceneHierarchy(
        input.session,
        input.destination.sceneId
      );
      return joinProjectRelativePath(
        STORYBOARDS_ROOT,
        kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
        kebabCasePathSegment(hierarchy.sceneTitle, 'scene'),
        'tmp'
      );
    }
    default:
      return assertNever(input.destination);
  }
}

export async function resolveShotVideoTakeMediaFolder(input: {
  session: DatabaseSession;
  projectFolder: string;
  takeId: string;
  now: string;
}): Promise<ProjectRelativePath> {
  const row = readSceneShotVideoTakeStorageRecord(input.session, input.takeId);
  if (row.mediaFolderProjectRelativePath) {
    return normalizeProjectRelativePath(row.mediaFolderProjectRelativePath);
  }
  const hierarchy = requireSceneHierarchy(input.session, row.sceneId);
  const folder = await allocateProjectRelativeFolderPath({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      SHOTS_ROOT,
      kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
      kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
    ),
    baseName: `${kebabCasePathSegment(row.title, 'take')}-${stableTakeNumber(
      input.session,
      row.sceneId,
      row.id
    )}`,
  });
  assignSceneShotVideoTakeMediaFolder(input.session, {
    takeId: row.id,
    mediaFolderProjectRelativePath: folder,
    now: input.now,
  });
  return folder;
}

export function resolveShotVideoTakeMediaFolderSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  takeId: string;
  now: string;
}): ProjectRelativePath {
  const row = readSceneShotVideoTakeStorageRecord(input.session, input.takeId);
  if (row.mediaFolderProjectRelativePath) {
    return normalizeProjectRelativePath(row.mediaFolderProjectRelativePath);
  }
  const hierarchy = requireSceneHierarchy(input.session, row.sceneId);
  const folder = allocateProjectRelativeFolderPathSync({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      SHOTS_ROOT,
      kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
      kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
    ),
    baseName: `${kebabCasePathSegment(row.title, 'take')}-${stableTakeNumber(
      input.session,
      row.sceneId,
      row.id
    )}`,
  });
  assignSceneShotVideoTakeMediaFolder(input.session, {
    takeId: row.id,
    mediaFolderProjectRelativePath: folder,
    now: input.now,
  });
  return folder;
}

export async function copyTakeOwnedProjectAssetFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceAssetId: string;
  sourceAssetFileId: string;
  targetAssetId: string;
  targetAssetFileId: string;
  targetTakeId: string;
  role: ShotVideoTakeMediaRole;
  fileRole: string;
  mediaKind: MediaKind;
  mimeType?: string;
  now: string;
}): Promise<AssetFileRecord> {
  const sourceFile = readAssetFileRecord(input.session, {
    assetId: input.sourceAssetId,
    assetFileId: input.sourceAssetFileId,
  });
  if (!sourceFile) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SOURCE_RECORD_MISSING',
      `Take-owned source asset file was not found: ${input.sourceAssetFileId}.`
    );
  }
  return persistProjectAssetFile({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.targetAssetId,
    assetFileId: input.targetAssetFileId,
    sourceProjectRelativePath: sourceFile.projectRelativePath,
    destination: {
      kind: 'shotVideoTake.media',
      takeId: input.targetTakeId,
      role: input.role,
    },
    fileRole: input.fileRole,
    mediaKind: input.mediaKind,
    mimeType: input.mimeType ?? sourceFile.mimeType ?? undefined,
    width: sourceFile.width ?? undefined,
    height: sourceFile.height ?? undefined,
    durationSeconds: sourceFile.durationSeconds ?? undefined,
    now: input.now,
  });
}

export function copyTakeOwnedProjectAssetFileSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet?: ProjectAssetFileWriteSet;
  sourceAssetId: string;
  sourceAssetFileId: string;
  targetAssetId: string;
  targetAssetFileId: string;
  targetTakeId: string;
  role: ShotVideoTakeMediaRole;
  fileRole: string;
  mediaKind: MediaKind;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  allowDiscardedSource?: boolean;
  now: string;
}): AssetFileRecord {
  const sourceFile = input.allowDiscardedSource
    ? readAssetFileRecordIncludingDiscarded(input.session, {
        assetId: input.sourceAssetId,
        assetFileId: input.sourceAssetFileId,
      })
    : readAssetFileRecord(input.session, {
        assetId: input.sourceAssetId,
        assetFileId: input.sourceAssetFileId,
      });
  if (!sourceFile) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SOURCE_RECORD_MISSING',
      `Take-owned source asset file was not found: ${input.sourceAssetFileId}.`
    );
  }
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    sourceFile.projectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  statProjectFileSync(sourcePath, {
    code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    message: `Take-owned source asset file was not found on disk: ${sourceProjectRelativePath}.`,
  });
  const destination = resolveDurableDestinationFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: {
      kind: 'shotVideoTake.media',
      takeId: input.targetTakeId,
      role: input.role,
    },
    sourceProjectRelativePath,
    mediaKind: input.mediaKind,
    now: input.now,
  });
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destination
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  let copied = false;
  try {
    fsSync.mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (sourcePath !== destinationPath) {
      fsSync.copyFileSync(sourcePath, destinationPath, fsSync.constants.COPYFILE_EXCL);
      copied = true;
      input.writeSet?.recordCreatedFile(destination);
    }
    const stats = statProjectFileSync(destinationPath, {
      code: 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND',
      message: `Copied take-owned project asset file was not found: ${destination}.`,
    });
    insertAssetFileRecord(input.session, {
      id: input.targetAssetFileId,
      assetId: input.targetAssetId,
      role: input.fileRole,
      projectRelativePath: destination,
      mimeType: input.mimeType ?? sourceFile.mimeType ?? undefined,
      mediaKind: input.mediaKind,
      sizeBytes: stats.size,
      contentHash: hashFileSync(destinationPath),
      width: input.width ?? sourceFile.width ?? undefined,
      height: input.height ?? sourceFile.height ?? undefined,
      durationSeconds:
        input.durationSeconds ?? sourceFile.durationSeconds ?? undefined,
      createdAt: input.now,
      updatedAt: input.now,
    });
    const row = readAssetFileRecord(input.session, {
      assetId: input.targetAssetId,
      assetFileId: input.targetAssetFileId,
    });
    if (!row) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_INSERT_FAILED',
        `Project asset file record was not inserted: ${input.targetAssetFileId}.`
      );
    }
    return row;
  } catch (error) {
    if (copied) {
      removeCopiedProjectAssetFileSync(input.projectFolder, destination);
    }
    throw error;
  }
}

export async function removeCopiedProjectAssetFile(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<void> {
  assertDurableProjectAssetFilePath(projectRelativePath);
  const resolved = resolveProjectRelativePath(projectFolder, projectRelativePath);
  assertResolvedPathInsideProject(projectFolder, resolved);
  await fs.rm(resolved, { force: true });
}

export function removeCopiedProjectAssetFileSync(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): void {
  assertDurableProjectAssetFilePath(projectRelativePath);
  const resolved = resolveProjectRelativePath(projectFolder, projectRelativePath);
  assertResolvedPathInsideProject(projectFolder, resolved);
  fsSync.rmSync(resolved, { force: true });
}

export async function allocateImageEditOutputNames(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceAssetId: string;
  sourceAssetFileId?: string;
  outputFormat: string;
  outputCount: number;
}): Promise<string[]> {
  const source = imageEditSourceFile(input.session, {
    sourceAssetId: input.sourceAssetId,
    sourceAssetFileId: input.sourceAssetFileId,
  });
  const parsed = path.parse(source.projectRelativePath);
  return allocateProjectRelativeVersionedFileNames({
    projectFolder: input.projectFolder,
    parent: parsed.dir as ProjectRelativePath,
    baseName: parsed.name,
    extension: extensionForImageOutput(input.outputFormat),
    count: input.outputCount,
    alwaysUseVersionSuffix: true,
  });
}

async function resolveDurableDestinationFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: MediaKind;
  now: string;
}): Promise<ProjectRelativePath> {
  const root = await durableDestinationRoot(input);
  if (input.destination.kind === 'scene.dialogueAudio') {
    return allocateSceneDialogueAudioFilePath({
      session: input.session,
      projectFolder: input.projectFolder,
      root,
      destination: input.destination,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
    });
  }
  const allocation = durableDestinationAllocation(input.destination, {
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    mediaKind: input.mediaKind,
  });
  if (allocation.versioned) {
    return allocateProjectRelativeVersionedFilePath({
      projectFolder: input.projectFolder,
      parent: root,
      baseName: allocation.baseName,
      extension: allocation.extension,
      alwaysUseVersionSuffix: allocation.alwaysUseVersionSuffix,
    });
  }
  return allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: root,
    baseName: allocation.baseName,
    extension: allocation.extension,
  });
}

function resolveDurableDestinationFileSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: MediaKind;
  now: string;
}): ProjectRelativePath {
  const root = durableDestinationRootSync(input);
  if (input.destination.kind === 'scene.dialogueAudio') {
    return allocateSceneDialogueAudioFilePathSync({
      session: input.session,
      projectFolder: input.projectFolder,
      root,
      destination: input.destination,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
    });
  }
  const allocation = durableDestinationAllocation(input.destination, {
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    mediaKind: input.mediaKind,
  });
  if (allocation.versioned) {
    return allocateProjectRelativeVersionedFilePathSync({
      projectFolder: input.projectFolder,
      parent: root,
      baseName: allocation.baseName,
      extension: allocation.extension,
      alwaysUseVersionSuffix: allocation.alwaysUseVersionSuffix,
    });
  }
  return allocateProjectRelativeFilePathSync({
    projectFolder: input.projectFolder,
    parent: root,
    baseName: allocation.baseName,
    extension: allocation.extension,
  });
}

async function durableDestinationRoot(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath?: ProjectRelativePath;
  now: string;
}): Promise<ProjectRelativePath> {
  switch (input.destination.kind) {
    case 'cast.characterSheet': {
      const castMember = requireCastMember(
        input.session,
        input.destination.castMemberId
      );
      return joinProjectRelativePath(CAST_ROOT, castMember.handle, 'character-sheets');
    }
    case 'cast.profile': {
      const castMember = requireCastMember(
        input.session,
        input.destination.castMemberId
      );
      return joinProjectRelativePath(CAST_ROOT, castMember.handle, 'profiles');
    }
    case 'cast.voiceSample': {
      const castMember = requireCastMember(
        input.session,
        input.destination.castMemberId
      );
      return joinProjectRelativePath(CAST_ROOT, castMember.handle, 'voice-samples');
    }
    case 'location.environmentSheet': {
      const location = requireLocation(input.session, input.destination.locationId);
      return joinProjectRelativePath(
        LOCATIONS_ROOT,
        location.handle,
        'environment-sheets'
      );
    }
    case 'location.hero': {
      const location = requireLocation(input.session, input.destination.locationId);
      return joinProjectRelativePath(LOCATIONS_ROOT, location.handle, 'heroes');
    }
    case 'visualLanguage.lookbookImage':
    case 'visualLanguage.lookbookSheet':
      return joinProjectRelativePath(VISUAL_LANGUAGE_ROOT, 'lookbook');
    case 'shotVideoTake.media':
      return resolveShotVideoTakeMediaFolder({
        session: input.session,
        projectFolder: input.projectFolder,
        takeId: input.destination.takeId,
        now: input.now,
      });
    case 'scene.dialogueAudio': {
      const hierarchy = requireSceneHierarchy(input.session, input.destination.sceneId);
      return joinProjectRelativePath(
        'audio',
        kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
        kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
      );
    }
    case 'image.editOutput': {
      const source = imageEditSourceFile(input.session, input.destination);
      return path.parse(source.projectRelativePath).dir as ProjectRelativePath;
    }
    default:
      return assertNever(input.destination);
  }
}

function durableDestinationRootSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath?: ProjectRelativePath;
  now: string;
}): ProjectRelativePath {
  switch (input.destination.kind) {
    case 'cast.characterSheet': {
      const castMember = requireCastMember(
        input.session,
        input.destination.castMemberId
      );
      return joinProjectRelativePath(CAST_ROOT, castMember.handle, 'character-sheets');
    }
    case 'cast.profile': {
      const castMember = requireCastMember(
        input.session,
        input.destination.castMemberId
      );
      return joinProjectRelativePath(CAST_ROOT, castMember.handle, 'profiles');
    }
    case 'cast.voiceSample': {
      const castMember = requireCastMember(
        input.session,
        input.destination.castMemberId
      );
      return joinProjectRelativePath(CAST_ROOT, castMember.handle, 'voice-samples');
    }
    case 'location.environmentSheet': {
      const location = requireLocation(input.session, input.destination.locationId);
      return joinProjectRelativePath(
        LOCATIONS_ROOT,
        location.handle,
        'environment-sheets'
      );
    }
    case 'location.hero': {
      const location = requireLocation(input.session, input.destination.locationId);
      return joinProjectRelativePath(LOCATIONS_ROOT, location.handle, 'heroes');
    }
    case 'visualLanguage.lookbookImage':
    case 'visualLanguage.lookbookSheet':
      return joinProjectRelativePath(VISUAL_LANGUAGE_ROOT, 'lookbook');
    case 'scene.dialogueAudio': {
      const hierarchy = requireSceneHierarchy(input.session, input.destination.sceneId);
      return joinProjectRelativePath(
        'audio',
        kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
        kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
      );
    }
    case 'image.editOutput': {
      const source = imageEditSourceFile(input.session, input.destination);
      return path.parse(source.projectRelativePath).dir as ProjectRelativePath;
    }
    case 'shotVideoTake.media':
      return resolveShotVideoTakeMediaFolderSync({
        session: input.session,
        projectFolder: input.projectFolder,
        takeId: input.destination.takeId,
        now: input.now,
      });
    default:
      return assertNever(input.destination);
  }
}

function durableDestinationAllocation(
  destination: ProjectAssetFileDestination,
  input: {
    sourceProjectRelativePath: ProjectRelativePath;
    mediaKind: MediaKind;
    outputFormatHint?: string;
  }
): {
  baseName: string;
  extension: string;
  versioned: boolean;
  alwaysUseVersionSuffix?: boolean;
} {
  const extension = extensionForMediaSource(input.sourceProjectRelativePath);
  switch (destination.kind) {
    case 'cast.characterSheet':
      return {
        baseName: destination.titleHint ?? 'character-sheet',
        extension,
        versioned: true,
      };
    case 'cast.profile':
      return {
        baseName: destination.titleHint ?? 'profile',
        extension,
        versioned: true,
      };
    case 'cast.voiceSample':
      return {
        baseName: destination.referenceName,
        extension: input.outputFormatHint ?? extension,
        versioned: true,
      };
    case 'location.environmentSheet':
      return {
        baseName: destination.titleHint ?? 'environment-sheet',
        extension,
        versioned: true,
      };
    case 'location.hero':
      return {
        baseName: destination.heroName ?? 'hero',
        extension,
        versioned: true,
      };
    case 'visualLanguage.lookbookImage':
      return {
        baseName: destination.titleHint ?? path.parse(input.sourceProjectRelativePath).name,
        extension,
        versioned: false,
      };
    case 'visualLanguage.lookbookSheet':
      return {
        baseName: destination.titleHint ?? path.parse(input.sourceProjectRelativePath).name,
        extension,
        versioned: false,
      };
    case 'shotVideoTake.media':
      return {
        baseName: shotVideoTakeMediaBaseName(destination.role),
        extension,
        versioned: false,
      };
    case 'scene.dialogueAudio':
      return {
        baseName: 'dialogue-audio',
        extension,
        versioned: false,
      };
    case 'image.editOutput':
      return {
        baseName: path.parse(input.sourceProjectRelativePath).name,
        extension,
        versioned: true,
        alwaysUseVersionSuffix: true,
      };
    default:
      return assertNever(destination);
  }
}

async function generationDestination(input: {
  session: DatabaseSession;
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<
  | { kind: 'temporary'; destination: ProjectTemporaryFileDestination }
  | { kind: 'durableAsset'; destination: ProjectAssetFileDestination }
> {
  const spec = input.specRecord.spec as unknown as Record<string, unknown>;
  switch (input.specRecord.purpose) {
    case CAST_CHARACTER_SHEET_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: { kind: 'cast.characterSheet', castMemberId: targetId(spec) },
      };
    case CAST_PROFILE_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: { kind: 'cast.profile', castMemberId: targetId(spec) },
      };
    case CAST_VOICE_SAMPLE_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: {
          kind: 'cast.voiceSample',
          castMemberId: targetId(spec),
          castVoiceId: targetId(spec),
          referenceName: requiredSpecString(spec, 'referenceName'),
        },
      };
    case LOOKBOOK_IMAGE_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: { kind: 'visualLanguage.lookbookImage' },
      };
    case LOOKBOOK_SHEET_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: { kind: 'visualLanguage.lookbookSheet' },
      };
    case LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: {
          kind: 'location.environmentSheet',
          locationId: targetId(spec),
        },
      };
    case LOCATION_HERO_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: { kind: 'location.hero', locationId: targetId(spec) },
      };
    case SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return {
        kind: 'temporary',
        destination: {
          kind: 'scene.storyboardSourceSheet',
          sceneId: targetId(spec),
        },
      };
    case SHOT_VIDEO_TAKE_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: {
          kind: 'shotVideoTake.media',
          takeId: targetId(spec),
          role: 'video',
        },
      };
    case IMAGE_EDIT_GENERATION_PURPOSE:
      return {
        kind: 'durableAsset',
        destination: {
          kind: 'image.editOutput',
          sourceAssetId: targetId(spec),
          sourceAssetFileId:
            typeof spec.sourceAssetFileId === 'string'
              ? spec.sourceAssetFileId
              : undefined,
        },
      };
    case IMAGE_CREATE_GENERATION_PURPOSE:
    case SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE:
      return {
        kind: 'temporary',
        destination: { kind: 'generation.media', purpose: input.specRecord.purpose },
      };
    default:
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_GENERATION_PURPOSE_UNSUPPORTED',
        `Media generation output placement is not defined for purpose: ${input.specRecord.purpose}.`
      );
  }
}

async function durableOutputNames(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  specRecord: MediaGenerationSpecRecord;
  outputCount: number;
}): Promise<string[]> {
  if (input.destination.kind === 'image.editOutput') {
    const spec = input.specRecord.spec as { parameterValues?: Record<string, unknown> };
    return allocateImageEditOutputNames({
      session: input.session,
      projectFolder: input.projectFolder,
      sourceAssetId: input.destination.sourceAssetId,
      sourceAssetFileId: input.destination.sourceAssetFileId,
      outputFormat: String(spec.parameterValues?.output_format ?? 'png'),
      outputCount: input.outputCount,
    });
  }
  const root = await durableDestinationRoot({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: input.destination,
    sourceProjectRelativePath: sourceProjectRelativePathForGeneration(
      input.session,
      input.specRecord
    ),
    now: new Date().toISOString(),
  });
  const allocation = durableDestinationAllocation(input.destination, {
    sourceProjectRelativePath: sourceProjectRelativePathForGeneration(
      input.session,
      input.specRecord
    ),
    mediaKind: mediaKindForPurpose(input.specRecord.purpose),
    outputFormatHint: durableGenerationOutputFormatHint(input.specRecord),
  });
  const names = allocation.versioned
    ? await allocateProjectRelativeVersionedFileNames({
        projectFolder: input.projectFolder,
        parent: root,
        baseName: allocation.baseName,
        extension: allocation.extension,
        count: input.outputCount,
        alwaysUseVersionSuffix: allocation.alwaysUseVersionSuffix,
      })
    : await allocateProjectRelativeFileNames({
        projectFolder: input.projectFolder,
        parent: root,
        baseName: allocation.baseName,
        extension: allocation.extension,
        count: input.outputCount,
      });
  return names;
}

function persistProjectAssetFileAtDestinationSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  assetId: string;
  assetFileId: string;
  fileRole: string;
  mediaKind: MediaKind;
  sourceProjectRelativePath: ProjectRelativePath;
  sourcePath: string;
  destinationProjectRelativePath: ProjectRelativePath;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  now: string;
  writeSet?: ProjectAssetFileWriteSet;
}): AssetFileRecord {
  assertDurableProjectAssetFilePath(input.destinationProjectRelativePath);
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    input.destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  let copied = false;
  try {
    fsSync.mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (input.sourcePath !== destinationPath) {
      fsSync.copyFileSync(input.sourcePath, destinationPath, fsSync.constants.COPYFILE_EXCL);
      copied = true;
      input.writeSet?.recordCreatedFile(input.destinationProjectRelativePath);
    }
    const stats = statProjectFileSync(destinationPath, {
      code: 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND',
      message: `Persisted project asset file was not found: ${input.destinationProjectRelativePath}.`,
    });
    insertAssetFileRecord(input.session, {
      id: input.assetFileId,
      assetId: input.assetId,
      role: input.fileRole,
      projectRelativePath: input.destinationProjectRelativePath,
      mimeType: input.mimeType ?? mimeTypeForProjectPath(input.destinationProjectRelativePath, input.mediaKind),
      mediaKind: input.mediaKind,
      sizeBytes: stats.size,
      contentHash: hashFileSync(destinationPath),
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      createdAt: input.now,
      updatedAt: input.now,
    });
    const row = readAssetFileRecord(input.session, {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    });
    if (!row) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_INSERT_FAILED',
        `Project asset file record was not inserted: ${input.assetFileId}.`
      );
    }
    return row;
  } catch (error) {
    if (copied && !input.writeSet) {
      removeCopiedProjectAssetFileSync(
        input.projectFolder,
        input.destinationProjectRelativePath
      );
    }
    throw error;
  }
}

function allocateSceneDialogueAudioFilePath(input: {
  session: DatabaseSession;
  projectFolder: string;
  root: ProjectRelativePath;
  destination: Extract<ProjectAssetFileDestination, { kind: 'scene.dialogueAudio' }>;
  sourceProjectRelativePath: ProjectRelativePath;
}): ProjectRelativePath {
  return allocateSceneDialogueAudioFilePathSync(input);
}

function allocateSceneDialogueAudioFilePathSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  root: ProjectRelativePath;
  destination: Extract<ProjectAssetFileDestination, { kind: 'scene.dialogueAudio' }>;
  sourceProjectRelativePath: ProjectRelativePath;
}): ProjectRelativePath {
  const basePrefix = sceneDialogueAudioBasePrefix(input.session, input.destination);
  const extension = extensionForMediaSource(input.sourceProjectRelativePath);
  for (let index = 0; index < 100; index += 1) {
    const candidate = joinProjectRelativePath(
      input.root,
      `${basePrefix}-${String(index).padStart(2, '0')}${extension}`
    );
    if (!projectPathExistsSync(input.projectFolder, candidate)) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
    `Could not allocate a dialogue audio file name for ${basePrefix}${extension}.`
  );
}

function sceneDialogueAudioBasePrefix(
  session: DatabaseSession,
  destination: Extract<ProjectAssetFileDestination, { kind: 'scene.dialogueAudio' }>
): string {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene Dialogue Audio storage requires a screenplay.'
    );
  }
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id !== destination.sceneId) {
          continue;
        }
        const block = scene.blocks.find(
          (candidate) =>
            candidate.type === 'dialogue' &&
            candidate.dialogueId === destination.dialogueId
        );
        if (!block || block.type !== 'dialogue') {
          throw new ProjectDataError(
            'PROJECT_ASSET_FILE_OWNER_MISSING',
            `Dialogue block was not found for project asset file destination: ${destination.dialogueId}.`
          );
        }
        if (!block.dialogueOrderKey) {
          throw new ProjectDataError(
            'PROJECT_ASSET_FILE_DIALOGUE_ORDER_KEY_MISSING',
            `Dialogue block is missing a stable dialogueOrderKey: ${destination.dialogueId}.`
          );
        }
        const castMember = block.castMemberId
          ? screenplay.cast.find((candidate) => candidate.id === block.castMemberId)
          : null;
        return `${block.dialogueOrderKey}-${kebabCasePathSegment(
          castMember?.handle || castMember?.name || 'dialogue',
          'dialogue'
        )}`;
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_OWNER_MISSING',
    `Scene was not found for project asset file destination: ${destination.sceneId}.`
  );
}

function nextStoryboardIterationNumber(
  projectFolder: string,
  session: DatabaseSession,
  sceneId: string
): number {
  const hierarchy = requireSceneHierarchy(session, sceneId);
  const parent = joinProjectRelativePath(
    STORYBOARDS_ROOT,
    kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
    kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
  );
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      parent,
      `${String(index).padStart(2, '0')}-iteration`
    );
    if (!projectPathExistsSync(projectFolder, candidate)) {
      return index;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    'Could not allocate a storyboard iteration folder.'
  );
}

function temporaryOutputNames(input: {
  specRecord: MediaGenerationSpecRecord;
  outputCount: number;
}): string[] {
  const extension =
    input.specRecord.purpose === SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE
      ? '.mp3'
      : '.png';
  const baseName = kebabCasePathSegment(input.specRecord.purpose, 'output');
  return Array.from({ length: Math.max(1, input.outputCount) }, (_, index) =>
    input.outputCount === 1
      ? `${baseName}${extension}`
      : `${baseName}-${String(index + 1).padStart(2, '0')}${extension}`
  );
}

function sourceProjectRelativePathForGeneration(
  session: DatabaseSession,
  specRecord: MediaGenerationSpecRecord
): ProjectRelativePath {
  if (specRecord.purpose === IMAGE_EDIT_GENERATION_PURPOSE) {
    const spec = specRecord.spec as { target?: { id?: unknown }; sourceAssetFileId?: unknown };
    const assetId = typeof spec.target?.id === 'string' ? spec.target.id : '';
    return normalizeProjectRelativePath(
      imageEditSourceFile(session, {
        sourceAssetId: assetId,
        sourceAssetFileId:
          typeof spec.sourceAssetFileId === 'string'
            ? spec.sourceAssetFileId
            : undefined,
      }).projectRelativePath
    );
  }
  const mediaKind = mediaKindForPurpose(specRecord.purpose);
  return joinProjectRelativePath(
    'tmp',
    `source${mediaKind === 'audio' ? '.mp3' : mediaKind === 'video' ? '.mp4' : '.png'}`
  );
}

function mediaKindForPurpose(purpose: MediaGenerationPurpose): MediaKind {
  if (
    purpose === CAST_VOICE_SAMPLE_GENERATION_PURPOSE ||
    purpose === SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE
  ) {
    return 'audio';
  }
  if (purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return 'video';
  }
  return 'image';
}

function durableGenerationOutputFormatHint(
  specRecord: MediaGenerationSpecRecord
): string | undefined {
  if (specRecord.purpose !== CAST_VOICE_SAMPLE_GENERATION_PURPOSE) {
    return undefined;
  }
  const spec = specRecord.spec as { outputFormat?: unknown };
  return extensionForAudioOutputFormat(
    typeof spec.outputFormat === 'string' ? spec.outputFormat : undefined
  );
}

function extensionForAudioOutputFormat(outputFormat: string | undefined): string {
  if (outputFormat?.startsWith('pcm_')) {
    return '.wav';
  }
  if (outputFormat?.startsWith('mp3_')) {
    return '.mp3';
  }
  return '.mp3';
}

function imageEditSourceFile(
  session: DatabaseSession,
  input: { sourceAssetId: string; sourceAssetFileId?: string }
): AssetFileRecord {
  if (!input.sourceAssetId) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_IMAGE_EDIT_SOURCE_REQUIRED',
      'Image edit output placement requires a source asset id.'
    );
  }
  const source = input.sourceAssetFileId
    ? readAssetFileRecord(session, {
        assetId: input.sourceAssetId,
        assetFileId: input.sourceAssetFileId,
      })
    : singleActiveImageFile(session, input.sourceAssetId);
  if (!source) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_IMAGE_EDIT_SOURCE_MISSING',
      `Image edit source asset file was not found for asset: ${input.sourceAssetId}.`
    );
  }
  return source;
}

function singleActiveImageFile(
  session: DatabaseSession,
  assetId: string
): AssetFileRecord | null {
  const imageFiles = listAssetFileRecordsForAsset(session, assetId).filter(
    (file) => file.mediaKind === 'image'
  );
  return imageFiles.length === 1 ? imageFiles[0]! : null;
}

function requireCastMember(session: DatabaseSession, castMemberId: string) {
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Cast member was not found for project asset file destination: ${castMemberId}.`
    );
  }
  return castMember;
}

function requireLocation(session: DatabaseSession, locationId: string) {
  const location = readLocationRecord(session, locationId);
  if (!location) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Location was not found for project asset file destination: ${locationId}.`
    );
  }
  return location;
}

function requireSceneHierarchy(
  session: DatabaseSession | undefined,
  sceneId: string
): { sequenceTitle: string; sceneTitle: string } {
  if (!session) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene hierarchy lookup requires a database session.'
    );
  }
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene hierarchy lookup requires a screenplay.'
    );
  }
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return {
            sequenceTitle: sequence.title ?? sequence.id ?? 'sequence',
            sceneTitle: scene.title ?? scene.id ?? 'scene',
          };
        }
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_OWNER_MISSING',
    `Scene was not found for project asset file destination: ${sceneId}.`
  );
}

function readSceneShotVideoTakeStorageRecord(
  session: DatabaseSession,
  takeId: string
) {
  return requireSceneShotVideoTakeStorageRecord(session, takeId);
}

function stableTakeNumber(
  session: DatabaseSession,
  sceneId: string,
  takeId: string
): string {
  const rows = listSceneShotVideoTakeStorageRecordsForScene(session, sceneId)
    .sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt)
    );
  const index = rows.findIndex((row) => row.id === takeId);
  return String(index < 0 ? rows.length + 1 : index + 1).padStart(2, '0');
}

async function allocateProjectRelativeFolderPath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
}): Promise<ProjectRelativePath> {
  const baseName = kebabCasePathSegment(input.baseName, 'folder');
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0
        ? baseName
        : `${baseName}-${String(index + 1).padStart(2, '0')}`
    );
    if (!(await projectPathExists(input.projectFolder, candidate))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    `Could not allocate a project asset folder for ${baseName}.`
  );
}

function allocateProjectRelativeFolderPathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
}): ProjectRelativePath {
  const baseName = kebabCasePathSegment(input.baseName, 'folder');
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0
        ? baseName
        : `${baseName}-${String(index + 1).padStart(2, '0')}`
    );
    if (!projectPathExistsSync(input.projectFolder, candidate)) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    `Could not allocate a project asset folder for ${baseName}.`
  );
}

async function allocateProjectRelativeFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): Promise<ProjectRelativePath> {
  const names = await allocateProjectRelativeFileNames({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

function allocateProjectRelativeFilePathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): ProjectRelativePath {
  const names = allocateProjectRelativeFileNamesSync({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

async function allocateProjectRelativeFileNames(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
}): Promise<string[]> {
  return allocateProjectRelativeNames(input, (baseName, index, extension) =>
    index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${String(index + 1).padStart(2, '0')}${extension}`
  );
}

function allocateProjectRelativeFileNamesSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
}): string[] {
  return allocateProjectRelativeNamesSync(input, (baseName, index, extension) =>
    index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${String(index + 1).padStart(2, '0')}${extension}`
  );
}

async function allocateProjectRelativeVersionedFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  alwaysUseVersionSuffix?: boolean;
}): Promise<ProjectRelativePath> {
  const names = await allocateProjectRelativeVersionedFileNames({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

function allocateProjectRelativeVersionedFilePathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  alwaysUseVersionSuffix?: boolean;
}): ProjectRelativePath {
  const names = allocateProjectRelativeVersionedFileNamesSync({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

async function allocateProjectRelativeVersionedFileNames(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
  alwaysUseVersionSuffix?: boolean;
}): Promise<string[]> {
  return allocateProjectRelativeNames(input, (baseName, index, extension) => {
    const version = input.alwaysUseVersionSuffix ? index + 1 : index;
    const suffix =
      version === 0 ? '' : `-v${String(version).padStart(2, '0')}`;
    return `${baseName}${suffix}${extension}`;
  });
}

function allocateProjectRelativeVersionedFileNamesSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
  alwaysUseVersionSuffix?: boolean;
}): string[] {
  return allocateProjectRelativeNamesSync(input, (baseName, index, extension) => {
    const version = input.alwaysUseVersionSuffix ? index + 1 : index;
    const suffix =
      version === 0 ? '' : `-v${String(version).padStart(2, '0')}`;
    return `${baseName}${suffix}${extension}`;
  });
}

async function allocateProjectRelativeNames(
  input: {
    projectFolder: string;
    parent: ProjectRelativePath;
    baseName: string;
    extension: string;
    count: number;
  },
  candidateName: (baseName: string, index: number, extension: string) => string
): Promise<string[]> {
  const baseName = kebabCasePathSegment(input.baseName, 'asset');
  const extension = input.extension.startsWith('.')
    ? input.extension.toLowerCase()
    : `.${input.extension.toLowerCase()}`;
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = candidateName(baseName, index, extension);
    if (reserved.has(name)) {
      continue;
    }
    const candidate = joinProjectRelativePath(input.parent, name);
    if (await projectPathExists(input.projectFolder, candidate)) {
      continue;
    }
    reserved.add(name);
    names.push(name);
  }
  if (names.length !== input.count) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
      `Could not allocate ${input.count} project asset file name(s) for ${baseName}${extension}.`
    );
  }
  return names;
}

function allocateProjectRelativeNamesSync(
  input: {
    projectFolder: string;
    parent: ProjectRelativePath;
    baseName: string;
    extension: string;
    count: number;
  },
  candidateName: (baseName: string, index: number, extension: string) => string
): string[] {
  const baseName = kebabCasePathSegment(input.baseName, 'asset');
  const extension = input.extension.startsWith('.')
    ? input.extension.toLowerCase()
    : `.${input.extension.toLowerCase()}`;
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = candidateName(baseName, index, extension);
    if (reserved.has(name)) {
      continue;
    }
    const candidate = joinProjectRelativePath(input.parent, name);
    if (projectPathExistsSync(input.projectFolder, candidate)) {
      continue;
    }
    reserved.add(name);
    names.push(name);
  }
  if (names.length !== input.count) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
      `Could not allocate ${input.count} project asset file name(s) for ${baseName}${extension}.`
    );
  }
  return names;
}

async function projectPathExists(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<boolean> {
  try {
    await fs.access(resolveProjectRelativePath(projectFolder, projectRelativePath));
    return true;
  } catch {
    return false;
  }
}

function projectPathExistsSync(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): boolean {
  return fsSync.existsSync(
    resolveProjectRelativePath(projectFolder, projectRelativePath)
  );
}

async function statProjectFile(
  absolutePath: string,
  error: { code: string; message: string }
): Promise<{ size: number; isFile(): boolean }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError(error.code, error.message);
  }
}

function statProjectFileSync(
  absolutePath: string,
  error: { code: string; message: string }
): fsSync.Stats {
  try {
    const stats = fsSync.statSync(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError(error.code, error.message);
  }
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  resolvedPath: string
): void {
  const relative = path.relative(projectFolder, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_PATH_OUTSIDE_PROJECT',
      'Project asset file paths must stay inside the project folder.'
    );
  }
}

function assertDurableProjectAssetFilePath(
  projectRelativePath: ProjectRelativePath
): void {
  if (
    projectRelativePath === 'generated' ||
    projectRelativePath.startsWith('generated/')
  ) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_DESTINATION_FORBIDDEN',
      `Durable asset files must not be stored under generated/: ${projectRelativePath}.`
    );
  }
  if (
    projectRelativePath === 'research' ||
    projectRelativePath.startsWith('research/')
  ) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_DESTINATION_FORBIDDEN',
      `Durable asset files must not be stored under research/: ${projectRelativePath}.`
    );
  }
}

async function hashFile(absolutePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(absolutePath));
  return hash.digest('hex');
}

function hashFileSync(absolutePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fsSync.readFileSync(absolutePath));
  return hash.digest('hex');
}

function mimeTypeForProjectPath(
  projectRelativePath: ProjectRelativePath,
  mediaKind: MediaKind
): string {
  const extension = path.extname(projectRelativePath).toLowerCase();
  if (mediaKind === 'audio') {
    if (extension === '.wav') {
      return 'audio/wav';
    }
    return 'audio/mpeg';
  }
  if (mediaKind === 'video') {
    return extension === '.mov' ? 'video/quicktime' : 'video/mp4';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}

function shotVideoTakeMediaBaseName(role: ShotVideoTakeMediaRole): string {
  switch (role) {
    case 'first-frame':
      return 'first-frame';
    case 'last-frame':
      return 'last-frame';
    case 'reference-image':
      return 'reference-image';
    case 'video-prompt-sheet':
      return 'video-prompt-sheet';
    case 'video':
      return 'video';
    default:
      return kebabCasePathSegment(role, 'media');
  }
}

function targetId(spec: Record<string, unknown>): string {
  const target = spec.target as { id?: unknown } | undefined;
  if (!target || typeof target.id !== 'string' || !target.id.trim()) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_TARGET_REQUIRED',
      'Media generation asset-file placement requires a spec target id.'
    );
  }
  return target.id;
}

function requiredSpecString(
  spec: Record<string, unknown>,
  fieldName: string
): string {
  const value = spec[fieldName];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SPEC_FIELD_REQUIRED',
      `Media generation asset-file placement requires spec.${fieldName}.`
    );
  }
  return value.trim();
}

function assertNever(value: never): never {
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_UNSUPPORTED_DESTINATION',
    `Unsupported project asset file destination: ${JSON.stringify(value)}.`
  );
}
