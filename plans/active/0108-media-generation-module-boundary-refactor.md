# 0108 Media Generation Module Boundary Refactor

Status: completed
Date: 2026-07-04

## Summary

`docs/architecture/module-boundary-investigation.md` found that several real
architecture rules are currently difficult to enforce because the code does not
express those rules as stable module boundaries.

The earlier cleanup correctly removed brittle static tests that scanned source
text for current helper names, private file names, and partial path strings.
Those tests were trying to protect important behavior, but they were protecting
it through unstable implementation details.

This plan creates the missing boundaries first, then adds architecture tests
that check folder ownership and public contract shape instead of today's helper
names.

The target outcome is:

- Core cost estimation is a visible cost module, separate from readiness,
  dependency availability, provider payload preparation, generation runs, and
  durable mutation.
- Engine pricing is a visible pricing module, separate from engine execution,
  provider payload validation, input-file loading, SDK handoff, and output
  persistence.
- Shot Video Take is split into named submodules with explicit ownership for
  authoring, planning, reference/input selection, spec preparation, provider
  preparation, runs, imports, and durable take persistence.
- The shared media-generation lifecycle, purpose registries, dependency
  contracts, and purpose implementations have clear dependency direction.
- Architecture tests can say "this module must not import that module" instead
  of "this file must not mention this private function."

This is a refactor plan. It should not change product behavior, persisted
project data, CLI command names, Studio user workflows, generation approval
semantics, or provider pricing math except where the refactor exposes an
existing bug that must be fixed inside the correct owning module.

## References Reviewed

