# 0061 Shot Reference Dependency Estimate Repair And Coverage

Status: implemented for the estimate regression and E2E coverage slice; broader
0060 architecture follow-ups remain open
Date: 2026-06-11

## Summary

The current implementation partially completed the shared media-generation
dependency graph architecture from
`plans/active/0060-shot-reference-selection-resolver.md`, but it did not finish
the architecture in the way the plan and ADR require.

Two regressions are visible in Studio:

- the References tab can show General `First Frame` and `Last Frame` cards
  without dependency estimates;
- the AI Production tab can show `Estimated total: -` for a model/input-mode
  combination that should still have a numeric cost estimate before generated
  dependencies exist.

The immediate root cause is not a single React rendering bug. The current graph
mixes three different concepts:

- dependency priceability;
- dependency materialization readiness;
- whether an agent has authored the prompt/spec needed to generate that
  dependency later.

For shot input dependencies such as `shot.first-frame` and `shot.last-frame`,
the current graph requires an authored dependency draft before it can estimate
the dependency node. When no prompt has been drafted yet, the graph marks the
node missing, the aggregate estimate becomes `unavailable`, and Studio renders
no total. Cast, location, and Lookbook dependencies behave differently because
their dependency draft builders can synthesize a valid draft estimate from
purpose-owned context.

That asymmetry is why the screenshot can show prices on Cast Character Sheet
cards while General First Frame and Last Frame cards are quiet.

This plan completes the shared architecture and restores the estimate behavior
with no UI-side pricing, no final-video-only fallback totals, no fake project
files, no compatibility shims, and no mock-based confidence.

It also replaces the current core-only shot video estimate matrix with a full
browser-client-to-server-to-core-to-engines estimate matrix for the AI
Production tab contract. The replacement must cover the same intent/model/
parameter matrix as
`packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts`, but
it must start from the browser-facing client API shape, pass through the real
Studio Hono route, reach core, and receive prices from the real engines
estimate layer. Once that end-to-end matrix exists and proves the same
coverage, the old core-only matrix can be deleted.

## Implementation Update 2026-06-11

Completed in this pass:

- Added explicit dependency `materializationState` to the shared graph and plan
  line contracts so priceability no longer implies immediate run-readiness.
- Made unauthored shot input dependencies priceable through internal
  estimate-only draft specs while withholding `draftGenerationSpec` from plan
  nodes/lines until a real authored prompt exists.
- Kept non-materializable planned shot input nodes out of execution levels and
  kept the final video node blocked from execution until dependencies are
  prepared.
- Changed shot preflight `canCreateSpec` to use the concrete missing input
  checklist instead of graph estimate missing-counts.
- Restored General reference pricing for planned shot-scoped reference images.
- Added no-mock core regression coverage for unauthored first-frame and
  first-last-frame dependencies.
- Replaced
  `packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts`
  with
  `packages/studio/src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts`.
  The replacement starts at the browser service function, routes through a real
  Hono app, uses a real temporary project, reaches core, and prices through the
  real engines estimate layer.
- Removed the stale Core `test:shot-video-estimates` script and added the
  focused Studio script that points at the new E2E matrix.
- Fixed two unrelated full-suite blockers found during verification:
  `dialogueId` is now recognized by the screenplay schema/sanitizer, and the
  scene dialogue audio generated-take test no longer collides with deterministic
  asset ids.

Verification completed:

- `pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-graph-estimates.test.ts src/server/media-generation/shot-video-take.test.ts --no-file-parallelism`
  passed: 26 tests.
- `pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism`
  passed: 256 tests.
- `pnpm --filter @gorenku/studio exec vitest run src/services/studio-shot-video-takes-api.test.ts server/routes/screenplay-video-take-production.test.ts src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx src/features/movie-studio/scenes/scene-shot-references-tab.test.tsx --no-file-parallelism`
  passed: 37 tests.
- `pnpm --dir packages/core test` exited 0.
- `pnpm --filter @gorenku/studio test` passed: 40 files, 464 tests.
- `pnpm --dir packages/core test:typecheck` passed.
- `pnpm --filter @gorenku/studio test:typecheck` passed.
- `pnpm --dir packages/core lint` passed.
- `pnpm --filter @gorenku/studio lint` passed.

Additional verification after completing the generic planner and selector
diagnostic slice:

- `pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-graph-estimates.test.ts --no-file-parallelism`
  passed: 12 tests.
- `pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism`
  passed: 257 tests.

Coverage status:

- Attempted
  `pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --coverage`.
- Vitest failed before running tests because `@vitest/coverage-v8` is not
  installed.
- No coverage percentage can be truthfully reported from this workspace until
  coverage tooling is added. Repository instructions currently prohibit
  installing new dependencies unless dependency installation is explicitly
  requested.

Still open from the broader 0060 architecture:

- Reference projection is still hybrid for Lookbook, cast, and location sections.
  General First/Last Frame cards are graph-backed, but the other sections still
  begin from narrative/scope data and attach graph pricing when available.
- Location and Lookbook selectors now use deterministic resolution semantics,
  but the no-mock regression tests added in this pass cover cast selector
  ambiguity/missing-file behavior first. Equivalent location and Lookbook
  invalid-state tests remain to be added.
