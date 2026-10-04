import type {
  AssetFileMetadataInput,
  AssetFileUpdateReport,
  UpdateAssetFileInput,
} from '../../client/asset-files.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { updateAssetFileRecordMetadata } from '../database/access/asset-files.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { requireAssetFileOwner } from './ownership.js';
import { readOwnedAssetFile } from './projection.js';
import { assetFileOwnerResourceKeys } from './resource-keys.js';
import { readProjectLocaleRecord } from '../database/access/project-locales.js';

export async function updateAssetFile(
  input: UpdateAssetFileInput & RenkuConfigPathOptions
): Promise<AssetFileUpdateReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = requireAssetFileOwner(session, input.assetFileId);
    assertAssetFileLocaleExists(session, input.localeId);
    const metadata = normalizeAssetFileMetadata(input, ['assetFile']);
    updateAssetFileRecordMetadata(session, {
      assetFileId: input.assetFileId,
      title: input.title === undefined ? undefined : optionalTrimmed(input.title),
      ...metadata,
      localeId: input.localeId,
      updatedAt: new Date().toISOString(),
    });
    const project = readProjectRecord(session);
    const assetFile = readOwnedAssetFile(session, { owner, assetFileId: input.assetFileId });
    if (!project || !assetFile) {
      throw new ProjectDataError(
        'CORE_ASSET_STORAGE_INVALID',
        `Updated Asset could not be projected: ${input.assetFileId}.`
      );
    }
    return {
      valid: true,
      warnings: [],
      project: { id: project.id, projectName: project.projectName, projectFolder },
      assetFile,
      resourceKeys: assetFileOwnerResourceKeys(session, owner),
    };
  } finally {
    session.close();
  }
}

export function normalizeAssetFileMetadata(
  input: AssetFileMetadataInput,
  path: string[] = ['assetFileMetadata']
): AssetFileMetadataInput {
  return {
    ...(input.oneLineSummary === undefined
      ? {}
      : { oneLineSummary: optionalTrimmed(input.oneLineSummary) }),
    ...(input.referenceName === undefined
      ? {}
      : { referenceName: optionalTrimmed(input.referenceName) }),
    ...(input.tags === undefined
      ? {}
      : { tags: normalizeAssetFileTags(input.tags, path) }),
  };
}

function normalizeAssetFileTags(tags: string[], path: string[]): string[] {
  if (!Array.isArray(tags)) {
    throw invalidAssetFileTags(path, 'Asset tags must be a list of strings.');
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of tags.entries()) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw invalidAssetFileTags(
        [...path, 'tags', String(index)],
        'Each Asset tag must be a non-empty string.'
      );
    }
    const tag = value.trim();
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized;
}

function invalidAssetFileTags(path: string[], message: string): ProjectDataError {
  return new ProjectDataError('CORE_ASSET_TAGS_INVALID', message, {
    issues: [createDiagnosticError(
      'CORE_ASSET_TAGS_INVALID',
      message,
      { path, context: 'Asset metadata' },
      'Pass a list containing only non-empty tag strings.'
    )],
  });
}

function assertAssetFileLocaleExists(
  session: Parameters<typeof readProjectLocaleRecord>[0],
  localeId: string | null | undefined
): void {
  if (
    localeId !== undefined
    && localeId !== null
    && !readProjectLocaleRecord(session, localeId)
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_LOCALE_INVALID',
      `Project locale was not found: ${localeId}.`
    );
  }
}

function optionalTrimmed(value?: string | null): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new ProjectDataError('CORE_ASSET_FILE_METADATA_INVALID', 'AssetFile text metadata must be text or null.');
  }
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
