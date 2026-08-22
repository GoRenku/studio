/**
 * OpenAI Integration Tests (Text Response)
 *
 * These tests call real OpenAI APIs and incur costs.
 * By default, all tests are SKIPPED even if OPENAI_API_KEY is available.
 *
 * Enable specific test types via environment variables:
 * - RUN_OPENAI_TEXT=1          (text response test)
 * - RUN_ALL_OPENAI_TESTS=1     (runs all OpenAI tests)
 *
 * Examples:
 *
 * # Run text response test
 * RUN_OPENAI_TEXT=1 pnpm test:e2e
 *
 * # Run all OpenAI tests
 * RUN_ALL_OPENAI_TESTS=1 pnpm test:e2e
 *
 * Requires OPENAI_API_KEY in the Renku provider credential file.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createOpenAiLlmHandler } from '../../src/producers/llm/openai.js';
import type { ProviderJobContext, SecretResolver } from '../../src/types.js';
import { requireRenkuProviderSecretResolver } from './renku-provider-credentials.js';

const RUN_TEST =
  process.env.RUN_OPENAI_TEXT === '1' ||
  process.env.RUN_ALL_OPENAI_TESTS === '1';
const describeIf = RUN_TEST ? describe : describe.skip;
let secretResolver: SecretResolver;

describeIf('OpenAI integration', () => {
  beforeAll(async () => {
    secretResolver = await requireRenkuProviderSecretResolver('OPENAI_API_KEY');
  });

  describe('text response', () => {
    it('executes live Responses API and returns artifacts', async () => {
    const handler = createOpenAiLlmHandler()({
      descriptor: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        environment: 'local',
      },
      mode: 'live',
      secretResolver,
      logger: undefined,
    });

    await handler.warmStart?.({ logger: undefined });

    const request: ProviderJobContext = {
      jobId: 'job-int-openai',
      provider: 'openai',
      model: 'gpt-4.1-mini',
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
    console.log('OpenAI integration test result:', JSON.stringify(result));
    expect(result.status).toBe('succeeded');
    const artifact = result.artifacts[0];
    expect(artifact).toBeDefined();
    expect(typeof artifact?.blob?.data === 'string' ? artifact.blob.data : '').toContain('Northern');
    });
  });
});
