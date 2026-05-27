import { eq } from 'drizzle-orm';
import { locations } from '../../schema/index.js';
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
