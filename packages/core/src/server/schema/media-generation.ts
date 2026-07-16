import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const mediaGenerationSpecs = sqliteTable(
  'media_generation_spec',
  {
    id: text('id').primaryKey(),
    purpose: text('purpose').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    provider: text('provider'),
    model: text('model'),
    title: text('title'),
    valuesJson: text('values_json').notNull(),
    referencesJson: text('references_json').notNull(),
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
    uniqueIndex('media_generation_spec_take_purpose_idx')
      .on(table.purpose, table.targetKind, table.targetId)
      .where(sql`${table.targetKind} = 'sceneShotVideoTake' and ${table.purpose} in ('shot.first-frame', 'shot.last-frame', 'shot.video-prompt', 'shot.video-take')`),
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
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    specSnapshotJson: text('spec_snapshot_json').notNull(),
    providerPayloadJson: text('provider_payload_json').notNull(),
    estimateJson: text('estimate_json').notNull(),
    approvalToken: text('approval_token').notNull(),
    status: text('status').notNull(),
    outputsJson: text('outputs_json').notNull(),
    receiptJson: text('receipt_json'),
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
    uniqueIndex('media_generation_run_take_success_idx')
      .on(table.targetId)
      .where(sql`${table.purpose} = 'shot.video-take' and ${table.targetKind} = 'sceneShotVideoTake' and ${table.status} = 'completed'`),
  ]
);
