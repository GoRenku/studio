import type {
  AssetFileOwner,
  AssetFileSelectionReport,
  AssetFileSelectionTarget,
  ClearAssetFileSelectionInput,
  SelectAssetFileInput,
} from '../../client/asset-files.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { clearSelectedAssetFileRecord, writeSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { assetFileOwnerResourceKeys } from './resource-keys.js';
import { projectCoverSelectionResourceKeys } from '../studio-coordination/resource-keys.js';
import { requireProjectCoverFile } from '../project-covers/cover-file.js';
import { assetFileOwnerKey } from './owner-keys.js';
import { assertAssetFileOwnerExists } from './ownership.js';
import {
  assetFileSelectionTargetForOwner,
  assetFileSelectionTargetKey,
  selectionTargetOwner,
} from './selection-targets.js';

const selectedAssetFileTypes: Record<AssetFileSelectionTarget['kind'], string> = {
  project: 'project_cover',
  castMember: 'cast_profile',
  location: 'location_hero',
  locationWorld: 'location_world',
  prop: 'prop_hero',
  lookbook: 'lookbook_image',
  shot: 'shot_image',
  sceneBeat: 'scene_storyboard_image',
};

export async function selectAssetFile(
  input: SelectAssetFileInput & RenkuConfigPathOptions
): Promise<AssetFileSelectionReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = selectionTargetOwner(input.target);
    assertSelectionInSession(session, {
      target: input.target,
      owner,
      assetFileId: input.assetFileId,
    });
    writeSelectedAssetFileRecord(session, {
      targetKey: assetFileSelectionTargetKey(input.target),
      assetFileId: input.assetFileId,
      now: new Date().toISOString(),
    });
    return selectionReport(session, projectFolder, input.target, input.assetFileId);
  } finally {
    session.close();
  }
}

export async function clearAssetFileSelection(
  input: ClearAssetFileSelectionInput & RenkuConfigPathOptions
): Promise<AssetFileSelectionReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = selectionTargetOwner(input.target);
    assertAssetFileOwnerExists(session, owner);
    clearSelectedAssetFileRecord(session, assetFileSelectionTargetKey(input.target));
    return selectionReport(session, projectFolder, input.target, null);
  } finally {
    session.close();
  }
}

export function selectAssetFileInSession(
  session: DatabaseSession,
  input: { target: AssetFileSelectionTarget; assetFileId: string; now: string }
): void {
  const owner = selectionTargetOwner(input.target);
  assertSelectionInSession(session, { ...input, owner });
  writeSelectedAssetFileRecord(session, {
    targetKey: assetFileSelectionTargetKey(input.target),
    assetFileId: input.assetFileId,
    now: input.now,
  });
}

export function assetFileSelectionTargetForOwnerType(
  owner: AssetFileOwner,
  assetFileType: string
): AssetFileSelectionTarget {
  const target = owner.kind === 'project' && assetFileType === 'project_cover'
    ? { kind: 'project' as const }
    : owner.kind === 'location' && assetFileType === 'location_world'
      ? { kind: 'locationWorld' as const, id: owner.id }
      : assetFileSelectionTargetForOwner(owner);
  if (!target || selectedAssetFileTypes[target.kind] !== assetFileType) {
    throw new ProjectDataError(
      'CORE_ASSET_SELECTION_UNSUPPORTED',
      `Asset type ${assetFileType} does not support canonical selection for ${owner.kind}.`
    );
  }
  return target;
}

function assertSelectionInSession(
  session: DatabaseSession,
  input: {
    target: AssetFileSelectionTarget;
    owner: AssetFileOwner;
    assetFileId: string;
  }
): void {
  assertAssetFileOwnerExists(session, input.owner);
  const assetFile = readAssetFileRecordIncludingDiscarded(session, input.assetFileId);
  if (
    !assetFile
    || assetFile.discardedAt
    || assetFile.availability !== 'ready'
    || assetFile.type !== selectedAssetFileTypes[input.target.kind]
    || assetFile.ownerKey !== assetFileOwnerKey(input.owner)
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_SELECTION_INVALID',
      'Selected Asset must be an active canonical candidate owned by the exact selection target.'
    );
  }
  if (input.target.kind === 'project') {
    requireProjectCoverFile(session, {
      assetFileId: input.assetFileId,
      errorCode: 'CORE_ASSET_SELECTION_INVALID',
    });
  }
}

function selectionReport(
  session: DatabaseSession,
  projectFolder: string,
  target: AssetFileSelectionTarget,
  selectedAssetFileId: string | null
): AssetFileSelectionReport {
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
    project: { id: project.id, projectName: project.projectName, projectFolder },
    target,
    selectedAssetFileId,
    resourceKeys: target.kind === 'project'
      ? projectCoverSelectionResourceKeys()
      : assetFileOwnerResourceKeys(session, selectionTargetOwner(target)),
  };
}