- Browser visual verification of the live localhost UI remains to be performed
  after starting or reusing the app server.

## Current State Audit

### What `b753f83` Implemented

Commit `b753f832bc73616303795899ee7afc37bc9f8e26` added a meaningful but
incomplete shared dependency graph slice.

Implemented pieces:

- Added ADR
  `docs/decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`.
- Added shared client contracts in
  `packages/core/src/client/media-generation.ts`:
  - `MediaGenerationDependencyKind`;
  - `MediaGenerationAssetSelectorId`;
  - `MediaGenerationDependencyKindDefinition`;
  - `MediaGenerationDependencySlot`;
  - dependency graph node/line pricing fields.
- Added `packages/core/src/server/media-generation/dependency-kind-registry.ts`.
- Added `packages/core/src/server/media-generation/dependency-asset-selectors.ts`.
- Added `packages/core/src/server/media-generation/dependency-draft-specs.ts`.
- Added `packages/core/src/server/media-generation/dependency-graph.ts`.
- Added `packages/core/src/server/media-generation/dependency-plan-lines.ts`.
- Added `buildDependencyDraftSpec` hooks to several purpose definitions:
  - `cast.character-sheet`;
  - `location.environment-sheet`;
  - `lookbook.sheet`;
  - shot input purposes.
- Added `cast.profile` as a non-shot proof for the generic
  `planMediaGenerationDependencies` path.
- Replaced old dependency ids such as
  `planned:character-sheet:cast-member:<id>` with
  `planned:cast-character-sheet:<id>`.
- Removed obsolete `estimateLines` and nullable card `cost` from the current
  plan shape.
- Added tests proving several happy paths:
  - missing cast/location/lookbook dependencies are priced in the shot graph;
  - a planned first-frame dependency can expand into cast/location/lookbook
    child dependency nodes when the first-frame draft is authored;
  - `cast.profile` can plan a missing character sheet;
  - imported character sheets can satisfy `cast.profile` at `$0.00`.

### What Was Left Out

The implementation did not complete several mandatory items from `0060`.

Important gaps:

- `0060` is marked `implemented`, but its own completion checklist still has
  unchecked items for selector diagnostics, non-shot resolver completeness,
  invalid-state handling, Studio cleanup, materialization flow, and browser
  verification.
- There is no `dependency-declaration-registry.ts`.
- `shot.video-take` does not declare dependencies through the shared purpose
  registry. The generic `planMediaGenerationDependencies` path can plan
  `cast.profile`, but shot-video planning still goes through local
  `shot-video-take.ts` callbacks.
- `dependency-graph.ts` is callback-driven. The resolver accepts
  `resolveExistingAsset`, `declareDependencies`, and `estimateRoot` callbacks
  from its caller instead of owning the registry-backed declaration flow.
- `dependency-asset-selectors.ts` only resolves:
  - `cast-character-sheet`;
  - `location-environment-sheet`;
  - `lookbook-sheet`.
- The shared selector does not resolve shot video inputs such as:
  - `first-frame`;
  - `last-frame`;
  - `reference-image`;
  - `multi-shot-storyboard-sheet`.
- The shared selector chooses the first matching cast/location asset instead of
  detecting ambiguity.
- Missing selected asset files are treated as `null` rather than structured
  selector diagnostics.
- Location environment sheet selection does not verify that the selected sheet
  has the correct composite image role before satisfying the dependency.
- Lookbook handling implements `lookbook-sheet`, not the `lookbook.image` /
  `lookbook-reference-image` model described by the earlier `0045` plan.
- Reference projection still walks narrative scope and section-specific asset
  lists, then optionally looks up graph nodes. It is not graph-first.
- Cast/location/reference section cards can still exist without a graph-backed
  node. The card then receives `not-applicable` pricing.
- The AI Production total display reads `plan.estimate.estimatedTotalUsd`, but
  the graph returns `null` when a shot input dependency is missing only because
  it lacks an authored prompt.
- The current UI tests use mocked service modules and do not protect the real
  core/server/UI data path.

## Evidence From Code

### Incomplete Shared Selectors

`packages/core/src/server/media-generation/dependency-asset-selectors.ts`
currently branches only on three dependency kinds:

- `cast-character-sheet`;
- `location-environment-sheet`;
- `lookbook-sheet`.

Everything else returns `null`.

Impact:

- generic graph planning cannot reuse existing `first-frame`, `last-frame`,
  `reference-image`, or `multi-shot-storyboard-sheet` inputs;
- selector diagnostics promised by `0060` cannot be emitted from this module;
- planned shot input cards can be priced or not priced based on local
  `shot-video-take.ts` behavior instead of shared selector rules.

### Callback-Based Resolver

`packages/core/src/server/media-generation/dependency-graph.ts` accepts
caller-supplied callbacks for existing-asset resolution, child dependency
declaration, root estimation, and input policy.

Impact:

- the resolver is reusable as a helper, but not yet the architecture's
  registry-owned dependency graph path;
- shot-video logic can still drift from generic media-generation behavior;
- test coverage can pass for the local shot path while the shared path remains
  incomplete.

### Shot-Local Reference Projection

`readShotVideoTakeProductionPlan` still builds References sections by walking
scene narrative scope, shot scope, local asset relationships, Lookbook sheet
records, and only then looking up graph nodes by dependency id.

