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
import { listAssetFilePageInSession } from './projection.js';
import type { CastingRoundSubject } from '../../client/casting/model.js';
import { readCastingCandidateRecord, readCastingRoundRecord } from '../database/access/casting/rounds.js';
import {
  assetFileSelectionTargetForOwner,
  assetFileSelectionTargetKey,
  resolveSelectionTargetOwner,
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
  castLook: 'casting_candidate',
  castCostume: 'character_sheet',
};

export async function selectAssetFile(
  input: SelectAssetFileInput & RenkuConfigPathOptions
): Promise<AssetFileSelectionReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = resolveSelectionTargetOwner(session, input.target);
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
    const owner = resolveSelectionTargetOwner(session, input.target);
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
  const owner = resolveSelectionTargetOwner(session, input.target);
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
  const target = selectableAssetFileTarget(owner, assetFileType);
  if (!target) {
    throw new ProjectDataError(
      'CORE_ASSET_SELECTION_UNSUPPORTED',
      `Asset type ${assetFileType} does not support canonical selection for ${owner.kind}.`
    );
  }
  return target;
}

/** The canonical selection target for this owner and Asset type, or null when the type has no selection. */
export function selectableAssetFileTarget(
  owner: AssetFileOwner,
  assetFileType: string
): AssetFileSelectionTarget | null {
  const target = owner.kind === 'project' && assetFileType === 'project_cover'
    ? { kind: 'project' as const }
    : owner.kind === 'location' && assetFileType === 'location_world'
      ? { kind: 'locationWorld' as const, id: owner.id }
      : assetFileSelectionTargetForOwner(owner);
  return target && selectedAssetFileTypes[target.kind] === assetFileType ? target : null;
}

export function assetFileSelectionResourceKeys(
  session: DatabaseSession,
  target: AssetFileSelectionTarget
): string[] {
  return target.kind === 'project'
    ? projectCoverSelectionResourceKeys()
    : assetFileOwnerResourceKeys(session, resolveSelectionTargetOwner(session, target));
}

export function selectFirstContinuityImageInSession(
  session: DatabaseSession,
  input: { owner: AssetFileOwner; assetFileType: string; assetFileId: string; now: string }
): void {
  const owner = input.owner;
  if (owner.kind !== 'castMember' && owner.kind !== 'location' && owner.kind !== 'prop') {
    return;
  }
  if (selectedAssetFileTypes[owner.kind] !== input.assetFileType) {
    return;
  }
  const candidates = listAssetFilePageInSession(session, {
    owner,
    type: input.assetFileType,
    mediaKind: 'image',
    limit: 2,
  });
  if (candidates.selectedAssetFileId || candidates.items.length !== 1
    || candidates.items[0]?.id !== input.assetFileId) {
    return;
  }
  selectAssetFileInSession(session, {
    target: owner,
    assetFileId: input.assetFileId,
    now: input.now,
  });
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
  if (input.target.kind === 'castLook' || input.target.kind === 'castCostume') {
    assertRoundImageBelongsToSubject(session, { subject: input.target, assetFileId: input.assetFileId });
  }
  if (input.target.kind === 'project') {
    requireProjectCoverFile(session, {
      assetFileId: input.assetFileId,
      errorCode: 'CORE_ASSET_SELECTION_INVALID',
    });
  }
}

const ROUND_SELECTION_MESSAGES: Record<CastingRoundSubject['kind'], string> = {
  castLook: 'A Look can only be cast from a candidate of its own casting rounds.',
  castCostume: 'A costume can only pick a character sheet of its own rounds.',
};

/** Looks and costumes choose only among the images of their own rounds. */
function assertRoundImageBelongsToSubject(
  session: DatabaseSession,
  input: { subject: CastingRoundSubject; assetFileId: string }
): void {
  const candidate = readCastingCandidateRecord(session, input.assetFileId);
  const round = candidate ? readCastingRoundRecord(session, candidate.roundId) : null;
  if (!round || round.subject.kind !== input.subject.kind || round.subject.id !== input.subject.id) {
    throw new ProjectDataError('CORE_ASSET_SELECTION_INVALID', ROUND_SELECTION_MESSAGES[input.subject.kind]);
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
    resourceKeys: assetFileSelectionResourceKeys(session, target),
  };
}
