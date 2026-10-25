# 0244 Casting Detail Levels

Date: 2026-10-25

Status: active

Related: [ADR 0127](../../docs/decisions/0127-cast-looks-costumes-and-casting-rounds.md),
[ADR 0128](../../docs/decisions/0128-estimate-generation-cost-from-saved-prices.md),
plan 0243.

## Summary

Casting candidates and character sheets use a model-neutral detail level,
`lowest | mid | highest`. Project casting settings hold the defaults
(candidates `lowest`, character sheets `highest`); the casting picker shows the
candidate level, preset from settings, and the director may change it for one
round. The Skill's Default Model List defines what each level means per
provider route as opaque native request fields. The picker prices the chosen
level, and the agent generates with the same fields.

Decisions confirmed by the user on 2026-10-25: mapping lives in the Default
Model List; sheets default to `highest`; the picker can change the level per
round. Previewer zoom is a separate later iteration.

## Context

Pika Nano Banana costs $0.066 at 512, $0.139 at 2K and $0.205 at 4K per image.
Casting compares many candidates and keeps one, so a low default saves money;
sheets are kept as identity references and need detail. Native size fields
differ per model and provider, so Studio cannot name them.

## Architecture Shape Gate

- **Core client**
  - `default-models.ts`: `IMAGE_DETAIL_LEVELS`, `ImageDetailLevel`,
    `IMAGE_DETAIL_LANES`, `findImageDetailFields`; `DefaultModelListProvider`
    gains optional `detail: Record<ImageDetailLevel, Record<string, JsonValue>>`,
    required on image and image edit lanes and refused elsewhere. The fields
    are opaque; Core validates only that each level is an object.
  - `casting/model.ts`: `CastingSettings` gains `candidateDetail` and
    `characterSheetDetail`. The round's level is not stored: the panel answer
    and consume result carry it to the agent, so no table changes.
  - `casting/cost-estimate.ts`: `CastingProviderEstimate.estimates` per level;
    `estimateCastingRoundCost(options, routes, detail)`.
- **Core server**
  - `default-models/document.ts` validates `detail` on every provider entry of
    the image and image edit lanes.
  - Project Settings version 9; custom Drizzle migration
    `0096_casting_detail_levels.sql` adds the two defaults to version 8
    documents (user_version 77). No runtime fallback.
  - `default-models/service.ts`: `readImageDetailFields` for the CLI.
- **Engines:** `estimateRouteDefaultsCost(provider, model, context, fields?)`
  applies the given native fields over the schema defaults before pricing one
  output. No model knowledge.
- **Codex**
  - `casting-round/estimates.ts` estimates each option at every level once at
    open: three estimates per provider route, cached. The panel switches
    levels without another round trip.
  - `casting.round.respond` and `consume` carry `detail`.
- **CLI**
  - `renku settings casting set` accepts the two fields.
  - `renku generation estimate --provider --model` gains `--detail <level>`,
    which reads the fields from the synced Default Model List. Core resolves
    the level; the CLI stays thin.
- **Studio**
  - Settings › Casting gets two `Select` rows.
  - The casting picker gets a `ToggleGroup`-style level control from
    `src/ui`, plus per-level prices and total.
- **studio-skills**
  - `default-models.json` gets `detail` for every image and image edit
    provider entry, with the sizes taken from each provider's schema.
  - The casting-candidate and character-sheet guides apply the level's fields.
  - The validator checks the three levels exist and use fields present in the
    route's schema when the schema is available.
- **Forbidden**
  - model ids, size names or field names in Core, Codex, CLI or Studio;
  - per-model branches;
  - a second estimate path.

## Review Attention

- New Settings fields, a new Default Model List field, a new round field and
  a new CLI flag.
- Existing Project settings need the two defaults written; this is a one-way
  conversion of Urban Basilica's settings document, not a runtime fallback.
- The stored Default Model List must be synced again after the skill change.

## Completion Checklist

### Architecture And Contracts
- [x] Level vocabulary in Core only; native fields opaque everywhere.
- [x] One estimate path; per-level prices come from the shared estimator.

### Implementation Slices
- [x] Core settings, round and model list contracts and validation.
- [x] Engines field overrides for route-default estimates.
- [x] Codex picker estimates per level; respond and consume carry the level.
- [x] CLI settings and estimate flag.
- [x] Studio Settings rows and picker level control from `src/ui`.
- [x] Skills data, guidance and validator.

### Tests And Guardrails
- [x] Core validation of levels and model list detail.
- [x] Engines override pricing.
- [x] Codex per-level estimates and round answer.
- [x] Studio picker level switching and settings rows.

### Documentation
- [x] ADR 0127 casting decision updated; CLI docs.

### Final Verification
- [ ] Build, tests, lint; diff inspected; Urban Basilica settings converted;
      Default Model List synced; picker checked in Codex.
