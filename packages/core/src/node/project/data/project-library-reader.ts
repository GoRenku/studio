import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectDataError } from '../../../project/errors.js';
import type { ProjectLibrary, ProjectSummary } from '../../../project/index.js';
import {
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { openProjectStore } from './sqlite-project-store.js';
import { readProjectFromSession } from './project-reader.js';

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
  const session = openProjectStore({ projectFolder, create: false });
  try {
    const project = readProjectFromSession({ session, projectFolder });
    return {
      name: project.identity.name,
      title: project.identity.title,
      type: project.identity.type,
      folderPath: project.identity.folderPath,
      coverImage: project.coverImage,
      logline: project.identity.logline,
      format: project.identity.format,
      baseLanguage: project.identity.baseLanguage,
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
              code: 'P022',
              message: error instanceof Error ? error.message : String(error),
            },
    };
  } finally {
    session.close();
  }
}

async function assertDirectory(targetPath: string, label: string): Promise<void> {
  const stats = await fs.stat(targetPath);
  if (!stats.isDirectory()) {
    throw new ProjectDataError('P023', `${label} is not a directory: ${targetPath}`);
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
