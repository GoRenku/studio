import { describe, expect, it } from 'vitest';
import { hostPlanUsageEstimate, type GenerationCostEstimate } from '../generation-cost-estimate.js';
import { estimateCastingRoundCost, type CastingModelEstimate } from './cost-estimate.js';

const model = { key: 'acme-image', name: 'Acme Image' };
const host = { key: 'acme-host', name: 'Acme Host' };
const estimate: GenerationCostEstimate = {
  state: 'computed', amountUsd: 0.05, basis: 'One candidate', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'request',
};
/** The same estimate at every detail level. */
const atEveryLevel = (value: GenerationCostEstimate) => ({ lowest: value, mid: value, highest: value });
const options: CastingModelEstimate[] = [
  { model, providers: [
    { provider: 'acme-cloud', estimates: atEveryLevel(estimate) },
    { provider: 'acme-alt', estimates: atEveryLevel({ ...estimate, amountUsd: 0.02 }) },
    { provider: 'acme-unknown', estimates: atEveryLevel({ ...estimate, state: 'missingPrice', amountUsd: null }) },
  ] },
  { model: host, providers: [{ provider: 'acme-host', estimates: atEveryLevel(hostPlanUsageEstimate(null)) }] },
];

describe('Casting Round cost estimates', () => {
  it('uses the picked provider and counts only charged candidates in a mixed round', () => {
    expect(estimateCastingRoundCost(options, [
      { provider: 'acme-alt', model, count: 10 },
      { provider: 'acme-host', model: host, count: 4 },
    ], 'lowest')).toEqual({ amountUsd: 0.2, breakdown: [{ name: 'Acme Image', amountUsd: 0.2 }], unpriced: [], hostPlanOnly: false });
  });

  it.each([{ ...estimate, state: 'missingPrice' as const, amountUsd: null }, { ...estimate, state: 'unpriced' as const, amountUsd: null }])('leaves the total unknown when a charged route has no current estimate (%j)', (missing) => {
    const unknown = { model: { key: 'acme-other', name: 'Acme Other' }, providers: [{ provider: 'acme-cloud', estimates: atEveryLevel(missing) }] };
    expect(estimateCastingRoundCost([...options, unknown], [
      { provider: 'acme-cloud', model, count: 2 },
      { provider: 'acme-cloud', model: unknown.model, count: 3 },
    ], 'lowest')).toEqual({ amountUsd: null, breakdown: [{ name: model.name, amountUsd: 0.1 }], unpriced: ['Acme Other'], hostPlanOnly: false });
  });

  it('distinguishes host plan usage from an empty round and an explicit zero charge', () => {
    expect(estimateCastingRoundCost(options, [{ provider: 'acme-host', model: host, count: 10 }], 'lowest')).toEqual({ amountUsd: null, breakdown: [], unpriced: [], hostPlanOnly: true });
    expect(estimateCastingRoundCost(options, [], 'lowest')).toEqual({ amountUsd: null, breakdown: [], unpriced: [], hostPlanOnly: false });
    expect(estimateCastingRoundCost([{ model, providers: [{ provider: 'acme-cloud', estimates: atEveryLevel({ ...estimate, amountUsd: 0 }) }] }], [{ provider: 'acme-cloud', model, count: 2 }], 'lowest').amountUsd).toBe(0);
  });

  it('rounds the breakdown and total consistently at six decimal places', () => {
    const precise = [{ model, providers: [{ provider: 'acme-cloud', estimates: atEveryLevel({ ...estimate, amountUsd: 0.00000049 }) }] }];
    expect(estimateCastingRoundCost(precise, [{ provider: 'acme-cloud', model, count: 3 }], 'lowest')).toMatchObject({ amountUsd: 0.000001, breakdown: [{ amountUsd: 0.000001 }] });
  });

  it('prices the chosen detail level', () => {
    const levels = [{ model, providers: [{ provider: 'acme-cloud', estimates: { lowest: { ...estimate, amountUsd: 0.066 }, mid: { ...estimate, amountUsd: 0.139 }, highest: { ...estimate, amountUsd: 0.205 } } }] }];
    expect(estimateCastingRoundCost(levels, [{ provider: 'acme-cloud', model, count: 4 }], 'lowest').amountUsd).toBe(0.264);
    expect(estimateCastingRoundCost(levels, [{ provider: 'acme-cloud', model, count: 4 }], 'highest').amountUsd).toBe(0.82);
  });

  it('reports an unoffered provider through structured diagnostics', () => {
    expect(() => estimateCastingRoundCost(options, [{ provider: 'acme-missing', model, count: 1 }], 'lowest')).toThrowError(expect.objectContaining({ code: 'CASTING_ROUND_ESTIMATE_ROUTE_INVALID' }));
  });
});
