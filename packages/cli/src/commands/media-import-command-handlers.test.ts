import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createStudioCoordinationService,
  initRenkuConfig,
} from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaImportCommandHandler } from './media-import-command-handlers.js';

describe('media import command handlers', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-media-import-'));
    storageRoot = path.join(homeDir, 'movies');
    await fs.mkdir(path.join(storageRoot, 'constantinople'), { recursive: true });
    await initRenkuConfig(storageRoot, { homeDir });
  });

  it('resolves take target shorthand and forwards replaceSelected for shot inputs', async () => {
    const readSceneShotVideoTake = vi.fn().mockResolvedValue({
      takeId: 'take_test0001',
      sceneId: 'scene_test0001',
    });
    const importShotVideoPromptSheet = vi.fn().mockResolvedValue({
      project: { name: 'constantinople' },
      resourceKeys: ['scene-shot-video-take:take_test0001'],
    });

    await expect(
      mediaImportCommandHandler.run({
        flags: {
          purpose: 'shot.video-prompt-sheet',
          target: 'take:take_test0001',
          source: 'generated/media/prompt-sheet.png',
          selection: 'select',
          replaceSelected: true,
        },
        runtime: runtimeFixture({
          homeDir,
          projectDataService: {
            readSceneShotVideoTake,
            importShotVideoPromptSheet,
          },
        }),
      } as never),
    ).resolves.toMatchObject({
      project: { name: 'constantinople' },
    });

    expect(readSceneShotVideoTake).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir,
      takeId: 'take_test0001',
    });
    expect(importShotVideoPromptSheet).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir,
      sceneId: 'scene_test0001',
      takeId: 'take_test0001',
      sourceProjectRelativePath: 'generated/media/prompt-sheet.png',
      title: undefined,
      receipt: undefined,
      selection: 'select',
      replaceSelected: true,
    });
  });

  it('rejects mismatched take target shorthand and take flag', async () => {
    await expect(
      mediaImportCommandHandler.run({
        flags: {
          purpose: 'shot.video-prompt-sheet',
          target: 'take:take_test0001',
          take: 'take_test0002',
          source: 'generated/media/prompt-sheet.png',
        },
        runtime: runtimeFixture({
          homeDir,
          projectDataService: {
            readSceneShotVideoTake: vi.fn(),
            importShotVideoPromptSheet: vi.fn(),
          },
        }),
      } as never),
    ).rejects.toMatchObject({
      code: 'CLI142',
    });
  });

  it('requests Studio focus on the target take after final shot video import', async () => {
    const readSceneShotVideoTake = vi.fn().mockResolvedValue({
      takeId: 'take_source0001',
      sceneId: 'scene_test0001',
    });
    const importShotVideoTake = vi.fn().mockResolvedValue({
      valid: true,
      purpose: 'shot.video-take',
      project: { name: 'constantinople', id: 'project_test0001' },
      resourceKeys: [
        'scene-shot-video-take:take_source0001',
        'scene-shot-video-take:take_target0001',
        'surface:scene:scene_test0001:takes',
      ],
      sourceTake: { takeId: 'take_source0001' },
      take: {
        takeId: 'take_target0001',
        sceneId: 'scene_test0001',
        shotIds: ['shot_001'],
      },
      createdRegeneratedTake: true,
      video: { takeId: 'take_target0001' },
    });

    await expect(
      mediaImportCommandHandler.run({
        flags: {
          purpose: 'shot.video-take',
          target: 'take:take_source0001',
          source: 'generated/media/final-take.mp4',
          title: 'Final take',
        },
        runtime: runtimeFixture({
          homeDir,
          projectDataService: {
            readSceneShotVideoTake,
            importShotVideoTake,
          },
        }),
      } as never),
    ).resolves.toMatchObject({
      purpose: 'shot.video-take',
      sourceTake: { takeId: 'take_source0001' },
      take: { takeId: 'take_target0001' },
      createdRegeneratedTake: true,
    });

    expect(importShotVideoTake).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir,
      sceneId: 'scene_test0001',
      takeId: 'take_source0001',
      sourceProjectRelativePath: 'generated/media/final-take.mp4',
      title: 'Final take',
      receipt: undefined,
    });
    await expect(
      createStudioCoordinationService({ homeDir }).readStudioEvents()
    ).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          type: 'studio.focusRequested',
          projectRef: {
            name: 'constantinople',
            id: 'project_test0001',
            storageRoot,
          },
          focus: {
            screen: 'movieStudio',
            selection: {
              type: 'scene',
              id: 'scene_test0001',
              sceneTab: 'takes',
              takeWorkspaceMode: 'edit',
              takeId: 'take_target0001',
              shotId: 'shot_001',
              shotTab: 'ai-production',
            },
          },
          source: { kind: 'cli', command: 'media import' },
          operationId: expect.any(String),
        }),
      ],
    });
  });
});

function runtimeFixture(input: {
  homeDir: string;
  projectDataService: Record<string, unknown>;
}) {
  return {
    projectName: 'constantinople',
    homeDir: input.homeDir,
    json: true,
    io: {
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    },
    projectDataService: input.projectDataService,
  };
}
