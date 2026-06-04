# 0043 Existing Media Generation Purpose Architecture Refactor

Status: proposed
Date: 2026-06-03

## Summary

Refactor the pre-0042 non-shot media generation implementations onto one shared
generation-purpose architecture after
`0042-shot-video-take-generation-plan-architecture.md` is implemented.

Plan `0042` should prove the shot-video dependency graph, route planning,
partial pricing, unpriced overrides, and agent-driven dependency execution.
This plan follows that work by moving the older non-shot generation purposes
from parallel direct implementations into the shared purpose registry and
lifecycle service established by `0042`.

This is not a rewrite of every purpose's creative or domain behavior. It is a
refactor of lifecycle architecture:

- each purpose keeps its context, prompt/spec, provider-payload, output naming,
  and import behavior;
- the shared architecture owns purpose lookup, common persistence, prepare,
  estimate, run, run recording, dependency declarations, plan projection, and
  structured diagnostics.

## Why This Exists

The current generation code already follows a common lifecycle, but that
lifecycle is implemented by convention rather than by one shared architecture.

Current shared pieces:

- `packages/core/src/client/media-generation.ts` defines purpose constants,
  purpose-specific spec types, `MediaGenerationSpec`, `PreparedMediaGeneration`,
  estimate reports, run records, and import reports.
- `packages/core/src/server/database/access/media-generation.ts` stores
  generation specs and runs through shared `mediaGenerationSpecs` and
  `mediaGenerationRuns` tables.
- `@gorenku/studio-engines` receives a common prepared generation request from
  each purpose's `prepare...Spec` path.

Current per-purpose pieces:

- `lookbook.image`, `cast.character-sheet`, `cast.profile`,
  `location.environment-sheet`, and `scene.storyboard-sheet` each expose their
  own context, model list, validate, create, update, read, list, prepare,
  estimate, run, record, and import functions.
- `cast.character-sheet` lives in
  `packages/core/src/server/media-generation/cast-character-sheet.ts` and shares
  some helper behavior with `cast.profile` through
  `packages/core/src/server/media-generation/cast-image-common.ts`.
- `shot.video-take` and its shot input image purposes currently live together
  in `packages/core/src/server/media-generation/shot-video-take.ts`, but those
  shot-video purposes are owned by plan `0042` and are not conversion targets in
  this follow-up plan.
- `packages/core/src/server/project-data-service-wiring/media-generation.ts`
  and `packages/core/src/server/project-data-service-wiring/shot-video-take.ts`
  manually wire purpose functions onto the project data service.
- `packages/cli/src/commands/generation-command.ts` and
  `packages/cli/src/commands/media-command.ts` manually branch by purpose. The
  CLI structure refactor is covered separately by
  `0044-cli-command-architecture-refactor.md`.

The current implementation is not fully inconsistent, but it is no longer the
right permanent shape. There is now enough repeated lifecycle behavior to
justify a shared generation-purpose architecture.

## Current Status After The Shot-Video Slice

As of 2026-06-03, the shot-video architecture has moved beyond the plan-only
state and gives this refactor concrete contracts to preserve.

Implemented shot-video pieces now visible in the codebase:

- `packages/engines/src/shot-video/` owns the shot-video model family catalog,
  route parameters, route validation, and route pricing tests.
- `packages/core/src/client/media-generation.ts` now includes shared dependency
  planning contracts such as `MediaGenerationDependencyMap`,
  `MediaGenerationDependencyNode`, `MediaGenerationDependencyPricing`,
  `MediaGenerationPlanLine`, and `ShotVideoTakeGenerationPlan`.
- `packages/core/src/server/media-generation/shot-video-take.ts` implements
  shot-video plan, preview, estimate, final-spec, shot-input-spec, run-record,
  and import behavior in one concrete service module.
- `packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts`
  proves that every current engine shot-video route has a project-level estimate
  case and that route-specific settings do not leak between model variants.

The older non-shot purposes are still direct implementations:

- `packages/core/src/server/media-generation/lookbook-image.ts`;
- `packages/core/src/server/media-generation/cast-character-sheet.ts`;
- `packages/core/src/server/media-generation/cast-profile.ts`;
- `packages/core/src/server/media-generation/location-environment-sheet.ts`;
- `packages/core/src/server/media-generation/scene-storyboard-sheet.ts`.

