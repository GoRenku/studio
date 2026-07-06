import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyStudioGenerationPreview } from './studio-notification-client.js';
import { generationCommandHandlers } from './generation-command-handlers.js';

vi.mock('./studio-notification-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./studio-notification-client.js')>();
  return {
    ...actual,
    notifyStudioGenerationPreview: vi.fn(),
  };
});

describe('generationCommandHandlers', () => {
  beforeEach(() => {
    vi.mocked(notifyStudioGenerationPreview).mockReset();
  });

  it('wires input delete to the focused Shot Video Take input deletion service', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'input delete',
    );
    if (!handler) {
      throw new Error('Expected input delete handler.');
    }
    const deleteShotVideoTakeInput = vi.fn().mockResolvedValue({ deleted: true });

    await expect(
      handler.run({
        flags: {
          purpose: 'shot.video-take',
          target: 'scene:scene_test0001',
          take: 'take_test0001',
          input: 'input_test0001',
        },
        runtime: {
          projectDataService: {
            deleteShotVideoTakeInput,
          },
        },
      } as never),
    ).resolves.toEqual({ deleted: true });

    expect(deleteShotVideoTakeInput).toHaveBeenCalledWith({
      sceneId: 'scene_test0001',
      takeId: 'take_test0001',
      inputId: 'input_test0001',
    });
  });

  it('resolves take target shorthand through core for generation context', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'context',
    );
    if (!handler) {
      throw new Error('Expected context handler.');
    }
    const readSceneShotVideoTake = vi.fn().mockResolvedValue({
      takeId: 'take_test0001',
      sceneId: 'scene_test0001',
    });
    const buildMediaGenerationContext = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      handler.run({
        flags: {
          purpose: 'shot.video-prompt-sheet',
          target: 'take:take_test0001',
        },
        runtime: {
          projectDataService: {
            readSceneShotVideoTake,
            buildMediaGenerationContext,
          },
        },
      } as never),
    ).resolves.toEqual({ ok: true });

    expect(readSceneShotVideoTake).toHaveBeenCalledWith({
      takeId: 'take_test0001',
    });
    expect(buildMediaGenerationContext).toHaveBeenCalledWith({
      purpose: 'shot.video-prompt-sheet',
      target: {
        kind: 'sceneShotVideoTake',
        id: 'take_test0001',
        sceneId: 'scene_test0001',
        takeId: 'take_test0001',
      },
      shotIds: undefined,
      shotListId: undefined,
    });
  });

  it('rejects mismatched take target shorthand and take flag', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'input list',
    );
    if (!handler) {
      throw new Error('Expected input list handler.');
    }

    await expect(
      handler.run({
        flags: {
          purpose: 'shot.video-take',
          target: 'take:take_test0001',
          take: 'take_test0002',
        },
        runtime: {
          projectDataService: {
            readSceneShotVideoTake: vi.fn(),
            listShotVideoTakeInputs: vi.fn(),
          },
        },
      } as never),
    ).rejects.toMatchObject({
      code: 'CLI142',
    });
  });

  it('rejects live bulk dialogue-audio generation because approval tokens are request-specific', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'dialogue-audio generate',
    );
    if (!handler) {
      throw new Error('Expected dialogue-audio generate handler.');
    }

    await expect(
      handler.run({
        flags: {
          scene: 'scene_test0001',
          all: true,
          approvalToken: 'sha256:one-token',
        },
        runtime: {
          projectDataService: {
            readSceneDialogueAudioContext: vi.fn(),
            generateSceneDialogueAudioTake: vi.fn(),
          },
        },
      } as never),
    ).rejects.toMatchObject({
      code: 'CLI141',
    });
  });

  it('delivers generation preview show requests to the running Studio server', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'preview show',
    );
    if (!handler) {
      throw new Error('Expected preview show handler.');
    }
    const homeDir = await writeRenkuConfig();
    const previewFile = await writePreviewFile(homeDir, previewFixture());
    vi.mocked(notifyStudioGenerationPreview).mockResolvedValue({
      status: 'delivered',
    });
    const readProject = vi.fn().mockResolvedValue({
      identity: {
        id: 'project_test0001',
        name: 'constantinople',
      },
    });

    await expect(
      handler.run({
        flags: { file: previewFile },
        runtime: {
          homeDir,
          projectDataService: { readProject },
        },
      } as never),
    ).resolves.toEqual({
      valid: true,
      previewId: 'generation_preview_test',
      purpose: 'shot.video-prompt-sheet',
      project: {
        id: 'project_test0001',
        name: 'constantinople',
      },
      studio: {
        delivery: 'delivered',
      },
    });

    expect(readProject).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir,
    });
    expect(notifyStudioGenerationPreview).toHaveBeenCalledWith({
      homeDir,
      notification: {
        projectRef: {
          id: 'project_test0001',
          name: 'constantinople',
          storageRoot: path.join(homeDir, 'library'),
        },
        preview: previewFixture(),
        source: { kind: 'cli', command: 'generation preview show' },
      },
    });
  });

  it('builds generation preview show requests from saved specs', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'preview show',
    );
    if (!handler) {
      throw new Error('Expected preview show handler.');
    }
    const homeDir = await writeRenkuConfig();
    const preview = previewFixture();
    vi.mocked(notifyStudioGenerationPreview).mockResolvedValue({
      status: 'delivered',
    });
    const buildMediaGenerationPreview = vi.fn().mockResolvedValue(preview);
    const readProject = vi.fn().mockResolvedValue({
      identity: {
        id: 'project_test0001',
        name: 'constantinople',
      },
    });

    await expect(
      handler.run({
        flags: { project: 'constantinople', spec: 'media_generation_spec_1' },
        runtime: {
          projectName: 'constantinople',
          homeDir,
          projectDataService: { buildMediaGenerationPreview, readProject },
        },
      } as never),
    ).resolves.toMatchObject({
      valid: true,
      previewId: 'generation_preview_test',
      purpose: 'shot.video-prompt-sheet',
    });

    expect(buildMediaGenerationPreview).toHaveBeenCalledWith({
      projectName: 'constantinople',
      homeDir,
      specId: 'media_generation_spec_1',
    });
    expect(notifyStudioGenerationPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({ preview }),
      })
    );
  });

  it('fails generation preview show when Studio is not running', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'preview show',
    );
    if (!handler) {
      throw new Error('Expected preview show handler.');
    }
    const homeDir = await writeRenkuConfig();
    const previewFile = await writePreviewFile(homeDir, previewFixture());
    vi.mocked(notifyStudioGenerationPreview).mockResolvedValue({
      status: 'notRunning',
    });

    await expect(
      handler.run({
        flags: { file: previewFile },
        runtime: {
          homeDir,
          projectDataService: {
            readProject: vi.fn().mockResolvedValue({
              identity: {
                id: 'project_test0001',
                name: 'constantinople',
              },
            }),
          },
        },
      } as never),
    ).rejects.toMatchObject({
      code: 'CLI144',
    });
  });

  it('validates generation previews before notifying Studio', async () => {
    const handler = generationCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'preview show',
    );
    if (!handler) {
      throw new Error('Expected preview show handler.');
    }
    const homeDir = await writeRenkuConfig();
    const invalidPreview = previewFixture();
    invalidPreview.previewId = '';
    const previewFile = await writePreviewFile(homeDir, invalidPreview);

    await expect(
      handler.run({
        flags: { file: previewFile },
        runtime: {
          homeDir,
          projectDataService: {
            readProject: vi.fn(),
          },
        },
      } as never),
    ).rejects.toMatchObject({
      code: 'CORE_GENERATION_PREVIEW_INVALID',
    });
    expect(notifyStudioGenerationPreview).not.toHaveBeenCalled();
  });
});

