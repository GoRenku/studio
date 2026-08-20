import type { Project } from '../../client/project/index.js';
import { readProjectCounts } from '../database/access/project-counts.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import { readSelectedProjectCoverImage } from '../project-covers/projection.js';

export async function readProject(input: ReadProjectInput): Promise<Project> {
  const { session } = await openProjectSession(input);
  try {
    return readProjectFromSession({ session });
  } finally {
    session.close();
  }
}

export function readProjectFromSession(input: {
  session: DatabaseSession;
  projectFolder?: string;
}): Project {
  const row = readProjectRecord(input.session);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${input.session.databasePath}.`,
    );
  }
  const information = readProjectInformationResourceFromDatabase(input.session);
  const { languages: _languages, ...metadata } = information;
  return {
    id: row.id,
    projectName: row.projectName,
    ...metadata,
    coverImage: readSelectedProjectCoverImage(input.session),
    counts: readProjectCounts(input.session),
  };
}
