import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { readProjectRecord } from '../access/project.js';
import { resolveProjectFolder } from '../../files/project-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  resolveRenkuConfigDir,
  resolveRenkuStorageRoot,
  type RenkuConfigPathOptions,
} from '../../renku-config.js';
import { openProjectStore, type DatabaseSession } from './store.js';

const CURRENT_PROJECT_FILE = 'current-project.json';
const CURRENT_PROJECT_SCHEMA_GENERATION = 4;

export interface CurrentProject {
  projectName: string;
  projectId: string;
  projectFolder: string;
  databasePath: string;
  schemaGeneration: number;
  updatedAt: string;
}

export interface CurrentProjectReport extends CurrentProject {
  status: 'set' | 'unchanged' | 'closed';
}

export interface CurrentProjectHandle {
  currentProject: CurrentProject;
  session: DatabaseSession;
}

export async function openCurrentProject(
  input: RenkuConfigPathOptions & { projectName: string }
): Promise<CurrentProjectReport> {
  const existing = await readCurrentProjectDescriptor(input);
  const { projectFolder, session } = await openProjectForName(input);
  try {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }

    const now = new Date().toISOString();
    const currentProject: CurrentProject = {
      projectName: project.name,
      projectId: project.id,
      projectFolder,
      databasePath: session.databasePath,
      schemaGeneration: CURRENT_PROJECT_SCHEMA_GENERATION,
      updatedAt: now,
    };
    await writeCurrentProjectDescriptor(input, currentProject);
    return {
      ...currentProject,
      status: existing?.projectName === project.name ? 'unchanged' : 'set',
    };
  } finally {
    session.close();
  }
}

export async function readCurrentProject(
  input: RenkuConfigPathOptions = {}
): Promise<CurrentProjectReport | null> {
  const currentProject = await readCurrentProjectDescriptor(input);
  if (!currentProject) {
    return null;
  }
  return { ...currentProject, status: 'unchanged' };
}

export async function closeCurrentProject(
  input: RenkuConfigPathOptions = {}
): Promise<CurrentProjectReport | null> {
  const currentProject = await readCurrentProjectDescriptor(input);
  if (!currentProject) {
    return null;
  }
  await fs.rm(resolveCurrentProjectPath(input), { force: true });
  return { ...currentProject, status: 'closed' };
}

export async function openCurrentProjectHandle(
  input: RenkuConfigPathOptions = {}
): Promise<CurrentProjectHandle> {
  const currentProject = await readCurrentProjectDescriptor(input);
  if (!currentProject) {
    throw new ProjectDataError(
      'PROJECT_DATA202',
      'No current authoring project is open.',
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA202',
            'No current authoring project is open.',
            { path: ['currentProject'] },
            'Run `renku project open <project-name>` before using screenplay commands.'
          ),
        ],
        suggestion:
          'Run `renku project open <project-name>` before using screenplay commands.',
      }
    );
  }

  try {
    const session = openProjectStore({
      projectFolder: currentProject.projectFolder,
      create: false,
    });
    return { currentProject, session };
  } catch (error) {
    throw new ProjectDataError(
      'PROJECT_DATA203',
      'The current authoring project is invalid.',
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA203',
            error instanceof Error
              ? error.message
              : 'The current authoring project is invalid.',
            { path: ['currentProject'] },
            'Run `renku project open <project-name>` to refresh the current project.'
          ),
        ],
        suggestion:
          'Run `renku project open <project-name>` to refresh the current project.',
      }
    );
  }
}

export async function withCurrentProjectSession<T>(
  input: RenkuConfigPathOptions,
  fn: (handle: CurrentProjectHandle) => T | Promise<T>
): Promise<T> {
  const handle = await openCurrentProjectHandle(input);
  try {
    return await fn(handle);
  } finally {
    handle.session.close();
  }
}

async function openProjectForName(
  input: RenkuConfigPathOptions & { projectName: string }
): Promise<{ projectFolder: string; session: DatabaseSession }> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  return {
    projectFolder,
    session: openProjectStore({ projectFolder, create: false }),
  };
}

async function readCurrentProjectDescriptor(
  input: RenkuConfigPathOptions = {}
): Promise<CurrentProject | null> {
  try {
    const contents = await fs.readFile(resolveCurrentProjectPath(input), 'utf8');
    const parsed = JSON.parse(contents) as CurrentProject;
    if (!parsed.projectName || !parsed.projectFolder || !parsed.databasePath) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeCurrentProjectDescriptor(
  input: RenkuConfigPathOptions,
  descriptor: CurrentProject
): Promise<void> {
  const filePath = resolveCurrentProjectPath(input);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
}

function resolveCurrentProjectPath(input: RenkuConfigPathOptions = {}): string {
  return path.join(resolveRenkuConfigDir(input), CURRENT_PROJECT_FILE);
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && typeof (error as { code?: unknown }).code === 'string';
}
