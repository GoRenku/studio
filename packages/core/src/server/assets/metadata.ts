import type {
  AssetUpdateReport,
  UpdateAssetInput,
} from '../../client/assets.js';
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
    updateAssetRecordMetadata(session, {
      assetId: input.assetId,
      title: optionalTrimmed(input.title) ?? undefined,
      oneLineSummary: input.oneLineSummary === undefined
        ? undefined
        : optionalTrimmed(input.oneLineSummary),
      referenceName: input.referenceName === undefined
        ? undefined
        : optionalTrimmed(input.referenceName),
      purpose: input.purpose === undefined
        ? undefined
        : optionalTrimmed(input.purpose),
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