Those modules still duplicate create, update, read, list, prepare, estimate, run,
record, and import flow. They also still throw purpose-specific hard failures for
unknown estimates, such as `PROJECT_DATA273` and `PROJECT_DATA333`, instead of
using the shot-video-style `unpriced` pricing state.

The project data service and CLI still expose purpose-specific branches:

- `packages/core/src/server/project-data-service-wiring/media-generation.ts`
  wires every old non-shot purpose method one by one.
- `packages/core/src/server/project-data-service-wiring/shot-video-take.ts`
  separately wires shot-video methods.
- `packages/cli/src/commands/generation-command.ts` and
  `packages/cli/src/commands/media-command.ts` still branch by purpose.

This means the migration target is clearer than it was before `0042`: reuse the
actual shot-video dependency, pricing, and plan-line contracts, then migrate the
older non-shot lifecycle duplication into that architecture.

## Relationship To Other Plans

This plan follows:

- `plans/active/0042-shot-video-take-generation-plan-architecture.md`
- `plans/active/0044-cli-command-architecture-refactor.md`

Plan `0042` should implement the new architecture for shot-video take planning,
shot input image purposes, and `shot.video-take` itself. It may use older
non-shot media-generation flows as concrete dependency materializers, but it
should not refactor every older non-shot media purpose.

Plan `0044` should make the CLI command implementation clean enough to support
the agent-facing generation contract without adding more giant nested command
functions.

This plan then migrates the older non-shot purposes into the architecture
established by `0042`.

## ADR Requirement

Before implementation, write a new ADR under `docs/decisions/` using the next
available decision number. Suggested title:

```text
Use A Shared Media Generation Purpose Architecture
```

The ADR must explain:

- why the earlier decision to defer a generic media-purpose framework has now
  been overtaken by concrete duplication;
- that this decision supersedes the direction in
  `docs/decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`;
- which lifecycle behavior is shared;
- which purpose behavior remains purpose-specific;
- how dependency declarations from `0042` fit into purpose definitions;
- how CLI and Studio Skills continue to use the same core contracts;
- how unpriced estimates and explicit override records work across purposes.

After adding the ADR, update:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/README.md`;
- `docs/architecture/core-design-principles.md`;
- any other current architecture document that still says generic media-purpose
  architecture must remain deferred.

Do not edit old ADR text to pretend the old decision never existed. The new ADR
should supersede it explicitly.

## Target Architecture

Add a shared purpose registry in `packages/core` that can look up every current
media generation purpose.

For this plan, the migration work is focused on older non-shot purposes. The
shot-video purposes should be represented in the same registry only by moving or
registering the concrete definitions established by `0042`; do not rewrite
shot-video behavior as part of this plan.

Proposed public contract:

```ts
export interface MediaGenerationPurposeDefinition<
  TContext,
  TSpec extends MediaGenerationSpec
