import { openProjectSession } from '../database/lifecycle/active-session.js';
import { openCurrentProjectHandle } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function withGenerationProject<T>(
  input: RenkuConfigPathOptions & { projectName?: string },
  operation: (project: { session: DatabaseSession; projectFolder: string }) => Promise<T> | T
): Promise<T> {
  const handle = input.projectName
    ? await openProjectSession({ projectName: input.projectName, homeDir: input.homeDir })
    : await openCurrentProjectHandle(input).then(({ currentProject, session }) => ({
        projectFolder: currentProject.projectFolder,
        session,
      }));
  try {
    return await operation(handle);
  } finally {
    handle.session.close();
  }
}
