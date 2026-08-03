import { asc } from 'drizzle-orm';
import type { ScreenplayStructureEntry } from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import { screenplayStructureEntries } from '../../schema/index.js';

export function readStructureRecords(
  session: DatabaseSession,
): ScreenplayStructureEntry[] {
  return session.db
    .select()
    .from(screenplayStructureEntries)
    .orderBy(
      asc(screenplayStructureEntries.parentSectionId),
      asc(screenplayStructureEntries.position),
      asc(screenplayStructureEntries.id),
    )
    .all()
    .map((row) => ({
      id: row.id,
      ...(row.parentSectionId ? { parentSectionId: row.parentSectionId } : {}),
      content: row.contentType === 'scene'
        ? { type: 'scene' as const, sceneId: required(row.sceneId) }
        : { type: 'section' as const, sectionId: required(row.sectionId) },
      position: row.position,
    }));
}

export function deleteStructureRecords(session: DatabaseSession): void {
  session.db.delete(screenplayStructureEntries).run();
}

export function insertStructureRecords(
  session: DatabaseSession,
  values: ScreenplayStructureEntry[],
): void {
  for (const entry of values) {
    session.db.insert(screenplayStructureEntries).values({
      id: entry.id,
      parentSectionId: entry.parentSectionId ?? null,
      contentType: entry.content.type,
      sceneId: entry.content.type === 'scene' ? entry.content.sceneId : null,
      sectionId: entry.content.type === 'section' ? entry.content.sectionId : null,
      position: entry.position,
    }).run();
  }
}

function required(value: string | null): string {
  if (value === null) {
    throw new ProjectDataError(
      'PROJECT_DATA201',
      'Stored Screenplay structure row is incomplete.',
      { suggestion: 'Repair the stored Screenplay structure row before reading this project.' },
    );
  }
  return value;
}