> {
  purpose: MediaGenerationPurpose;
  mediaKind: MediaKind;
  targetKind: MediaGenerationTarget["kind"];
  buildContext(input: MediaGenerationPurposeContextInput): Promise<TContext>;
  listModels(context: TContext): Promise<MediaGenerationModelListReport>;
  normalizeSpec(input: unknown, context: TContext): TSpec;
  buildProviderPayload(
    spec: TSpec,
    context: TContext
  ): MediaGenerationProviderPlan;
  declareDependencies(input: {
    context: TContext;
    spec?: TSpec;
  }): MediaGenerationPurposeDependencyDeclaration[];
  resolveOutputPaths(
    input: MediaGenerationOutputPathInput
  ): Promise<MediaGenerationOutputPaths>;
  importGeneratedMedia(
    input: MediaGenerationImportInput
  ): Promise<MediaGenerationImportReport>;
}
```

The public architecture should keep these contract names and concepts explicit:

- purpose definition;
- purpose registry;
- shared generation service;
- dependency declaration;
- dependency map;
- dependency pricing state;
- plan line;
- prepared generation;
- run authorization;
- media import report.

Private local helper names can be narrower when they do not affect public
contracts, command shapes, package exports, or persisted schemas.

Concrete contracts to reuse from the shot-video implementation:

- keep `PreparedMediaGeneration` as the common provider request shape produced
  by purpose definitions and consumed by `@gorenku/studio-engines`;
- keep `MediaGenerationSpecRecord` and `MediaGenerationRun` as the persisted
  spec and run record shapes;
- reuse `MediaGenerationDependencyMap`,
  `MediaGenerationDependencyPricing`, and `MediaGenerationPlanLine` for
  dependency projection instead of inventing a second graph shape;
- preserve `pricing.state: "priced" | "unpriced" | "not-applicable"` semantics,
  including `overrideRequired: true` for unpriced billable work;
- keep generated media separate from imported project metadata, so a simulated
  or live run record does not automatically attach project assets.

The first implementation should prove the proposed
`MediaGenerationPurposeDefinition` interface against real conversions before it
is treated as final. If the shared service cannot perform generic persistence,
prepare, estimate, run, and run recording without purpose-specific switches, add
explicit fields to the purpose definition instead of hiding switches in local
helpers. Likely required fields include:

- a stable spec title builder for create/update/list reports;
- a target identity resolver for list operations;
- a provider request builder that returns `PreparedMediaGeneration["generation"]`
  plus the provider payload snapshot;
- an output-path resolver for live and simulated runs;
- a flag or policy describing whether unpriced estimates may be approved through
  an explicit override.

## Shared Responsibilities

The shared generation service should own:

- purpose lookup;
- unsupported-purpose diagnostics;
- generic spec create, update, read, and list operations;
- generic prepare orchestration;
- generic estimate orchestration;
- generic run authorization handling;
- generic live/simulated run execution;
- generic run recording;
- unpriced estimate state and explicit override requirements;
- dependency declaration lookup;
- dependency graph integration;
- plan-line projection for Studio, CLI, and agent workflows.

## Purpose-Specific Responsibilities

Each purpose definition should own:

- target validation;
- context building;
- model choices and route controls;
- spec normalization and validation;
- prompt/spec rules;
- provider payload construction;
- input file mapping;
- output names and output roles;
- import or attachment behavior;
- purpose-specific dependency declarations.

Purpose definitions should not own generic persistence, approval, run recording,
or CLI dispatch.

## Purposes To Register

Register and migrate every pre-0042 non-shot media generation purpose that was
not already implemented through the `0042` shot-video architecture:

- `lookbook.image`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.environment-sheet`;
- `scene.storyboard-sheet`.

The first implementation should convert those older direct functions to use the
registry-backed lifecycle without changing generation behavior.

Do not convert these in this plan because plan `0042` should already implement
them in the new architecture:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet` when it remains a shot-level purpose;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take`.

Those shot-video purposes may still need registry entries so dependency planning
and shared lifecycle operations can find them by purpose. Treat that as
registration of existing architecture, not behavioral conversion.

## Character Sheet Example

`cast.character-sheet` is the clearest example.

Keep purpose-specific behavior:

- read cast member, screenplay, time-period, active Lookbook, selected assets,
  character-sheet takes, and profile takes;
- normalize the character-sheet spec;
- build the character-sheet provider payload;
- choose output names and roles;
- import generated media as character-sheet assets.

Move shared behavior:

- create/update/read/list the persisted spec;
- prepare the shared generation request;
- estimate;
- represent missing pricing as unpriced plan state;
- authorize estimated or unpriced runs;
- execute live or simulated runs;
- record generation runs;
- expose dependency declarations such as active Lookbook references when the
  product decision adds that dependency.

## CLI Relationship

The CLI remains a crucial agent-facing contract.

This plan should not reintroduce nested purpose dispatch in CLI command files.
Plan `0044` owns the CLI command-handler refactor. This plan should expose
registry-backed core operations that the CLI handlers can call cleanly.

The desired shape is:

```text
CLI command handler
  parses command and flags
  calls shared core generation service

shared core generation service
  resolves purpose definition
  runs lifecycle operation

purpose definition
  owns purpose-specific context/spec/provider/import behavior
```

## Implementation Phases

### Phase 1: ADR And Documentation

- Add the new shared media generation architecture ADR.
- Link it from media generation architecture docs and the architecture README.
- Update current docs that still describe generic media-purpose architecture as
  deferred-only direction.

### Phase 2: Current Lifecycle Inventory

- Inventory every current purpose function.
- Identify behavior that is truly generic versus purpose-specific.
- Confirm current command and Studio Skill workflows that depend on each
  purpose.
