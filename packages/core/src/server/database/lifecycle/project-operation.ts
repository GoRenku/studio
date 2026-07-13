import { openProjectSession } from './active-session.js';
import { withCurrentProjectSession } from './current-project.js';
import type { DatabaseSession } from './store.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';

export async function withProjectDatabaseSession<T>(
  input: RenkuConfigPathOptions & { projectName?: string },
  operation: (session: DatabaseSession) => T | Promise<T>
): Promise<T> {
  if (!input.projectName) {
    return withCurrentProjectSession(input, ({ session }) => operation(session));
  }
  const handle = await openProjectSession({
    projectName: input.projectName,
    homeDir: input.homeDir,
  });
  try {
    return await operation(handle.session);
  } finally {
    handle.session.close();
  }
}
