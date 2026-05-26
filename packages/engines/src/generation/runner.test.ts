import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LoadedModelCatalog } from '../model-catalog.js';
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

  it('resolves image edit input files before simulated provider execution', async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-generation-output-')
    );
    const inputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-generation-input-')
    );
    const sourcePath = path.join(inputRoot, 'cast/ada/source.png');
    const stylePath = path.join(inputRoot, 'cast/ada/style.webp');
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(sourcePath, 'image bytes');
    await fs.writeFile(stylePath, 'style bytes');

    const result = await runGeneration({
      mode: 'simulated',
      catalog: createCatalog(),
      inputRoot,
      outputRoot,
      outputProjectRelativeRoot: 'generated/media',
      policy: {
        provider: 'test-provider',
        model: 'image-edit',
        mediaKind: 'image',
        mode: 'image-edit',
      },
      request: {
        prompt: 'Turn this character sheet into a profile portrait.',
        inputFiles: [
          {
            field: 'image_urls',
            projectRelativePath: 'cast/ada/source.png',
            mediaKind: 'image',
            asArray: true,
            required: true,
          },
          {
            field: 'image_urls',
            projectRelativePath: 'cast/ada/style.webp',
            mediaKind: 'image',
            asArray: true,
            required: true,
          },
        ],
        parameters: {
          num_images: 1,
          aspect_ratio: '1:1',
          resolution: '2K',
          output_format: 'png',
          safety_tolerance: '4',
          limit_generations: true,
          enable_web_search: false,
          sync_mode: false,
        },
        outputNames: ['profile.png'],
      },
    });

    expect(result).toMatchObject({
      outputs: [
        {
          projectRelativePath: 'generated/media/profile.png',
        },
      ],
      receipt: {
        model: 'image-edit',
        mode: 'image-edit',
        simulated: true,
      },
    });
    const simulatedReport = String(
      result.outputs[0]?.diagnostics?.simulatedReport ?? ''
    );
    expect(simulatedReport).toContain('"mimeType": "image/png"');
    expect(simulatedReport).toContain('"mimeType": "image/webp"');
    expect(simulatedReport).not.toContain('renku-input://');
  });
});

function createCatalog(): LoadedModelCatalog {
  return {
    providers: new Map([
      [
        'test-provider',
        new Map([
          [
            'image-edit',
            {
              name: 'image-edit',
              type: 'image',
              mime: ['image/png'],
            },
          ],
        ]),
      ],
    ]),
  };
}