- Record any intentional behavior cleanup before implementation.

### Phase 3: Registry And Shared Service

- Add `MediaGenerationPurposeDefinition`.
- Add the purpose registry.
- Add the shared generation service.
- Add structured diagnostics for missing or unsupported purpose definitions.
- Add tests for purpose lookup and unsupported-purpose failures.

### Phase 4: Convert Older Non-Shot Purposes

- Convert `lookbook.image`.
- Convert `cast.character-sheet`.
- Convert `cast.profile`.
- Convert `location.environment-sheet`.
- Convert `scene.storyboard-sheet`.

Each conversion should keep behavior stable and update callers directly to the
new shared service.

### Phase 5: Dependency Declarations

- Move dependency declarations into purpose definitions.
- Confirm the `0042` shot-video dependency resolver can ask the registry for
  dependencies declared by the newly migrated non-shot purposes.
- Keep the current shot-video distinction clear: shot first/last/reference and
  multi-shot storyboard inputs can be auto-drafted, while `character-sheet`,
  `location-sheet`, and lookbook `reference-image` inputs are currently required
  attachments.
- Add automatic non-shot dependency materialization only when the product
  behavior is explicitly implemented and tested. Do not imply that migrating a
  purpose into the registry automatically makes shot-video create that purpose.

### Phase 6: Unpriced Overrides Across Purposes

- Replace purpose-specific "unknown estimate" hard failures with shared
  unpriced plan state where the current product flow allows an explicit
  override.
- Keep true invalid configuration as structured failures.
- Record estimated approvals and unpriced overrides consistently in run records.

### Phase 7: Service Wiring And CLI Integration

- Update project data service wiring to expose registry-backed lifecycle
  operations.
- Update CLI command handlers from `0044` to call the shared core service.
- Update Studio Skill media-producer references if command output or spec
  materialization shapes change.

### Phase 8: Tests And Verification

- Add registry tests for all purposes in this plan's migration scope.
- Add lifecycle tests proving create, update, prepare, estimate, run, and import
  behavior is preserved.
- Add dependency-declaration tests.
- Add CLI tests proving command output still routes through the shared service.
- Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` when the
  implementation is complete and the user has approved running tests.

## Integration Test Plan

The existing
`packages/core/tests/integration/shot-video-take-estimate-matrix.test.ts` is the
right model for this refactor: it creates a real project fixture and proves that
engine-level facts still line up with core project behavior. Add the following
integration tests under `packages/core/tests/integration`.

### `media-generation-purpose-lifecycle-matrix.test.ts`

Purpose: prove every migrated non-shot purpose can complete the shared lifecycle
through the same service operations.

Matrix rows:

- `lookbook.image`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.environment-sheet`;
- `scene.storyboard-sheet`.

For each row:

- create a sample movie project with `createSampleMovieProject`;
- create or select the minimum required target data, including active Lookbook
  and shot list when needed;
- build context and list models through the registry-backed service;
- create a spec with deterministic ids;
- update the spec title or prompt and verify the persisted spec changed;
- read and list the spec and verify it is filtered by purpose and target;
- prepare the spec and assert provider, model, media kind, mode, output count,
  output names, and important provider payload fields;
- estimate the spec and assert a priced estimate for a known priced route;
- run with `simulate: true` and assert the run record captures the spec snapshot,
  provider payload, estimate snapshot, approval token, simulated status, and
  outputs;
- verify that the simulated run did not import or attach project metadata before
  the explicit import call.

Expected impact: this catches regressions where a purpose is registered but the
shared service loses target filtering, provider-payload construction, output
naming, run recording, or the generation/import separation.

### `media-generation-purpose-import-matrix.test.ts`

Purpose: prove purpose-specific import behavior remains purpose-owned after the
lifecycle refactor.

Rows and assertions:

- `lookbook.image`: imports a generated image into the requested Lookbook,
  preserves sections, returns Lookbook resource keys, and records generated
  origin when a receipt is provided.
- `cast.character-sheet`: imports an image as a cast-member character-sheet take,
  attaches it to the cast member, and returns cast surface resource keys.
- `cast.profile`: imports an image as a cast-member profile take without
  disturbing selected character-sheet assets.
- `location.environment-sheet`: imports the composite and four view files as one
  environment sheet, records the expected file roles, and attaches the grouped
  asset to the location.
