import { eq } from 'drizzle-orm';
import type { Lookbook } from '../../../client/index.js';
import { lookbook } from '../../schema/index.js';
import {
  parseStoredVisualLanguageSection,
  type LookbookSections,
} from '../../visual-language-json/validator.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookRecord = typeof lookbook.$inferSelect;

export function readLookbookRecord(session: DatabaseSession): LookbookRecord | null {
  return session.db.select().from(lookbook).limit(1).get() ?? null;
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

export function upsertLookbookRecord(
  session: DatabaseSession,
  input: {
    id: string;
    sections: Record<keyof LookbookSections, string>;
    now: string;
  }
): void {
  const existing = readLookbookRecord(session);
  if (existing) {
    session.db
      .update(lookbook)
      .set({
        thesis: input.sections.thesis,
        palette: input.sections.palette,
        toneMood: input.sections.toneMood,
        composition: input.sections.composition,
        lighting: input.sections.lighting,
        texture: input.sections.texture,
        camera: input.sections.camera,
        updatedAt: input.now,
      })
      .where(eq(lookbook.id, existing.id))
      .run();
    return;
  }

  session.db
    .insert(lookbook)
    .values({
      id: input.id,
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

export function toLookbook(row: LookbookRecord): Lookbook {
  return {
    id: row.id,
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
