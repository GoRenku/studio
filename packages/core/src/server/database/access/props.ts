import { and, asc, eq, notInArray } from 'drizzle-orm';
import {
  assetFiles,
  propDesigns,
  propDesignState,
  props,
} from '../../schema/index.js';
import { assetFileOwnerKey } from '../../asset-files/owner-keys.js';
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
  assetFileCount: number;
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

export function listPropAssetFileRoleRecords(
  session: DatabaseSession,
  propId: string
): Array<{ type: string }> {
  return session.db
    .select({ type: assetFiles.type })
    .from(assetFiles)
    .where(eq(assetFiles.ownerKey, assetFileOwnerKey({ kind: 'prop', id: propId })))
    .all();
}

export function readPropDeleteDependencySummary(
  session: DatabaseSession,
  propId: string
): PropDeleteDependencySummary {
  const ownerKey = assetFileOwnerKey({ kind: 'prop', id: propId });
  return {
    assetFileCount: session.db.select({ id: assetFiles.id })
      .from(assetFiles).where(eq(assetFiles.ownerKey, ownerKey)).all().length,
    designCount: session.db.select({ id: propDesigns.id })
      .from(propDesigns).where(eq(propDesigns.propId, propId)).all().length,
    activeDesignStateCount: session.db.select({ propId: propDesignState.propId })
      .from(propDesignState).where(eq(propDesignState.propId, propId)).all().length,
    propSheetCount: session.db.select({ id: assetFiles.id })
      .from(assetFiles)
      .where(and(eq(assetFiles.ownerKey, ownerKey), eq(assetFiles.type, 'prop_sheet')))
      .all().length,
  };
}
