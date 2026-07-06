import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProjectCreateReport } from '../../client/index.js';
import { createProjectDataService } from '../index.js';
import { resolveProjectDatabasePath, resolveProjectFolder } from '../files/project-paths.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import {
  createCommandBuiltBlankMovieProject,
  createCommandBuiltSampleMovieProject,
  writeConfig,
} from './project-data-fixtures.js';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

interface MovieProjectTemplate {
  projectName: string;
  projectFolder: string;
  databasePath: string;
  report: ProjectCreateReport;
}

export interface IsolatedBlankMovieProject {
  homeDir: string;
  projectName: string;
  projectFolder: string;
  databasePath: string;
}

export interface IsolatedSampleMovieProject {
  homeDir: string;
  projectName: 'constantinople';
  projectFolder: string;
  databasePath: string;
}

let blankMovieProjectTemplatePromise:
  | Promise<MovieProjectTemplate | null>
  | undefined;
let sampleMovieProjectTemplatePromise:
  | Promise<MovieProjectTemplate | null>
  | undefined;

export async function createIsolatedBlankMovieProjectFromTemplate(input: {
  homeDir: string;
  projectData: ProjectDataService;
}): Promise<ProjectCreateReport | null> {
  const template = await blankMovieProjectTemplate();
  if (!template) {
    return null;
  }
  const isolated = await copyMovieProjectTemplate({
    homeDir: input.homeDir,
    template,
  });
  return templateReportForIsolatedProject(template, isolated);
}

export async function createIsolatedSampleMovieProjectFromTemplate(input: {
  homeDir: string;
  projectData: ProjectDataService;
}): Promise<ProjectCreateReport | null> {
  const template = await sampleMovieProjectTemplate();
  if (!template) {
    return null;
  }
  const isolated = await copyMovieProjectTemplate({
    homeDir: input.homeDir,
    template,
  });
  await input.projectData.openCurrentProject({
    homeDir: input.homeDir,
    projectName: isolated.projectName,
  });
  return templateReportForIsolatedProject(template, isolated);
}

async function blankMovieProjectTemplate(): Promise<MovieProjectTemplate | null> {
  blankMovieProjectTemplatePromise ??= buildMovieProjectTemplate({
    tempPrefix: 'renku-blank-movie-template-',
    createProject: createCommandBuiltBlankMovieProject,
  });
  return await blankMovieProjectTemplatePromise;
}

async function sampleMovieProjectTemplate(): Promise<MovieProjectTemplate | null> {
  sampleMovieProjectTemplatePromise ??= buildMovieProjectTemplate({
    tempPrefix: 'renku-sample-movie-template-',
    createProject: createCommandBuiltSampleMovieProject,
  });
  return await sampleMovieProjectTemplatePromise;
}

async function buildMovieProjectTemplate(input: {
  tempPrefix: string;
  createProject(options: {
    homeDir: string;
    projectData: ProjectDataService;
  }): Promise<ProjectCreateReport | null>;
}): Promise<MovieProjectTemplate | null> {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `${input.tempPrefix}${process.pid}-`)
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const report = await input.createProject({
    homeDir,
    projectData: createProjectDataService(),
  });
  if (!report) {
    return null;
  }

  await assertPathExists(report.projectPath, 'template project folder');
  await assertPathExists(report.databasePath, 'template project database');

  return {
    projectName: report.projectName,
    projectFolder: report.projectPath,
    databasePath: report.databasePath,
    report,
  };
}

async function copyMovieProjectTemplate(input: {
  homeDir: string;
  template: MovieProjectTemplate;
}): Promise<IsolatedBlankMovieProject | IsolatedSampleMovieProject> {
  await assertPathExists(input.template.projectFolder, 'template project folder');
  await assertPathExists(input.template.databasePath, 'template project database');

  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  await fs.mkdir(storageRoot, { recursive: true });
  const projectFolder = resolveProjectFolder(storageRoot, input.template.projectName);
  await fs.cp(input.template.projectFolder, projectFolder, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });

  const databasePath = resolveProjectDatabasePath(projectFolder);
  await assertPathExists(projectFolder, 'copied project folder');
  await assertPathExists(databasePath, 'copied project database');

  return {
    homeDir: input.homeDir,
    projectName: input.template.projectName,
    projectFolder,
    databasePath,
  } as IsolatedBlankMovieProject | IsolatedSampleMovieProject;
}

function templateReportForIsolatedProject(
  template: MovieProjectTemplate,
  isolated: IsolatedBlankMovieProject | IsolatedSampleMovieProject
): ProjectCreateReport {
  return {
    ...template.report,
    projectName: isolated.projectName,
    projectPath: isolated.projectFolder,
    databasePath: isolated.databasePath,
  };
}

async function assertPathExists(filePath: string, description: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new MovieProjectTemplateFixtureError(
        `Expected ${description} to exist at ${filePath}.`
      );
    }
    throw error;
  }
}

class MovieProjectTemplateFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MovieProjectTemplateFixtureError';
  }
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && typeof (error as { code?: unknown }).code === 'string';
}
