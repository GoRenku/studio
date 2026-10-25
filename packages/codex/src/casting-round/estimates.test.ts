import { describe, expect, it } from 'vitest';
import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import { createFakeCostEstimator } from '../testing/fake-cost-estimator.js';
import { estimateCastingRoundOptions } from './estimates.js';
import type { CastingRoundOptionRecord } from './options.js';

const options: CastingRoundOptionRecord[] = [{
  model: { key: 'acme-image', name: 'Acme Image' }, note: null,
  providers: [
    { provider: 'acme-cloud', providerLabel: 'Acme Cloud', recommended: true, route: 'acme/image', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } },
    { provider: 'acme-alt', providerLabel: 'Acme Alt', recommended: false, route: 'alt/acme-image', detail: { lowest: { size: 's' }, mid: { size: 'l' }, highest: { size: 'l' } } },
  ],
}];

describe('Casting round estimates', () => {
  it('estimates one output of every offered route at each detail level, once per distinct set of fields', async () => {
    const estimator = createFakeCostEstimator(0.05);
    const priced = await estimateCastingRoundOptions(options, estimator, '/home/fixture');
    expect(estimator.calls).toEqual([
      { homeDir: '/home/fixture', provider: 'acme-cloud', model: 'acme/image', fields: { size: 'small' }, requestSha256: null },
      { homeDir: '/home/fixture', provider: 'acme-cloud', model: 'acme/image', fields: { size: 'medium' }, requestSha256: null },
      { homeDir: '/home/fixture', provider: 'acme-cloud', model: 'acme/image', fields: { size: 'large' }, requestSha256: null },
      { homeDir: '/home/fixture', provider: 'acme-alt', model: 'alt/acme-image', fields: { size: 's' }, requestSha256: null },
      { homeDir: '/home/fixture', provider: 'acme-alt', model: 'alt/acme-image', fields: { size: 'l' }, requestSha256: null },
    ]);
    expect(priced[0]!.providers.map((provider) => [provider.provider, provider.providerLabel, provider.estimates.highest.amountUsd])).toEqual([
      ['acme-cloud', 'Acme Cloud', 0.05],
      ['acme-alt', 'Acme Alt', 0.05],
    ]);
  });

  it('keeps each level\'s estimator result unchanged, including a missing price and its note', async () => {
    const missing: GenerationCostEstimate = {
      state: 'missingPrice', amountUsd: null, basis: 'No price is known for this route', notes: ['The provider pricing API is unavailable.'], observedAt: null, sourceUrl: null, requestSha256: null,
    };
    const priced = await estimateCastingRoundOptions(options, { async estimate() { return missing; } });
    expect(priced[0]!.providers[0]!.estimates).toEqual({ lowest: missing, mid: missing, highest: missing });
  });
});
