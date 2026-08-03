import { eq } from 'drizzle-orm';
import type { Screenplay } from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import { screenplay } from '../../schema/index.js';
import { assertValidScreenplay, parseStoredOpeningJson } from '../validation/blocks.js';
import { readReferenceRecords, readScreenplaySubjectIds, replaceReferenceRecords } from './references.js';
import { readSceneRecords, replaceSceneRecords } from './scenes.js';
import { readSectionRecords, replaceSectionRecords } from './sections.js';
import { deleteStructureRecords, insertStructureRecords, readStructureRecords } from './structure.js';

const SCREENPLAY_SINGLETON_ID = 1;

export function ensureScreenplaySingleton(session: DatabaseSession): void {
  session.db
    .insert(screenplay)
    .values({ singletonId: SCREENPLAY_SINGLETON_ID, openingJson: '[]' })
    .onConflictDoNothing()
    .run();
}

export function readScreenplayAggregate(session: DatabaseSession): Screenplay {
  const row = session.db
    .select()
    .from(screenplay)
    .where(eq(screenplay.singletonId, SCREENPLAY_SINGLETON_ID))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'SCREENPLAY_INVALID_CONTENT',
      'Project database has no Screenplay singleton row.',
      { suggestion: 'Migrate or repair the Project database before reading the Screenplay.' },
    );
  }
  const value: Screenplay = {
    opening: parseStoredOpeningJson(row.openingJson),
    scenes: readSceneRecords(session),
    sections: readSectionRecords(session),
    structure: readStructureRecords(session),
    references: readReferenceRecords(session),
  };
  assertValidScreenplay(value, {
    subjects: readScreenplaySubjectIds(session),
    context: 'stored Screenplay',
  });
  return value;
}

export function replaceScreenplayAggregate(
  session: DatabaseSession,
  value: Screenplay,
): void {
  assertValidScreenplay(value, {
    subjects: readScreenplaySubjectIds(session),
    context: 'Screenplay write',
  });
  ensureScreenplaySingleton(session);
  session.db
    .update(screenplay)
    .set({ openingJson: JSON.stringify(value.opening) })
    .where(eq(screenplay.singletonId, SCREENPLAY_SINGLETON_ID))
    .run();

  replaceReferenceRecords(session, []);
  deleteStructureRecords(session);
  replaceSceneRecords(session, value.scenes);
  replaceSectionRecords(session, value.sections);
  insertStructureRecords(session, value.structure);
  replaceReferenceRecords(session, value.references);
}