Impact:

- a visible card is not guaranteed to correspond to a graph node;
- cards can render with `not-applicable` pricing even when the graph should have
  planned and priced a generated dependency;
- the References tab is not yet a pure projection of graph nodes as required by
  ADR `0032`.

### First/Last Frame Estimate Regression

`buildShotInputDependencyDraftSpec` currently requires an authored dependency
draft for shot input dependency purposes.

When no prompt has been drafted yet:

- the dependency node remains `state: "missing"`;
- pricing remains `not-applicable`;
- graph aggregate state becomes `unavailable`;
- `estimatedTotalUsd` becomes `null`;
- AI Production renders `-`;
- the References tab has no price to show on the First Frame / Last Frame cards.

This is different from cast/location/lookbook dependencies, whose dependency
draft builders can produce an estimate from purpose context and default
parameters.

### AI Production Display

`scene-shot-ai-production-tab.tsx` correctly prefers the graph estimate over the
final-video-only estimate. That is the right direction.

The bug is that the graph estimate becomes unavailable for a dependency that is
priceable but not yet materializable.

Therefore the fix must be in core graph planning and dependency estimate
semantics, not by falling back to the final video estimate in Studio.

## Test Coverage Audit

### Commands Run During This Audit

Focused tests currently pass:

```bash
pnpm --dir packages/core test:shot-video-estimates
```

Result:

- 1 file passed;
- 255 tests passed.

```bash
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-graph-estimates.test.ts src/server/media-generation/shot-video-take.test.ts --no-file-parallelism
```

Result:

- 2 files passed;
- 25 tests passed.

```bash
pnpm --filter @gorenku/studio exec vitest run src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx src/features/movie-studio/scenes/scene-shot-references-tab.test.tsx --no-file-parallelism
```

Result:

- 2 files passed;
- 10 tests passed.

### Coverage Tooling Gap

No installed coverage provider was found in `package.json`,
`packages/*/package.json`, or `pnpm-lock.yaml`.

That means the repository can currently report pass/fail coverage from the test
matrix, but it cannot honestly report line/branch/function coverage percentages
from Vitest without adding coverage tooling.

Required decision:

- add coverage tooling, most likely `@vitest/coverage-v8`, to the relevant
  package dev dependencies; or
- provide a project-owned coverage script through another already-available
  mechanism.

Because this repository forbids running package-management commands unless the
user explicitly asks for dependency installation, implementation should pause
for approval before adding a new coverage dependency if it is not already
available.

### Existing Test Strengths

Strong existing coverage:

- The route/model estimate matrix covers every current shot-video route exposed
  by the engines catalog.
- The estimate matrix covers both single-shot and multi-shot modes.
- The estimate matrix covers prepared-input and unprepared-input states.
- The estimate matrix covers many parameter permutations for Seedance, Kling,
  Veo, Grok, LTX, and Happy Horse.
- Core integration tests prove the new graph can price missing cast, location,
  and Lookbook dependencies.
- Core integration tests prove `cast.profile` can use the shared graph for a
  missing or reused character sheet.

### Existing Test Weaknesses

Missing or weak coverage:

- No test covers the exact screenshot state:
  - First + Last Frame input mode;
  - no first-frame asset;
  - no last-frame asset;
  - no authored dependency drafts;
  - no final prompt;
  - AI Production still shows a numeric full-plan estimate.
- No test asserts First Frame / Last Frame cards in the References tab show the
  same pricing as their graph nodes.
- No test asserts that a graph node can be priceable but not yet materializable.
- No test protects the distinction between:
  - estimated dependency price;
  - authored dependency prompt/spec readiness;
  - final spec materialization readiness.
- No test exercises selector ambiguity for cast/location assets.
- No test exercises missing selected asset files as structured diagnostics.
- No test exercises generic shot input asset selection through shared selectors.
- No test exercises `planMediaGenerationDependencies` for `shot.video-take`.
- Studio React tests currently mock services, so they do not prove the real API
  response shape.
- Studio server route tests use a fake project data service, so they do not
  prove real core estimates survive HTTP serialization.
- The route/model estimate matrix is core-only. It does not prove the browser
  client request shape, Studio server parsing, Hono routing, response
  serialization, and UI-facing estimate contract all work together.
- The current Studio route tests prove delegation to fake project-data methods,
  not the real end-to-end estimate behavior.
- There is no line/branch/function coverage report.

## Correct Architecture

### Separate Priceability From Materialization Readiness

The graph needs to distinguish:

- `priceable`: enough information exists to estimate cost;
- `materializable`: enough authored/spec/file information exists to create or
  run the generation;
- `resolved`: the dependency is already an imported asset.

For image dependencies such as `shot.first-frame` and `shot.last-frame`,
provider pricing depends on model, image size, quality, and output count. It
does not depend on the final authored prompt text.

Therefore the graph should price the dependency before the prompt exists, while
still preventing materialization until an authored draft exists.

Expected behavior:

- card shows a price;
- graph total includes the dependency price;
- dependency line carries a diagnostic or readiness state saying the prompt is
  not authored yet;
- execution/materialization does not create a spec until the authored draft
  exists;
