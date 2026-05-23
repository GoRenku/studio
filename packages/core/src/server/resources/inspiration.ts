import type {
  InspirationFolder,
  InspirationResource,
} from '../../client/index.js';
import type { InspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { listInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import type { ListInspirationFoldersInput } from '../project-data-service-contracts.js';

export async function readInspirationResource(
  input: ListInspirationFoldersInput
): Promise<InspirationResource> {
  return withVisualLanguageSession(input, ({ session }) => {
    const folders = listInspirationFolderRecords(session, input);
    return {
      folders: {
        items: folders.items.map(toInspirationFolder),
        nextCursor: folders.nextCursor,
      },
    };
  });
}

export function toInspirationFolder(
  row: Pick<InspirationFolderRecord, 'id' | 'name' | 'projectRelativePath'>
): InspirationFolder {
  return {
    id: row.id,
    name: row.name,
    projectRelativePath: normalizeProjectRelativePath(row.projectRelativePath),
  };
}

async function withVisualLanguageSession<T>(
  input: { projectName?: string; homeDir?: string },
  fn: (handle: { projectFolder: string; session: DatabaseSession }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn(handle);
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({ projectFolder: currentProject.projectFolder, session })
  );
}
