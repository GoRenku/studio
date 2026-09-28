import { channel } from 'node:diagnostics_channel';
import { openProjectSession } from './active-session.js';
import { withCurrentProjectSession } from './current-project.js';
import type { DatabaseSession } from './store.js';
import type { RenkuConfigPathOptions } from '../../config/index.js';

const performanceChannel = channel('renku.performance');

export async function withProjectDatabaseSession<T>(
  input: RenkuConfigPathOptions & { projectName?: string },
  operation: (session: DatabaseSession) => T | Promise<T>
): Promise<T> {
  if (!input.projectName) {
    return withCurrentProjectSession(input, ({ session }) => operation(session));
  }
  const started = performanceChannel.hasSubscribers ? performance.now() : undefined;
  let outcome = 'success';
  try {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await operation(handle.session);
    } finally {
      handle.session.close();
    }
  } catch (error) {
    outcome = 'failure';
    throw error;
  } finally {
    if (started !== undefined) {
      performanceChannel.publish({ package: 'core', phase: 'project-operation', durationMs: performance.now() - started, outcome });
    }
  }
}
