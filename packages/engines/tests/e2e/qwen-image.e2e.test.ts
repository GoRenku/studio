/**
 * Qwen Image Provider Integration Test (native provider uploads)
 *
 * Run with: RUN_QWEN_IMAGE_TEST=1 pnpm test:e2e
 * Requires a credential in the Renku provider credential file:
 *   - REPLICATE_API_TOKEN
 *
 * To save output for visual inspection:
 * RUN_QWEN_IMAGE_TEST=1 SAVE_TEST_ARTIFACTS=1 pnpm test:e2e
 */

import { beforeAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProviderRegistry } from '../../src/registry.js';
import type { ProviderJobContext, SecretResolver } from '../../src/types.js';
import { buildImageExtras, type ImageModel } from './schema-helpers.js';
import { requireRenkuProviderSecretResolver } from './renku-provider-credentials.js';
import { saveTestArtifact } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUN_TEST = process.env.RUN_QWEN_IMAGE_TEST === '1';

const describeIf = RUN_TEST ? describe : describe.skip;
let secretResolver: SecretResolver;

function loadFixture(filename: string): { data: Buffer; mimeType: string } {
  const fixturePath = join(__dirname, 'fixtures', filename);
  const data = readFileSync(fixturePath);
  const mimeType =
    filename.endsWith('.jpg') || filename.endsWith('.jpeg')
      ? 'image/jpeg'
      : filename.endsWith('.png')
        ? 'image/png'
        : 'application/octet-stream';
  return { data, mimeType };
}

describeIf('Qwen Image provider integration (native uploads)', () => {
  beforeAll(async () => {
    secretResolver = await requireRenkuProviderSecretResolver(
      'REPLICATE_API_TOKEN'
    );
  });

  it('generates image with multiple image inputs via provider upload', async () => {
    const provider = 'replicate';
    const model: ImageModel = 'qwen/qwen-image';

    // Load fixture images as blobs
    const cokeCan = loadFixture('coke-can.jpg');
    const pepsiCan = loadFixture('pepsi-can.jpg');

    // Create registry (adapter handles native file uploads)
    const registry = createProviderRegistry({
      mode: 'live',
      secretResolver,
    });

    const handler = registry.resolve({ provider, model, environment: 'local' });

    // Build request with multiple image inputs as blobs
    const resolvedInputs: Record<string, unknown> = {
      'Input:Prompt': 'A pirate holding a coke and pepsi can in each hands',
      'Input:ImageInput': [cokeCan, pepsiCan],
    };

    const request: ProviderJobContext = {
      jobId: `integration-qwen-image-multi`,
      provider,
      model,
      revision: 'rev-test',
      layerIndex: 0,
      attempt: 1,
      inputs: Object.keys(resolvedInputs),
      produces: ['Artifact:Output[index=0]'],
      context: {
        providerConfig: {},
        extras: await buildImageExtras(model, resolvedInputs, {
          ImageInput: { field: 'image_input', required: false },
        }),
      },
    };

    await handler.warmStart?.({ logger: undefined });
    const result = await handler.invoke(request);

    expect(result.status).toBe('succeeded');
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.blob?.mimeType).toMatch(
      /^image\/(png|jpeg|jpg|webp)$/
    );
    expect(result.artifacts[0]?.blob?.data).toBeInstanceOf(Uint8Array);

    // Verify diagnostics contain the uploaded URLs (not blobs)
    const diagnostics = result.diagnostics as Record<string, unknown>;
    const input = diagnostics?.input as Record<string, unknown>;
    if (input?.image_input) {
      const imageInput = input.image_input as string[];
      expect(Array.isArray(imageInput)).toBe(true);
      expect(imageInput).toHaveLength(2);
      // Each item should be a URL (string starting with http)
      for (const url of imageInput) {
        expect(typeof url).toBe('string');
        expect(url).toMatch(/^https?:\/\//);
      }
    }

    if (result.artifacts[0]?.blob?.data) {
      saveTestArtifact(
        'qwen-image-pirate-output.png',
        result.artifacts[0].blob.data
      );
    }
  }, 300000); // 5 minute timeout for image generation with upload
});
