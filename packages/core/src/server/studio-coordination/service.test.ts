import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectDataService,
} from '../project-data-service.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createSampleMovieProject } from '../testing/project-data-fixtures.js';
import { createStudioCoordinationService } from './service.js';
import {
  readStudioEventStoreSummary,
  resolveStudioEventStorePath,
} from './event-store.js';
import { claimStudioRuntimeDescriptor } from './runtime-descriptor.js';

describe('StudioCoordinationService', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-events-'));
  });

  it('appends events and reads them with byte-offset cursors', async () => {
    const coordination = createStudioCoordinationService({ homeDir });
    const first = await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_one',
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const firstRead = await coordination.readStudioEvents();
    expect(firstRead.events.map((event) => event.id)).toEqual([first.id]);
    expect(firstRead.nextCursor).not.toBe('0');

    const second = await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_two',
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_two',
      },
    });

    const secondRead = await coordination.readStudioEvents({
      after: firstRead.nextCursor,
    });
    expect(secondRead.events.map((event) => event.id)).toEqual([second.id]);
  });

  it('rejects generation Preview events without at least one ordinary Preview', async () => {
    const coordination = createStudioCoordinationService({ homeDir });

    await expect(coordination.appendStudioEvent({
      type: 'studio.generationPreviewsRequested',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot: path.join(homeDir, 'projects'),
      },
      previews: [],
      source: { kind: 'cli', command: 'generation preview show' },
    })).rejects.toMatchObject({ code: 'STUDIO_COORDINATION003' });
  });

  it('creates the Renku config directory before appending events', async () => {
    const isolatedHomeDir = path.join(homeDir, 'fresh-home');
    const coordination = createStudioCoordinationService({ homeDir: isolatedHomeDir });

    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_one',
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
    });

    await expect(
      fs.stat(resolveStudioEventStorePath({ homeDir: isolatedHomeDir }))
    ).resolves.toMatchObject({ size: expect.any(Number) });
  });

  it('reports the filesystem cause when Studio events cannot be appended', async () => {
    const blockedHomeDir = path.join(homeDir, 'blocked-home');
    await fs.mkdir(path.join(blockedHomeDir, '.config'), { recursive: true });
    await fs.writeFile(
      path.join(blockedHomeDir, '.config', 'renku'),
      'not a directory',
      'utf8'
    );
    const coordination = createStudioCoordinationService({ homeDir: blockedHomeDir });

    let appendError: unknown;
    try {
      await coordination.appendStudioEvent({
        type: 'studio.browserSessionActive',
        browserSessionId: 'studio_browser_one',
        source: {
          kind: 'studio',
          browserSessionId: 'studio_browser_one',
        },
      });
    } catch (error) {
      appendError = error;
    }

    expect(appendError).toMatchObject({
      code: 'STUDIO_COORDINATION001',
      suggestion: expect.stringContaining('writable'),
    });
    expect(appendError).toBeInstanceOf(Error);
    expect((appendError as Error).message).toMatch(/EEXIST|ENOTDIR/);
  });

  it('summarizes invalid historical lines with one structured warning', async () => {
    const eventStorePath = resolveStudioEventStorePath({ homeDir });
    await fs.mkdir(path.dirname(eventStorePath), { recursive: true });
    await fs.writeFile(
      eventStorePath,
      [
        '{not valid json}',
        JSON.stringify({
          id: 'studio_event_old_focus',
          version: '0.1.0',
          createdAt: new Date().toISOString(),
          type: 'studio.focusChanged',
          projectRef: {
            name: 'constantinople',
            id: 'project_test0001',
            storageRoot: path.join(homeDir, 'projects'),
          },
          focus: {
            screen: 'movieStudio',
            selection: { type: 'storyboard' },
          },
          source: {
            kind: 'studio',
            browserSessionId: 'studio_browser_one',
          },
        }),
        JSON.stringify({
          id: 'studio_event_valid',
          version: '0.1.0',
          createdAt: new Date().toISOString(),
          type: 'studio.browserSessionActive',
          browserSessionId: 'studio_browser_one',
          source: {
            kind: 'studio',
            browserSessionId: 'studio_browser_one',
          },
        }),
        '',
      ].join('\n'),
      'utf8'
    );

    const result = await createStudioCoordinationService({
      homeDir,
    }).readStudioEvents();

    expect(result.events).toHaveLength(1);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'STUDIO_COORDINATION007',
        message:
          'Skipped 2 invalid historical Studio coordination event lines.',
        severity: 'warning',
        location: expect.objectContaining({ path: ['events'] }),
      }),
    ]);

    await expect(readStudioEventStoreSummary({ homeDir })).resolves.toMatchObject({
      lineCount: 3,
      invalidEventCount: 2,
      warningCount: 1,
    });
  });

  it('does not expose historical focus as current when Studio is stopped', async () => {
    const coordination = createStudioCoordinationService({ homeDir });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot: path.join(homeDir, 'projects'),
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'projectInformation' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const current = await coordination.readStudioCurrent();

    expect(current.studio.running).toBe(false);
    expect(current.project).toBeNull();
    expect(current.selection).toBeNull();
    expect(current.context).toBeNull();
  });

  it('treats Project Library focus as no selected current project', async () => {
    const coordination = createStudioCoordinationService({ homeDir });
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_one',
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot: path.join(homeDir, 'projects'),
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'storyArc' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      focus: {
        screen: 'projectLibrary',
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
    });

    const current = await coordination.readStudioCurrent();

    expect(current.studio.running).toBe(true);
    expect(current.project).toBeNull();
    expect(current.selection).toBeNull();
    expect(current.context).toBeNull();
  });

  it('uses recent browser session activity when the operational runtime descriptor is stale', async () => {
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
    await createProjectDataService().createMovieProject({
      homeDir,
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      idGenerator: createDeterministicIdGenerator(),
    });
    const coordination = createStudioCoordinationService({ homeDir });
    const now = new Date();
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      now: new Date(now.getTime() - 120_000),
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_one',
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
      createdAt: now.toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'projectInformation' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
      createdAt: now.toISOString(),
    });

    const current = await coordination.readStudioCurrent();

    expect(current.studio.running).toBe(true);
    expect(current.project).toMatchObject({
      name: 'constantinople',
      id: 'project_test0001',
    });
    expect(current.selection).toEqual({ type: 'projectInformation' });
    expect(current.context).toMatchObject({
      kind: 'projectInformation',
      title: 'Preparation of the Siege',
    });
  });

  it('uses browser activity focus reports as current Studio selection', async () => {
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
    const projectData = createProjectDataService();
    await createSampleMovieProject({
      homeDir,
      projectData,
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const coordination = createStudioCoordinationService({ homeDir });

    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_scene',
      activityKind: 'focused',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: {
          type: 'scene',
          id: scene.id as string,
          sceneTab: 'shots',
        },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_scene',
      },
    });

    const current = await coordination.readStudioCurrent();

    expect(current.studio.running).toBe(true);
    expect(current.selection).toEqual({
      type: 'scene',
      id: scene.id,
      sceneTab: 'shots',
    });
    expect(current.context).toMatchObject({
      kind: 'scene',
      id: scene.id,
      sceneTab: {
        id: 'shots',
        label: 'Shots',
      },
    });
  });

  it('keeps the most recently engaged focus when passive activity reports arrive later', async () => {
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
    const projectData = createProjectDataService();
    await createSampleMovieProject({
      homeDir,
      projectData,
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const coordination = createStudioCoordinationService({ homeDir });
    const now = Date.now();

    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'projectInformation' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_old',
      },
      createdAt: new Date(now - 5_000).toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: {
          type: 'scene',
          id: scene.id as string,
          sceneTab: 'shots',
        },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_scene',
      },
      createdAt: new Date(now - 3_000).toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_scene',
      activityKind: 'focused',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: {
          type: 'scene',
          id: scene.id as string,
          sceneTab: 'shots',
        },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_scene',
      },
      createdAt: new Date(now - 3_000).toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_old',
      activityKind: 'visible',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'projectInformation' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_old',
      },
      createdAt: new Date(now - 2_000).toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_scene',
      activityKind: 'visible',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: {
          type: 'scene',
          id: scene.id as string,
          sceneTab: 'shots',
        },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_scene',
      },
      createdAt: new Date(now - 1_500).toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_old',
      activityKind: 'visible',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'projectInformation' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_old',
      },
      createdAt: new Date(now - 1_000).toISOString(),
    });

    const current = await coordination.readStudioCurrent();

    expect(current.selection).toEqual({
      type: 'scene',
      id: scene.id,
      sceneTab: 'shots',
    });
    expect(current.context).toMatchObject({
      kind: 'scene',
      id: scene.id,
      sceneTab: {
        id: 'shots',
        label: 'Shots',
      },
    });
  });

  it('reports unresolved selected project data through current-context diagnostics', async () => {
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
    await createProjectDataService().createMovieProject({
      homeDir,
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      idGenerator: createDeterministicIdGenerator(),
    });
    const coordination = createStudioCoordinationService({ homeDir });
    const now = new Date();
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      now,
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_one',
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
      createdAt: now.toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: 'constantinople',
        id: 'project_test0001',
        storageRoot,
      },
      focus: {
        screen: 'movieStudio',
        selection: { type: 'scene', id: 'missing_scene' },
      },
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
      createdAt: now.toISOString(),
    });

    const current = await coordination.readStudioCurrent();

    expect(current.project).toMatchObject({
      name: 'constantinople',
      id: 'project_test0001',
    });
    expect(current.selection).toEqual({
      type: 'scene',
      id: 'missing_scene',
    });
    expect(current.context).toBeNull();
    expect(current.warnings).toEqual([
      expect.objectContaining({
        code: 'STUDIO_COORDINATION031',
        severity: 'error',
      }),
    ]);
  });

  it('does not expose superseded focus requests after the newest request is applied', async () => {
    const coordination = createStudioCoordinationService({ homeDir });
    const projectRef = {
      name: 'constantinople',
      id: 'project_test0001',
      storageRoot: path.join(homeDir, 'projects'),
    };
    await coordination.appendStudioEvent({
      type: 'studio.focusRequested',
      projectRef,
      focus: {
        screen: 'movieStudio',
        selection: { type: 'storyArc' },
      },
      source: { kind: 'cli', command: 'renku project select' },
    });
    const newestRequest = await coordination.appendStudioEvent({
      type: 'studio.focusRequested',
      focus: {
        screen: 'projectLibrary',
      },
      source: { kind: 'cli', command: 'renku info set' },
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      focus: {
        screen: 'projectLibrary',
      },
      appliedRequestId: newestRequest.id,
      source: {
        kind: 'studio',
        browserSessionId: 'studio_browser_one',
      },
    });

    const current = await coordination.readStudioCurrent();

    expect(current.pendingRequest).toBeNull();
  });

  it('exposes only the newest unresolved focus request as pending', async () => {
    const coordination = createStudioCoordinationService({ homeDir });
    const projectRef = {
      name: 'constantinople',
      id: 'project_test0001',
      storageRoot: path.join(homeDir, 'projects'),
    };
    await coordination.appendStudioEvent({
      type: 'studio.focusRequested',
      projectRef,
      focus: {
        screen: 'movieStudio',
        selection: { type: 'storyArc' },
      },
      source: { kind: 'cli', command: 'renku project select' },
    });
    const newestRequest = await coordination.appendStudioEvent({
      type: 'studio.focusRequested',
      projectRef,
      focus: {
        screen: 'movieStudio',
        selection: { type: 'projectInformation' },
      },
      source: { kind: 'cli', command: 'renku info set' },
    });

    const current = await coordination.readStudioCurrent();

    expect(current.pendingRequest?.eventId).toBe(newestRequest.id);
  });
});

async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}
