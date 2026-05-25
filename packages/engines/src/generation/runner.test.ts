import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runGeneration } from './runner.js';

describe('runGeneration', () => {
  it('derives simulated output count from request parameters', async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-generation-output-')
    );

    const result = await runGeneration({
      mode: 'simulated',
      outputRoot,
      outputProjectRelativeRoot: 'generated/media',
      policy: {
        provider: 'fal-ai',
        model: 'nano-banana-2',
        mediaKind: 'image',
        mode: 'text-to-image',
      },
      request: {
        prompt: 'A simulated image for tests.',
        parameters: {
          num_images: 3,
        },
        outputNames: ['first.png', 'second.png', 'third.png'],
      },
    });

    expect(result.outputs).toHaveLength(3);
    expect(result.outputs.map((output) => output.projectRelativePath)).toEqual([
      'generated/media/first.png',
      'generated/media/second.png',
      'generated/media/third.png',
    ]);
  });

  it('rejects generated output names with path segments', async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-generation-output-')
    );

    await expect(
      runGeneration({
        mode: 'simulated',
        outputRoot,
        outputProjectRelativeRoot: 'generated/media',
        policy: {
          provider: 'fal-ai',
          model: 'nano-banana-2',
          mediaKind: 'image',
          mode: 'text-to-image',
        },
        request: {
          prompt: 'A simulated image for tests.',
          parameters: {
            num_images: 1,
          },
          outputNames: ['../../project.sqlite'],
        },
      })
    ).rejects.toThrow(/outputNames entries must be file names/);
  });
});
