# 0128 Estimate Generation Cost From Saved Prices

Date: 2026-10-24

Status: accepted

Supersedes the live quotes, price expiry and price research cadence of
[ADR 0117](0117-cache-provider-prices-with-schemas-and-estimate-before-review.md)
and the prepared casting estimate requests of
[ADR 0127](0127-cast-looks-costumes-and-casting-rounds.md).

## Context

Estimates are approximate by definition, and provider prices change rarely
and by small amounts. Opening a review or the casting picker was slow: every
estimate asked the provider for a live quote, prices expired after one day
(API) or 14 days (researched), a slow provider could hold an estimate for
minutes of timeouts and retries, and the casting picker required the agent to
prepare a native request for every offered model and provider first.

## Decision

- **An estimate never waits on a provider.** Engines estimates a request from
  the saved price only: the researched price when one exists, otherwise the
  provider's API price. A provider that quotes exact settings (Pika, WaveSpeed)
  is asked first, and its quote is saved per set of settings like a price and
  reused for 30 days; a failed quote falls back to the published price. For a
  Fal.ai route billed in a unit Renku cannot count (tokens), the published
  price is Fal.ai's typical charge per call from past usage, noted as such.
  Estimating a route at its defaults fills required text such as the prompt
  with a short placeholder, for pricing only. Estimate states are `computed`,
  `missingPrice` and `unpriced`; Core adds `hostPlanUsage`.
- **Saved prices last.** While estimating, provider metadata (prices and the
  input schemas whose defaults the estimate applies) is reused for up to 30
  days. An older entry gets one refresh attempt with a 5 second timeout and no
  retries; a failed refresh keeps the saved copy. Researched prices never
  expire; recording again replaces them.
- **Price research runs only when no price is known** for a provider route
  without API prices, once per route. It never runs for an existing price.
- **One estimator.** The CLI composes the only `GenerationCostEstimator`. It
  returns the host plan usage envelope for the Codex built-in provider and the
  Engines estimate otherwise. Callers (`generation estimate`, `prepare`,
  `preview show`, the generation review panel and the casting picker) never
  branch on billing.
- **Billing is decided once, in Core,** from the provider:
  `generationRouteBilling(provider)`. Skill Route Descriptions no longer carry
  `billing`.
- **The casting picker prices routes, not prepared requests.** Each Default
  Model List provider entry names the lane's route on that provider
  (`{ "provider", "route" }`). The picker estimates one output of each offered
  route at its schema defaults: Engines sets the image count fields its price
  reads to one, so a route that defaults to a batch is still priced per
  candidate. Differences from the eventual request (size, quality,
  references) are accepted estimate error. Hosts without the picker use the
  same estimate through
  `renku generation estimate --provider <provider> --model <route>`.

## Architecture Shape Gate

- `engines/src/pricing/` owns estimation, the price lookup
  (`readRoutePrice`, shared by `estimateRouteCost` and `generation price
  show`) and the estimating metadata policy. Provider `pricing.ts` files only
  read provider price data and translate provider unit names through the shared
  `pricing/billing-units.ts` table.
- `engines/src/shared/metadata-retrieval.ts` applies an optional
  `ProviderContext.cachedMetadataReuse`; provider metadata loaders are unaware
  of it.
- `engines/src/shared/json-object.ts` owns the JSON object guards used across
  Engines.
- `core/src/client/generation-cost-estimate.ts` owns the envelope,
  `generationRouteBilling` and `hostPlanUsageEstimate`.
- `cli/src/commands/generation/cost-estimator.ts` is the only estimator
  implementation.
- `engines/src/pricing/quote-cache.ts` owns saved quotes; a provider module
  only implements `quoteCost` for its public quote endpoint.
- `studio/src/features/media-generation-request/generation-cost-estimate-format.ts`
  owns estimate wording and `formatUsd`; the view renders them.
- Stop if a caller checks billing before estimating, a second price lookup
  order appears, a price amount or model id is written into code, or an
  estimate path makes a provider request beyond one refresh of an old saved
  price or quote.

## Consequences

- An estimate may lag a price change by up to 30 days (API) or until it is
  researched again. Account discounts can still lower the real charge.
- Pika and WaveSpeed estimates follow duration, resolution and other settings
  exactly. Fal.ai token-billed routes show a typical per-call charge that
  ignores settings; recording a researched price replaces it.
- The stored Default Model List must be synced again after the shape change.
