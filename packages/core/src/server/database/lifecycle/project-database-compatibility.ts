import Database from 'better-sqlite3';
import { resolveProjectDatabasePath } from '../../files/project-paths.js';
import { currentProjectStoreSchemaGeneration } from './project-store-schema-generation.js';

/** What a user does when a Project database was written by a newer Renku. */
export const UPDATE_RENKU_SUGGESTION =
  'Update Renku with the update button in the Studio header, or run `renku update` in a terminal.';

/**
 * True when the Project database was written by a newer Renku than this
 * runtime. Reads the schema generation without opening or upgrading the store.
 */
export function projectDatabaseRequiresNewerRuntime(input: { projectFolder: string }): boolean {
  const sqlite = new Database(resolveProjectDatabasePath(input.projectFolder), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const schemaGeneration = sqlite.pragma('user_version', { simple: true });
    return typeof schemaGeneration === 'number' && schemaGeneration > currentProjectStoreSchemaGeneration();
  } finally {
    sqlite.close();
  }
}
