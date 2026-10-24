import { describe, expect, it } from 'vitest';
import type { GenerationCostEstimate } from '../generation-cost-estimate.js';
import { estimateCastingRoundCost, type CastingModelEstimate } from './cost-estimate.js';

const model = { key: 'acme-image', name: 'Acme Image' };
const host = { key: 'acme-host', name: 'Acme Host' };
const estimate: GenerationCostEstimate = {
  state: 'computed', amountUsd: 0.05, basis: 'One candidate', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'request',
};
const options: CastingModelEstimate[] = [
  { model, providers: [
    { provider: 'acme-cloud', billing: 'providerCharge', estimate },
    { provider: 'acme-alt', billing: 'providerCharge', estimate: { ...estimate, amountUsd: 0.02 } },
    { provider: 'acme-unknown', billing: 'providerCharge', estimate: null },
  ] },
  { model: host, providers: [{ provider: 'acme-host', billing: 'hostPlanUsage', estimate: null }] },
];

describe('Casting Round cost estimates', () => {
  it('uses the picked provider and counts only charged candidates in a mixed round', () => {
    expect(estimateCastingRoundCost(options, [
      { provider: 'acme-alt', model, count: 10 },
      { provider: 'acme-host', model: host, count: 4 },
    ])).toEqual({ amountUsd: 0.2, breakdown: [{ name: 'Acme Image', amountUsd: 0.2 }], unpriced: [], hostPlanOnly: false });
  });

  it.each([null, { ...estimate, state: 'expired' as const, amountUsd: null }, { ...estimate, state: 'unpriced' as const, amountUsd: null }])('leaves the total unknown when a charged route has no current estimate (%j)', (missing) => {
    const unknown = { model: { key: 'acme-other', name: 'Acme Other' }, providers: [{ provider: 'acme-cloud', billing: 'providerCharge' as const, estimate: missing }] };
    expect(estimateCastingRoundCost([...options, unknown], [
      { provider: 'acme-cloud', model, count: 2 },
      { provider: 'acme-cloud', model: unknown.model, count: 3 },
    ])).toEqual({ amountUsd: null, breakdown: [{ name: model.name, amountUsd: 0.1 }], unpriced: ['Acme Other'], hostPlanOnly: false });
  });

  it('distinguishes host plan usage from an empty round and an explicit zero charge', () => {
    expect(estimateCastingRoundCost(options, [{ provider: 'acme-host', model: host, count: 10 }])).toEqual({ amountUsd: null, breakdown: [], unpriced: [], hostPlanOnly: true });
    expect(estimateCastingRoundCost(options, [])).toEqual({ amountUsd: null, breakdown: [], unpriced: [], hostPlanOnly: false });
    expect(estimateCastingRoundCost([{ model, providers: [{ provider: 'acme-cloud', billing: 'providerCharge', estimate: { ...estimate, amountUsd: 0 } }] }], [{ provider: 'acme-cloud', model, count: 2 }]).amountUsd).toBe(0);
  });

  it('rounds the breakdown and total consistently at six decimal places', () => {
    const precise = [{ model, providers: [{ provider: 'acme-cloud', billing: 'providerCharge' as const, estimate: { ...estimate, amountUsd: 0.00000049 } }] }];
    expect(estimateCastingRoundCost(precise, [{ provider: 'acme-cloud', model, count: 3 }])).toMatchObject({ amountUsd: 0.000001, breakdown: [{ amountUsd: 0.000001 }] });
  });

  it('reports an unoffered provider through structured diagnostics', () => {
    expect(() => estimateCastingRoundCost(options, [{ provider: 'acme-missing', model, count: 1 }])).toThrowError(expect.objectContaining({ code: 'CASTING_ROUND_ESTIMATE_ROUTE_INVALID' }));
  });
});
