/**
 * Vercel AI Gateway Integration Tests (Structured Output)
 *
 * These tests call real AI provider APIs through the Vercel AI Gateway and incur costs.
 * By default, all tests are SKIPPED even if gateway credentials are available.
 *
 * Enable specific test types via environment variables:
 * - RUN_VERCEL_STRUCTURED=1    (structured output test)
 * - RUN_ALL_VERCEL_TESTS=1     (runs all Vercel gateway tests)
 *
 * Requires AI_GATEWAY_API_KEY in the Renku provider credential file.
 *
 * Examples:
 *
 * # Run structured output test
 * RUN_VERCEL_STRUCTURED=1 pnpm test:e2e
 *
 * # Run all Vercel gateway tests
 * RUN_ALL_VERCEL_TESTS=1 pnpm test:e2e
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createVercelAiGatewayHandler } from '../../src/producers/llm/vercel-ai-gateway.js';
import type { ProviderJobContext, SecretResolver } from '../../src/types.js';
import { requireRenkuProviderSecretResolver } from './renku-provider-credentials.js';

const RUN_TEST =
  process.env.RUN_VERCEL_STRUCTURED === '1' ||
  process.env.RUN_ALL_VERCEL_TESTS === '1';
const describeIf = RUN_TEST ? describe : describe.skip;
let secretResolver: SecretResolver;

describeIf('Vercel AI Gateway structured integration', () => {
  beforeAll(async () => {
    secretResolver = await requireRenkuProviderSecretResolver(
      'AI_GATEWAY_API_KEY'
    );
  });

  describe('structured output', () => {
    it('returns artifacts for structured JSON schema outputs using anthropic/claude-haiku-4.5', async () => {
      const handler = createVercelAiGatewayHandler()({
        descriptor: {
          provider: 'vercel',
          model: 'anthropic/claude-haiku-4.5',
          environment: 'local',
        },
        mode: 'live',
        secretResolver,
        logger: undefined,
      });

      await handler.warmStart?.({ logger: undefined });

      const request: ProviderJobContext = {
        jobId: 'job-int-vercel-structured',
        provider: 'vercel',
        model: 'anthropic/claude-haiku-4.5',
        revision: 'rev-int-structured',
        layerIndex: 0,
        attempt: 1,
        inputs: [],
        produces: ['Artifact:MovieSummary', 'Artifact:MovieTitle'],
        context: {
          providerConfig: {
            systemPrompt: 'Return JSON with "MovieSummary" and "MovieTitle" fields describing the topic.',
            userPrompt: 'Topic: {{topic}}',
            variables: {
              topic: 'topic',
            },
            responseFormat: {
              type: 'json_schema',
              schema: {
                type: 'object',
                properties: {
                  MovieSummary: { type: 'string' },
                  MovieTitle: { type: 'string' },
                },
                required: ['MovieSummary', 'MovieTitle'],
              },
            },
          },
          rawAttachments: [],
          observability: undefined,
          environment: 'local',
          extras: {
            resolvedInputs: {
              topic: 'bioluminescent marine life',
            },
          },
        },
      };

      const result = await handler.invoke(request);
      console.log('Vercel Gateway structured output test result:', JSON.stringify(result));

      expect(result.status).toBe('succeeded');
      const ids = result.artifacts.map((a) => a.artifactId).sort();
      expect(ids).toEqual(['Artifact:MovieSummary', 'Artifact:MovieTitle']);

      const summary = result.artifacts.find(
        (a) => a.artifactId === 'Artifact:MovieSummary'
      );
      const title = result.artifacts.find(
        (a) => a.artifactId === 'Artifact:MovieTitle'
      );
      expect(typeof summary?.blob?.data === 'string' && summary.blob.data.length > 0).toBeTruthy();
      expect(typeof title?.blob?.data === 'string' && title.blob.data.length > 0).toBeTruthy();
    });
  });
});
