import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from '../assets.js';

export const screenplayImports = sqliteTable(
  'screenplay_import',
  {
    id: text('id').primaryKey(),
    singletonKey: integer('singleton_key').notNull(),
    sourceAssetId: text('source_asset_id')
      .notNull()
      .references(() => assets.id),
    sourceAssetFileId: text('source_asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    importerVersion: integer('importer_version').notNull(),
    importedAt: text('imported_at').notNull(),
    technicalLogJson: text('technical_log_json').notNull().default('[]'),
  },
  (table) => [
    uniqueIndex('screenplay_import_singleton_unique_idx').on(table.singletonKey),
    uniqueIndex('screenplay_import_source_file_unique_idx').on(table.sourceAssetFileId),
    check('screenplay_import_singleton_check', sql`${table.singletonKey} = 1`),
    check('screenplay_import_version_check', sql`${table.importerVersion} = 1`),
  ],
);
