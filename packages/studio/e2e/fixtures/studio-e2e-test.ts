import { test as base, expect, type Page } from '@playwright/test';
import { ProjectLibraryPage } from '../pages/project-library-page';
import {
  createStudioE2eGenerationPromptProject,
  type StudioE2eGenerationPromptProject,
} from './studio-e2e-generation-preview';
import {
  cleanStudioE2eProject,
  createSceneBeatsMovieProject,
  createMinimalMovieProject,
  createStudioE2eProjectName,
  type StudioE2eMovieProject,
  type StudioE2eProject,
} from './studio-e2e-project';
import {
  createBrickAndSteelMovieProject,
  type StudioE2eBrickAndSteelProject,
} from './studio-e2e-screenplay-fdx';
import {
  readStudioE2eRuntime,
  type StudioE2eRuntime,
} from './studio-e2e-runtime';

interface StudioE2eFixtures {
  minimalMovieProject: StudioE2eProject;
  movieProject: StudioE2eMovieProject;
  generationPromptProject: StudioE2eGenerationPromptProject;
  brickAndSteelProject: StudioE2eBrickAndSteelProject;
  projectLibraryPage: ProjectLibraryPage;
}

interface StudioE2eWorkerFixtures {
  studioE2eRuntime: StudioE2eRuntime;
}

export const test = base.extend<StudioE2eFixtures, StudioE2eWorkerFixtures>({
  studioE2eRuntime: [
    async ({}, use) => {
      await use(readStudioE2eRuntime());
    },
    { scope: 'worker' },
  ],

  minimalMovieProject: async ({ studioE2eRuntime }, use, testInfo) => {
    const projectName = createStudioE2eProjectName({
      prefix: 'e2e-minimal-movie',
      workerIndex: testInfo.workerIndex,
      testIndex: testInfo.testId.length,
      title: testInfo.title,
    });
    const project = await createMinimalMovieProject({
      runtime: studioE2eRuntime,
      projectName,
      title: `E2E Minimal Movie ${projectName}`,
    });

    await use(project);

    if (
      !studioE2eRuntime.keepArtifacts &&
      testInfo.status === testInfo.expectedStatus
    ) {
      await cleanStudioE2eProject({ runtime: studioE2eRuntime, project });
    }
  },

  movieProject: async ({ studioE2eRuntime }, use, testInfo) => {
    const projectName = createStudioE2eProjectName({
      prefix: 'e2e-scene-beats',
      workerIndex: testInfo.workerIndex,
      testIndex: testInfo.testId.length,
      title: testInfo.title,
    });
    const project = await createSceneBeatsMovieProject({
      runtime: studioE2eRuntime,
      projectName,
      title: `E2E Scene Beats ${projectName}`,
    });

    await use(project);

    if (
      !studioE2eRuntime.keepArtifacts &&
      testInfo.status === testInfo.expectedStatus
    ) {
      await cleanStudioE2eProject({ runtime: studioE2eRuntime, project });
    }
  },

  generationPromptProject: async ({
    studioE2eRuntime,
    movieProject,
  }, use) => {
    await use(await createStudioE2eGenerationPromptProject({
      runtime: studioE2eRuntime,
      project: movieProject,
    }));
  },

  brickAndSteelProject: async ({ studioE2eRuntime }, use, testInfo) => {
    const projectName = createStudioE2eProjectName({
      prefix: 'e2e-brick-and-steel',
      workerIndex: testInfo.workerIndex,
      testIndex: testInfo.testId.length,
      title: testInfo.title,
    });
    const project = await createBrickAndSteelMovieProject({
      runtime: studioE2eRuntime,
      projectName,
      title: `E2E Brick And Steel ${projectName}`,
    });

    await use(project);

    if (
      !studioE2eRuntime.keepArtifacts &&
      testInfo.status === testInfo.expectedStatus
    ) {
      await cleanStudioE2eProject({ runtime: studioE2eRuntime, project });
    }
  },

  projectLibraryPage: async ({ page }, use) => {
    const browserFailures = installUnexpectedBrowserFailureChecks(page);
    await use(new ProjectLibraryPage(page));
    expect(
      browserFailures.consoleErrors,
      'unexpected browser console errors'
    ).toEqual([]);
    expect(
      browserFailures.failedRequests,
      'unexpected failed browser requests'
    ).toEqual([]);
  },
});

export { expect };

function installUnexpectedBrowserFailureChecks(page: Page): {
  consoleErrors: string[];
  failedRequests: string[];
} {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.trim()
    );
  });

  return { consoleErrors, failedRequests };
}
