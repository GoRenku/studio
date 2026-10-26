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
    expect(estimateCastingRoundCost({ options, routes: [
      { provider: 'acme-alt', model, count: 10 },
      { provider: 'acme-host', model: host, count: 4 },
    ], detail: 'lowest', roundCount: 1 })).toEqual({ amountUsd: 0.2, breakdown: [{ name: 'Acme Image', amountUsd: 0.2 }], unpriced: [], hostPlanOnly: false });
  });

  it.each([{ ...estimate, state: 'missingPrice' as const, amountUsd: null }, { ...estimate, state: 'unpriced' as const, amountUsd: null }])('leaves the total unknown when a charged route has no current estimate (%j)', (missing) => {
    const unknown = { model: { key: 'acme-other', name: 'Acme Other' }, providers: [{ provider: 'acme-cloud', estimates: atEveryLevel(missing) }] };
    expect(estimateCastingRoundCost({ options: [...options, unknown], routes: [
      { provider: 'acme-cloud', model, count: 2 },
      { provider: 'acme-cloud', model: unknown.model, count: 3 },
    ], detail: 'lowest', roundCount: 1 })).toEqual({ amountUsd: null, breakdown: [{ name: model.name, amountUsd: 0.1 }], unpriced: ['Acme Other'], hostPlanOnly: false });
  });

  it('distinguishes host plan usage from an empty round and an explicit zero charge', () => {
    expect(estimateCastingRoundCost({ options, routes: [{ provider: 'acme-host', model: host, count: 10 }], detail: 'lowest', roundCount: 1 })).toEqual({ amountUsd: null, breakdown: [], unpriced: [], hostPlanOnly: true });
    expect(estimateCastingRoundCost({ options, routes: [], detail: 'lowest', roundCount: 1 })).toEqual({ amountUsd: null, breakdown: [], unpriced: [], hostPlanOnly: false });
    expect(estimateCastingRoundCost({ options: [{ model, providers: [{ provider: 'acme-cloud', estimates: atEveryLevel({ ...estimate, amountUsd: 0 }) }] }], routes: [{ provider: 'acme-cloud', model, count: 2 }], detail: 'lowest', roundCount: 1 }).amountUsd).toBe(0);
  });

  it('rounds the breakdown and total consistently at six decimal places', () => {
    const precise = [{ model, providers: [{ provider: 'acme-cloud', estimates: atEveryLevel({ ...estimate, amountUsd: 0.00000049 }) }] }];
    expect(estimateCastingRoundCost({ options: precise, routes: [{ provider: 'acme-cloud', model, count: 3 }], detail: 'lowest', roundCount: 1 })).toMatchObject({ amountUsd: 0.000001, breakdown: [{ amountUsd: 0.000001 }] });
  });

  it('prices the chosen detail level', () => {
    const levels = [{ model, providers: [{ provider: 'acme-cloud', estimates: { lowest: { ...estimate, amountUsd: 0.066 }, mid: { ...estimate, amountUsd: 0.139 }, highest: { ...estimate, amountUsd: 0.205 } } }] }];
    expect(estimateCastingRoundCost({ options: levels, routes: [{ provider: 'acme-cloud', model, count: 4 }], detail: 'lowest', roundCount: 1 }).amountUsd).toBe(0.264);
    expect(estimateCastingRoundCost({ options: levels, routes: [{ provider: 'acme-cloud', model, count: 4 }], detail: 'highest', roundCount: 1 }).amountUsd).toBe(0.82);
  });

  it('multiplies the per-round estimate by the number of rounds', () => {
    expect(estimateCastingRoundCost({ options, routes: [{ provider: 'acme-alt', model, count: 2 }], detail: 'lowest', roundCount: 3 })).toMatchObject({ amountUsd: 0.12, breakdown: [{ name: 'Acme Image', amountUsd: 0.12 }] });
  });

  it('reports an unoffered provider through structured diagnostics', () => {
    expect(() => estimateCastingRoundCost({ options, routes: [{ provider: 'acme-missing', model, count: 1 }], detail: 'lowest', roundCount: 1 })).toThrowError(expect.objectContaining({ code: 'CASTING_ROUND_ESTIMATE_ROUTE_INVALID' }));
  });
});
