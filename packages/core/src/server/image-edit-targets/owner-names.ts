import type { AssetFileOwner } from '../../client/asset-files.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { readLocationRecord } from '../database/access/locations.js';
import { readLookbookRecordById } from '../database/access/lookbook.js';
import { readPropRecord } from '../database/access/props.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

type OwnerNameReader = (session: DatabaseSession, id: string) => string | null;

/** Owners whose own record carries a display name; other owners are presented by image type alone. */
const OWNER_NAME_READERS: Partial<Record<AssetFileOwner['kind'], OwnerNameReader>> = {
  castMember: (session, id) => readCastMemberRecord(session, id)?.name ?? null,
  location: (session, id) => readLocationRecord(session, id)?.name ?? null,
  prop: (session, id) => readPropRecord(session, id)?.name ?? null,
  lookbook: (session, id) => readLookbookRecordById(session, id)?.name ?? null,
  inspirationFolder: (session, id) => readInspirationFolderRecord(session, id)?.name ?? null,
  shot: (session, id) => readShotRecord(session, id)?.title ?? null,
};

export function assetFileOwnerName(session: DatabaseSession, owner: AssetFileOwner): string | null {
  if (!('id' in owner)) {
    return null;
  }
  return OWNER_NAME_READERS[owner.kind]?.(session, owner.id) ?? null;
}