- `docs/architecture/module-boundary-investigation.md`
- `docs/architecture/architecture-test-registry.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `plans/active/0104-generation-cost-estimate-architecture-reset.md`
- `plans/active/0107-single-generation-approval-token-simplification.md`
- `packages/core/src/server/architecture.test.ts`
- `packages/core/src/server/media-generation/shared-generation-service.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`
- `packages/core/src/server/media-generation/estimation/cost-projection.ts`
- `packages/core/src/server/media-generation/estimation/spec-estimates.ts`
- `packages/core/src/server/media-generation/shot-video-take`
- `packages/engines/src/generation`

## Problem Statement

The current behavior is closer to the desired architecture than the filesystem
shape suggests. Recent work already separated cost projection from readiness and
made approval a single-run Core gate. The remaining problem is that the modules
still make the boundaries too easy to blur.

Examples:

- `packages/core/src/server/media-generation/estimation` is the current cost
  rail, but it sits next to and imports through a purpose registry that also
  imports preparation, validation, run, import, and dependency modules. A direct
  import check cannot cleanly prove that cost code is independent from readiness
  code.
- `packages/engines/src/generation/estimates.ts` is a pricing API, but it is a
  peer of runner, provider-payload validation, logical provider-payload
  construction, input-file payload handling, model discovery, and request
  hashing. A pricing-purity test has to know too much about current file names.
- `packages/core/src/server/media-generation/shot-video-take` contains many
  focused files, but they are all siblings. Reviewers can learn the intended
  ownership by reading the files, but the folder structure does not show which
  imports would cross a domain boundary.
- The shared purpose registry currently combines lifecycle orchestration,
  purpose implementation wiring, dependency declarations, cost projection, run
  behavior, and import behavior into one contract. That makes it hard for cost
  and readiness to depend on separate public contracts.

The implementation risk is not that a single helper has the wrong name. The
risk is that a future change can accidentally make estimates prepare generation,
make pricing inspect provider payloads, make planning run providers, or make an
adapter reach into take-state internals. The code needs boundaries that make
those mistakes mechanically visible.

## Non-Goals

This plan does not:

- change the CLI command surface;
- change Studio routes or visible UI behavior;
- change persisted media generation spec schemas;
- add database migrations;
- add compatibility aliases, compatibility wrappers, or re-export facades for
  old import paths;
- create graph execution or dependency auto-generation;
- change single-run approval token semantics from
  `docs/decisions/0043-use-single-generation-approval-tokens.md`;
- validate prompt text, generated media contents, prompt-sheet panel structure,
  or any other opaque AI artifact content;
- move business rules into Studio server routes, CLI handlers, or React feature
  code;
- add static tests that hard-code private helper names, implementation function
  names, local variable names, or complete command/service inventories.

When files move, update callers directly and delete the old path in the same
slice. Do not leave root-level forwarding files behind to preserve old imports.

## Naming Decisions

Use these module names:

- `cost`: Core cost projection, cost plans, cost approval parsing/checking, and
  purpose cost registries.
- `readiness`: validation and preparation facts that determine whether real
  generation can run. This is a responsibility boundary expressed through
  `lifecycle`, `dependencies`, and purpose-owned `planning`, `specs`, and
  `provider` modules, not a planned top-level `readiness` folder.
- `lifecycle`: shared media-generation orchestration for context, model list,
  spec persistence, readiness preparation, run, import, and dependency planning.
- `dependencies`: shared dependency declarations, dependency ids, dependency
  selectors, readiness inventory, and dependency line projections.
- `pricing`: engine-side price calculation and cost approval hashing.
- `execution`: engine-side provider request construction, provider validation,
  input-file loading, SDK handoff, run receipts, and output persistence.
- `catalog`: engine-side model catalog loading and model lookup that can be used
  by both pricing and execution.
- `authoring`: Shot Video Take user-editable direction, authoring context, and
  authoring apply/validate behavior.
- `planning`: Shot Video Take production planning, dependency declarations,
  readiness reports, and planning projections.
- `selection`: Shot Video Take durable reference/input selection commands.
- `specs`: Shot Video Take generation spec validation, creation, update,
  listing, draft preparation, and final spec construction.
- `provider`: Shot Video Take provider payload preparation and mechanical
  provider setup needed by the final provider request.
- `runs`: Shot Video Take live/simulated run orchestration and run recording.
- `imports`: Shot Video Take media import behavior.
- `persistence`: Shot Video Take durable take records, take state, take shot
  membership, and focused take-state mutation helpers.

Avoid these names for new modules:

- `utils`, `helpers`, `common`, `manager`, `data`, `item`, `detail`, and
  `misc`, because they do not express ownership.
- `graph` for cost planning, because dependency cost plans are to-do-list
  projections, not execution graphs.
- `validation` in cost module names, because cost may check whether pricing
  inputs exist but must not validate generation readiness.

## Target Module Shape

### Core Media Generation

Target server layout:

```text
packages/core/src/server/media-generation/
  cost/
    cost-approval.ts
    dependency-cost-plan.ts
    purpose-cost-projections.ts
    purpose-cost-registry.ts
    spec-cost.ts
  dependencies/
    dependency-draft-specs.ts
    dependency-identifiers.ts
    dependency-inventory.ts
    dependency-inventory-lines.ts
    dependency-kind-registry.ts
    dependency-selectors.ts
    dependency-slot-definitions.ts
  lifecycle/
    context-service.ts
    dependency-service.ts
    model-service.ts
    purpose-lifecycle-registry.ts
    run-service.ts
    spec-service.ts
  purposes/
    cast-character-sheet.ts
    cast-profile.ts
    cast-voice-sample.ts
    location-environment-sheet.ts
    location-hero.ts
    lookbook-image.ts
    lookbook-sheet.ts
    scene-dialogue-audio.ts
    scene-storyboard-sheet.ts
    shot-video-take/
      authoring/
      imports/
      persistence/
      planning/
      provider/
      runs/
      selection/
      shared/
      specs/
