import type { RenkuConfigPathOptions } from '../config/index.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export interface CastVoiceProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface CastVoiceProjectHandle {
  currentProject: {
    projectName: string;
    projectId: string;
    projectFolder: string;
  };
  projectFolder: string;
  session: DatabaseSession;
}

export async function withCastVoiceProjectSession<T>(
  input: CastVoiceProjectInput,
  fn: (handle: CastVoiceProjectHandle) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      const project = readProjectRecord(handle.session);
      if (!project) {
        throw new ProjectDataError(
          'PROJECT_DATA353',
          `Project database has no project row: ${handle.session.databasePath}.`
        );
      }
      return await fn({
        currentProject: {
          projectName: project.projectName,
          projectId: project.id,
          projectFolder: handle.projectFolder,
        },
        projectFolder: handle.projectFolder,
        session: handle.session,
      });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      currentProject,
      projectFolder: currentProject.projectFolder,
      session,
    })
  );
}
