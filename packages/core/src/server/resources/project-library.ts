import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectLibrary, ProjectSummary } from '../../client/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import {
  resolveProjectCoverImage as resolveProjectCoverImageFile,
} from '../files/cover-image-files.js';
import {
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { readProjectFromSession } from './full-project.js';
import type { ResolveProjectCoverImageInput } from '../project-data-service-contracts.js';

export async function listLibrary(
  input: RenkuConfigPathOptions = {}
): Promise<ProjectLibrary> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  return await readProjectLibrary({ storageRoot });
}

export async function resolveCoverImage(
  input: ResolveProjectCoverImageInput
): Promise<string | null> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const library = await readProjectLibrary({ storageRoot });
  const project = library.projects.find(
    (candidate) => candidate.name === input.projectName
  );
  return await resolveProjectCoverImageFile({
    storageRoot,
    projectName: input.projectName,
    coverFile: project?.coverImage?.fileName ?? null,
  });
}

export async function readProjectLibrary(input: {
  storageRoot: string;
}): Promise<ProjectLibrary> {
  await assertDirectory(input.storageRoot, 'Configured storageRoot');
  const entries = await fs.readdir(input.storageRoot, { withFileTypes: true });
  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectFolder = resolveProjectFolder(input.storageRoot, entry.name);
    if (!(await fileExists(resolveProjectDatabasePath(projectFolder)))) {
      continue;
    }

    projects.push(readProjectSummary(projectFolder));
  }

  projects.sort((a, b) => a.title.localeCompare(b.title));

  return {
    storageRoot: input.storageRoot,
    projects,
  };
}

function readProjectSummary(projectFolder: string): ProjectSummary {
  let session: ReturnType<typeof openProjectStore> | null = null;
  try {
    session = openProjectStore({ projectFolder, create: false });
    const project = readProjectFromSession({ session, projectFolder });
    return {
      name: project.identity.name,
      title: project.identity.title,
      type: project.identity.type,
      folderPath: project.identity.folderPath,
      coverImage: project.coverImage,
      logline: project.identity.logline,
      counts: project.counts,
      validationError: null,
    };
  } catch (error) {
    const folderName = path.basename(projectFolder);
    return {
      name: folderName,
      title: folderName,
      type: 'standaloneMovie',
      folderPath: projectFolder,
      coverImage: null,
      counts: null,
      validationError:
        error instanceof ProjectDataError
          ? { code: error.code, message: error.message }
          : {
              code: 'PROJECT_DATA022',
              message: error instanceof Error ? error.message : String(error),
            },
    };
  } finally {
    session?.close();
  }
}

async function assertDirectory(targetPath: string, label: string): Promise<void> {
  const stats = await fs.stat(targetPath);
  if (!stats.isDirectory()) {
    throw new ProjectDataError(
      'PROJECT_DATA023',
      `${label} is not a directory: ${targetPath}`
    );
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isFile();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