```

The exact file names may change during implementation when a clearer domain name
appears, but the module boundaries above are the intended public architecture.
Renaming a private helper inside one of those folders must not require an
architecture-test edit.

The old root-level media-generation files are not compatibility paths. After the
move, callers should import from the new owning module and the old files should
be deleted.

### Core Cost Boundary

`media-generation/cost` owns:

- spec-record and draft estimate behavior once the caller already has the spec
  in memory;
- purpose cost projections from spec fields to `GenerationPriceKey` and
  `GenerationPricingInputs`;
- dependency cost plan construction for the full to-do list;
- single-run cost approval parsing and checking;
- conversion from engine `GenerationCostEstimate` into client-visible cost line
  pricing states.

Persisted-spec estimate command behavior is split: `media-generation/lifecycle`
reads the persisted spec record from project storage, then delegates the
in-memory spec record to `media-generation/cost`. This keeps low-level database
access out of cost while preserving the public estimate command.

`media-generation/cost` may import:

- browser-safe client contracts from `packages/core/src/client`;
- structured diagnostics;
- the engine pricing API and pricing contracts;
- pure purpose cost projection modules;
- pure dependency declaration contracts needed to know which generated
  dependency purposes may appear in a cost plan.

`media-generation/cost` must not import:

- lifecycle readiness services;
- spec preparation services;
- provider payload construction;
- provider payload validation;
- generation run services;
- media import services;
- project file resolution for provider upload/input files;
- dependency selectors that resolve concrete project assets;
- low-level database access;
- Shot Video Take provider, run, import, or persistence submodules.

Important registry split:

The current all-purpose `purpose-registry.ts` imports readiness and run
implementations, so the cost rail cannot safely depend on it. Split this into:

- `cost/purpose-cost-registry.ts`, which imports only cost projection functions;
- `lifecycle/purpose-lifecycle-registry.ts`, which imports readiness, context,
  model list, spec, run, dependency declaration, and import behavior.

Add a runtime registry-shape test that compares the purpose ids registered in
the cost registry and lifecycle registry. The test should compare public purpose
ids from the registries; it must not list private file names or helper names.

### Core Lifecycle And Dependencies Boundary

`media-generation/lifecycle` owns shared orchestration:

- building purpose context reports;
- listing models;
- validating specs through the owning purpose implementation;
- creating and updating persisted specs;
- reading/listing persisted specs;
- preparing persisted and draft specs for readiness;
- planning dependency readiness;
- running one persisted spec after Core cost approval succeeds;
- importing media through the owning purpose implementation.

`media-generation/dependencies` owns shared dependency infrastructure:

- dependency id construction and parsing;
- dependency slot declarations and stable dependency kinds;
- deterministic selection against project assets;
- readiness inventory construction;
- dependency inventory line projection for CLI/Studio/client reports;
- dependency draft spec planning contracts that are not Shot Video Take specific.

Lifecycle may depend on cost to display or embed cost results. Cost must not
depend on lifecycle readiness services.

Dependency contracts that are safe for cost planning should be separated from
readiness selectors. For example, a cost plan may need to know that a missing
slot can be satisfied by `cast.character-sheet`; it must not resolve whether a
specific asset file exists on disk.

### Engines Generation

Target engine layout:

```text
packages/engines/src/generation/
  catalog/
    model-discovery.ts
  contracts.ts
  execution/
    input-file-payload.ts
    logical-provider-payload.ts
    provider-payload-validation.ts
    request-hash.ts
    runner.ts
  index.ts
  pricing/
    billable-units.ts
    cost-approval-hash.ts
    estimate-generation-cost.ts
    generation-pricing-registry.ts
    pricing-inputs.ts
```

`generation/pricing` owns:

- `estimateGenerationCost`;
- pricing-input normalization;
- missing-pricing-input detection;
- billable-unit projection;
- price-row matching;
- cost approval token hashing for cost estimates.

`generation/pricing` may import:

- generation pricing contracts;
- model catalog lookup and pricing facts;
- deterministic hashing utilities that do not know provider payload shape.

`generation/pricing` must not import:

- `generation/execution`;
- provider payload construction or validation;
- input-file payload handling;
- SDK modules;
- output persistence;
- Node filesystem APIs.

`generation/execution` owns:

- `runGeneration`;
- logical provider payload construction;
- provider payload validation;
- input file loading;
- SDK provider handoff;
- output writing;
- execution request hashes for receipts.

The package entrypoint may continue to re-export public engine APIs through
`generation/index.ts`, because that file is an intentional public module API,
not a compatibility facade. New internal modules should import from the owning
folder, not from `generation/index.ts`.

### Shot Video Take Submodules

Target Shot Video Take layout:

```text
packages/core/src/server/media-generation/purposes/shot-video-take/
  authoring/
    authoring.ts
    take-context.ts
    take-production-state.ts
    take-iteration.ts
  imports/
    media-imports.ts
  persistence/
    take-shot-membership.ts
    take-state.ts
    takes.ts
  planning/
    dependency-draft-specs.ts
    dependency-inventory.ts
    dependency-slots.ts
    dialogue-audio-references.ts
    preflight-report.ts
    production-plan.ts
    reference-card-plans.ts
    reference-inclusions.ts
    reference-scope.ts
    reference-sections.ts
    shot-input-dependencies.ts
    shot-input-references.ts
    storyboard-images.ts
  provider/
    generation-output-paths.ts
    kling-transient-voice.ts
    preflight-inputs.ts
    project-media-files.ts
    provider-payloads.ts
  runs/
    generation-runs.ts
  selection/
    input-policy.ts
    input-selection.ts
    reference-selection.ts
    reference-selection-mutations.ts
  shared/
    diagnostics.ts
    project-session.ts
    purpose-config.ts
    resource-keys.ts
    route-settings.ts
  specs/
    final-spec-construction.ts
    final-specs.ts
    input-specs.ts
    model-list.ts
    prompt-sheet-metadata.ts
    spec-records.ts
    spec-validation.ts
