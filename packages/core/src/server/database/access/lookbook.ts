import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Lookbook, LookbookKind } from '../../../client/index.js';
import {
  lookbook,
  lookbookCardImages,
} from '../../schema/index.js';
import {
  parseStoredLookbookDefinition,
} from '../../visual-language-json/validator.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookRecord = typeof lookbook.$inferSelect;
export type LookbookCardImageRecord = typeof lookbookCardImages.$inferSelect;

export function listLookbookRecords(session: DatabaseSession): LookbookRecord[] {
  return session.db
    .select()
    .from(lookbook)
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
      .where(eq(lookbook.id, lookbookId))
      .get() ??
    null
  );
}

export function readLookbookRecordByKind(
  session: DatabaseSession,
  kind: LookbookKind
): LookbookRecord | null {
  return (
    session.db
      .select()
      .from(lookbook)
      .where(eq(lookbook.kind, kind))
      .get() ?? null
  );
}

export function requireLookbookRecordByKind(
  session: DatabaseSession,
  kind: LookbookKind
): LookbookRecord {
  const row = readLookbookRecordByKind(session, kind);
  if (!row) {
    throw new ProjectDataError(
      'CORE_LOOKBOOK_NOT_AUTHORED',
      `${kind === 'production' ? 'Production' : 'Storyboard'} Lookbook has not been authored.`
    );
  }
  return row;
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
    kind: LookbookKind;
    definitionJson: string;
    now: string;
  }
): void {
  try {
    session.db
      .insert(lookbook)
      .values({
        id: input.id,
        name: input.name,
        kind: input.kind,
        definitionJson: input.definitionJson,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .run();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      throw new ProjectDataError(
        'CORE_LOOKBOOK_ALREADY_EXISTS',
        `A current ${input.kind} Lookbook already exists.`
      );
    }
    throw error;
  }
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
  row: LookbookRecord
): Lookbook {
  if (row.kind === 'production') {
    return {
      id: row.id,
      name: row.name,
      kind: 'production',
      definition: parseStoredLookbookDefinition({
        kind: 'production',
        value: row.definitionJson,
      }),
    };
  }
  return {
    id: row.id,
    name: row.name,
    kind: 'storyboard',
    definition: parseStoredLookbookDefinition({
      kind: 'storyboard',
      value: row.definitionJson,
    }),
  };
}
