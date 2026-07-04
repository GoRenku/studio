import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';

export type MediaGenerationEstimationPathOptions = RenkuConfigPathOptions & {
  projectName?: string;
};

export type MediaGenerationProjectSessionPathOptions =
  RenkuConfigPathOptions & {
    projectName?: string;
  };

export async function withMediaGenerationEstimationProjectSession<T>(
  input: MediaGenerationEstimationPathOptions,
  fn: (handle: { session: DatabaseSession }) => T | Promise<T>
): Promise<T> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    fn({ session })
  );
}

export async function withMediaGenerationProjectSession<T>(
  input: MediaGenerationProjectSessionPathOptions,
  fn: (handle: {
    projectFolder: string;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({
        projectFolder: handle.projectFolder,
        session: handle.session,
      });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      projectFolder: currentProject.projectFolder,
      session,
    })
  );
}
