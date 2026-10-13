import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';
import { runProjectSettingsCommand } from './project-settings-command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  createProjectDataService: vi.fn(),
}));
vi.mock('./studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('Project Settings command', () => {
  const settings = projectSettings();
  const readProjectSettings = vi.fn();
  const replaceProjectSettings = vi.fn();
  const updateGenerationLaneSettings = vi.fn();
  const resolveStudioProjectRef = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resolveStudioProjectRef.mockResolvedValue({
      id: 'project_test',
      name: 'constantinople',
      storageRoot: '/tmp/projects',
    });
    readProjectSettings.mockResolvedValue({
      project: { id: 'project_test', name: 'constantinople' },
      settings,
    });
    replaceProjectSettings.mockResolvedValue({
      resource: {
        project: { id: 'project_test', name: 'constantinople' },
        settings,
      },
      resourceKeys: ['project-settings'],
    });
    vi.mocked(createProjectDataService).mockReturnValue({
      resolveStudioProjectRef,
      readProjectSettings,
      replaceProjectSettings,
      updateGenerationLaneSettings,
    } as never);
    updateGenerationLaneSettings.mockResolvedValue({
      resource: {
        project: { id: 'project_test', name: 'constantinople' },
        settings,
      },
      resourceKeys: ['project-settings'],
    });
  });

  it('shows canonical settings for an explicit Project', async () => {
    const stdout: string[] = [];
    await runProjectSettingsCommand({
      input: ['show'],
      flags: { project: 'constantinople' },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/home',
    });
    expect(resolveStudioProjectRef).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: '/tmp/home',
    });
    expect(JSON.parse(stdout[0]!)).toEqual(settings);
  });

  it('delegates the complete file document and emits one forwarded notification', async () => {
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'settings-cli-')), 'settings.json');
    await fs.writeFile(file, JSON.stringify(settings), 'utf8');
    const stdout: string[] = [];
    await runProjectSettingsCommand({
      input: ['set'],
      flags: { file },
      json: true,
      io: captureIo(stdout),
    });

    expect(resolveStudioProjectRef).toHaveBeenCalledWith({
      projectName: undefined,
      homeDir: undefined,
    });
    expect(replaceProjectSettings).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: undefined,
      settings,
    });
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledOnce();
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        report: {
          project: { id: 'project_test', projectName: 'constantinople' },
          resourceKeys: ['project-settings'],
        },
      })
    );
    expect(JSON.parse(stdout[0]!)).toMatchObject({
      resource: { settings },
      resourceKeys: ['project-settings'],
    });
  });

  it('shows one generation lane by its CLI name', async () => {
    const stdout: string[] = [];
    await runProjectSettingsCommand({
      input: ['generation', 'show'],
      flags: { lane: 'image-edit' },
      json: true,
      io: captureIo(stdout),
    });
    expect(JSON.parse(stdout[0]!)).toEqual({
      enableProviderPromptExpansion: true,
      lanes: { imageEdit: settings.generation.imageEdit },
    });
  });

  it('delegates one focused lane change and emits one notification', async () => {
    await runProjectSettingsCommand({
      input: ['generation', 'set'],
      flags: {
        lane: 'image-edit',
        provider: 'fal-ai',
        model: 'fictional-edit',
        modelName: 'Fictional Edit',
        chooseRoute: 'off',
        askBeforeGenerating: 'on',
      },
      json: true,
      io: captureIo([]),
    });
    expect(updateGenerationLaneSettings).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir: undefined,
      lane: 'imageEdit',
      provider: 'fal-ai',
      model: { key: 'fictional-edit', name: 'Fictional Edit' },
      chooseRouteBeforeGenerating: false,
      askBeforeGenerating: true,
    });
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledOnce();
  });

  it('clears a lane model back to the recommendation', async () => {
    await runProjectSettingsCommand({
      input: ['generation', 'set'],
      flags: { lane: 'video', clearModel: true },
      json: true,
      io: captureIo([]),
    });
    expect(updateGenerationLaneSettings).toHaveBeenCalledWith(expect.objectContaining({ lane: 'video', model: null }));
  });

  it.each([
    [{ lane: 'imageEdit', askBeforeGenerating: 'off' }],
    [{ lane: 'video', chooseRoute: 'yes' }],
    [{ lane: 'video', model: 'fictional-video' }],
    [{ lane: 'video', clearModel: true, model: 'fictional-video', modelName: 'Fictional Video' }],
    [{ askBeforeGenerating: 'off' }],
  ])('rejects invalid lane flags before writing: %j', async (flags) => {
    await expect(runProjectSettingsCommand({
      input: ['generation', 'set'],
      flags,
      json: true,
      io: captureIo([]),
    })).rejects.toMatchObject({ code: 'CLI167' });
    expect(updateGenerationLaneSettings).not.toHaveBeenCalled();
  });

  it('reports malformed JSON through the shared structured input boundary', async () => {
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'settings-cli-')), 'broken.json');
    await fs.writeFile(file, '{', 'utf8');
    await expect(
      runProjectSettingsCommand({
        input: ['set'],
        flags: { file },
        json: true,
        io: captureIo([]),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA201' });
    expect(replaceProjectSettings).not.toHaveBeenCalled();
  });

  it('reports an unreadable settings file through a structured diagnostic', async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'settings-cli-missing-')
    );
    const file = path.join(directory, 'project-settings.json');
    await expect(
      runProjectSettingsCommand({
        input: ['set'],
        flags: { file },
        json: true,
        io: captureIo([]),
      })
    ).rejects.toMatchObject({
      code: 'CLI082',
      issues: [
        expect.objectContaining({
          location: expect.objectContaining({ filePath: file }),
        }),
      ],
    });
    expect(replaceProjectSettings).not.toHaveBeenCalled();
  });
});

function captureIo(stdout: string[]) {
  return {
    stdout: { log: (message: string) => stdout.push(message) },
    stderr: { error: () => undefined },
  };
}

function projectSettings() {
  return {
    version: 7 as const,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      enableProviderPromptExpansion: true,
      image: lane('codex', false, true, 5),
      imageEdit: lane('fal-ai', true, false, 1),
      video: lane('fal-ai', true, false, 1),
      audio: lane('elevenlabs', true, false, 1),
    },
  };
}

function lane(provider: string, askBeforeGenerating: boolean, runGenerationsConcurrently: boolean, maxConcurrentGenerations: number) {
  return {
    provider,
    model: null,
    chooseRouteBeforeGenerating: true,
    askBeforeGenerating,
    runGenerationsConcurrently,
    maxConcurrentGenerations,
  };
}
