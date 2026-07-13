import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  GenerationOutputMediaKind,
  GenerationReference,
  GenerationReferenceCatalogItem,
  GenerationReferenceCatalogPage,
} from '../../client/generation.js';
import type { ProjectRelativePath } from '../../client/project.js';
import {
  listGenerationReferenceAssetFileRecords,
  readGenerationReferenceAssetFileRecord,
} from '../database/access/generation-references.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { isPathInside } from '../files/project-paths.js';

export interface ListGenerationReferencesInput {
  session: DatabaseSession;
  assetId?: string;
  assetFileIds?: string[];
  mediaKind?: GenerationOutputMediaKind;
  owner?: { kind: string; id: string };
  assetRole?: string;
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export function listGenerationReferences(
  input: ListGenerationReferencesInput
): GenerationReferenceCatalogPage {
  const search = input.search?.trim().toLocaleLowerCase();
  const items = listGenerationReferenceAssetFileRecords(input.session)
    .flatMap((record): GenerationReferenceCatalogItem[] => {
      const { asset, file, owner, generationRunId } = record;
      if (!isGenerationMediaKind(file.mediaKind)) {
        return [];
      }
      if (asset.origin === 'external' && !input.owner && !input.assetId && !input.assetFileIds) {
        return [];
      }
      const role = owner?.role ?? file.role;
      const label = asset.title.trim() || file.role;
      if (input.mediaKind && file.mediaKind !== input.mediaKind) {
        return [];
      }
      if (input.assetId && file.assetId !== input.assetId) {
        return [];
      }
      if (input.assetFileIds && !input.assetFileIds.includes(file.id)) {
        return [];
      }
      if (
        input.owner &&
        (owner?.kind !== input.owner.kind || owner.id !== input.owner.id)
      ) {
        return [];
      }
      if (input.assetRole && role !== input.assetRole) {
        return [];
      }
      if (
        search &&
        !`${label} ${role} ${file.projectRelativePath}`
          .toLocaleLowerCase()
          .includes(search)
      ) {
        return [];
      }
      return [{
        reference: {
          kind: 'asset-file',
          assetId: file.assetId,
          assetFileId: file.id,
        },
        label,
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        width: file.width,
        height: file.height,
        durationSeconds: file.durationSeconds,
        owner: owner ? { kind: owner.kind, id: owner.id } : null,
        role,
        provenance: {
          origin: asset.origin,
          ...(generationRunId
            ? { generationRunId }
            : {}),
        },
        projectRelativePath: normalizeProjectRelativePath(
          file.projectRelativePath
        ),
      }];
    })
    .sort((left, right) =>
      `${left.label}\0${referenceKey(left.reference)}`.localeCompare(
        `${right.label}\0${referenceKey(right.reference)}`
      )
    );
  const afterCursor = input.cursor
    ? items.filter((item) => itemCursor(item) > input.cursor!)
    : items;
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 200);
  const pageItems = afterCursor.slice(0, limit);
  return {
    items: pageItems,
    nextCursor:
      afterCursor.length > limit && pageItems.length > 0
        ? itemCursor(pageItems[pageItems.length - 1]!)
        : null,
  };
}

export async function resolveGenerationReference(input: {
  session: DatabaseSession;
  projectFolder: string;
  reference: GenerationReference;
}): Promise<GenerationReferenceCatalogItem | null> {
  if (input.reference.kind === 'project-file') {
    const projectRelativePath = normalizeProjectRelativePath(
      input.reference.projectRelativePath
    );
    const mediaKind = mediaKindForPath(projectRelativePath);
    if (!mediaKind) {
      return null;
    }
    if (!(await projectFileIsAvailable(input.projectFolder, projectRelativePath))) {
      return null;
    }
    const fileStats = await stat(
      resolveProjectRelativePath(input.projectFolder, projectRelativePath)
    );
    return {
      reference: input.reference,
      label: path.posix.basename(projectRelativePath),
      mediaKind,
      mimeType: mimeTypeForPath(projectRelativePath),
      sizeBytes: fileStats.size,
      width: null,
      height: null,
      durationSeconds: null,
      owner: null,
      role: 'project-file',
      provenance: { origin: 'project-file' },
      projectRelativePath,
    };
  }

  const record = readGenerationReferenceAssetFileRecord(input.session, {
    assetId: input.reference.assetId,
    assetFileId: input.reference.assetFileId,
  });
  if (!record || !isGenerationMediaKind(record.file.mediaKind)) {
    return null;
  }
  const mediaKind = record.file.mediaKind;
  const { asset, file, owner, generationRunId } = record;
  const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
  if (!(await projectFileIsAvailable(input.projectFolder, projectRelativePath))) {
    return null;
  }
  return {
    reference: input.reference,
    label: asset.title.trim() || file.role,
    mediaKind,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    width: file.width,
    height: file.height,
    durationSeconds: file.durationSeconds,
    owner: owner ? { kind: owner.kind, id: owner.id } : null,
    role: owner?.role ?? file.role,
    provenance: {
      origin: asset.origin,
      ...(generationRunId ? { generationRunId } : {}),
    },
    projectRelativePath,
  };
}

function referenceKey(reference: GenerationReference): string {
  return reference.kind === 'asset-file'
    ? `${reference.assetId}:${reference.assetFileId}`
    : reference.projectRelativePath;
}

function itemCursor(item: GenerationReferenceCatalogItem): string {
  return `${item.label}\0${referenceKey(item.reference)}`;
}

function isGenerationMediaKind(
  mediaKind: string
): mediaKind is GenerationOutputMediaKind {
  return mediaKind === 'image' || mediaKind === 'audio' || mediaKind === 'video';
}

function mediaKindForPath(
  projectRelativePath: ProjectRelativePath
): GenerationOutputMediaKind | null {
  const mimeType = mimeTypeForPath(projectRelativePath);
  if (mimeType?.startsWith('image/')) {
    return 'image';
  }
  if (mimeType?.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType?.startsWith('video/')) {
    return 'video';
  }
  return null;
}

function mimeTypeForPath(projectRelativePath: ProjectRelativePath): string | null {
  switch (path.posix.extname(projectRelativePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    default:
      return null;
  }
}

async function projectFileIsAvailable(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<boolean> {
  try {
    const [realProjectFolder, realFilePath] = await Promise.all([
      realpath(path.resolve(projectFolder)),
      realpath(resolveProjectRelativePath(projectFolder, projectRelativePath)),
    ]);
    return isPathInside(realProjectFolder, realFilePath);
  } catch {
    return false;
  }
}
