import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const mediaGenerationSpecs = sqliteTable(
  'media_generation_spec',
  {
    id: text('id').primaryKey(),
    purpose: text('purpose').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    modelChoice: text('model_choice').notNull(),
    title: text('title').notNull(),
    specJson: text('spec_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('media_generation_spec_target_idx').on(
      table.purpose,
      table.targetKind,
      table.targetId,
      table.updatedAt
    ),
  ]
);

export const mediaGenerationRuns = sqliteTable(
  'media_generation_run',
  {
    id: text('id').primaryKey(),
    specId: text('spec_id')
      .notNull()
      .references(() => mediaGenerationSpecs.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    modelChoice: text('model_choice').notNull(),
    specSnapshotJson: text('spec_snapshot_json').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    providerPayloadJson: text('provider_payload_json').notNull(),
    estimateSnapshotJson: text('estimate_snapshot_json').notNull(),
    simulated: integer('simulated', { mode: 'boolean' }).notNull(),
    status: text('status').notNull(),
    outputsJson: text('outputs_json').notNull(),
    diagnosticsJson: text('diagnostics_json').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('media_generation_run_spec_idx').on(table.specId, table.startedAt),
    index('media_generation_run_target_idx').on(
      table.purpose,
      table.targetKind,
      table.targetId,
      table.startedAt
    ),
  ]
);
