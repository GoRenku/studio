import { eq } from 'drizzle-orm';
import type { AssetOwner } from '../../client/assets.js';
import {
  castMembers,
  locations,
  scenes,
  sequences,
} from '../schema/index.js';
import { readProjectRecord } from '../database/access/project.js';
import { readLookbookRecordById } from '../database/access/lookbook.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import { readActiveSceneBeatSheetRecord, readSceneBeatSheetDocument } from '../database/access/scene-beat-sheets.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { insertAssetMembershipRecord, readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetOwnerKey, parseAssetOwnerKey } from './owner-keys.js';

export function assertAssetOwnerExists(
  session: DatabaseSession,
  owner: AssetOwner
): void {
  const exists = assetOwnerExists(session, owner);
  if (!exists) {
    throw new ProjectDataError(
      'CORE_ASSET_OWNER_INVALID',
      `Asset owner was not found: ${describeOwner(owner)}.`
    );
  }
}

export function createAssetMembership(
  session: DatabaseSession,
  input: { assetId: string; owner: AssetOwner; now: string }
): void {
  assertAssetOwnerExists(session, input.owner);
  insertAssetMembershipRecord(session, {
    assetId: input.assetId,
    ownerKey: assetOwnerKey(input.owner),
    now: input.now,
  });
}

export function readAssetOwner(
  session: DatabaseSession,
  assetId: string
): AssetOwner | null {
  const membership = readAssetMembershipRecord(session, assetId);
  return membership ? parseAssetOwnerKey(membership.ownerKey) : null;
}

export function requireAssetOwner(
  session: DatabaseSession,
  assetId: string
): AssetOwner {
  const owner = readAssetOwner(session, assetId);
  if (!owner) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Asset ${assetId} has no ownership membership.`
    );
  }
  return owner;
}

function assetOwnerExists(
  session: DatabaseSession,
  owner: AssetOwner
): boolean {
  switch (owner.kind) {
    case 'project':
      return readProjectRecord(session) !== null;
    case 'castMember':
      return rowExists(session, castMembers, castMembers.id, owner.id);
    case 'location':
      return rowExists(session, locations, locations.id, owner.id);
    case 'sequence':
      return rowExists(session, sequences, sequences.id, owner.id);
    case 'scene':
      return rowExists(session, scenes, scenes.id, owner.id);
    case 'lookbook':
      return readLookbookRecordById(session, owner.id) !== null;
    case 'shot':
      return readShotRecord(session, owner.id) !== null;
    case 'sceneBeat':
      return sceneBeatExists(session, owner.sceneId, owner.beatId);
  }
}

function rowExists(
  session: DatabaseSession,
  table: typeof castMembers | typeof locations | typeof sequences | typeof scenes,
  idColumn: typeof castMembers.id | typeof locations.id | typeof sequences.id | typeof scenes.id,
  id: string
): boolean {
  return session.db
    .select({ id: idColumn })
    .from(table)
    .where(eq(idColumn, id))
    .get() !== undefined;
}

function sceneBeatExists(
  session: DatabaseSession,
  sceneId: string,
  beatId: string
): boolean {
  const active = readActiveSceneBeatSheetRecord(session, sceneId);
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!active || !screenplay) {
    return false;
  }
  const document = readSceneBeatSheetDocument({ row: active, screenplay });
  return document.beats.some((beat) => beat.id === beatId);
}

function describeOwner(owner: AssetOwner): string {
  return owner.kind === 'project'
    ? 'project'
    : owner.kind === 'sceneBeat'
      ? `sceneBeat:${owner.sceneId}:${owner.beatId}`
      : `${owner.kind}:${owner.id}`;
}
