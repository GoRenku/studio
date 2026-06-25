import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import type { StudioE2eRuntime } from './studio-e2e-runtime';
import { assertInsideStudioE2eRoot } from './studio-e2e-runtime';

export interface StudioE2eProject {
  projectName: string;
  title: string;
  projectPath: string;
}

export async function createMinimalMovieProject(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  title: string;
}): Promise<StudioE2eProject> {
  const projectData = createProjectDataService();
  const created = await projectData.createMovieProject({
    projectName: input.projectName,
    title: input.title,
    logline: 'A deterministic browser E2E project.',
    summary: 'Created through core-owned project commands for Playwright tests.',
    aspectRatio: '16:9',
    homeDir: input.runtime.homeDir,
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.openCurrentProject({
    projectName: input.projectName,
    homeDir: input.runtime.homeDir,
  });

  return {
    projectName: input.projectName,
    title: input.title,
    projectPath: created.projectPath,
  };
}

export async function cleanStudioE2eProject(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eProject;
}): Promise<void> {
  assertInsideStudioE2eRoot(input.runtime, input.project.projectPath);
  await fs.rm(input.project.projectPath, { recursive: true, force: true });
}

export function createStudioE2eProjectName(input: {
  prefix: string;
  workerIndex: number;
  testIndex: number;
  title: string;
}): string {
  const suffix = slugify(input.title).slice(0, 36) || 'test';
  return `${input.prefix}-${input.workerIndex}-${input.testIndex}-${Date.now().toString(36)}-${suffix}`;
}

export function projectRoute(project: Pick<StudioE2eProject, 'projectName'>): string {
  return `/projects/${encodeURIComponent(project.projectName)}`;
}

export function assertProjectIsInsideStorageRoot(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eProject;
}): void {
  const relative = path.relative(input.runtime.storageRoot, input.project.projectPath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new Error(
      `Project path is not inside Studio E2E storage root: ${input.project.projectPath}`
    );
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

