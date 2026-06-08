import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { castMembers } from './cast-members.js';
import { locations } from './locations.js';

export const castDesigns = sqliteTable(
  'cast_design',
  {
    id: text('id').primaryKey(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    documentJson: text('document_json').notNull(),
    title: text('title'),
    sourceCommand: text('source_command'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('cast_design_owner_created_idx').on(
      table.castMemberId,
      table.createdAt,
      table.id
    ),
  ],
);

export const castDesignState = sqliteTable(
  'cast_design_state',
  {
    castMemberId: text('cast_member_id')
      .primaryKey()
      .references(() => castMembers.id),
    activeDesignId: text('active_design_id')
      .notNull()
      .references(() => castDesigns.id),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('cast_design_state_active_idx').on(table.activeDesignId)],
);

export const locationDesigns = sqliteTable(
  'location_design',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    documentJson: text('document_json').notNull(),
    title: text('title'),
    sourceCommand: text('source_command'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('location_design_owner_created_idx').on(
      table.locationId,
      table.createdAt,
      table.id
    ),
  ],
);

export const locationDesignState = sqliteTable(
  'location_design_state',
  {
    locationId: text('location_id')
      .primaryKey()
      .references(() => locations.id),
    activeDesignId: text('active_design_id')
      .notNull()
      .references(() => locationDesigns.id),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('location_design_state_active_idx').on(table.activeDesignId),
  ],
);
