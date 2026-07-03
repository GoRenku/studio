import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LoadedModelCatalog } from '../model-catalog.js';
import { estimateGenerationCost } from './estimates.js';
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

  it('uses the catalog MIME for simulated audio fallback outputs', async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-generation-output-')
    );

    const result = await runGeneration({
      mode: 'simulated',
      catalog: createCatalog(),
      outputRoot,
      outputProjectRelativeRoot: 'generated/media',
      policy: {
        provider: 'test-provider',
        model: 'text-to-speech',
        mediaKind: 'audio',
        mode: 'text-to-speech',
        outputCount: 1,
      },
      request: {
        parameters: {
          text: 'A simulated text-to-speech sample.',
          voice: 'voice_urban_normal',
        },
        outputNames: ['voice-sample.mp3'],
      },
    });

    expect(result.outputs).toMatchObject([
      {
        mimeType: 'audio/mp3',
        projectRelativePath: 'generated/media/voice-sample.mp3',
      },
    ]);
  });

  it('rejects stale live approval tokens before provider execution', async () => {
    await expect(
      runGeneration({
        mode: 'live',
        catalog: createCatalog(),
        approvalToken: 'sha256:stale-cost-approval',
        policy: {
          provider: 'test-provider',
          model: 'text-to-speech',
          mediaKind: 'audio',
          mode: 'text-to-speech',
          outputCount: 1,
        },
        request: {
          parameters: {
            text: 'A paid request with a stale approval token.',
          },
        },
      })
    ).rejects.toThrow(/current cost approval token/);
  });

  it('rejects non-voice approval tokens when nested voice ids imply voice control', async () => {
    const catalog = createCatalog();
    const nonVoiceEstimate = await estimateGenerationCost({
      catalog,
      priceKey: {
        provider: 'test-provider',
        model: 'voice-control-video',
        mediaKind: 'video',
      },
      pricingInputs: {
        outputCount: 1,
        durationSeconds: '5',
        generateAudio: true,
        usesVoiceControl: false,
      },
    });
    expect(nonVoiceEstimate.state).toBe('priced');
    if (nonVoiceEstimate.state !== 'priced') {
      throw new Error('Expected non-voice estimate to be priced.');
    }

    await expect(
      runGeneration({
        mode: 'live',
        catalog,
        approvalToken: nonVoiceEstimate.costApprovalToken,
        policy: {
          provider: 'test-provider',
          model: 'voice-control-video',
          mediaKind: 'video',
          mode: 'image-to-video',
          outputCount: 1,
        },
        request: {
          parameters: {
            duration: '5',
            generate_audio: true,
            elements: [
              {
                voice_id: 'transient_voice_001',
              },
            ],
          },
          outputNames: ['voice-control.mp4'],
        },
      })
    ).rejects.toThrow(/current cost approval token/);
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
          [
            'text-to-speech',
            {
              name: 'text-to-speech',
              type: 'audio',
              mime: ['audio/mp3'],
              price: {
                function: 'costByCharacters',
                inputs: ['text'],
                pricePerCharacter: 0.001,
              },
            },
          ],
          [
            'voice-control-video',
            {
              name: 'voice-control-video',
              type: 'video',
              mime: ['video/mp4'],
              price: {
                function: 'costByVideoDurationAndAudioVoiceControl',
                inputs: ['duration', 'generate_audio', 'uses_voice_control'],
                prices: [
                  {
                    generate_audio: true,
                    uses_voice_control: true,
                    pricePerSecond: 0.196,
                  },
                  {
                    generate_audio: true,
                    uses_voice_control: false,
                    pricePerSecond: 0.168,
                  },
                  {
                    generate_audio: false,
                    uses_voice_control: false,
                    pricePerSecond: 0.112,
                  },
                ],
              },
            },
          ],
        ]),
      ],
    ]),
  };
}