- `scene.storyboard-sheet`: imports the generated sheet and sliced storyboard
  image files for the requested shot list without changing unrelated shot lists.

Expected impact: this catches the most likely refactor mistake: making the
shared lifecycle generic but accidentally flattening the import behavior that is
actually domain-specific.

### `media-generation-registry-contract.test.ts`

Purpose: prove the registry is a real contract, not another manual switch.

Assertions:

- every value in `MediaGenerationPurpose` has exactly one registry definition;
- every definition exposes the expected media kind and target kind;
- unsupported purpose lookup fails with a structured diagnostic code, not a
  loose `throw new Error`;
- a target-kind mismatch fails before persistence;
- registry-backed create/list/prepare/estimate/run calls do not branch through
  old purpose-specific service names.

Expected impact: this catches missing registrations and compatibility-wrapper
drift early.

### `media-generation-unpriced-override-integration.test.ts`

Purpose: prove the shared unpriced estimate behavior matches the shot-video
pricing model.

Scenarios:

- a purpose whose route returns `estimatedCostUsd: null` produces a plan or
  estimate state with `pricing.state: "unpriced"` and `overrideRequired: true`;
- running without an explicit unpriced-cost approval fails with a structured
  diagnostic;
- running with the explicit override records the override in the run record;
- invalid provider mapping, invalid target, or invalid spec still fails fast and
  is not downgraded into an unpriced override.

Expected impact: this catches the dangerous class of regressions where missing
pricing is either silently accepted or treated as the same kind of failure as an
invalid configuration.

### `shot-video-dependency-registry-integration.test.ts`

Purpose: prove shot-video planning can consume registry-backed purpose
definitions without one-off dependency branches.

Scenarios:

- planning a first-frame or first-last-frame video take with
  `inputPolicy.defaultMode: "regenerate"` creates priced dependency-generation
  lines for shot input purposes and then a priced final-video line;
- planning with selected existing inputs creates reused-asset lines priced at
  zero and no dependency-generation lines;
- planning a reference route with missing `character-sheet`, `location-sheet`,
  or lookbook `reference-image` inputs still reports required attachments until
  automatic non-shot dependency materialization is explicitly implemented;
- the plan exposes stable `MediaGenerationDependencyMap` edges and execution
  levels for dependency runs.

Expected impact: this catches regressions where 0043 disconnects the older
purpose migration from the shot-video dependency planner or accidentally changes
current reference-route behavior.

### `generation-cli-shared-service-integration.test.ts`

Purpose: prove the CLI still exposes the same agent-facing behavior after the
core lifecycle is registry-backed.

Assertions:

- `generation validate`, `generation create`, `generation list`,
  `generation estimate`, and simulated `generation run` produce the same JSON
  shape for one migrated purpose and one shot-video purpose;
- unsupported purposes and target mismatches surface structured diagnostics;
- command handlers call shared core operations rather than adding new nested
  purpose dispatch.

Expected impact: this gives the media-producer skill and other agents a clear
signal that the refactor did not split CLI behavior from Studio/core behavior.

## Acceptance Criteria

- Every pre-0042 non-shot media generation purpose in this plan's scope is
  registered.
- Generic lifecycle operations route through the shared generation service.
- Purpose-specific context, prompt/spec, provider-payload, output naming, and
  import behavior remain purpose-owned.
- Shot-video dependency planning can use the migrated non-shot purpose
  definitions instead of one-off branches for those dependencies.
- Shot-video reference routes still treat character, location, and lookbook
  reference inputs as required attachments unless this plan explicitly adds and
  tests automatic non-shot materialization.
- CLI handlers can call shared core generation operations without nested purpose
  dispatch.
- Unknown estimate behavior is represented consistently as unpriced state with
  explicit override requirements where allowed.
- Structured diagnostics cover unsupported purposes, invalid targets, invalid
  specs, missing dependency declarations, and unpriced lines.
- A new ADR exists and architecture docs link to it.

## Non-Goals

- Do not implement this before the shot-video dependency plan in `0042`.
- Do not convert `shot.first-frame`, `shot.last-frame`, `shot.reference-sheet`,
  `shot.multi-shot-storyboard-sheet`, or `shot.video-take`; those belong to
  `0042`.
