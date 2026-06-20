import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const trashOperations = sqliteTable(
  'trash_operation',
  {
    id: text('id').primaryKey(),
    commandName: text('command_name').notNull(),
    actorKind: text('actor_kind').notNull(),
    actorLabel: text('actor_label'),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
    restoredAt: text('restored_at'),
    garbageCollectedAt: text('garbage_collected_at'),
  },
  (table) => [
    index('trash_operation_created_idx').on(table.createdAt, table.id),
    index('trash_operation_state_idx').on(
      table.restoredAt,
      table.garbageCollectedAt,
      table.createdAt
    ),
  ]
);

export const trashItems = sqliteTable(
  'trash_item',
  {
    id: text('id').primaryKey(),
    operationId: text('operation_id')
      .notNull()
      .references(() => trashOperations.id),
    itemKind: text('item_kind').notNull(),
    itemId: text('item_id').notNull(),
    ownerKind: text('owner_kind'),
    ownerId: text('owner_id'),
    title: text('title').notNull(),
    originalProjectRelativePath: text('original_project_relative_path'),
    trashProjectRelativePath: text('trash_project_relative_path'),
    restoreSnapshotJson: text('restore_snapshot_json').notNull(),
    createdAt: text('created_at').notNull(),
    restoredAt: text('restored_at'),
    garbageCollectedAt: text('garbage_collected_at'),
  },
  (table) => [
    index('trash_item_operation_idx').on(table.operationId),
    index('trash_item_kind_item_idx').on(table.itemKind, table.itemId),
    index('trash_item_owner_idx').on(table.ownerKind, table.ownerId),
    index('trash_item_state_created_idx').on(
      table.restoredAt,
      table.garbageCollectedAt,
      table.createdAt
    ),
  ]
);
