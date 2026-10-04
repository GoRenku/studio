import fs from 'node:fs';
import path from 'node:path';
import type { AssetFileOwner, ImportReferenceFilesInput, ProjectRelativePath } from '../../client/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { requireInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { assertProjectFilePathWithoutSymlinks } from '../project-asset-files/path-guards.js';
import { ProjectDataError } from '../project-data-error.js';
import { hashFileSync, mimeTypeForProjectPath, referenceMediaKindForProjectPath } from '../project-asset-files/file-operations.js';

const images = new Set(['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

export function referenceDestination(session: DatabaseSession, destination: ImportReferenceFilesInput['destination']): {
  root: ProjectRelativePath; owner: AssetFileOwner; type: string;
} {
  if (!destination || typeof destination !== 'object') { throw new ProjectDataError('CORE_REFERENCE_FILE_DESTINATION_INVALID', 'Choose an Inspiration folder or research destination.'); }
  if (destination.kind === 'research') { return { root: normalizeProjectRelativePath('research'), owner: { kind: 'project' }, type: 'research_reference' }; }
  if (destination.kind !== 'inspiration') { throw new ProjectDataError('CORE_REFERENCE_FILE_DESTINATION_INVALID', 'Choose an Inspiration folder or research destination.'); }
  if (typeof destination.folderId !== 'string' || !destination.folderId.trim()) { throw new ProjectDataError('CORE_REFERENCE_FILE_DESTINATION_INVALID', 'Provide the Inspiration folder id.'); }
  const folder = requireInspirationFolderRecord(session, destination.folderId);
  const root = normalizeProjectRelativePath(folder.projectRelativePath);
  if (!root.startsWith('visual-language/inspiration/')) { throw new ProjectDataError('CORE_REFERENCE_FILE_DESTINATION_INVALID', 'Inspiration directory must stay inside visual-language/inspiration/.'); }
  return { root, owner: { kind: 'inspirationFolder', id: folder.id }, type: 'inspiration_image' };
}

export function readReferenceSource(projectFolder: string, source: ImportReferenceFilesInput['files'][number], destination: ReturnType<typeof referenceDestination>) {
  const projectRelativePath = normalizeProjectRelativePath(source.sourceProjectRelativePath);
  assertProjectFilePathWithoutSymlinks(projectFolder, projectRelativePath);
  assertProjectFilePathWithoutSymlinks(projectFolder, destination.root);
  const absolute = resolveProjectRelativePath(projectFolder, projectRelativePath);
  const stats = fs.lstatSync(absolute);
  if (!stats.isFile()) { throw new ProjectDataError('CORE_REFERENCE_FILE_SOURCE_INVALID', 'Reference imports require regular files.'); }
  const extension = path.extname(projectRelativePath).toLowerCase();
  if (destination.type === 'inspiration_image' && !images.has(extension)) { throw new ProjectDataError('CORE_REFERENCE_FILE_SOURCE_INVALID', 'Inspiration imports require a supported image format.'); }
  const mediaKind = referenceMediaKindForProjectPath(projectRelativePath);
  const inPlace = destination.type === 'inspiration_image'
    ? path.posix.dirname(projectRelativePath) === destination.root
    : projectRelativePath.startsWith(`${destination.root}/`);
  if (source.title !== undefined && typeof source.title !== 'string') { throw new ProjectDataError('CORE_REFERENCE_FILE_METADATA_INVALID', 'Reference title must be text.'); }
  return { projectRelativePath, mediaKind, inPlace, sizeBytes: stats.size,
    contentHash: hashFileSync(absolute), mimeType: mimeTypeForProjectPath(projectRelativePath, mediaKind), title: source.title ?? null };
}