- Do not change public command names or flags.
- Do not move CLI parsing or terminal formatting into core.
- Do not replace purpose-specific prompt/spec behavior with a vague generic
  prompt framework.
- Do not add compatibility aliases for old import paths or old service names.
- Do not add fallback behavior for missing purposes, stale specs, or invalid
  provider mappings.

## Completion Checklist

Use this checklist to track when the existing non-shot media generation refactor
is complete enough to replace the current parallel direct implementations.

### Design Review

- [x] Confirm `0042` has implemented the shot-video purpose architecture for
  `shot.first-frame`, `shot.last-frame`, `shot.reference-sheet` when kept,
  `shot.multi-shot-storyboard-sheet`, and `shot.video-take`.
- [x] Confirm this plan's migration scope is limited to pre-0042 non-shot
  purposes: `lookbook.image`, `cast.character-sheet`, `cast.profile`,
  `location.environment-sheet`, and `scene.storyboard-sheet`.
- [x] Confirm the shared architecture separates lifecycle behavior from
  purpose-specific context, spec, prompt, provider-payload, output, and import
  behavior.
- [x] Confirm this plan reuses the concrete `0042` contracts:
  `PreparedMediaGeneration`, `MediaGenerationDependencyMap`,
  `MediaGenerationDependencyPricing`, `MediaGenerationPlanLine`,
  `MediaGenerationSpecRecord`, and `MediaGenerationRun`.
- [x] Confirm the registry and shared service names are final enough for public
  contracts, package exports, and architecture docs.
- [x] Confirm shot-video purpose registry entries, if added in this plan, are
  registration of existing `0042` behavior rather than a shot-video rewrite.
- [x] Confirm no compatibility aliases, old service shims, or re-export facades
  are planned.

### ADR And Documentation

- [x] Add a new ADR under `docs/decisions/` for the shared media generation
  purpose architecture.
- [x] State in the ADR that it supersedes the direction in
  `docs/decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`.
- [x] Explain in the ADR why concrete duplication now justifies the shared
  architecture.
- [x] Link the ADR from `docs/architecture/media-generation.md`.
- [x] Link the ADR from `docs/architecture/reference/media-generation.md`.
- [x] Link the ADR from `docs/architecture/README.md`.
- [x] Update `docs/architecture/core-design-principles.md` so it no longer says
  generic media-purpose registries are deferred-only direction.
- [x] Update any Studio Skill reference docs if command or lifecycle wording
  changes.

### Current Lifecycle Inventory

- [x] Inventory current `lookbook.image` context, model, spec, prepare,
  estimate, run, record, and import functions.
- [x] Inventory current `cast.character-sheet` lifecycle functions and shared
  `cast-image-common.ts` behavior.
- [x] Inventory current `cast.profile` lifecycle functions and edit-source
  behavior.
- [x] Inventory current `location.environment-sheet` lifecycle functions,
  grouped import document behavior, and slicing expectations.
- [x] Inventory current `scene.storyboard-sheet` lifecycle functions, shot-list
  context, and slicing/import document behavior.
- [x] Record any intentional behavior cleanup before implementation starts.
- [x] Confirm which current errors must remain hard structured failures versus
  unpriced override cases.

### Shared Registry And Service

- [x] Add `MediaGenerationPurposeDefinition`.
- [x] Add the shared media generation purpose registry.
- [x] Add registry lookup with structured unsupported-purpose diagnostics.
- [x] Add shared create, update, read, and list spec operations.
- [x] Add shared prepare operation.
- [x] Add shared estimate operation.
- [x] Add shared live and simulated run operation.
- [x] Add shared run-recording operation.
- [x] Add shared unpriced estimate and override handling where allowed.
- [ ] Add shared dependency declaration lookup.
- [x] Reuse `MediaGenerationDependencyMap`,
  `MediaGenerationDependencyPricing`, and `MediaGenerationPlanLine` for any
  shared dependency or plan projection.
- [x] Add explicit purpose-definition fields for spec title, target identity,
  prepared-generation construction, output path resolution, and unpriced
  override policy if the first conversions prove those fields are required.
- [x] Ensure purpose definitions do not own generic persistence, approval,
  run-recording, or CLI dispatch.

### Purpose Conversion

- [x] Convert `lookbook.image` to the shared lifecycle without changing current
  context, spec, provider-payload, output naming, estimate, run, or import
  behavior.
