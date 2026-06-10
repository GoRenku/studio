import { describe, expect, it, vi } from 'vitest';
import { generationCommandHandlers } from './generation-command-handlers.js';

describe('generationCommandHandlers', () => {
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