- final/root spec creation remains blocked while the dependency is not a real
  imported asset.

### No Studio-Side Pricing

Studio must continue to render core's report:

- no final-video-only fallback when a graph exists;
- no hardcoded image prices;
- no model-price tables in React;
- no price inference from card type.

The core graph must provide the numeric total.

### No Fake Files Or Compatibility Layers

The fix must not:

- create fake project-relative files;
- add placeholder asset rows;
- fabricate provider input files;
- keep old dependency id aliases;
- add wrapper/facade modules to preserve obsolete paths;
- add fallback branches for old estimate fields.

A typed price-only dependency request is allowed only if it is explicit,
documented, and tested. It is not a generated spec and cannot be materialized.

## Implementation Plan

### Slice 1: Repair Dependency Pricing Semantics

Add a graph-level way to represent priced-but-not-materializable generated
dependencies.

Implementation details:

- Keep `MediaGenerationDependencyPricing` as the source of price state.
- Add an explicit materialization/readiness field to dependency nodes or plan
  lines, for example:
  - `materializationState: "ready" | "needs-authored-draft" | "needs-import"`.
- Do not encode prompt readiness as `state: "missing"` when the node is still
  priceable.
- Keep `state: "missing"` for truly unresolvable dependencies:
  - manual attachment missing;
  - invalid selector result;
  - missing generation target;
  - missing draft builder for a dependency purpose that cannot provide pricing.
- For shot input dependencies without authored drafts, estimate from a
  purpose-owned price-only request:
  - purpose;
  - target;
  - default dependency model;
  - default dependency parameters;
  - output count;
  - media kind.
- Record a diagnostic such as
  `CORE_MEDIA_DEPENDENCY_DRAFT_REQUIRED_BEFORE_MATERIALIZATION` on the node.
- Ensure this diagnostic is not treated as an estimate-blocking error.

### Slice 2: Complete Shared Dependency Declarations

Move dependency declaration into the shared purpose registry path.

Implementation details:

- Add `dependency-declaration-registry.ts` if keeping declarations separate from
  purpose definitions is clearer.
- Add `declareDependencies` for `shot.video-take` in the purpose registry.
- Ensure `planMediaGenerationDependencies` can plan a `shot.video-take` spec
  through the same graph path as `cast.profile`.
- Keep shot-video route policy in a focused shot dependency module, not in the
  generic graph.
- Delete duplicate shot-local declaration logic once the shared declaration is
  active.
- Preserve direct caller updates; do not add compatibility aliases.

### Slice 3: Complete Asset Selectors

Make selectors deterministic, structured, and shared.

Implementation details:

- Implement `shot-video-input` selector for:
  - `first-frame`;
  - `last-frame`;
  - `reference-image`;
  - `multi-shot-storyboard-sheet`.
- Ensure the selector can resolve imported shot input records by production
  group, shot ids, dependency kind, subject kind, and subject id.
- Replace `firstImageAssetForTarget` with explicit deterministic selector
  behavior:
  - exactly one selected/default asset satisfies a single-card dependency;
  - multiple selected matches produce structured diagnostics;
  - selected asset with no image file produces structured diagnostics;
  - location environment sheet must resolve the composite image file;
  - Lookbook sheet must resolve its selected sheet image.
- Return selector diagnostics alongside selector results.
- Ensure selector diagnostics can make the graph `unavailable` when required.

### Slice 4: Make References Projection Graph-First

Replace hybrid section reconstruction with graph-first projection.

Implementation details:

- Build General reference choices from graph nodes and existing graph-backed
  candidates.
- Build Lookbook choices from graph nodes and existing graph-backed candidates.
- Build Cast Character Sheets from graph nodes and existing graph-backed
  candidates.
- Build Location Sheets And Views from graph nodes and existing graph-backed
  candidates.
- Do not create a priced/selected card unless there is a graph node or a
  graph-backed candidate.
- If scene-scope cast/location data is shown for selection context, keep it
  separate from generated-dependency pricing.
- Ensure First Frame and Last Frame cards show their graph node prices when
  selected and not generated.
- Ensure every visible selected planned card has:
  - `dependencyNodeId`;
  - `planLineId`;
  - `purpose`;
  - `pricing`;
  - diagnostics.

### Slice 5: Repair AI Production Total

Fix core so AI Production receives a numeric graph total in the unprepared UI
state.

Implementation details:

- Ensure first-frame, last-frame, reference bundle, and multi-shot storyboard
  dependencies are priced even before generated assets exist.
- Ensure the graph estimate is `complete` or `partial` when all runnable
  generation nodes are priced and no required manual attachment is missing.
- Do not return `unavailable` merely because a dependency prompt still needs to
  be authored before materialization.
- Keep `displayEstimateTotal` simple and graph-driven.
- Add tests that fail if Studio falls back to the final-video-only total when a
  graph total exists.

### Slice 6: Materialization Safety

Keep generation safety stricter than estimate display.

Implementation details:

- Spec creation must still fail while a required generated dependency is not an
  imported asset.
- Dependency spec materialization must fail while an authored dependency draft
  is missing.
- Graph execution levels should include only materializable generated
  dependency nodes.
- Price-only nodes should be visible and priced but not executable.
- Final/root nodes should not become executable until required dependencies are
  real assets.

