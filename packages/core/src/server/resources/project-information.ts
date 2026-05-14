import type { ProjectInformationResource } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';

export async function readProjectInformationResourceForProject(
  input: ReadProjectInput
): Promise<ProjectInformationResource> {
  const { session } = await openProjectSession(input);
  try {
    return readProjectInformationResource(session);
  } finally {
    session.close();
  }
}

export function readProjectInformationResource(
  session: DatabaseSession
): ProjectInformationResource {
  return readProjectInformationResourceFromDatabase(session);
}
