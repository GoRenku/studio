/**
 * Vercel AI Gateway Integration Tests (Text Response)
 *
 * These tests call real AI provider APIs through the Vercel AI Gateway and incur costs.
 * By default, all tests are SKIPPED even if gateway credentials are available.
 *
 * Enable specific test types via environment variables:
 * - RUN_VERCEL_TEXT=1          (text response test)
 * - RUN_ALL_VERCEL_TESTS=1     (runs all Vercel gateway tests)
 *
 * Requires AI_GATEWAY_API_KEY in the Renku provider credential file.
 *
 * Examples:
 *
 * # Run text response test
 * RUN_VERCEL_TEXT=1 pnpm test:e2e
 *
 * # Run all Vercel gateway tests
 * RUN_ALL_VERCEL_TESTS=1 pnpm test:e2e
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createVercelAiGatewayHandler } from '../../src/producers/llm/vercel-ai-gateway.js';
import type { ProviderJobContext, SecretResolver } from '../../src/types.js';
import { requireRenkuProviderSecretResolver } from './renku-provider-credentials.js';

const RUN_TEST =
  process.env.RUN_VERCEL_TEXT === '1' ||
  process.env.RUN_ALL_VERCEL_TESTS === '1';
const describeIf = RUN_TEST ? describe : describe.skip;
let secretResolver: SecretResolver;

describeIf('Vercel AI Gateway integration', () => {
  beforeAll(async () => {
    secretResolver = await requireRenkuProviderSecretResolver(
      'AI_GATEWAY_API_KEY'
    );
  });

  describe('text response', () => {
    it('executes live generation and returns artifacts using google/gemini-3-flash', async () => {
      const handler = createVercelAiGatewayHandler()({
        descriptor: {
          provider: 'vercel',
          model: 'google/gemini-3-flash',
          environment: 'local',
        },
        mode: 'live',
        secretResolver,
        logger: undefined,
      });

      await handler.warmStart?.({ logger: undefined });

      const request: ProviderJobContext = {
        jobId: 'job-int-vercel-text',
        provider: 'vercel',
        model: 'google/gemini-3-flash',
        revision: 'rev-int',
        layerIndex: 0,
        attempt: 1,
        inputs: [],
        produces: ['Artifact:NarrationScript'],
        context: {
          providerConfig: {
            systemPrompt: 'You are a concise assistant. Summarize the topic provided by the user.',
            userPrompt: 'Topic: {{topic}}',
            variables: {
              topic: 'topic',
            },
            responseFormat: { type: 'text' },
            artifactMapping: [
              {
                artifactId: 'Artifact:NarrationScript',
                output: 'blob',
              },
            ],
          },
          rawAttachments: [],
          environment: 'local',
          observability: undefined,
          extras: {
            resolvedInputs: {
              topic: 'the Northern Lights in winter',
            },
          },
        },
      };

      const result = await handler.invoke(request);
      console.log('Vercel Gateway text response test result:', JSON.stringify(result));
      expect(result.status).toBe('succeeded');
      const artifact = result.artifacts[0];
      expect(artifact).toBeDefined();
      expect(typeof artifact?.blob?.data === 'string' ? artifact.blob.data.length : 0).toBeGreaterThan(0);
    });
  });
});
