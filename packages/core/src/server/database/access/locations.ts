import { and, asc, eq, notInArray } from 'drizzle-orm';
import {
  locationAssets,
  locationDesigns,
  locationDesignState,
  locations,
} from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LocationRecord = typeof locations.$inferSelect;

export function readLocationRecord(
  session: DatabaseSession,
  locationId: string
): LocationRecord | null {
  return (
    session.db.select().from(locations).where(eq(locations.id, locationId)).get() ??
    null
  );
}

export function listLocationRecords(session: DatabaseSession): LocationRecord[] {
  return session.db
    .select()
    .from(locations)
    .orderBy(asc(locations.position), asc(locations.id))
    .all();
}

export interface LocationAuthoringRecord {
  id: string;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}

export interface LocationDeleteDependencySummary {
  assetCount: number;
  designCount: number;
  activeDesignStateCount: number;
  environmentSheetCount: number;
}

export function replaceLocationAuthoringRecords(
  session: DatabaseSession,
  records: LocationAuthoringRecord[]
): void {
  records.forEach((record, position) => {
    const values = {
      id: record.id,
      handle: record.handle,
      name: record.name,
      timePeriod: record.timePeriod ?? null,
      description: record.description ?? null,
      visualNotes: record.visualNotes ?? null,
      position,
    };
    const existing = session.db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.id, record.id))
      .get();
    if (existing) {
      session.db.update(locations).set(values).where(eq(locations.id, record.id)).run();
    } else {
      session.db.insert(locations).values(values).run();
    }
  });

  const ids = records.map((record) => record.id);
  if (ids.length === 0) {
    session.db.delete(locations).run();
    return;
  }
  session.db.delete(locations).where(notInArray(locations.id, ids)).run();
}

export function listLocationAssetRoleRecords(
  session: DatabaseSession,
  locationId: string
): Array<{ role: string }> {
  return session.db
    .select({ role: locationAssets.role })
    .from(locationAssets)
    .where(eq(locationAssets.locationId, locationId))
    .all();
}

export function readLocationDeleteDependencySummary(
  session: DatabaseSession,
  locationId: string
): LocationDeleteDependencySummary {
  return {
    assetCount: session.db
      .select({ id: locationAssets.id })
      .from(locationAssets)
      .where(eq(locationAssets.locationId, locationId))
      .all().length,
    designCount: session.db
      .select({ id: locationDesigns.id })
      .from(locationDesigns)
      .where(eq(locationDesigns.locationId, locationId))
      .all().length,
    activeDesignStateCount: session.db
      .select({ locationId: locationDesignState.locationId })
      .from(locationDesignState)
      .where(eq(locationDesignState.locationId, locationId))
      .all().length,
    environmentSheetCount: session.db
      .select({ id: locationAssets.id })
      .from(locationAssets)
      .where(
        and(
          eq(locationAssets.locationId, locationId),
          eq(locationAssets.role, 'environment_sheet')
        )
      )
      .all().length,
  };
}