```

Ownership rules:

- `authoring` may read planning projections and persistence, but it must send
  durable mutations through focused persistence or selection commands.
- `planning` may read specs, shared route settings, and dependency contracts. It
  must not run providers, import media, or write durable take state.
- `selection` owns focused user-intent mutations for selected references and
  selected inputs. It may write through persistence, but it must not prepare
  provider payloads or run generation.
- `specs` owns generation spec validation and spec record lifecycle. It may call
  planning/readiness helpers when creating final specs, but it must not execute
  providers or import generated media.
- `provider` owns final provider payload preparation and mechanical provider
  setup, including Kling transient voice ids. It must not mutate durable take
  authoring state.
- `runs` owns run orchestration and recording. It may call provider preparation
  and engine execution after Core cost approval has passed. It must not own
  dependency planning rules or selected-reference mutation rules.
- `imports` owns attaching generated or external media to the take target. It
  must not decide provider readiness or generation cost.
- `persistence` owns durable take reads/writes and narrow mutation primitives.
  It must not know provider payload shape or pricing.

Do not add a `shot-video-take/index.ts` re-export barrel. Registry and lifecycle
callers should import the focused owner modules directly.

## Implementation Slices

### Slice 1: Record The Boundary Decision

Add an accepted decision after this plan is approved:

```text
docs/decisions/0044-use-media-generation-module-boundaries.md
```

The decision should state:

- cost and readiness are separate Core modules;
- engine pricing and execution are separate modules;
- Shot Video Take owns explicit submodules instead of a large sibling folder;
- static architecture tests must protect folder/module boundaries, not private
  implementation names;
- no compatibility import paths should remain after the move.

Update:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/architecture-test-registry.md`;
- `docs/architecture/module-boundary-investigation.md`, only to mark this plan
  and the ADR as the follow-up direction.

Do not rewrite historical plans except for current accepted references that
point readers at active architecture.

### Slice 2: Split Engine Pricing From Execution

Move engine pricing files into `packages/engines/src/generation/pricing`.

Move execution files into `packages/engines/src/generation/execution`.

Move model catalog loading used by both sides into
`packages/engines/src/generation/catalog`.

Keep `packages/engines/src/generation/contracts.ts` as the public generation
contract owner unless implementation shows that separate `contracts/pricing.ts`
and `contracts/execution.ts` files are clearer. If contracts are split, update
callers directly and keep package exports intentional through the public
`generation/index.ts` entrypoint.

Expected moves:

- `estimates.ts` becomes `pricing/estimate-generation-cost.ts`.
- pricing normalization and billable-unit helpers move into pricing-owned files
  when that makes the estimator smaller and reviewable.
- `generation-pricing-registry.ts` moves into `pricing`.
- cost approval hashing moves into `pricing/cost-approval-hash.ts`.
- `runner.ts`, `logical-provider-payload.ts`,
  `provider-payload-validation.ts`, `input-file-payload.ts`, and execution
  request hashing move into `execution`.
- `model-discovery.ts` moves into `catalog` if both pricing and execution need
  it.

Update all imports directly. Do not keep old forwarding files.

Add an engine architecture test that resolves import sources and fails when any
file in `generation/pricing` imports:

- `generation/execution`;
- `sdk`;
- Node filesystem modules;
- provider-payload validation;
- input-file payload handling;
- runner modules.

This test should name the module boundary and forbidden capability categories.
It must not name private pricing helper functions.

### Slice 3: Split Core Cost From Lifecycle Readiness

Create `packages/core/src/server/media-generation/cost`.

Move current cost projection behavior into this module:

- draft spec estimates;
- spec-record cost estimation;
- purpose cost projections;
- cost approval parsing/checking;
- cost estimate to dependency-line pricing projection.

Split the current purpose registry into:

- `cost/purpose-cost-registry.ts`;
- `lifecycle/purpose-lifecycle-registry.ts`.

Move purpose cost projection functions so the cost registry imports only cost
projection owners. For example, image-model pricing projection can be shared by
multiple purpose cost projection entries, but it must live in `cost`, not in a
readiness purpose module.

Update lifecycle services to call cost through cost module entrypoints.

Persisted spec estimate commands should live in lifecycle: read the persisted
spec record there, then delegate the spec record to cost.

