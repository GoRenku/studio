import { asc, eq, notInArray } from 'drizzle-orm';
import type { ScreenplaySection } from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { screenplaySections } from '../../schema/index.js';

export function readSectionRecords(
  session: DatabaseSession,
): ScreenplaySection[] {
  return session.db
    .select()
    .from(screenplaySections)
    .orderBy(asc(screenplaySections.id))
    .all()
    .map((row) => ({
      id: row.id,
      type: row.sectionType as ScreenplaySection['type'],
      title: row.title,
      ...(row.description ? { description: row.description } : {}),
    }));
}

export function replaceSectionRecords(
  session: DatabaseSession,
  values: ScreenplaySection[],
): void {
  for (const section of values) {
    const record = {
      id: section.id,
      sectionType: section.type,
      title: section.title,
      description: section.description ?? null,
    };
    const existing = session.db
      .select({ id: screenplaySections.id })
      .from(screenplaySections)
      .where(eq(screenplaySections.id, section.id))
      .get();
    if (existing) {
      session.db
        .update(screenplaySections)
        .set(record)
        .where(eq(screenplaySections.id, section.id))
        .run();
    } else {
      session.db.insert(screenplaySections).values(record).run();
    }
  }

  const ids = values.map((section) => section.id);
  if (ids.length === 0) {
    session.db.delete(screenplaySections).run();
  } else {
    session.db
      .delete(screenplaySections)
      .where(notInArray(screenplaySections.id, ids))
      .run();
  }
}
