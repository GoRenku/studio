import type {
  AssetMetadataInput,
  AssetUpdateReport,
  UpdateAssetInput,
} from '../../client/assets.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { updateAssetRecordMetadata } from '../database/access/assets.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { requireAssetOwner } from './ownership.js';
import { readOwnedAsset } from './projection.js';
import { assetOwnerResourceKeys } from './resource-keys.js';
import { readProjectLocaleRecord } from '../database/access/project-locales.js';

export async function updateAsset(
  input: UpdateAssetInput & RenkuConfigPathOptions
): Promise<AssetUpdateReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = requireAssetOwner(session, input.assetId);
    assertAssetLocaleExists(session, input.localeId);
    const metadata = normalizeAssetMetadata(input, ['asset']);
    updateAssetRecordMetadata(session, {
      assetId: input.assetId,
      title: optionalTrimmed(input.title) ?? undefined,
      ...metadata,
      localeId: input.localeId,
      updatedAt: new Date().toISOString(),
    });
    const project = readProjectRecord(session);
    const asset = readOwnedAsset(session, { owner, assetId: input.assetId });
    if (!project || !asset) {
      throw new ProjectDataError(
        'CORE_ASSET_STORAGE_INVALID',
        `Updated Asset could not be projected: ${input.assetId}.`
      );
    }
    return {
      valid: true,
      warnings: [],
      project: { id: project.id, projectName: project.projectName, projectFolder },
      asset,
      resourceKeys: assetOwnerResourceKeys(session, owner),
    };
  } finally {
    session.close();
  }
}

export function normalizeAssetMetadata(
  input: AssetMetadataInput,
  path: string[] = ['assetMetadata']
): AssetMetadataInput {
  return {
    ...(input.oneLineSummary === undefined
      ? {}
      : { oneLineSummary: optionalTrimmed(input.oneLineSummary) }),
    ...(input.referenceName === undefined
      ? {}
      : { referenceName: optionalTrimmed(input.referenceName) }),
    ...(input.tags === undefined
      ? {}
      : { tags: normalizeAssetTags(input.tags, path) }),
  };
}

function normalizeAssetTags(tags: string[], path: string[]): string[] {
  if (!Array.isArray(tags)) {
    throw invalidAssetTags(path, 'Asset tags must be a list of strings.');
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of tags.entries()) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw invalidAssetTags(
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

function invalidAssetTags(path: string[], message: string): ProjectDataError {
  return new ProjectDataError('CORE_ASSET_TAGS_INVALID', message, {
    issues: [createDiagnosticError(
      'CORE_ASSET_TAGS_INVALID',
      message,
      { path, context: 'Asset metadata' },
      'Pass a list containing only non-empty tag strings.'
    )],
  });
}

function assertAssetLocaleExists(
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
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
