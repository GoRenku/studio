import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import { runDialogueAudioCommand } from './command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  createProjectDataService: vi.fn(),
}));
vi.mock('../studio-resource-event-command.js', () => ({
  appendStudioResourceChangedEvent: vi.fn(),
}));

describe('dialogue-audio command', () => {
  const workspace = {
    purpose: 'scene.dialogue-audio',
    scene: { id: 'scene_1' },
    resourceKeys: ['surface:scene:scene_1:dialogue-audio'],
  };
  const readSceneDialogueAudioWorkspace = vi.fn();
  const replaceSceneDialogueAudioSetup = vi.fn();
  const resolveStudioProjectRef = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    readSceneDialogueAudioWorkspace.mockResolvedValue(workspace);
    replaceSceneDialogueAudioSetup.mockResolvedValue({
      context: workspace,
      resourceKeys: workspace.resourceKeys,
    });
    resolveStudioProjectRef.mockResolvedValue({
      id: 'project_1',
      name: 'movie',
      storageRoot: '/tmp/projects',
    });
    vi.mocked(createProjectDataService).mockReturnValue({
      readSceneDialogueAudioWorkspace,
      replaceSceneDialogueAudioSetup,
      resolveStudioProjectRef,
    } as never);
  });

  it('shows the complete Scene workspace through one Core read', async () => {
    const stdout: string[] = [];
    await runDialogueAudioCommand({
      input: ['show'],
      flags: { project: 'movie', scene: 'scene_1' },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/home',
    });
    expect(readSceneDialogueAudioWorkspace).toHaveBeenCalledWith({
      projectName: 'movie',
      homeDir: '/tmp/home',
      sceneId: 'scene_1',
    });
    expect(JSON.parse(stdout[0]!)).toEqual(workspace);
  });

  it('passes one complete setup document to Core and forwards its resource event', async () => {
    const setup = {
      purpose: 'scene.dialogue-audio',
      target: { kind: 'sceneDialogue', sceneId: 'scene_1', turnId: 'turn_1' },
      modelChoice: 'elevenlabs/eleven_v3',
      castVoiceId: 'voice_1',
      plainText: 'Exact dialogue.',
      v3Text: 'Exact dialogue.',
      voiceSettings: {},
      outputFormat: 'mp3_44100_128',
      languageCode: null,
    };
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'dialogue-audio-cli-'));
    const file = path.join(folder, 'setup.json');
    await fs.writeFile(file, JSON.stringify(setup));
    const stdout: string[] = [];

    await runDialogueAudioCommand({
      input: ['setup'],
      flags: { file, scene: 'scene_1', dialogue: 'turn_1' },
      json: true,
      io: captureIo(stdout),
      homeDir: '/tmp/home',
    });

    expect(replaceSceneDialogueAudioSetup).toHaveBeenCalledWith({
      projectName: 'movie',
      homeDir: '/tmp/home',
      sceneId: 'scene_1',
      turnId: 'turn_1',
      setup,
    });
    expect(appendStudioResourceChangedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'renku dialogue-audio setup',
        report: {
          project: { projectName: 'movie', id: 'project_1' },
          resourceKeys: workspace.resourceKeys,
        },
      }),
    );
    expect(JSON.parse(stdout[0]!)).toMatchObject({ context: workspace });
  });

  it('fails before Core delegation when required setup flags are missing', async () => {
    await expect(runDialogueAudioCommand({
      input: ['setup'],
      flags: { scene: 'scene_1' },
      json: true,
      io: captureIo([]),
    })).rejects.toMatchObject({ code: 'CLI001' });
    expect(replaceSceneDialogueAudioSetup).not.toHaveBeenCalled();
  });
});

function captureIo(stdout: string[]) {
  return {
    stdout: { log: (message: string) => stdout.push(message) },
    stderr: { error: () => undefined },
  };
}