### Slice 7: Coverage Tooling And Reporting

Add a coverage report path before claiming the >95% target.

Implementation details:

- If approved, add Vitest coverage tooling to the relevant packages.
- Add focused coverage scripts:
  - `coverage:core`;
  - `coverage:studio`;
  - optionally `coverage:dependency-estimates` for the high-risk slice.
- Configure thresholds for changed/high-risk files first:
  - statements: 95%;
  - branches: 95%;
  - functions: 95%;
  - lines: 95%.
- Report full numbers after implementation.
- If whole-package 95% is not immediately realistic because of unrelated legacy
  files, enforce 95% on the touched dependency graph, shot-video estimate, and
  reference projection modules, then report package-level numbers honestly.

### Slice 8: Replace The Core-Only Estimate Matrix With E2E AI Production Tests

Build a new comprehensive estimate matrix that starts at the browser-facing
client/service layer and reaches engines pricing through the real Studio server
route and core service.

Implementation details:

- Add a Studio integration/e2e test file for the AI Production estimate route,
  for example:
  - `packages/studio/server/routes/ai-production-estimate-e2e.test.ts`; or
  - `packages/studio/tests/e2e/ai-production-estimate-matrix.test.ts` if a
    package-level e2e folder is clearer.
- Use a real temp Renku config/home directory.
- Use `createProjectDataService()` and `createSampleMovieProject()`.
- Mount the real Hono screenplay route with the real project data service and a
  no-op auth middleware.
- Call the same request shape that the browser client sends:
  - `POST /:projectName/screenplay/scenes/:sceneId/video-take-production/estimate`;
  - request body contains a `productionGroup` representing the user's current
    AI Production selections.
- Do not mock:
  - browser service serialization;
  - Studio route handlers;
  - project data service methods;
  - core planning;
  - engines estimate calls.
- Simulate user selections at the browser-client boundary by constructing the
  `productionGroup.videoTakeProduction` payload the UI would send after the
  user selects:
  - input intent;
  - model;
  - relevant model parameters;
  - prepared inputs or unprepared state.
- No visual browser automation is required for the matrix. The test begins at
  the browser client/server request boundary, not at DOM clicks.
- Every matrix case must assert the route response deeply:
  - HTTP status;
  - selected input mode;
  - selected model;
  - shot group mode;
  - provider model;
  - normalized route settings;
  - final estimate provider/model/billable units;
  - final estimate cost;
  - graph estimate total;
  - dependency line count;
  - dependency line total;
  - final line price;
  - issues/diagnostics state;
  - response JSON contains no obsolete `estimateLines` or nullable `cost`.
- The matrix must cover at least the same combinations as
  `shot-video-take-estimate-matrix.test.ts` before that file is removed.
- Delete `packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts`
  only after the new e2e matrix is green and the route/model coverage assertion
  proves all engines catalog routes are represented.

## No-Mock Test Matrix

The tests added for this repair should use real core services, real temp
projects, real Hono request handling where applicable, and real engine estimate
logic. Do not add tests that mock `estimateGeneration`, Studio services, or
project data service methods for this regression.

### Core Graph Estimate Tests

Add or expand no-mock tests under `packages/core/tests/integration`.

#### First / Last Frame Priceability

Cases:

- single-shot `first-frame`, no asset, no authored dependency draft:
  - dependency node exists for `first-frame`;
  - dependency pricing is `priced`;
  - materialization readiness says prompt/draft is required;
  - graph total includes first-frame dependency plus final video;
  - final spec creation remains blocked.
- single-shot `first-last-frame`, no assets, no authored dependency drafts:
  - dependency nodes exist for `first-frame` and `last-frame`;
  - both nodes are priced;
  - graph total includes both image dependency prices plus final video;
  - AI Production-equivalent plan total is numeric.
- multi-shot `first-last-frame`, no assets, no authored dependency drafts:
  - same as above;
  - production group id and shot ids are stable in dependency ids.
- `first-frame` with authored draft:
  - dependency is priced;
  - materialization readiness is materializable;
  - draft spec is present.
- `first-frame` with imported asset:
  - dependency resolves to `existing-asset`;
  - pricing is `$0.00`;
  - graph total excludes generated first-frame cost.

#### Reference Bundle Priceability

Cases:

- `reference` mode with missing cast, missing location, and active Lookbook:
  - cast dependency is `cast.character-sheet`, priced;
  - location dependency is `location.environment-sheet`, priced;
  - Lookbook dependency is priced or reused according to selected asset state;
  - total includes all generated dependencies plus final video.
- `reference` mode without authored final prompt:
  - final video estimate uses estimate placeholder only for pricing;
  - dependency estimates remain numeric;
  - materialization remains blocked.
- provider reference inputs optional:
  - product reference bundle still appears in graph;
  - optional provider slot does not suppress product dependency policy.

#### General Reference Cards

Cases:

- First Frame planned node projects into a General card with:
  - `dependencyNodeId`;
  - `planLineId`;
  - `purpose: "shot.first-frame"`;
  - priced `pricing`;
  - selected state.
- Last Frame planned node projects into a General card with the same fields.
- First Frame imported asset projects as `selected-ready` with `$0.00`.
- Last Frame imported asset projects as `selected-ready` with `$0.00`.
- A planned but not materializable first/last frame card does not render as
  `not-applicable`.

