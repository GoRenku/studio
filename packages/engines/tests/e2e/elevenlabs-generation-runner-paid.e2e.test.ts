/**
 * Paid ElevenLabs shared generation runner E2E.
 *
 * This intentionally lives outside the direct provider E2E file so paid
 * runner-contract coverage stays isolated.
 *
 * Run with:
 * RUN_ELEVENLABS_GENERATION_RUNNER_PAID_TEST=1 pnpm test:e2e -- elevenlabs-generation-runner-paid
 *
 * Requires:
 * ELEVENLABS_API_KEY
 *
 * Optional:
 * ELEVENLABS_TEST_TTS_VOICE_ID or ELEVENLABS_TEST_SHARED_VOICE_ID
 * SAVE_TEST_ARTIFACTS=1
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  estimateGenerationCost,
  loadBundledGenerationCatalog,
  runGeneration,
  type GenerationRequest,
} from '../../src/generation/index.js';
import type { LoadedModelCatalog } from '../../src/model-catalog.js';
import { saveTestArtifact } from './test-utils.js';

const RUN_TEST = process.env.RUN_ELEVENLABS_GENERATION_RUNNER_PAID_TEST;
const API_KEY = process.env.ELEVENLABS_API_KEY;
const TEST_VOICE_ID =
  process.env.ELEVENLABS_TEST_TTS_VOICE_ID ??
  process.env.ELEVENLABS_TEST_SHARED_VOICE_ID ??
  'EXAVITQu4vr4xnSDxMaL';

const describeIf = RUN_TEST && API_KEY ? describe : describe.skip;

let catalog: LoadedModelCatalog;

describeIf('ElevenLabs paid shared generation runner E2E', () => {
  beforeAll(async () => {
    catalog = await loadBundledGenerationCatalog();
  });

  it('generates persisted TTS audio through estimateGenerationCost and live runGeneration', async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-elevenlabs-runner-paid-')
    );
    const text = 'Renku Studio paid generation runner contract test.';
    const request: GenerationRequest = {
      parameters: {
        text,
        voice: TEST_VOICE_ID,
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          use_speaker_boost: true,
        },
      },
      outputNames: ['scene-dialogue-audio.mp3'],
    };
    const policy = {
      provider: 'elevenlabs',
      model: 'eleven_v3',
      mediaKind: 'audio',
      mode: 'text-to-speech',
      outputCount: 1,
    } as const;

    const estimate = await estimateGenerationCost({
      catalog,
      priceKey: {
        provider: policy.provider,
        model: policy.model,
        mediaKind: policy.mediaKind,
      },
      pricingInputs: {
        outputCount: policy.outputCount,
        characterCount: text.length,
      },
    });
    expect(estimate.state).toBe('priced');
    if (estimate.state !== 'priced') {
      throw new Error('Expected ElevenLabs generation estimate to be priced.');
    }
    expect(estimate).toMatchObject({
      state: 'priced',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      mediaKind: 'audio',
      costApprovalToken: expect.any(String),
    });

    const result = await runGeneration({
      catalog,
      mode: 'live',
      outputRoot,
      outputProjectRelativeRoot: 'generated/media',
      policy,
      request,
    });

    expect(result.outputs).toMatchObject([
      {
        artifactId: expect.stringContaining('GeneratedAudio'),
        mimeType: 'audio/mp3',
        projectRelativePath: 'generated/media/scene-dialogue-audio.mp3',
        contentHash: expect.stringMatching(/^sha256:/),
      },
    ]);
    expect(result.receipt).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_v3',
      mediaKind: 'audio',
      mode: 'text-to-speech',
      simulated: false,
    });

    const outputPath = path.join(outputRoot, 'scene-dialogue-audio.mp3');
    const outputBytes = await fs.readFile(outputPath);
    expect(outputBytes.byteLength).toBeGreaterThan(0);
    saveTestArtifact('elevenlabs-generation-runner-paid.mp3', outputBytes);
  }, 60000);
});
