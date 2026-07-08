import type {
  MediaKind,
  ProjectRelativePath,
  ShotVideoTakeInputKind,
} from '../../../../../client/index.js';
import {
  readAssetFileRecord,
  readAssetFileRecordIncludingDiscarded,
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
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  copyTakeOwnedProjectAssetFileSync,
  removeCopiedProjectAssetFileSync,
  type ProjectAssetFileWriteSet,
} from '../../../../project-asset-files/index.js';

const TAKE_OWNED_INPUT_KINDS = new Set<ShotVideoTakeInputKind>([
  'video-prompt-sheet',
  'first-frame',
  'last-frame',
  'reference-image',
]);

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
  writeSet?: ProjectAssetFileWriteSet;
  sourceAssetId: string;
  sourceAssetFileId: string;
  targetTakeId: string;
  targetTakeFolder: ProjectRelativePath;
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

  const assetId = input.nextId('asset');
  const assetFileId = input.nextId('asset_file');
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
  const copiedFile = copyTakeOwnedProjectAssetFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    writeSet: input.writeSet,
    sourceAssetId: input.sourceAssetId,
    sourceAssetFileId: input.sourceAssetFileId,
    targetAssetId: assetId,
    targetAssetFileId: assetFileId,
    targetTakeId: input.targetTakeId,
    role: input.inputKind,
    fileRole: sourceFile.role,
    mediaKind: sourceFile.mediaKind as MediaKind,
    mimeType: sourceFile.mimeType ?? undefined,
    width: sourceFile.width ?? undefined,
    height: sourceFile.height ?? undefined,
    durationSeconds: sourceFile.durationSeconds ?? undefined,
    allowDiscardedSource: input.allowDiscardedSource,
    now: input.now,
  });

  return {
    assetId,
    assetFileId,
    projectRelativePath: copiedFile.projectRelativePath as ProjectRelativePath,
  };
}

export function removeCopiedTakeOwnedMediaAssetFile(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): void {
  removeCopiedProjectAssetFileSync(
    input.projectFolder,
    input.projectRelativePath
  );
}
