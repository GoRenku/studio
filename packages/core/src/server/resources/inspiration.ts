import type {
  InspirationFolder,
  InspirationFolderListItem,
  InspirationResource,
} from '../../client/index.js';
import type { InspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { listInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import { listInspirationImagesFromFolder } from '../files/inspiration-images.js';
import type { ListInspirationFoldersInput } from '../project-data-service-contracts.js';

export async function readInspirationResource(
  input: ListInspirationFoldersInput
): Promise<InspirationResource> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folders = listInspirationFolderRecords(session, input);
    return {
      folders: {
        items: await Promise.all(
          folders.items.map((folder) => toInspirationFolderListItem(projectFolder, folder))
        ),
        nextCursor: folders.nextCursor,
      },
    };
  });
}

async function toInspirationFolderListItem(
  projectFolder: string,
  folder: InspirationFolderRecord
): Promise<InspirationFolderListItem> {
  const images = await listInspirationImagesFromFolder(projectFolder, folder);
  return {
    folder: toInspirationFolder(folder),
    cardImage: images[0] ?? null,
    imageCount: images.length,
  };
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
