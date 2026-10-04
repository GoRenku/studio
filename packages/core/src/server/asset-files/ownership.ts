import { readInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { eq } from 'drizzle-orm';
import type { AssetFileOwner } from '../../client/asset-files.js';
import {
  castMembers,
  locations,
  props,
  scenes,
} from '../schema/index.js';
import { readProjectRecord } from '../database/access/project.js';
import { readLookbookRecordById } from '../database/access/lookbook.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import { sceneBeatExistsInHistory } from '../database/access/scene-beats.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { parseAssetFileOwnerKey } from './owner-keys.js';

export function assertAssetFileOwnerExists(
  session: DatabaseSession,
  owner: AssetFileOwner
): void {
  const exists = assetFileOwnerExists(session, owner);
  if (!exists) {
    throw new ProjectDataError(
      'CORE_ASSET_OWNER_INVALID',
      `Asset owner was not found: ${describeOwner(owner)}.`
    );
  }
}

export function readAssetFileOwner(
  session: DatabaseSession,
  assetFileId: string
): AssetFileOwner | null {
  const record = readAssetFileRecordIncludingDiscarded(session, assetFileId);
  return record ? parseAssetFileOwnerKey(record.ownerKey) : null;
}

export function requireAssetFileOwner(
  session: DatabaseSession,
  assetFileId: string
): AssetFileOwner {
  const owner = readAssetFileOwner(session, assetFileId);
  if (!owner) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Asset ${assetFileId} has no retained file record.`
    );
  }
  return owner;
}

function assetFileOwnerExists(
  session: DatabaseSession,
  owner: AssetFileOwner
): boolean {
  switch (owner.kind) {
    case 'inspirationFolder':
      return readInspirationFolderRecord(session, owner.id) !== null;
    case 'project':
      return readProjectRecord(session) !== null;
    case 'castMember':
      return rowExists(session, castMembers, castMembers.id, owner.id);
    case 'location':
      return rowExists(session, locations, locations.id, owner.id);
    case 'prop':
      return rowExists(session, props, props.id, owner.id);
    case 'scene':
      return rowExists(session, scenes, scenes.id, owner.id);
    case 'lookbook':
      return readLookbookRecordById(session, owner.id) !== null;
    case 'shot':
      return readShotRecord(session, owner.id) !== null;
    case 'sceneBeat':
      return sceneBeatExistsInHistory(session, owner.sceneId, owner.beatId);
  }
}

function rowExists(
  session: DatabaseSession,
  table: typeof castMembers | typeof locations | typeof props | typeof scenes,
  idColumn: typeof castMembers.id | typeof locations.id | typeof props.id | typeof scenes.id,
  id: string
): boolean {
  return session.db
    .select({ id: idColumn })
    .from(table)
    .where(eq(idColumn, id))
    .get() !== undefined;
}

function describeOwner(owner: AssetFileOwner): string {
  return owner.kind === 'project'
    ? 'project'
    : owner.kind === 'sceneBeat'
      ? `sceneBeat:${owner.sceneId}:${owner.beatId}`
      : `${owner.kind}:${owner.id}`;
}