Add a Core architecture test that resolves imports and fails when
`media-generation/cost` imports:

- `media-generation/lifecycle`;
- readiness preparation modules;
- provider modules;
- run modules;
- import modules;
- dependency selectors that resolve concrete assets;
- low-level database access;
- Node filesystem APIs.

The test may refer to stable folder names such as `cost`, `lifecycle`,
`dependencies`, `provider`, and `runs`. It must not search for current helper
function names such as private `prepare*` functions.

### Slice 4: Split Shared Lifecycle And Dependencies

Replace the large shared service file with focused lifecycle services:

- `lifecycle/context-service.ts`;
- `lifecycle/model-service.ts`;
- `lifecycle/spec-service.ts`;
- `lifecycle/dependency-service.ts`;
- `lifecycle/run-service.ts`.

Move shared dependency infrastructure into `media-generation/dependencies`.

The dependency module should separate:

- pure dependency contracts and slot declarations that cost planning may read;
- readiness inventory construction that resolves availability and selected
  project assets;
- dependency line projection for client/Studio/CLI reports;
- dependency draft spec planning contracts.

Update `ProjectDataService` wiring, CLI command handlers, Studio server routes,
and purpose lifecycle registry callers to use the new lifecycle entrypoints.

Keep adapter code thin. Studio server and CLI code should still call public Core
services and should not import purpose-private modules.

### Slice 5: Move Non-Shot Purpose Implementations Under `purposes`

Move existing non-shot purpose implementation files under
`media-generation/purposes`.

Initial target files:

- `cast-character-sheet.ts`;
- `cast-profile.ts`;
- `cast-voice-sample.ts`;
- `location-environment-sheet.ts`;
- `location-hero.ts`;
- `lookbook-image.ts`;
- `lookbook-sheet.ts`;
- `scene-dialogue-audio.ts`;
- `scene-storyboard-sheet.ts`.

Keep these files focused on their purpose-owned behavior:

- context;
- model listing;
- spec validation/create/update/list;
- readiness preparation;
- provider payload preparation when the purpose owns it;
- run behavior;
- import behavior;
- dependency declaration and dependency draft behavior when applicable.

Cost projection code should already have moved out to the cost module in Slice
3, so purpose files do not become hidden cost dependencies.

### Slice 6: Split Shot Video Take Into Submodules

Move Shot Video Take files into the target submodules named above.

Suggested order:

1. Move `shared` files first, because many submodules depend on diagnostics,
   route settings, purpose config, resource keys, and project session helpers.
2. Move `persistence` files next, so selection, authoring, specs, and runs can
   depend on focused durable state operations.
3. Move `selection`, preserving runtime tests for reference selection and input
   selection mutations.
4. Move `planning`, preserving dependency inventory, production plan, reference
   section, and preflight report tests.
5. Move `specs`, preserving input spec, final spec, and spec-validation tests.
6. Move `provider`, preserving provider payload and Kling transient voice tests.
7. Move `runs` and `imports`, preserving run and media import tests.
8. Update lifecycle registry imports to use the new owner modules directly.

After the move, add a Shot Video Take import-boundary test with these rules:

- `planning` must not import `provider`, `runs`, or `imports`;
- `planning` must not import persistence write modules except through explicit
  read-only contracts if those are introduced;
- `selection` must not import `provider`, `runs`, or `imports`;
- `provider` must not import `selection` mutation modules or persistence write
  commands;
- `imports` must not import `provider` or `runs`;
- `persistence` must not import `provider`, `runs`, `imports`, engine
  execution, or engine pricing;
- no caller imports a removed root-level `shot-video-take` compatibility path.

If a legitimate dependency violates one of these proposed rules, redesign the
submodule split before weakening the test. The point of this slice is to make
ownership visible, not to encode the old sibling-folder relationships.

### Slice 7: Update Documentation And Architecture Registry

Update `docs/architecture/architecture-test-registry.md` with new registered
boundaries:

- Core media generation cost rail;
- engines generation pricing rail;
- Shot Video Take submodule direction;
- media generation lifecycle and dependency ownership.

Each registry entry should answer:

- which package owns the domain rule;
- what static import boundary protects it;
- what runtime tests still prove data-integrity behavior;
- what normal refactors must remain allowed without editing the architecture
  test.

Update media-generation architecture docs with the new folder ownership and
call-flow shape.

Add a short note to `docs/architecture/module-boundary-investigation.md` that
the missing-boundary investigation has been accepted into this plan, while
keeping the investigation's historical findings intact.

