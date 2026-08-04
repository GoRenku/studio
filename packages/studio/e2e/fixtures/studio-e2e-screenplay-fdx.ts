import fs from 'node:fs/promises';
import type { Screenplay } from '@gorenku/studio-core/client';
import {
  createProjectDataService,
  type ImportFdxScreenplayReport,
} from '@gorenku/studio-core/server';
import { runStudioE2eFdxImport } from './studio-e2e-cli';
import {
  createMinimalMovieProject,
  type StudioE2eProject,
} from './studio-e2e-project';
import type { StudioE2eRuntime } from './studio-e2e-runtime';
import {
  prepareStudioE2eScreenplayFdxSource,
  type StudioE2eFdxFixture,
} from './studio-e2e-screenplay-fdx-sources';

export interface StudioE2eImportedFdxProject extends StudioE2eProject {
  sourcePath: string;
  sourceBytes: Buffer;
  importReport: ImportFdxScreenplayReport;
  screenplay: Screenplay;
}

export interface StudioE2eBrickAndSteelProject extends StudioE2eImportedFdxProject {
  patioSceneId: string;
  poolSceneId: string;
  openingTitlesSceneId: string;
}

export async function createImportedFdxMovieProject(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  title: string;
  fixture: StudioE2eFdxFixture;
}): Promise<StudioE2eImportedFdxProject> {
  const project = await createMinimalMovieProject(input);
  const sourcePath = await prepareStudioE2eScreenplayFdxSource(input.fixture);
  const importReport = await runStudioE2eFdxImport({
    runtime: input.runtime,
    projectName: input.projectName,
    sourcePath,
  });
  const projectData = createProjectDataService();
  const resource = await projectData.readScreenplayStructure({
    projectName: input.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
  });
  return {
    ...project,
    sourcePath,
    sourceBytes: await fs.readFile(sourcePath),
    importReport,
    screenplay: resource.screenplay,
  };
}

export async function createBrickAndSteelMovieProject(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  title: string;
}): Promise<StudioE2eBrickAndSteelProject> {
  const project = await createImportedFdxMovieProject({
    ...input,
    fixture: 'brick-and-steel.fdx',
  });
  return {
    ...project,
    patioSceneId: requiredSceneId(project.screenplay, 'Ext. Brick’s patio - day'),
    poolSceneId: requiredSceneId(project.screenplay, 'Ext. Brick’s pool - day'),
    openingTitlesSceneId: requiredSceneId(project.screenplay, 'OPENING Titles'),
  };
}

function requiredSceneId(screenplay: Screenplay, heading: string): string {
  const scene = screenplay.scenes.find((candidate) => candidate.heading === heading);
  if (!scene) {
    throw new Error(`Imported FDX fixture is missing Scene Heading: ${heading}`);
  }
  return scene.id;
}
