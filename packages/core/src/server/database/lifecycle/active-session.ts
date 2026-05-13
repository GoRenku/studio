import { resolveRenkuStorageRoot } from '../../renku-config.js';
import { resolveProjectFolder } from '../../files/project-paths.js';
import { openProjectStore, type DatabaseSession } from './store.js';

export interface OpenProjectSessionInput {
  projectName: string;
  homeDir?: string;
}

export interface OpenProjectSessionResult {
  projectFolder: string;
  session: DatabaseSession;
}

export async function openProjectSession(
  input: OpenProjectSessionInput
): Promise<OpenProjectSessionResult> {
  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  return {
    projectFolder,
    session: openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    }),
  };
}
