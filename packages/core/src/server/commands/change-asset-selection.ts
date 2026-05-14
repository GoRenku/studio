import type { Asset, AssetTarget } from '../../client/index.js';
import {
  nextAssetSelectionOrder,
  readAssetRelationship,
  readAssetRelationshipRecord,
  updateAssetRelationshipSelection,
} from '../database/access/asset-relationships/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function createAssetSelect(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    selectionOrder?: number;
  } & RenkuConfigPathOptions
): Promise<Asset> {
  return updateSelection(input, 'create');
}

export async function updateAssetSelect(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    selectionOrder?: number;
  } & RenkuConfigPathOptions
): Promise<Asset> {
  return updateSelection(input, 'update');
}

export async function removeAssetSelect(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
  } & RenkuConfigPathOptions
): Promise<Asset> {
  const { session } = await openProjectSession(input);
  try {
    const row = readAssetRelationshipRecord(session, {
      target: input.target,
      assetId: input.assetId,
    });
    if (!row) {
      throw assetNotAttached(input.assetId);
    }
    updateAssetRelationshipSelection(session, {
      target: input.target,
      assetId: input.assetId,
      selection: 'take',
      selectionOrder: null,
      updatedAt: new Date().toISOString(),
    });
    return readAssetOrThrow(session, input.target, input.assetId);
  } finally {
    session.close();
  }
}

async function updateSelection(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    selectionOrder?: number;
  } & RenkuConfigPathOptions,
  operation: 'create' | 'update'
): Promise<Asset> {
  if (input.selectionOrder !== undefined && input.selectionOrder < 1) {
    throw new ProjectDataError(
      'PROJECT_DATA083',
      'Selection order must be a positive integer.'
    );
  }

  const { session } = await openProjectSession(input);
  try {
    const row = readAssetRelationshipRecord(session, {
      target: input.target,
      assetId: input.assetId,
    });
    if (!row) {
      throw assetNotAttached(input.assetId);
    }
    if (operation === 'update' && row.selection !== 'select') {
      throw new ProjectDataError(
        'PROJECT_DATA084',
        `Asset ${input.assetId} is still a take for the requested target.`
      );
    }
    const selectionOrder =
      input.selectionOrder ??
      nextAssetSelectionOrder(session, {
        target: input.target,
        role: row.role,
        localeId: row.localeId,
      });
    updateAssetRelationshipSelection(session, {
      target: input.target,
      assetId: input.assetId,
      selection: 'select',
      selectionOrder,
      updatedAt: new Date().toISOString(),
    });
    return readAssetOrThrow(session, input.target, input.assetId);
  } finally {
    session.close();
  }
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

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
