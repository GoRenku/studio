import { and, asc, eq, notInArray } from 'drizzle-orm';
import {
  assetMemberships,
  assets,
  propDesigns,
  propDesignState,
  props,
} from '../../schema/index.js';
import { assetOwnerKey } from '../../assets/owner-keys.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type PropRecord = typeof props.$inferSelect;

export function readPropRecord(
  session: DatabaseSession,
  propId: string
): PropRecord | null {
  return session.db.select().from(props).where(eq(props.id, propId)).get() ?? null;
}

export function listPropRecords(session: DatabaseSession): PropRecord[] {
  return session.db
    .select()
    .from(props)
    .orderBy(asc(props.position), asc(props.id))
    .all();
}

export interface PropAuthoringRecord {
  id: string;
  handle: string;
  name: string;
  description?: string;
  visualNotes?: string;
}

export interface PropDeleteDependencySummary {
  assetCount: number;
  designCount: number;
  activeDesignStateCount: number;
  propSheetCount: number;
}

export function replacePropAuthoringRecords(
  session: DatabaseSession,
  records: PropAuthoringRecord[]
): void {
  records.forEach((record, position) => {
    const values = {
      id: record.id,
      handle: record.handle,
      name: record.name,
      description: record.description ?? null,
      visualNotes: record.visualNotes ?? null,
      position,
    };
    const existing = session.db.select({ id: props.id })
      .from(props).where(eq(props.id, record.id)).get();
    if (existing) {
      session.db.update(props).set(values).where(eq(props.id, record.id)).run();
    } else {
      session.db.insert(props).values(values).run();
    }
  });

  const ids = records.map((record) => record.id);
  if (ids.length === 0) {
    session.db.delete(props).run();
    return;
  }
  session.db.delete(props).where(notInArray(props.id, ids)).run();
}

export function listPropAssetRoleRecords(
  session: DatabaseSession,
  propId: string
): Array<{ type: string }> {
  return session.db
    .select({ type: assets.type })
    .from(assetMemberships)
    .innerJoin(assets, eq(assets.id, assetMemberships.assetId))
    .where(eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'prop', id: propId })))
    .all();
}

export function readPropDeleteDependencySummary(
  session: DatabaseSession,
  propId: string
): PropDeleteDependencySummary {
  const ownerKey = assetOwnerKey({ kind: 'prop', id: propId });
  return {
    assetCount: session.db.select({ id: assetMemberships.assetId })
      .from(assetMemberships).where(eq(assetMemberships.ownerKey, ownerKey)).all().length,
    designCount: session.db.select({ id: propDesigns.id })
      .from(propDesigns).where(eq(propDesigns.propId, propId)).all().length,
    activeDesignStateCount: session.db.select({ propId: propDesignState.propId })
      .from(propDesignState).where(eq(propDesignState.propId, propId)).all().length,
    propSheetCount: session.db.select({ id: assets.id })
      .from(assetMemberships)
      .innerJoin(assets, eq(assets.id, assetMemberships.assetId))
      .where(and(eq(assetMemberships.ownerKey, ownerKey), eq(assets.type, 'prop_sheet')))
      .all().length,
  };
}
