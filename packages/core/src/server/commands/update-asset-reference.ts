import type {
  Asset,
  AssetReferenceUpdateReport,
  AssetTarget,
  UpdateAssetReferenceInput,
} from '../../client/index.js';
import {
  readAssetRelationship,
  readAssetRelationshipRecord,
  updateAssetRelationshipReferenceMetadata,
} from '../database/access/asset-relationships/index.js';
import { updateAssetRecordMetadata } from '../database/access/assets.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { studioAssetTargetSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';

export async function updateAssetReference(
  input: UpdateAssetReferenceInput & RenkuConfigPathOptions
): Promise<AssetReferenceUpdateReport> {
  const normalizedInput = normalizeUpdateAssetReferenceInput(input);
  const { projectFolder, session } = await openProjectSession(normalizedInput);
  try {
    const row = readAssetRelationshipRecord(session, {
      target: normalizedInput.target,
      assetId: normalizedInput.assetId,
    });
    if (!row) {
      throw assetNotAttached(normalizedInput.assetId);
    }

    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      updateAssetRecordMetadata(transactionSession, {
        assetId: normalizedInput.assetId,
        title: normalizedInput.title ?? undefined,
        oneLineSummary: normalizedInput.oneLineSummary,
        updatedAt: now,
      });
      updateAssetRelationshipReferenceMetadata(transactionSession, {
        target: normalizedInput.target,
        assetId: normalizedInput.assetId,
        referenceName: normalizedInput.referenceName,
        purpose: normalizedInput.purpose ?? null,
        updatedAt: now,
      });
    });

    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }
    return {
      valid: true,
      warnings: [],
      project: { id: project.id, name: project.name, projectFolder },
      asset: readAssetOrThrow(
        session,
        normalizedInput.target,
        normalizedInput.assetId
      ),
      resourceKeys: studioAssetTargetSurfaceResourceKeys(normalizedInput.target),
    };
  } finally {
    session.close();
  }
}

function normalizeUpdateAssetReferenceInput(
  input: UpdateAssetReferenceInput & RenkuConfigPathOptions
): UpdateAssetReferenceInput & RenkuConfigPathOptions {
  return {
    ...input,
    referenceName: requiredTrimmed(input.referenceName, 'referenceName'),
    title: optionalTrimmed(input.title) ?? undefined,
    oneLineSummary:
      input.oneLineSummary === undefined
        ? undefined
        : optionalTrimmed(input.oneLineSummary),
    purpose: optionalTrimmed(input.purpose),
  };
}

function readAssetOrThrow(
  session: Parameters<typeof readAssetRelationship>[0],
  target: AssetTarget,
  assetId: string
): Asset {
  const asset = readAssetRelationship(session, { target, assetId });
  if (!asset) {
    throw assetNotAttached(assetId);
  }
  return asset;
}

function requiredTrimmed(input: string, fieldName: string): string {
  const value = input.trim();
  if (!value) {
    throw new ProjectDataError('PROJECT_DATA081', `${fieldName} cannot be empty.`);
  }
  return value;
}

function optionalTrimmed(input?: string | null): string | null {
  const value = input?.trim();
  return value ? value : null;
}

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
