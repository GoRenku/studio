import { eq } from 'drizzle-orm';
import type { InspirationAnalysis } from '../../../client/index.js';
import { inspirationAnalysis } from '../../schema/index.js';
import {
  parseStoredVisualLanguageSection,
  type InspirationAnalysisSections,
} from '../../visual-language-json/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type InspirationAnalysisRecord = typeof inspirationAnalysis.$inferSelect;

export function readInspirationAnalysisRecord(
  session: DatabaseSession,
  folderId: string
): InspirationAnalysisRecord | null {
  return (
    session.db
      .select()
      .from(inspirationAnalysis)
      .where(eq(inspirationAnalysis.folderId, folderId))
      .get() ?? null
  );
}

export function upsertInspirationAnalysisRecord(
  session: DatabaseSession,
  input: {
    folderId: string;
    sections: Record<keyof InspirationAnalysisSections, string>;
    now: string;
  }
): void {
  const existing = readInspirationAnalysisRecord(session, input.folderId);
  if (existing) {
    session.db
      .update(inspirationAnalysis)
      .set({
        thesis: input.sections.thesis,
        palette: input.sections.palette,
        toneMood: input.sections.toneMood,
        composition: input.sections.composition,
        lighting: input.sections.lighting,
        texture: input.sections.texture,
        inspiredBy: input.sections.inspiredBy,
        updatedAt: input.now,
      })
      .where(eq(inspirationAnalysis.folderId, input.folderId))
      .run();
    return;
  }

  session.db
    .insert(inspirationAnalysis)
    .values({
      folderId: input.folderId,
      thesis: input.sections.thesis,
      palette: input.sections.palette,
      toneMood: input.sections.toneMood,
      composition: input.sections.composition,
      lighting: input.sections.lighting,
      texture: input.sections.texture,
      inspiredBy: input.sections.inspiredBy,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function toInspirationAnalysis(
  row: InspirationAnalysisRecord
): InspirationAnalysis {
  return {
    folderId: row.folderId,
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
    inspiredBy: parseStoredVisualLanguageSection({
      value: row.inspiredBy,
      section: 'inspiredBy',
      path: ['inspiredBy'],
    }),
  };
}
