import { readProjectRecord } from '../database/access/project.js';
import { withProjectDatabaseSession } from '../database/lifecycle/project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  resolveRenkuStorageRoot,
  type RenkuConfigPathOptions,
} from '../renku-config.js';
import type { StudioProjectRef } from './events.js';

export async function resolveStudioProjectRef(
  input: RenkuConfigPathOptions & { projectName?: string }
): Promise<StudioProjectRef> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  return withProjectDatabaseSession(input, (session) => {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }
    return {
      name: project.name,
      id: project.id,
      storageRoot,
    };
  });
}
