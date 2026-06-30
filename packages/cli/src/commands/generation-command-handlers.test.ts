import { describe, expect, it, vi } from 'vitest';
import { generationCommandHandlers } from './generation-command-handlers.js';

describe('generationCommandHandlers', () => {
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
});
