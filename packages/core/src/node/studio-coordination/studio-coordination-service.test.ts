import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../project/index.js';
import { createStudioCoordinationService } from './studio-coordination-service.js';
import { resolveStudioEventStorePath } from './studio-event-store.js';
import { claimStudioRuntimeDescriptor } from './studio-runtime-descriptor.js';

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

  it('skips malformed historical lines with structured warnings', async () => {
    const eventStorePath = resolveStudioEventStorePath({ homeDir });
    await fs.mkdir(path.dirname(eventStorePath), { recursive: true });
    await fs.writeFile(
      eventStorePath,
      [
        '{not valid json}',
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
        severity: 'warning',
      }),
    ]);
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
        selection: { type: 'storyboard' },
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
    await createProjectDataService().createFromSetup({
      homeDir,
      setupPath: await writeProjectSetup(homeDir),
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

  it('reports unresolved selected project data through current-context diagnostics', async () => {
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
    await createProjectDataService().createFromSetup({
      homeDir,
      setupPath: await writeProjectSetup(homeDir),
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
        selection: { type: 'storyboard' },
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
        selection: { type: 'storyboard' },
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

async function writeProjectSetup(homeDir: string): Promise<string> {
  const setupPath = path.join(homeDir, 'project.yaml');
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople
  title: Preparation of the Siege
  type: standaloneMovie
`,
    'utf8'
  );
  return setupPath;
}
