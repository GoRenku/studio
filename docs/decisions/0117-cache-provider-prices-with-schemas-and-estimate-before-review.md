# 0117 Cache Provider Prices With Schemas And Estimate Before Review

Date: 2026-10-12

Status: accepted

Supersedes the pricing removal in
[ADR 0086](0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md).

## Context

No review surface showed a cost. Some providers publish prices or quotes
through their APIs; others only on pricing pages, where research is slow.

## Decision

- Prices are cached provider metadata owned by Engines
  (`engines/src/pricing/`), stored in the provider metadata cache beside input
  schemas. Core, Studio, Project databases and Skills hold no price data.
- A `RoutePrice` uses a closed vocabulary: units `request`, `image`,
  `megapixel`, `second`, `character` and `credit`; quantities `constant`,
  request `field` (JSON Pointer, optional default), `characters` and
  `imageMegapixels`; optional tiers keyed by request JSON Pointers. Anything
  the vocabulary cannot express stays unpriced.
- `imageMegapixels` covers per-megapixel image prices without any model
  knowledge. It guesses the output size from `width` and `height` or a size
  label in `resolution`, `image_size` or `size` ("2k" is 2 × 2 = 4 megapixels,
  "1080p" a 16:9 frame, "512sq" a square, "1024x768" exact pixels), assumes
  1 megapixel when the request names no size, and the estimate's basis says
  what the guess was based on.
- Provider modules implement optional `readPrice` and `quoteCost`: Pika
  (catalog display pricing and the public quote endpoint), WaveSpeed (model
  base price and the pricing endpoint) and Fal.ai (the pricing API). API
  prices expire by provider headers or after 24 hours.
- Agents record researched prices with `renku generation price record`;
  Engines validates the entry and caps its expiry at 14 days after it was
  observed. `renku generation price show` prints cached prices and their age.
- `estimateCost` tries a live quote, then a fresh recorded entry, then the API
  price. States are `quoted`, `computed`, `missingPrice`, `expired` and
  `unpriced`; a missing price is never zero.
- Core owns only the display envelope `GenerationCostEstimate`, which adds
  `hostPlanUsage` and the request SHA-256. The CLI composes Engines into it,
  attaches it in `generation prepare` and `generation preview show`, and
  injects a `GenerationCostEstimator` into the Codex MCP server, which never
  imports Engines.
- Casting (ADR 0127) uses that same estimator and full envelope per candidate.
  Core owns only the casting aggregation of those amounts by candidate count;
  Codex and React share that calculation. Every offered paid model/provider
  requires a Skill-prepared one-candidate request before the panel opens;
  missing requests return structured issues for the agent to resolve. Provider
  prices that remain unavailable after estimation stay visible with their
  explanation. Engines remains the provider-pricing owner.
- Skill route descriptions carry `billing`: `hostPlanUsage` for Codex built-in
  routes, which are never estimated, and `providerCharge` otherwise.
- Studio formats estimates in one shared view used by the generation review
  panel and Generation Preview; Generation Preview marks an estimate outdated
  when the request changed.

## Consequences

- Fal.ai and WaveSpeed account discounts can lower the real charge; recording
  the actual charge belongs to a later plan with an overall budget.
- Price research runs only when a review estimate is missing or expired, at
  most once per route per expiry period, and never when Ask is off.