#### AI Production Total

Cases:

- First + Last Frame UI setup with no generated inputs and no drafted prompts:
  - core estimate report has numeric `plan.estimate.estimatedTotalUsd`;
  - total equals dependency image prices plus final video price;
  - `estimate.estimate.estimatedCostUsd` remains the final video price only;
  - `plan.estimate.estimatedTotalUsd` is greater than final video price.
- Same case with one generated first frame reused:
  - total equals `$0.00` reused first frame plus generated last frame plus final
    video.
- Same case with both generated inputs reused:
  - total equals final video only.
- Same case with unpriced dependency route:
  - plan state is `partial`;
  - total is the priced subtotal;
  - override is required;
  - UI must not show a fake complete total.

### Shared Selector Tests

Add no-mock integration tests for selectors.

Cases:

- cast character sheet:
  - no asset -> planned priced generation;
  - one valid selected asset -> `$0.00`;
  - multiple selected assets -> structured diagnostic;
  - selected asset with no image file -> structured diagnostic.
- location environment sheet:
  - no asset -> planned priced generation;
  - selected composite image -> `$0.00`;
  - missing composite image -> structured diagnostic;
  - selected view files do not replace the composite dependency unless the
    dependency kind explicitly asks for a view.
- lookbook sheet:
  - no sheet -> planned priced generation;
  - selected/default sheet -> `$0.00`;
  - sheet without image file -> structured diagnostic.
- shot video inputs:
  - selected first frame -> `$0.00`;
  - selected last frame -> `$0.00`;
  - selected reference image -> `$0.00`;
  - selected multi-shot storyboard sheet -> `$0.00`;
  - selection from another production group -> structured diagnostic.

### Generic Registry Tests

Add no-mock tests proving shared architecture is not shot-local.

Cases:

- every dependency kind has a registered selector;
- every dependency kind with `plan-generation` has a registered generation
  purpose;
- every dependency generation purpose has either:
  - a materializable dependency draft builder; or
  - a deliberate price-only estimate path plus materialization gate.
- `planMediaGenerationDependencies` works for:
  - `cast.profile`;
  - `shot.video-take`.
- generic graph execution levels exclude price-only nodes from executable
  materialization levels.
- cycles produce structured diagnostics.

### Studio Server No-Mock Tests

Add route integration tests that mount the Hono route with a real
`createProjectDataService()` and a temp project.

Cases:

- `/video-take-production/estimate` returns a graph total for first-last-frame
  with no generated inputs and no authored prompts.
- `/video-take-production/plan` returns First Frame and Last Frame reference
  card pricing in the serialized plan report.
- serialized plan total matches core's graph total exactly.
- route does not strip dependency node pricing, readiness diagnostics, or
  plan-line ids.

### AI Production E2E Estimate Matrix

Add a full end-to-end matrix that replaces
`packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts`.

Scope:

- intent/input modes:
  - `text-only`;
  - `first-frame`;
  - `first-last-frame`;
  - `reference`.
- shot group modes:
  - `single-shot`;
  - `multi-shot`.
- every current shot-video model route exposed by
  `listShotVideoModelFamilies()`.
- relevant model parameters for every model family:
  - Seedance duration, aspect ratio, resolution, audio, seed;
  - Kling duration, aspect ratio where applicable, audio, cfg scale;
  - Veo duration, aspect ratio where applicable, resolution, audio, auto-fix;
  - Grok duration and resolution;
  - LTX duration, aspect ratio, audio, resolution, fps;
  - Happy Horse duration, aspect ratio where applicable, resolution, safety,
    seed.
- prepared-input state:
  - all required inputs prepared;
  - no generated inputs prepared;
  - partial prepared inputs for first/last frame routes.
- dependency-authoring state:
  - authored dependency drafts where materialization should be possible;
  - no authored dependency drafts where estimates should still be priceable but
    materialization should remain blocked.

Required top-level tests:

- `covers every current shot video model route exposed by engines through the Studio estimate route`
  - compare catalog route keys from `listShotVideoModelFamilies()` to matrix
    route keys.
- `prepared input cases estimate final video creation only through the browser-to-server path`
  - no dependency generation lines;
  - graph total equals final video cost.
- `unprepared input cases return a numeric graph total through the browser-to-server path`
  - dependency lines appear;
  - graph total equals final video cost plus generated dependency costs.
- `run setup parameter permutations return exact engine-backed totals through the Studio route`
  - replicate the current run setup permutations from the core matrix.
- `no-draft first/last-frame cases still return estimates through the Studio route`
  - dependency lines are priced;
  - materialization readiness says authored draft is required;
  - graph estimate is not unavailable.
- `response shape is the UI contract`
  - assert all fields consumed by AI Production are present;
  - assert obsolete fields are absent;
  - assert no card-local/null-cost estimate path exists.

Assertions per case:

