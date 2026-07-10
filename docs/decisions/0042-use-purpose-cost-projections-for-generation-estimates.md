# Use Purpose Cost Projections For Generation Estimates

Date: 2026-07-03

Status: accepted

## Context

Renku Studio previously estimated generation cost by preparing a generation
request and passing that request through engine estimation. That coupled cost
approval to readiness work such as provider payload construction, file
resolution, dependency materialization, and provider request validation.

That coupling made valid pricing unavailable whenever a prompt, reference file,
or generated dependency was not yet ready, even when the selected purpose,
model, route, duration, resolution, and input counts were enough to price the
work.

## Decision

Generation cost estimates use purpose-owned cost projections.

Each media generation purpose exposes a `buildCostProjection` implementation
that converts the purpose spec into:

- a `GenerationPriceKey`;
- `GenerationPricingInputs`;
- a `GenerationCostEstimate`.

The engine cost API is `estimateGenerationCost({ priceKey, pricingInputs })`.
It prices declared pricing facts only. It must not construct provider payloads,
validate provider payloads, resolve files, inspect prompt contents, or run
readiness validation.

The estimate endpoint returns a cost estimate only:

```ts
{
  spec: MediaGenerationSpecRecord;
  estimate: GenerationCostEstimate;
}
```

Estimates are pricing-only and do not return approval artifacts. Live provider
approval is provided at run time through the Core run input or CLI run flag.

## Consequences

- Readiness and cost are separate rails.
- Missing prompts, missing references, stale shot ids, and missing selected
  dependency media can block generation readiness while still producing a
  priced cost line.
- Missing pricing facts, such as required duration or character count, produce
  `state: "missing-pricing-input"`.
- Unknown or unsupported model pricing produces `state: "unpriced"` for display.
  Live runs still use the same explicit live provider approval boundary.
- Studio server handlers, CLI handlers, and React code must not recreate cost
  rules locally. They call core and pass through the returned cost estimate.
- Runtime generation still prepares provider payloads before execution, but
  live paid runs require explicit live provider approval at the run boundary.

## Non-Goals

This decision does not make Studio inspect or validate creative prompt or media
contents. Cost projection uses product-owned pricing facts only.
