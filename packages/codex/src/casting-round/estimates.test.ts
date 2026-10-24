import { describe, expect, it } from 'vitest';
import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import { createFakeCostEstimator } from '../testing/fake-cost-estimator.js';
import { estimateCastingRoundOptions } from './estimates.js';
import type { CastingRoundOptionRecord } from './options.js';

const options: CastingRoundOptionRecord[] = [{
  model: { key: 'acme-image', name: 'Acme Image' }, note: null,
  providers: [{ provider: 'acme-cloud', providerLabel: 'Acme Cloud', recommended: true, billing: 'providerCharge' }],
}];

describe('Casting estimate requests', () => {
  it('rejects missing requests before running any provider estimates', async () => {
    const estimator = createFakeCostEstimator();
    const offered = [{ ...options[0]!, providers: [...options[0]!.providers, { ...options[0]!.providers[0]!, provider: 'acme-alt', providerLabel: 'Acme Alt' }] }];
    await expect(estimateCastingRoundOptions(offered, [], estimator)).rejects.toMatchObject({
      code: 'CODEX_CASTING_ROUND_INVALID',
      issues: [
        { location: { path: ['estimateRequests', 'acme-image', 'acme-cloud'] }, message: expect.stringContaining('Acme Cloud') },
        { location: { path: ['estimateRequests', 'acme-image', 'acme-alt'] }, message: expect.stringContaining('Acme Alt') },
      ],
    });
    expect(estimator.calls).toEqual([]);
  });

  it('requires requests for unselected alternate providers as well', async () => {
    const estimator = createFakeCostEstimator();
    const offered = [{ ...options[0]!, providers: [...options[0]!.providers, { ...options[0]!.providers[0]!, provider: 'acme-alt' }] }];
    await expect(estimateCastingRoundOptions(offered, [{ provider: 'acme-cloud', modelKey: 'acme-image', route: 'acme/image', request: { candidate_count: 1 } }], estimator)).rejects.toMatchObject({
      issues: [{ location: { path: ['estimateRequests', 'acme-image', 'acme-alt'] } }],
    });
    expect(estimator.calls).toEqual([]);
  });

  it('passes the Skill request and operation route unchanged and preserves the entire estimate', async () => {
    const estimator = createFakeCostEstimator(0.05);
    const source: GenerationCostEstimate = {
      state: 'computed', amountUsd: 0.05, basis: 'One image', observedAt: '2026-10-24T00:00:00.000Z',
      sourceUrl: 'https://example.test/pricing', notes: ['Base price only.', 'Schema defaults could not be read.'], requestSha256: 'unused',
    };
    const request = { candidate_count: 1, output_size: 'large', reference: 'asset-reference' };
    const priced = await estimateCastingRoundOptions(options, [{ provider: 'acme-cloud', modelKey: 'acme-image', route: 'acme/reference-image', request }], {
      async estimate(input) {
        await estimator.estimate(input);
        return { ...source, requestSha256: input.requestSha256 };
      },
    });
    expect(estimator.calls).toEqual([expect.objectContaining({ model: 'acme/reference-image', request })]);
    expect(priced[0]!.providers[0]!.estimate).toEqual({ ...source, requestSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  it('does not send host plan usage to the provider estimator', async () => {
    const estimator = createFakeCostEstimator();
    const host: CastingRoundOptionRecord[] = [{ ...options[0]!, providers: [{ ...options[0]!.providers[0]!, billing: 'hostPlanUsage' }] }];
    const priced = await estimateCastingRoundOptions(host, [], estimator);
    expect(priced[0]!.providers[0]).toMatchObject({ billing: 'hostPlanUsage', estimate: null });
    expect(estimator.calls).toEqual([]);
  });

  it('keeps a genuine missing price and its diagnostic after estimation was attempted', async () => {
    const priced = await estimateCastingRoundOptions(options, [{ provider: 'acme-cloud', modelKey: 'acme-image', route: 'acme/image', request: { candidate_count: 1 } }], {
      async estimate(input) {
        return { state: 'missingPrice', amountUsd: null, basis: 'No price is known for this route', notes: ['The provider pricing API is unavailable.'], observedAt: null, sourceUrl: null, requestSha256: input.requestSha256 };
      },
    });
    expect(priced[0]!.providers[0]!.estimate).toMatchObject({ state: 'missingPrice', amountUsd: null, notes: ['The provider pricing API is unavailable.'] });
  });
});