- response status is `200`;
- `estimate.inputModeId` equals the selected intent;
- `estimate.modelChoice` equals the selected model;
- `estimate.shotGroupMode` equals the selected shot group mode;
- `estimate.plan.request.routeSettings` equals expected normalized settings;
- `estimate.estimate.provider` is `fal-ai`;
- `estimate.estimate.model` equals expected provider model;
- `estimate.estimate.billableUnits` equals expected billable units;
- `estimate.estimate.estimatedCostUsd` equals expected final video estimate;
- dependency generation lines have expected count;
- dependency generation lines all have explicit pricing state;
- priced dependency subtotal equals expected dependency cost;
- final video line is priced and equals expected final video estimate;
- `estimate.plan.estimate.estimatedTotalUsd` equals expected full graph total;
- `estimate.plan.estimate.requiresPriceOverride` matches expected pricing state;
- diagnostics are empty for valid priceable cases;
- no obsolete `estimateLines` field exists;
- no input card uses a nullable `cost` field.

Deletion rule:

- Do not delete `shot-video-take-estimate-matrix.test.ts` until the new e2e
  matrix contains all current cases and passes.
- When deleting it, remove the `test:shot-video-estimates` script or retarget it
  to the new e2e matrix directly. Do not leave a stale script.

### Studio Rendering Tests

Prefer rendering pure components with real serialized reports from core
fixtures. Avoid mocked service modules for this regression.

Cases:

- `SceneShotAiProductionTab` displays the graph total when:
  - final video estimate exists;
  - graph total is larger than final estimate;
  - dependency prompts are not authored yet.
- `SceneShotAiProductionTab` displays `-` only when core says the graph total is
  unavailable because of a true required attachment or invalid selector result.
- `SceneShotReferencesTab` displays First Frame and Last Frame prices from card
  `pricing`.
- `SceneShotReferencesTab` does not display a planned selected dependency card
  without `dependencyNodeId` and `planLineId`.

Existing mocked tests can remain for broad interaction coverage, but they do
not count toward the no-mock coverage target for this regression.

### Browser Verification

After implementation:

- run the Studio dev server;
- open the Urban Basilica shot from the screenshot or an equivalent fixture;
- verify the References tab shows prices for General First Frame and Last
  Frame when they are planned;
- verify the AI Production tab shows a numeric Estimated Total for First + Last
  Frame before generated assets exist;
- verify switching to Reference mode shows cast, location, Lookbook, and final
  video costs from the same graph total;
- verify no mobile viewport work is reported.

## Test Coverage Target

The target is more than 95% coverage for the changed/high-risk surface:

- `dependency-kind-registry.ts`;
- `dependency-asset-selectors.ts`;
- `dependency-draft-specs.ts`;
- `dependency-graph.ts`;
- `dependency-plan-lines.ts`;
- new shot dependency declaration/projection modules;
- touched estimate and reference projection functions in `shot-video-take.ts`;
- AI Production total selection logic;
- References tab card pricing rendering.

Coverage must include:

- line coverage;
- branch coverage;
- function coverage;
- statement coverage.

The final implementation report must include:

- exact coverage command;
- exact coverage percentages;
- focused test command results;
- any files below threshold with explanation;
- whether package-level coverage is above or below 95%;
- whether changed-file coverage is above or below 95%.

## Acceptance Criteria

- First Frame and Last Frame planned cards show graph-backed prices in the
  References tab.
- AI Production shows a numeric graph total for priceable unprepared
  dependencies.
- Missing authored dependency prompts do not make the estimate unavailable.
- Missing authored dependency prompts still block dependency spec
  materialization.
- Missing imported dependency assets still block final/root spec creation.
- The graph total includes generated dependencies plus final/root generation.
- The final-video-only estimate is not used as a fallback total when a graph
  exists.
- Cast, location, Lookbook, first-frame, last-frame, reference-image, and
  multi-shot storyboard dependencies all use the same graph pricing semantics.
- Existing assets satisfy graph slots at `$0.00`.
- Missing selected asset files and ambiguous selected assets produce structured
  diagnostics.
- `shot.video-take` can be planned through the generic shared dependency graph
  path.
- References tab cards are graph-first projections.
- No new raw HTML interactive controls are added to `packages/studio`.
- No mocks are used in the new core/server regression tests.
- The AI Production estimate matrix runs end-to-end through the browser-client
  request shape, Studio Hono route, core, and engines with no mocked estimate
  path.
- The new e2e estimate matrix covers every route currently covered by
  `shot-video-take-estimate-matrix.test.ts`.
- `shot-video-take-estimate-matrix.test.ts` is deleted only after the e2e matrix
  replaces its coverage completely.
- Coverage for changed/high-risk files is above 95%, or implementation does
  not ship.

## Completion Checklist

### Review And Scope

- [x] Confirm this plan supersedes the unfinished portions of `0060`.
- [x] Confirm `0060` should remain historical/current context rather than being
  silently edited to look complete.
- [x] Confirm no Studio-side pricing is introduced.
- [x] Confirm no final-video-only fallback total is introduced.
- [x] Confirm no fake project files, asset files, URLs, or provider inputs are
  introduced.
- [x] Confirm no compatibility aliases or re-export stubs are introduced.
- [x] Confirm no package installation happens without explicit approval.

### Contracts And Semantics

- [x] Add a graph/node/line field for materialization readiness, or an
  equivalent explicit contract.
- [x] Represent priced-but-not-materializable dependencies without making the
  graph estimate unavailable.
- [ ] Add structured diagnostics for dependencies that need authored drafts
  before materialization.
