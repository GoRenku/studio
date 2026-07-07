import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ProjectRelativePath,
  ShotVideoTakeInputKind,
} from '../../../../../client/index.js';
import {
  readAssetFileRecord,
  readAssetFileRecordIncludingDiscarded,
  insertAssetFileRecord,
} from '../../../../database/access/asset-files.js';
import {
  readAssetOwnerTargets,
} from '../../../../database/access/asset-relationships/index.js';
import {
  insertAssetRecord,
  readAssetRecord,
} from '../../../../database/access/assets.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import type {
  EntityIdPrefix,
} from '../../../../entity-ids.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../../../../files/project-relative-paths.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  assertResolvedPathInsideProject,
} from '../shared/project-media-files.js';

const TAKE_OWNED_INPUT_KINDS = new Set<ShotVideoTakeInputKind>([
  'video-prompt-sheet',
  'first-frame',
  'last-frame',
  'reference-image',
]);
const TAKE_OWNED_MEDIA_COPY_ROOT = joinProjectRelativePath(
  'generated',
  'media',
  'scene-shot-video-takes'
);

export function isShotVideoTakeOwnedMediaInputKind(
  kind: string
): kind is ShotVideoTakeInputKind {
  return TAKE_OWNED_INPUT_KINDS.has(kind as ShotVideoTakeInputKind);
}

export function isShotVideoTakeOwnedMediaAsset(
  session: DatabaseSession,
  input: { inputKind: string; assetId: string }
): input is { inputKind: ShotVideoTakeInputKind; assetId: string } {
  return (
    isShotVideoTakeOwnedMediaInputKind(input.inputKind) &&
    readAssetOwnerTargets(session, input.assetId).length === 0
  );
}

export interface CopiedTakeOwnedMediaAssetFile {
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
}

export function copyTakeOwnedMediaAssetFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceAssetId: string;
  sourceAssetFileId: string;
  targetTakeId: string;
  inputKind: ShotVideoTakeInputKind;
  allowDiscardedSource?: boolean;
  now: string;
  nextId: (prefix: EntityIdPrefix) => string;
}): CopiedTakeOwnedMediaAssetFile {
  const sourceAsset = readAssetRecord(input.session, input.sourceAssetId);
  if (!sourceAsset || (sourceAsset.discardedAt && !input.allowDiscardedSource)) {
    throw new ProjectDataError(
      'PROJECT_DATA436',
      `Shot video take-owned source asset was not found or is discarded: ${input.sourceAssetId}.`,
      {
        suggestion:
          'Repair or reselect the take-owned media before creating a take iteration.',
      }
    );
  }
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
      'PROJECT_DATA437',
      `Shot video take-owned source asset file was not found or is discarded: ${input.sourceAssetFileId}.`,
      {
        suggestion:
          'Repair or reselect the take-owned media before creating a take iteration.',
      }
    );
  }

  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceFile.projectRelativePath as ProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const sourceStats = statActiveTakeOwnedMediaFile(sourcePath);

  const assetId = input.nextId('asset');
  const assetFileId = input.nextId('asset_file');
  const projectRelativePath = copiedTakeOwnedMediaProjectPath({
    takeId: input.targetTakeId,
    inputKind: input.inputKind,
    assetFileId,
    sourceProjectRelativePath: sourceFile.projectRelativePath,
  });
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    projectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  const destinationExistedBeforeCopy = fs.existsSync(destinationPath);

  try {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (sourcePath !== destinationPath) {
      fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    }

    const destinationStats = statActiveTakeOwnedMediaFile(destinationPath);
    if (sourceStats.size !== destinationStats.size) {
      throw new ProjectDataError(
        'PROJECT_DATA438',
        'Copied take-owned media size does not match the source file.',
        {
          suggestion:
            'Retry the take iteration after confirming the source media file is stable on disk.',
        }
      );
    }
    const contentHash = hashFileSync(destinationPath);

    insertAssetRecord(input.session, {
      id: assetId,
      type: sourceAsset.type,
      mediaKind: sourceAsset.mediaKind,
      title: sourceAsset.title,
      oneLineSummary: sourceAsset.oneLineSummary ?? undefined,
      origin: sourceAsset.origin,
      availability: sourceAsset.availability,
      createdAt: input.now,
      updatedAt: input.now,
    });
    insertAssetFileRecord(input.session, {
      id: assetFileId,
      assetId,
      role: sourceFile.role,
      projectRelativePath,
      mimeType: sourceFile.mimeType ?? undefined,
      mediaKind: sourceFile.mediaKind,
      sizeBytes: destinationStats.size,
      contentHash,
      width: sourceFile.width ?? undefined,
      height: sourceFile.height ?? undefined,
      durationSeconds: sourceFile.durationSeconds ?? undefined,
      createdAt: input.now,
      updatedAt: input.now,
    });

    return {
      assetId,
      assetFileId,
      projectRelativePath,
    };
  } catch (error) {
    if (!destinationExistedBeforeCopy && sourcePath !== destinationPath) {
      try {
        removeCopiedTakeOwnedMediaAssetFile({
          projectFolder: input.projectFolder,
          projectRelativePath,
        });
      } catch {
        // Preserve the original copy failure for callers.
      }
    }
    throw error;
  }
}

export function removeCopiedTakeOwnedMediaAssetFile(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): void {
  if (!isCopiedTakeOwnedMediaProjectPath(input.projectRelativePath)) {
    throw new ProjectDataError(
      'PROJECT_DATA441',
      `Refusing to remove a non-iteration take-owned media file: ${input.projectRelativePath}.`
    );
  }
  const filePath = resolveProjectRelativePath(
    input.projectFolder,
    input.projectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, filePath);
  fs.rmSync(filePath, { force: true });
}

function copiedTakeOwnedMediaProjectPath(input: {
  takeId: string;
  inputKind: ShotVideoTakeInputKind;
  assetFileId: string;
  sourceProjectRelativePath: string;
}): ProjectRelativePath {
  return joinProjectRelativePath(
    'generated',
    'media',
    'scene-shot-video-takes',
    input.takeId,
    `${input.inputKind}-${input.assetFileId}${path.extname(input.sourceProjectRelativePath)}`
  );
}

function isCopiedTakeOwnedMediaProjectPath(
  projectRelativePath: ProjectRelativePath
): boolean {
  return projectRelativePath.startsWith(`${TAKE_OWNED_MEDIA_COPY_ROOT}/`);
}

function statActiveTakeOwnedMediaFile(filePath: string): fs.Stats {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA439',
      `Shot video take-owned media file was not found on disk: ${filePath}.`,
      {
        suggestion:
          'Repair or reimport the take-owned media before creating a take iteration.',
      }
    );
  }
}

function hashFileSync(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}
