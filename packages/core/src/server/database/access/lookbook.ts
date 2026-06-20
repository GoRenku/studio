import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Lookbook, LookbookType } from '../../../client/index.js';
import {
  lookbook,
  lookbookCardImages,
  lookbookSelections,
  storyboardLookbookSourceMovies,
} from '../../schema/index.js';
import {
  parseStoredLookbookDefinition,
} from '../../visual-language-json/validator.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookRecord = typeof lookbook.$inferSelect;
export type LookbookSelectionRecord = typeof lookbookSelections.$inferSelect;
export type LookbookCardImageRecord = typeof lookbookCardImages.$inferSelect;

export function listLookbookRecords(session: DatabaseSession): LookbookRecord[] {
  return session.db
    .select()
    .from(lookbook)
    .where(isNull(lookbook.discardedAt))
    .orderBy(asc(lookbook.updatedAt), asc(lookbook.id))
    .all();
}

export function readLookbookRecordById(
  session: DatabaseSession,
  lookbookId: string
): LookbookRecord | null {
  return (
    session.db
      .select()
      .from(lookbook)
      .where(and(eq(lookbook.id, lookbookId), isNull(lookbook.discardedAt)))
      .get() ??
    null
  );
}

export function requireLookbookRecordById(
  session: DatabaseSession,
  lookbookId: string
): LookbookRecord {
  const row = readLookbookRecordById(session, lookbookId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA236',
      `Lookbook was not found: ${lookbookId}.`
    );
  }
  return row;
}

