# 0128 Use Local Image Prices For Casting

Date: 2026-10-24

Status: accepted

Supersedes the casting estimate preparation requirement in ADRs 0117 and 0127.

## Decision

The casting picker needs fast, approximate comparisons. Engines owns a small
bundled list of typical per-image prices, checked against public provider
pricing and updated with the catalog. The list is loaded once by the module
system and requires no network, schema, credentials or disk-cache lookup.

Each model uses the same reference price across providers. Differences in
provider, size, quality, references and account discounts are accepted estimate
error. The displayed basis says the price is approximate. A model absent from
the list has an unknown price; host-plan images remain plan usage.

Codex supplies only the existing model key to the injected estimator. Core
continues to multiply the per-image amounts by candidate counts. Skills do no
pricing research or native request preparation to open the casting picker.
Estimation of an actual generation request is unchanged.

## Architecture Shape Gate

- `engines/src/providers/image-pricing.ts` owns the reference table and public
  `estimateImageCost(modelKey)` lookup. No registries, refresh jobs or requests.
- `codex/src/generation-review-estimate.ts` adds `estimateImage(modelKey)` to
  the injected `GenerationCostEstimator`; CLI composes the Engines result into
  the existing display envelope in `generation/cost-estimator.ts`.
- `codex/src/casting-round/estimates.ts` looks up each paid model once and
  projects that estimate onto its providers. No provider or model knowledge.
- `GenerationCostEstimate.requestSha256` is null for a model estimate, because
  no generation request exists. Request estimates retain their hashes.
- Remove the request-preparation input, validation, tests and Skill guidance.
- Stop if implementation adds network calls, schema lookup, background refresh,
  another cache, provider-specific adapter logic, or another price DTO.

## Review Attention

- Casting tool input becomes smaller; its prepared-request field is removed.
- Prices deliberately trade precision and automatic freshness for immediate,
  offline availability. Updating prices is catalog maintenance.
- No database, Settings, CLI commands or generation confirmation changes.
- Verification covers all current paid image choices, offline repeated lookups,
  count aggregation, host-plan bypass and unchanged native-request estimation.