### Slice 8: Remove Old Paths And Tighten Review Signals

After all imports move:

- delete old root-level files that were moved;
- confirm no root-level forwarding files were added;
- confirm no non-`index.ts` re-export stubs were added;
- update existing source-path tests that currently mention deleted paths only
  when the path itself is a stable removed compatibility boundary;
- remove any old source-text blacklist whose real boundary is now covered by an
  import-boundary test.

Do not keep tests that mention obsolete helper names as sentinels. Runtime tests
should cover behavior. Static tests should cover the new module boundaries.

## Architecture Test Impact

This plan intentionally changes architecture-test coverage.

### Domain Ownership

- Core owns media generation lifecycle, cost projection, dependency readiness,
  and durable take-state mutations.
- Engines own provider catalog, pricing, and execution adapters.
- Studio server and CLI remain thin adapters that call Core services.
- React feature code remains a projection consumer.

### Existing Tests That Still Matter

- `packages/core/src/server/architecture.test.ts` continues to protect Core
  server boundaries, no re-export facades, durable mutation ownership, opaque
  prompt-sheet runtime contracts, and single-run cost approval.
- `packages/cli/src/commands/command-architecture.test.ts` continues to protect
  thin CLI command handlers.
- `packages/studio/server/architecture.test.ts` continues to protect thin
  Studio server routes.
- `packages/studio/src/architecture.test.ts` continues to protect React
  feature code and local shadcn UI control usage.

### New Static Tests

Add static import-boundary tests only after the corresponding folders exist:

- Core `media-generation/cost` cannot import readiness, provider, run, import,
  file-resolution, database, or asset-selection modules.
- Engines `generation/pricing` cannot import execution, provider payload,
  input-file, SDK, output persistence, or filesystem modules.
- Shot Video Take planning/selection/provider/runs/imports/persistence
  submodules follow the dependency direction described in this plan.
- Cost and lifecycle registries cover the same public purpose id set without
  sharing readiness imports.

These tests must resolve import paths and compare folder ownership. They must
not search for private function names, current local variable names, or complete
service inventories.

### Runtime Tests

Keep or update runtime tests for:

- invalid state failing before durable take mutations;
- cost estimates staying numeric for invalid-but-priceable specs;
- missing pricing inputs returning `missing-pricing-input`;
- dependency readiness reporting missing/invalid selections without changing
  cost projection semantics;
- live generation requiring the current single-spec approval token;
- provider payload validation still happening before live execution;
- media imports creating project metadata only through import commands.

## Review Checklist Gate

Before implementation starts, reviewers should confirm:

- The proposed module names are accepted architecture names.
- Cost projection can be split from the all-purpose registry without making a
  compatibility wrapper.
- Engine pricing can depend on catalog facts without importing execution.
- Shot Video Take submodule names are specific enough for import-boundary tests.
- The planned tests protect folder boundaries and public purpose ids, not helper
  names.
- No plan slice asks Studio server, CLI, or React code to enforce domain rules
  locally.

## Completed Implementation Notes

Completed on 2026-07-04.

The implemented module shape follows this plan with three ownership refinements
that became clearer during the move:

- `preflight-inputs.ts` landed in Shot Video Take `planning`, because it is used
  by readiness and preflight projection rather than provider request assembly.
- `project-media-files.ts` landed in Shot Video Take `shared`, because
  selection, provider preparation, and import behavior all need the same
  read-only project media-file resolution without making `provider` a shared
  dependency.
- read-only take direction projection helpers landed in
  `shot-video-take/shared/take-state-projections.ts`, while durable mutation
  helpers remain in `shot-video-take/persistence`.

These refinements preserve the boundary intent: planning does not import
provider/runs/imports, provider does not own durable mutation, and persistence
does not know provider payload or pricing shape.

## Completion Checklist

### Review Area

- [x] Confirm this plan preserves the existing CLI command surface.
- [x] Confirm this plan preserves existing Studio user workflows.
- [x] Confirm this plan preserves single-run approval token semantics.
- [x] Confirm this plan does not add graph execution or dependency
      auto-generation.
- [x] Confirm this plan does not add AI artifact or prompt content validation.
- [x] Confirm this plan does not rely on compatibility import paths.
- [x] Confirm each proposed module name is deliberate domain vocabulary.

### Documentation And Decisions