export function insertLookbookRecord(
  session: DatabaseSession,
  input: {
    id: string;
    name: string;
    type: LookbookType;
    definitionJson: string;
    now: string;
  }
): void {
  session.db
    .insert(lookbook)
    .values({
      id: input.id,
      name: input.name,
      type: input.type,
      definitionJson: input.definitionJson,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function updateLookbookRecord(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    name?: string;
    definitionJson?: string;
    now: string;
  }
): void {
  const row = requireLookbookRecordById(session, input.lookbookId);
  session.db
    .update(lookbook)
    .set({
      name: input.name ?? row.name,
      definitionJson: input.definitionJson ?? row.definitionJson,
      updatedAt: input.now,
    })
    .where(eq(lookbook.id, input.lookbookId))
    .run();
}

export function deleteLookbookRecord(
  session: DatabaseSession,
  lookbookId: string
): void {
  session.db.delete(lookbook).where(eq(lookbook.id, lookbookId)).run();
}

export function listSelectedLookbookIdsByType(
  session: DatabaseSession
): Partial<Record<LookbookType, string>> {
  const selections = session.db.select().from(lookbookSelections).all();
  return Object.fromEntries(
    selections.map((selection) => [selection.lookbookType, selection.lookbookId])
  ) as Partial<Record<LookbookType, string>>;
}

export function readSelectedLookbookId(
  session: DatabaseSession,
  type: LookbookType
): string | null {
  return (
    session.db
      .select({ lookbookId: lookbookSelections.lookbookId })
      .from(lookbookSelections)
      .where(eq(lookbookSelections.lookbookType, type))
      .get()?.lookbookId ?? null
  );
}

export function readSelectedMovieLookbookId(
  session: DatabaseSession
): string | null {
  return readSelectedLookbookId(session, 'movie');
}

export function readSelectedStoryboardLookbookId(
  session: DatabaseSession
): string | null {
  return readSelectedLookbookId(session, 'storyboard');
}

export function setLookbookSelectionRecord(
  session: DatabaseSession,
  input: { type: LookbookType; lookbookId: string; now: string }
): void {
  const existing = readSelectedLookbookId(session, input.type);
  if (existing) {
    session.db
      .update(lookbookSelections)
      .set({
        lookbookId: input.lookbookId,
        updatedAt: input.now,
      })
      .where(eq(lookbookSelections.lookbookType, input.type))
      .run();
    return;
  }
  session.db
    .insert(lookbookSelections)
    .values({
      lookbookType: input.type,
      lookbookId: input.lookbookId,
      selectedAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function clearLookbookSelectionRecord(
  session: DatabaseSession,
  type: LookbookType
): void {
  session.db
    .delete(lookbookSelections)
    .where(eq(lookbookSelections.lookbookType, type))
    .run();
}

export function clearLookbookSelectionForLookbookRecord(
  session: DatabaseSession,
  input: { lookbookId: string; type: LookbookType }
): void {
  session.db
    .delete(lookbookSelections)
    .where(
      and(
        eq(lookbookSelections.lookbookType, input.type),
        eq(lookbookSelections.lookbookId, input.lookbookId)
      )
    )
    .run();
}

export function replaceStoryboardLookbookSourceMovieRecords(
  session: DatabaseSession,
  input: {
    storyboardLookbookId: string;
    movieLookbookIds: string[];
    now: string;
  }
): void {
  session.db
    .delete(storyboardLookbookSourceMovies)
    .where(
      eq(
        storyboardLookbookSourceMovies.storyboardLookbookId,
        input.storyboardLookbookId
      )
    )
    .run();
  input.movieLookbookIds.forEach((movieLookbookId, index) => {
    session.db
      .insert(storyboardLookbookSourceMovies)
      .values({
        storyboardLookbookId: input.storyboardLookbookId,
        movieLookbookId,
        sortOrder: index + 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .run();
  });
}

export function listStoryboardSourceMovieIdsByLookbookId(
  session: DatabaseSession,
  lookbookIds: string[]
): Map<string, string[]> {
  const sourceIdsByLookbookId = new Map<string, string[]>();
  if (lookbookIds.length === 0) {
    return sourceIdsByLookbookId;
  }
  const rows = session.db
    .select()
    .from(storyboardLookbookSourceMovies)
    .where(
      and(
        inArray(storyboardLookbookSourceMovies.storyboardLookbookId, lookbookIds),
        isNull(storyboardLookbookSourceMovies.discardedAt)
      )
    )
    .orderBy(
      asc(storyboardLookbookSourceMovies.storyboardLookbookId),
      asc(storyboardLookbookSourceMovies.sortOrder)
    )
    .all();
  for (const row of rows) {
    const existing = sourceIdsByLookbookId.get(row.storyboardLookbookId) ?? [];
    existing.push(row.movieLookbookId);
    sourceIdsByLookbookId.set(row.storyboardLookbookId, existing);
  }
  return sourceIdsByLookbookId;
}

export function readLookbookCardImageId(
  session: DatabaseSession,
  lookbookId: string
): string | null {
  return (
    session.db
      .select({ imageId: lookbookCardImages.imageId })
      .from(lookbookCardImages)
      .where(
        and(
          eq(lookbookCardImages.lookbookId, lookbookId),
          isNull(lookbookCardImages.discardedAt)
        )
      )
      .get()?.imageId ?? null
  );
}

export function listLookbookCardImageIds(
  session: DatabaseSession
): Map<string, string> {
  const rows = session.db
    .select()
    .from(lookbookCardImages)
    .where(isNull(lookbookCardImages.discardedAt))
    .all();
  return new Map(rows.map((row) => [row.lookbookId, row.imageId]));
}

export function setLookbookCardImageRecord(
  session: DatabaseSession,
  input: { lookbookId: string; imageId: string; now: string }
): void {
  const existing = readLookbookCardImageId(session, input.lookbookId);
  if (existing) {
    session.db
      .update(lookbookCardImages)
      .set({ imageId: input.imageId, updatedAt: input.now })
      .where(eq(lookbookCardImages.lookbookId, input.lookbookId))
      .run();
    return;
  }
  session.db
    .insert(lookbookCardImages)
    .values({
      lookbookId: input.lookbookId,
      imageId: input.imageId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function clearLookbookCardImageRecord(
  session: DatabaseSession,
  lookbookId: string
): void {
  session.db
    .delete(lookbookCardImages)
    .where(eq(lookbookCardImages.lookbookId, lookbookId))
    .run();
}

export function toLookbook(
  row: LookbookRecord,
  input?: { sourceMovieLookbookIds?: string[] }
): Lookbook {
  if (row.type === 'movie') {
    return {
      id: row.id,
      name: row.name,
      type: 'movie',
      definition: parseStoredLookbookDefinition({
        type: 'movie',
        value: row.definitionJson,
      }),
    };
  }
  return {
    id: row.id,
    name: row.name,
    type: 'storyboard',
    definition: parseStoredLookbookDefinition({
      type: 'storyboard',
      value: row.definitionJson,
    }),
    sourceMovieLookbookIds: input?.sourceMovieLookbookIds ?? [],
  };
}
