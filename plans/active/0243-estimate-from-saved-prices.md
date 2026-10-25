# 0243 Estimate From Saved Prices

Date: 2026-10-24

Status: active

Decision: [ADR 0128](../../docs/decisions/0128-estimate-generation-cost-from-saved-prices.md)

## Summary

Make every cost estimate fast by estimating from saved prices only, and
consolidate the estimate code so each rule has one owner. The casting picker
prices each offered route from the Default Model List instead of
agent-prepared requests.

## Context

Estimates appear in the generation review panel (open and re-estimate),
Studio Generation Preview (`prepare`, `preview show`), text review,
`generation estimate` and the casting picker. All use the CLI-composed
estimator, but the host plan check was repeated in four callers, the price
lookup order twice, money formatting twice, and JSON object guards in twenty
Engines files. Live quotes, short price expiry, long timeouts with retries and
prepared casting requests made the agent and panels slow.

## Architecture Shape Gate

- **Engines `pricing/`:** `contracts.ts` (vocabulary, `RoutePrice` without
  expiry, states `computed | missingPrice | unpriced`), `estimate.ts`
  (`estimateRouteCost`: sets the estimating metadata policy, applies schema
  defaults, reads prices, evaluates), `price-cache.ts` (`readRoutePrice`,
  `recordRoutePrice`, `ESTIMATE_METADATA_REUSE`), `billing-units.ts` (shared
  unit translations), `price-evaluation.ts`, `price-schema.ts`,
  `image-megapixels.ts`, `request-defaults.ts`. `provider-quote.ts` is deleted.
  `index.ts` stays a thin export list.
- **Engines `shared/`:** `metadata-retrieval.ts` honours
  `ProviderContext.cachedMetadataReuse` (reuse within age, one attempt, saved
  copy on failure); `PROVIDER_CATALOG_MAX_AGE_MS` names the default freshness
  provider loaders use outside estimation; `json-object.ts` owns
  `isJsonObject` and `isUnknownObject`.
- **Providers:** `fal-ai/pricing.ts`, `pika/pricing.ts`,
  `wavespeed/pricing.ts` only read price data and map provider unit names to
  `billing-units.ts` keys. `quoteCost` leaves the `MediaProvider` contract.
- **Core client:** `generation-cost-estimate.ts` owns the envelope,
  `generationRouteBilling` and `hostPlanUsageEstimate`;
  `casting/cost-estimate.ts` aggregates without a separate billing field;
  `default-models.ts` entries hold `providers: DefaultModelListProvider[]`.
- **Core server:** `default-models/document.ts` validates provider entries.
- **CLI:** `generation/cost-estimator.ts` is the only estimator and handles
  the host plan case; `estimate.ts`, `prepare.ts`, `preview.ts` call it with
  no billing branch; `price.ts` shows saved prices with their age.
- **Codex:** `GenerationCostEstimator` has one `estimate` method;
  generation review, review re-estimate and `casting-round/estimates.ts` call
  it without billing checks. Route `billing` leaves the review and image edit
  Route Description schemas.
- **Studio:** the estimate view owns `formatUsd` and wording; the casting
  panel and image edit disclosure use Core's `generationRouteBilling` or the
  estimate state.
- **Forbidden:** caller-side billing checks, a second lookup order, price
  amounts or model ids in code, provider requests while estimating beyond one
  refresh of an old saved price or quote, new estimate DTOs.

## Contracts

- `GenerationCostEstimateState`: `computed | missingPrice | unpriced |
  hostPlanUsage`. `requestSha256` is null for a route estimate at defaults.
- `GenerationCostEstimator.estimate({ homeDir?, provider, model, request,
  requestSha256 })`.
- `DefaultModelListEntry.providers: Array<{ provider: string; route: string }>`;
  `recommendedFor` stays a provider id list.
- `RoutePrice` loses `expiresAt`; `renku generation price record` no longer
  accepts it; `price show` reports `observedAt` instead of `expired`.
- Review and image edit Route Descriptions lose `billing`.
- `casting.round.open` has no `estimateRequests`.

## Implementation Slices

1. Engines pricing, metadata reuse policy, unit table, JSON guards.
2. Core envelope, billing, casting aggregation, Default Model List shape.
3. CLI estimator, price commands; Codex estimator callers and casting.
4. Studio formatter, wording and billing consumers.
5. studio-skills guidance, evals and Default Model List routes.
6. Docs (ADR 0117/0127 pointers, CLI commands, plan 0242).

## Tests And Guardrails

- Engines: estimate uses saved prices without fetching inside the reuse age;
  refreshes once when older; keeps the saved copy on refresh failure; prefers
  the researched price; researched prices do not expire.
- Core: Default Model List provider entries validated; billing from provider;
  casting aggregation with host plan estimates.
- CLI: `preview show` for a host route returns plan usage via the estimator;
  `price record` without expiry.
- Codex: casting options estimate one output of each route without a request; review
  open and re-estimate call the estimator for host routes too.

## Final Verification

`pnpm build`, `pnpm test`, `pnpm lint`, full diff review for formatting churn.

## Completion Checklist

### Review Area
- [ ] User told about reversing the earlier removal of Default Model List routes.
- [ ] User asked before deleting Codex's untracked draft files.

### Architecture And Contracts
- [ ] No caller checks billing before estimating.
- [ ] One price lookup used by estimate and price show.
- [ ] `quoteCost`, `provider-quote.ts`, `quoted`, `expired`, price expiry removed.
- [ ] Route `billing` removed from review and image edit schemas.
- [ ] `index.ts` files remain thin.

### Implementation Slices
- [ ] Engines slice.
- [ ] Core slice.
- [ ] CLI and Codex slice.
- [ ] Studio slice.
- [ ] studio-skills slice.

### Tests And Guardrails
- [ ] Engines reuse and refresh tests.
- [ ] Core, CLI, Codex and Studio tests updated to the current contracts only.

### Documentation
- [ ] ADR 0117 and 0127 point to ADR 0128.
- [ ] CLI commands and plan 0242 updated.

### Final Verification
- [ ] Build, tests and lint pass.
- [ ] Diff inspected for formatting churn and large files.