- [x] Add `docs/decisions/0044-use-media-generation-module-boundaries.md`.
- [x] Update `docs/architecture/media-generation.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/architecture/architecture-test-registry.md`.
- [x] Update `docs/architecture/module-boundary-investigation.md` with the
      accepted follow-up direction.
- [x] Keep historical plans unchanged unless they are current architecture
      references.

### Engine Pricing And Execution

- [x] Create `packages/engines/src/generation/pricing`.
- [x] Create `packages/engines/src/generation/execution`.
- [x] Create `packages/engines/src/generation/catalog` if catalog loading is
      shared by pricing and execution.
- [x] Move `estimateGenerationCost` into the pricing module.
- [x] Move pricing-input normalization into pricing-owned files.
- [x] Move billable-unit projection into pricing-owned files.
- [x] Move cost approval hashing into pricing.
- [x] Move `runGeneration` into the execution module.
- [x] Move provider payload validation into execution.
- [x] Move input-file payload loading into execution.
- [x] Move execution request hashing into execution.
- [x] Update public engine exports intentionally through
      `generation/index.ts`.
- [x] Delete old engine file paths after imports are updated.
- [x] Add engine pricing import-boundary tests.
- [x] Preserve existing engine pricing behavior with focused tests.
- [x] Preserve existing engine runner behavior with focused tests.

### Core Cost Boundary

- [x] Create `packages/core/src/server/media-generation/cost`.
- [x] Move persisted spec estimate reads into `lifecycle` and delegate
      spec-record projection to `cost`.
- [x] Move draft spec estimate behavior into `cost`.
- [x] Move spec-record cost estimation into `cost`.
- [x] Move purpose cost projections into `cost`.
- [x] Move cost approval parsing/checking into `cost`.
- [x] Move cost-estimate-to-line-pricing projection into `cost`.
- [x] Add `cost/purpose-cost-registry.ts`.
- [x] Ensure the cost registry imports only cost projection owners.
- [x] Ensure cost modules do not import lifecycle readiness services.
- [x] Ensure cost modules do not import provider payload construction.
- [x] Ensure cost modules do not import dependency selectors that resolve
      concrete project assets.
- [x] Ensure cost modules do not import low-level database access.
- [x] Add Core cost import-boundary tests.
- [x] Preserve invalid-but-priceable cost tests.

### Core Lifecycle And Dependencies

- [x] Create `packages/core/src/server/media-generation/lifecycle`.
- [x] Create `lifecycle/context-service.ts`.
- [x] Create `lifecycle/model-service.ts`.
- [x] Create `lifecycle/spec-service.ts`.
- [x] Create `lifecycle/dependency-service.ts`.
- [x] Create `lifecycle/run-service.ts`.
- [x] Add `lifecycle/purpose-lifecycle-registry.ts`.
- [x] Create `packages/core/src/server/media-generation/dependencies`.
- [x] Move dependency id helpers into `dependencies`.
- [x] Move dependency slot definitions into `dependencies`.
- [x] Move dependency kind registry into `dependencies`.
- [x] Move dependency selectors into `dependencies`.
- [x] Move dependency readiness inventory into `dependencies`.
- [x] Move dependency inventory line projection into `dependencies`.
- [x] Move shared dependency draft spec contracts into `dependencies`.
- [x] Separate cost-safe dependency declaration contracts from readiness asset
      selectors.
- [x] Update ProjectDataService wiring to call lifecycle entrypoints.
- [x] Update CLI and Studio server adapters only through public Core services.

### Purpose Implementations

- [x] Create `packages/core/src/server/media-generation/purposes`.
- [x] Move Lookbook image implementation under `purposes`.
- [x] Move Lookbook sheet implementation under `purposes`.
- [x] Move Cast Character Sheet implementation under `purposes`.
- [x] Move Cast Profile implementation under `purposes`.
- [x] Move Cast Voice Sample implementation under `purposes`.
- [x] Move Location Environment Sheet implementation under `purposes`.
- [x] Move Location Hero implementation under `purposes`.
- [x] Move Scene Dialogue Audio implementation under `purposes`.
- [x] Move Scene Storyboard Sheet implementation under `purposes`.
- [x] Update lifecycle registry imports to use moved purpose modules.
- [x] Confirm purpose modules no longer own cost projection code that belongs
      in `cost`.
- [x] Confirm no old root-level purpose import paths remain.

### Shot Video Take Submodules

- [x] Create `purposes/shot-video-take/shared`.
- [x] Move diagnostics, project session, purpose config, resource keys, and
      route settings into `shared`.