async function writeRenkuConfig(): Promise<string> {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-test-'));
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${path.join(homeDir, 'library')}\n`,
    'utf8',
  );
  return homeDir;
}

async function writePreviewFile(
  homeDir: string,
  preview: ReturnType<typeof previewFixture>,
): Promise<string> {
  const previewFile = path.join(homeDir, 'preview.json');
  await fs.writeFile(previewFile, JSON.stringify(preview), 'utf8');
  return previewFile;
}

function previewFixture() {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    purpose: 'shot.video-prompt-sheet',
    project: {
      id: 'project_test0001',
      name: 'constantinople',
    },
    target: {
      kind: 'sceneShotVideoTake',
      id: 'take_test0001',
      sceneId: 'scene_test0001',
      takeId: 'take_test0001',
      shotIds: ['shot_test0001'],
    },
    title: 'Choreography prompt sheet',
    model: {
      provider: 'fal-ai',
      modelId: 'fal-ai/openai/gpt-image-2',
      mediaKind: 'image',
    },
    promptSheetVisualStyleId: 'handdrawn-storyboard',
    promptSheetNotationModeId: 'motion-annotation',
    finalPrompt: {
      text: 'Create a motion annotated video prompt image.',
    },
    references: [
      {
        kind: 'image',
        role: 'style',
        label: 'Storyboard Lookbook Sheet',
        providerToken: '@Reference1',
        assetId: 'asset_style',
        assetFileId: 'asset_file_style',
        sourcePurpose: 'lookbook.sheet',
        selected: true,
      },
    ],
    configuration: {
      sections: [
        {
          key: 'model-inputs',
          label: 'Model inputs',
          rows: [
            {
              key: 'image_size',
              label: 'Image size',
              value: '1024x768',
              source: 'spec',
            },
          ],
        },
      ],
    },
    diagnostics: [],
  };
}
