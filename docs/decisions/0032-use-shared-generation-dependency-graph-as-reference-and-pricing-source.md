# 0032 Use Shared Generation Dependency Graph As Reference And Pricing Source

Date: 2026-06-11

Status: superseded

Superseded by: `plans/active/0063-generation-dependency-inventory-rewrite.md`

Note: the current architecture uses a dependency inventory/checklist/estimate
contract instead of a dependency execution graph. This ADR remains historical
context for why dependency pricing moved into shared core.

## Context

Media generation references were drifting because `shot.video-take` owned too
much local planning behavior. The shot video References tab could show scene
scope, selected assets, planned generations, and warnings from separate code
paths. That made cast, location, and Lookbook references behave differently and
made cost estimates hard to reason about.

Renku Studio already uses a shared media generation purpose registry. The same
architecture must own dependency planning, dependency estimates, and reference
projection. A video shot, cast profile, character sheet, location sheet, or
Lookbook sheet should not invent a separate pricing or dependency model.

## Decision

Use a shared media generation dependency graph as the source of truth for:

- required dependencies;
- existing assets that satisfy dependencies;
- planned generated dependencies;
- dependency and root generation estimates;
- execution levels;
- reference-card pricing and status.

There is exactly one meaning of pricing: a generated node price is the provider
estimate returned by `@gorenku/studio-engines` for that node's generation
request. A graph total is the sum of priced graph nodes, including the root
generation and generated dependencies. Existing assets are priced at `$0.00`.
External manual attachments are not generation work and are not priced.

Purpose definitions own dependency declarations and draft dependency specs.
The generic resolver walks those declarations, resolves existing assets,
estimates planned dependency specs through the shared purpose lifecycle, and
returns a read-only dependency map. Root spec creation and update must refuse
to persist a spec while required dependencies are still planned or missing.

Studio and CLI surfaces should render graph projections. They must not compute
generation prices or maintain a second dependency model.

## Consequences

- `cast.profile` and `shot.video-take` use the same dependency graph planning
  path.
- Missing generated dependencies are explicit planned nodes, not card-local
  placeholders.
- Missing or unpriced nodes prevent a trustworthy complete total.
- Existing selected assets satisfy dependency slots at `$0.00`.
- Dependency ids use dependency-kind vocabulary such as
  `cast-character-sheet:<castMemberId>` and
  `location-environment-sheet:<locationId>`.
- No compatibility aliases are kept for obsolete dependency id shapes.

## Implementation Notes

The shared implementation lives under
`packages/core/src/server/media-generation`:

- `dependency-kind-registry.ts`;
- `dependency-asset-selectors.ts`;
- `dependency-draft-specs.ts`;
- `dependency-graph.ts`;
- `dependency-plan-lines.ts`.

The first dependency kinds are `first-frame`, `last-frame`, `reference-image`,
`video-prompt-sheet`, `cast-character-sheet`,
`location-environment-sheet`, `lookbook-sheet`, and `manual-attachment`.

The first non-shot proof is `cast.profile`, which declares and plans a
`cast-character-sheet` dependency through the same graph used by shot video
planning.