- [x] Convert `cast.character-sheet` to the shared lifecycle without changing
  current character-sheet generation behavior.
- [x] Convert `cast.profile` to the shared lifecycle without changing edit
  source handling or profile import behavior.
- [x] Convert `location.environment-sheet` to the shared lifecycle without
  changing grouped sheet import behavior.
- [x] Convert `scene.storyboard-sheet` to the shared lifecycle without changing
  shot-list context, generated sheet behavior, or sliced import behavior.
- [x] Update callers directly to the new shared service.
- [ ] Delete obsolete direct lifecycle paths rather than keeping wrapper aliases.

### Dependency Declarations

- [ ] Add dependency declaration support to purpose definitions.
- [ ] Confirm migrated non-shot purposes can declare dependencies without moving
  prompt/spec ownership into the dependency resolver.
- [ ] Confirm the `0042` shot-video dependency resolver can query migrated
  non-shot purpose definitions.
- [x] Confirm shot-video reference routes still treat `character-sheet`,
  `location-sheet`, and lookbook `reference-image` inputs as required
  attachments unless automatic non-shot materialization is explicitly added.
- [ ] Add active Lookbook dependency declarations only where the current product
  behavior actually requires them.
- [x] Avoid adding speculative dependency slots for domains that are not yet
  implemented.

### CLI And Agent Integration

- [ ] Confirm `0044` has refactored CLI command entry points into small
  handlers or that this implementation only touches handler/registry code.
- [x] Update CLI generation handlers to call registry-backed core operations.
- [x] Preserve current command names, flags, JSON output shapes, and structured
  error behavior unless a cleanup is explicitly named and tested.
- [x] Confirm Studio Skills still create specs, estimate, run, inspect, and
  import through CLI/core contracts.
- [x] Update media-producer references if lifecycle output or approval wording
  changes.

### Validation And Tests

- [x] Add registry tests for every migrated non-shot purpose.
- [x] Add unsupported-purpose structured diagnostic tests.
- [x] Add `packages/core/tests/integration/media-generation-purpose-lifecycle-matrix.test.ts`
  for create, update, read, list, prepare, estimate, simulated run, run record,
  and generation/import separation behavior.
- [ ] Add `packages/core/tests/integration/media-generation-purpose-import-matrix.test.ts`
  for Lookbook, cast character-sheet, cast profile, location environment-sheet,
  and scene storyboard-sheet import behavior.
- [x] Add `packages/core/tests/integration/media-generation-registry-contract.test.ts`
  or equivalent focused registry coverage for all registered purposes and
  unsupported-purpose diagnostics.
- [ ] Add dependency declaration tests.
- [ ] Add `packages/core/tests/integration/media-generation-unpriced-override-integration.test.ts`
  or equivalent coverage for unpriced estimate state, explicit override
  recording, and invalid-configuration failures.
- [ ] Add `packages/core/tests/integration/shot-video-dependency-registry-integration.test.ts`
  proving shot-video dependency planning works with registry-backed definitions
  and preserves current required-attachment behavior.
- [x] Add tests proving invalid configuration still fails with structured
  diagnostics.
- [ ] Add `generation-cli-shared-service-integration.test.ts` or equivalent CLI
  coverage proving command output routes through the shared core service.
- [x] Add sample project smoke coverage for at least one migrated image purpose.

### Final Verification

- [x] Verify no shot-video purpose conversion work remains in this plan.
- [x] Verify shot-video route, pricing, and route-parameter behavior from
  `packages/engines/src/shot-video/` remains covered by the existing estimate
  matrix.
- [x] Verify no generic prompt framework was introduced.
- [x] Verify no compatibility aliases, pass-through wrappers, or re-export
  facades were added.
- [x] Verify current media generation commands still work for migrated purposes.
- [x] Verify shot-video reference routes still report missing character,
  location, and lookbook reference inputs as required attachments unless the
  implementation explicitly adds non-shot dependency materialization.
- [x] Verify generated files still require explicit media import before becoming
  project metadata.
- [x] Run `pnpm build` when implementation is complete.
- [x] Run `pnpm test` when implementation is complete.
- [x] Run `pnpm lint` when implementation is complete.
- [x] Run `pnpm check` when implementation is complete.
- [x] Document any checks not run and why.
