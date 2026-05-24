import { asc, eq } from 'drizzle-orm';
import type { Lookbook } from '../../../client/index.js';
import {
  lookbook,
  lookbookCardImages,
  visualLanguageState,
} from '../../schema/index.js';
import {
  parseStoredVisualLanguageSection,
  type LookbookSections,
} from '../../visual-language-json/validator.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export const VISUAL_LANGUAGE_STATE_ID = 'visual_language_state';

export type LookbookRecord = typeof lookbook.$inferSelect;
export type VisualLanguageStateRecord = typeof visualLanguageState.$inferSelect;
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
    session.db.select().from(lookbook).where(eq(lookbook.id, lookbookId)).get() ??
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
    sections: Record<keyof LookbookSections, string>;
    now: string;
  }
): void {
  session.db
    .insert(lookbook)
    .values({
      id: input.id,
      name: input.name,
      thesis: input.sections.thesis,
      palette: input.sections.palette,
      toneMood: input.sections.toneMood,
      composition: input.sections.composition,
      lighting: input.sections.lighting,
      texture: input.sections.texture,
      camera: input.sections.camera,
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
    sections?: Record<keyof LookbookSections, string>;
    now: string;
  }
): void {
  const row = requireLookbookRecordById(session, input.lookbookId);
  session.db
    .update(lookbook)
    .set({
      name: input.name ?? row.name,
      thesis: input.sections?.thesis ?? row.thesis,
      palette: input.sections?.palette ?? row.palette,
      toneMood: input.sections?.toneMood ?? row.toneMood,
      composition: input.sections?.composition ?? row.composition,
      lighting: input.sections?.lighting ?? row.lighting,
      texture: input.sections?.texture ?? row.texture,
      camera: input.sections?.camera ?? row.camera,
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

export function readVisualLanguageStateRecord(
  session: DatabaseSession
): VisualLanguageStateRecord | null {
  return (
    session.db
      .select()
      .from(visualLanguageState)
      .where(eq(visualLanguageState.id, VISUAL_LANGUAGE_STATE_ID))
      .get() ?? null
  );
}

export function readActiveLookbookId(session: DatabaseSession): string | null {
  return readVisualLanguageStateRecord(session)?.activeLookbookId ?? null;
}

export function setActiveLookbookRecord(
  session: DatabaseSession,
  input: { lookbookId: string | null; now: string }
): void {
  const existing = readVisualLanguageStateRecord(session);
  if (existing) {
    session.db
      .update(visualLanguageState)
      .set({
        activeLookbookId: input.lookbookId,
        updatedAt: input.now,
      })
      .where(eq(visualLanguageState.id, VISUAL_LANGUAGE_STATE_ID))
      .run();
    return;
  }
  session.db
    .insert(visualLanguageState)
    .values({
      id: VISUAL_LANGUAGE_STATE_ID,
      activeLookbookId: input.lookbookId,
      createdAt: input.now,
      updatedAt: input.now,
    })
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
      .where(eq(lookbookCardImages.lookbookId, lookbookId))
      .get()?.imageId ?? null
  );
}

export function listLookbookCardImageIds(
  session: DatabaseSession
): Map<string, string> {
  const rows = session.db.select().from(lookbookCardImages).all();
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

export function toLookbook(row: LookbookRecord): Lookbook {
  return {
    id: row.id,
    name: row.name,
    thesis: parseStoredVisualLanguageSection({
      value: row.thesis,
      section: 'thesis',
      path: ['thesis'],
    }),
    palette: parseStoredVisualLanguageSection({
      value: row.palette,
      section: 'palette',
      path: ['palette'],
    }),
    toneMood: parseStoredVisualLanguageSection({
      value: row.toneMood,
      section: 'toneMood',
      path: ['toneMood'],
    }),
    composition: parseStoredVisualLanguageSection({
      value: row.composition,
      section: 'composition',
      path: ['composition'],
    }),
    lighting: parseStoredVisualLanguageSection({
      value: row.lighting,
      section: 'lighting',
      path: ['lighting'],
    }),
    texture: parseStoredVisualLanguageSection({
      value: row.texture,
      section: 'texture',
      path: ['texture'],
    }),
    camera: parseStoredVisualLanguageSection({
      value: row.camera,
      section: 'camera',
      path: ['camera'],
    }),
  };
}