- [x] Keep truly missing required attachments as estimate-unavailable.
- [x] Keep unpriced generated dependencies as partial with override required.
- [x] Update client contracts directly and update all callers.

### Shared Dependency Architecture

- [x] Add or complete dependency declaration registry behavior.
- [x] Register `shot.video-take` dependency declaration in the shared purpose
  architecture.
- [x] Make `planMediaGenerationDependencies` work for `shot.video-take`.
- [x] Keep shot-video route policy in a focused purpose-owned module.
- [ ] Remove duplicated local declaration code after shared declaration is used.
- [x] Ensure `cast.profile` still uses the same shared path.

### Asset Selectors

- [x] Implement shared `shot-video-input` selector.
- [x] Implement deterministic cast character sheet selector diagnostics.
- [ ] Implement deterministic location environment sheet selector diagnostics.
- [ ] Implement deterministic Lookbook sheet selector diagnostics.
- [x] Report ambiguous selected assets as structured diagnostics.
- [x] Report missing selected asset files as structured diagnostics.
- [x] Resolve reused assets at `$0.00`.

### Shot Input Dependency Pricing

- [x] Price missing first-frame dependencies without authored drafts.
- [x] Price missing last-frame dependencies without authored drafts.
- [x] Price missing reference-image dependencies without authored drafts when
  applicable.
- [x] Price missing multi-shot storyboard dependencies without authored drafts.
- [x] Prevent materialization of those dependency specs until authored drafts
  exist.
- [x] Preserve authored-draft behavior when drafts exist.

### Reference Projection

- [x] Project General references from graph nodes.
- [ ] Project Lookbook references from graph nodes.
- [ ] Project Cast Character Sheets from graph nodes.
- [ ] Project Location Sheets And Views from graph nodes.
- [x] Ensure every selected planned reference card has graph pricing.
- [x] Ensure no selected planned card renders with `not-applicable` pricing
  when the dependency is priceable.
- [x] Ensure First Frame and Last Frame cards show prices in the screenshot
  state.
- [ ] Keep non-selected scene-scope choices visually quiet and not priced unless
  graph-backed.

### AI Production

- [x] Ensure graph total is numeric for priceable unprepared first/last frame
  dependencies.
- [x] Ensure graph total is greater than final-video-only estimate when
  dependencies must be generated.
- [x] Ensure UI displays graph total.
- [ ] Ensure UI displays `-` only for genuinely unavailable graph totals.
- [ ] Add rendering coverage for graph total vs final estimate.

### No-Mock Core Tests

- [x] Add no-draft first-frame estimate test.
- [x] Add no-draft first-last-frame estimate test.
- [x] Add imported first/last frame `$0.00` reuse tests.
- [ ] Add reference-bundle planned/reused matrix tests.
- [x] Add selector ambiguity diagnostics tests.
- [x] Add missing asset file diagnostics tests.
- [x] Add `planMediaGenerationDependencies` shot-video test.
- [x] Add materialization gate tests for price-only dependency nodes.

### No-Mock Server/UI Tests

- [x] Add real-project Hono estimate route test.
- [x] Add real-project Hono plan route test.
- [x] Add serialized First/Last Frame pricing assertions.
- [ ] Add AI Production render test using real serialized reports, not mocked
  service modules.
- [ ] Add References render test using real serialized reports, not mocked
  service modules.

### AI Production E2E Estimate Matrix

- [x] Add real-project e2e estimate matrix through the Studio Hono route.
- [x] Simulate user selections by sending browser-client-shaped
  `productionGroup.videoTakeProduction` payloads.
- [x] Cover every engines catalog shot-video route.
- [x] Cover single-shot and multi-shot group modes.
- [x] Cover every supported input intent per model.
- [x] Cover prepared-input final-video-only cases.
- [x] Cover unprepared-input generated-dependency cases.
- [x] Cover no-authored-draft priceable dependency cases.
- [x] Cover Seedance run setup parameter permutations.
- [x] Cover Kling run setup parameter permutations.
- [x] Cover Veo run setup parameter permutations.
- [x] Cover Grok run setup parameter permutations.
- [x] Cover LTX run setup parameter permutations.
- [x] Cover Happy Horse run setup parameter permutations.
- [x] Assert normalized route settings for every case.
- [x] Assert provider model and billable units for every case.
- [x] Assert final estimate, dependency subtotal, and graph total for every
  case.
- [x] Assert dependency line counts and pricing states for every case.
- [x] Assert obsolete estimate/card fields are absent from serialized responses.
- [x] Retarget or delete `test:shot-video-estimates` after the e2e replacement
  passes.
- [x] Delete `packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts`
  only after coverage parity is proven.

### Coverage And Verification

- [ ] Add or enable coverage tooling after approval if necessary.
- [x] Run focused core tests.
- [x] Run focused Studio tests.
- [ ] Run coverage for changed/high-risk files.
- [ ] Confirm changed/high-risk coverage is above 95%.
- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --filter @gorenku/studio test`.
- [x] Run package typecheck commands for touched packages.
- [x] Run lint for touched packages.
- [ ] Browser-verify References tab prices.
- [ ] Browser-verify AI Production estimated total.
- [x] Report all commands and coverage status in the final implementation
  summary.