- [x] Create `purposes/shot-video-take/persistence`.
- [x] Move takes, take state, and take shot membership into `persistence`.
- [x] Create `purposes/shot-video-take/selection`.
- [x] Move input policy, input selection, reference selection, and reference
      selection mutations into `selection`.
- [x] Create `purposes/shot-video-take/planning`.
- [x] Move dependency inventory, dependency slots, production plan, preflight
      report, reference sections, reference scope, reference inclusions,
      dialogue audio references, shot input references, storyboard images,
      reference card plans, shot input dependencies, and dependency draft specs
      into `planning`.
- [x] Create `purposes/shot-video-take/specs`.
- [x] Move input specs, final specs, final spec construction, model list,
      prompt-sheet metadata, spec records, and spec validation into `specs`.
- [x] Create `purposes/shot-video-take/provider`.
- [x] Move provider payloads, generation output paths, and Kling transient
      voice handling into `provider`; keep preflight input projection in
      `planning` and read-only project media-file resolution in `shared`.
- [x] Create `purposes/shot-video-take/runs`.
- [x] Move generation runs into `runs`.
- [x] Create `purposes/shot-video-take/imports`.
- [x] Move media imports into `imports`.
- [x] Create `purposes/shot-video-take/authoring`.
- [x] Move authoring context, take context, take production state, and take
      iteration into `authoring`.
- [x] Update all local imports directly.
- [x] Delete old root-level Shot Video Take file paths after imports are
      updated.
- [x] Add Shot Video Take submodule import-boundary tests.

### Adapter Surfaces

- [x] Confirm Studio server routes still call Core services and do not import
      moved purpose-private modules.
- [x] Confirm CLI command handlers still call Core services and do not import
      moved purpose-private modules.
- [x] Confirm React feature code still consumes service projections and does
      not enforce Core media-generation rules locally.
- [x] Confirm local shadcn UI control rules are unaffected.
- [x] Confirm agent-facing CLI JSON shapes are unchanged unless a current
      accepted architecture doc explicitly changes them.

### Static Architecture Tests

- [x] Add engine pricing import-boundary test.
- [x] Add Core cost import-boundary test.
- [x] Add Shot Video Take submodule import-boundary test.
- [x] Add registry-shape test comparing cost and lifecycle purpose id coverage.
- [x] Remove obsolete source-text blacklists now replaced by import-boundary
      tests.
- [x] Confirm new static tests do not hard-code private helper names.
- [x] Confirm adding a routine helper inside an owning module does not require
      editing architecture tests.
- [x] Confirm renaming a private helper inside an owning module does not require
      editing architecture tests.

### Runtime Regression Tests

- [x] Focused engine pricing tests still pass.
- [x] Focused engine runner tests still pass.
- [x] Focused Core cost projection tests still pass.
- [x] Focused Core cost approval tests still pass.
- [x] Focused shared dependency inventory tests still pass.
- [x] Focused Shot Video Take production plan tests still pass.
- [x] Focused Shot Video Take input selection tests still pass.
- [x] Focused Shot Video Take reference selection mutation tests still pass.
- [x] Focused Shot Video Take spec validation tests still pass.
- [x] Focused Shot Video Take provider payload tests still pass.
- [x] Focused Shot Video Take Kling transient voice tests still pass.
- [x] Focused Shot Video Take media import tests still pass.

### Documentation And Skill Follow-Up

- [x] Check `$HOME/Projects/aitinkerbox/studio-skills` for agent instructions
      that mention old media-generation server file paths.
- [x] Update Studio skill guidance only if agent-facing workflows or examples
      reference old internal paths; no stale references were found.
- [x] Confirm skills still direct agents through CLI/Core contracts rather than
      internal modules.

### Final Verification

- [x] Run `pnpm build:core`.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm test:engines`.
- [x] Run `pnpm test:cli` if CLI imports or JSON outputs changed.
- [x] Confirm Studio-specific tests are not required because Studio service DTOs
      and server route imports did not change; `pnpm check` still ran Studio
      architecture tests.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Verify `rg "media-generation/estimation" packages docs` has no runtime
      import references after the cost move.
- [x] Verify `rg "media-generation/shot-video-take" packages docs` shows only
      current module paths or historical documentation references.
- [x] Verify no non-`index.ts` re-export stubs were added.
- [x] Verify no old root-level moved files remain as compatibility facades.
- [x] Verify architecture tests fail by temporarily adding one forbidden import
      in each new boundary, then revert those temporary changes before commit.
