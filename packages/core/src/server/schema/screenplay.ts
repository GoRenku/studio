import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const screenplay = sqliteTable('screenplay', {
  title: text('title').notNull(),
  intendedAudience: text('intended_audience'),
  targetLengthLabel: text('target_length_label'),
  estimatedMinutes: integer('estimated_minutes'),
  genrePrimary: text('genre_primary'),
  genreSecondary: text('genre_secondary'),
  tone: text('tone'),
  ratingIntent: text('rating_intent'),
  boundaries: text('boundaries'),
  logline: text('logline'),
  summary: text('summary'),
  premiseOverview: text('premise_overview'),
  centralConflict: text('central_conflict'),
  dramaticQuestion: text('dramatic_question'),
  themes: text('themes'),
  historicalBasis: text('historical_basis'),
  dramatizedElements: text('dramatized_elements'),
  status: text('status'),
  researchSources: text('research_sources'),
  assumptionsMade: text('assumptions_made'),
});

export const screenplayRevisions = sqliteTable(
  'screenplay_revision',
  {
    id: text('id').primaryKey(),
    screenplayDocument: text('screenplay_document').notNull(),
    sourceCommand: text('source_command').notNull(),
    summary: text('summary'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('screenplay_revision_created_idx').on(table.createdAt, table.id),
  ]
);
