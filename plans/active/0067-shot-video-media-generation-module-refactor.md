# 0067 Shot Video And Media Generation Module Refactor

Status: proposed
Date: 2026-06-12

## Summary

`0062-shot-video-take-core-refactor.md` correctly identified that the shot-video
core code had become too large to review safely. That plan is now stale in two
important ways:

- the dependency graph direction in `0062` was superseded by the shared
  dependency inventory work from `0063` and `0064`;
- some extraction work already happened, but the remaining source shape still
  leaves large mixed-responsibility files in place.

This plan replaces the stale file-splitting direction from `0062`.

The refactor has two targets:

- split `packages/core/src/client/media-generation.ts` into public contract
  files that have clear domain ownership;
- split `packages/core/src/server/media-generation/shot-video-take.ts` and the
  already-large `shot-video-take/reference-sections.ts` into focused server
  modules with explicit layering rules.

The goal is not to redesign product behavior. The goal is to make the current
media-generation architecture reviewable, testable, and hard to accidentally
undo.

## Relationship To Current Architecture

This plan builds on the current accepted architecture:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `plans/active/0063-generation-dependency-inventory-rewrite.md`
- `plans/active/0064-generation-dependency-inventory-cleanup.md`
- `plans/active/0066-low-noise-lint-and-architecture-checks.md`

Important inherited rules:

- purpose modules own purpose-specific context, model reports, provider
  payloads, dependency declarations, dependency draft specs, and import
  behavior;
- shared generation services own common lifecycle orchestration;
- dependency inventory is the pricing and dependency source of truth;
- generated files do not become project metadata until import succeeds;
- spec creation and update must fail fast while required dependencies are
  unresolved;
- package-boundary failures must use structured diagnostics or
  `ProjectDataError` with stable codes;
- no compatibility shims, old-path aliases, re-export stubs, or convenience
  barrels.

`0066` deliberately rejected broad global file-size gates. This plan therefore
does not reintroduce a repo-wide `max-lines` script. It uses focused static
checks for this refactor instead.

## Current Evidence

The two originally named files are still too large:

```text
packages/core/src/client/media-generation.ts                         1,809 lines
packages/core/src/server/media-generation/shot-video-take.ts          3,938 lines
```

Two shot-video modules already exist:

```text
packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts      246 lines
packages/core/src/server/media-generation/shot-video-take/reference-sections.ts  1,303 lines
```

The first one is a good example of the intended direction: a focused owner for
purpose-owned dependency slot declarations.

The second one shows why this plan must cover already-extracted code too:
`reference-sections.ts` currently owns section composition, card states,
preview projection, selection semantics, inclusion overrides, location view
labels, asset lookup, diagnostics, and plan-line lookup in one file.

The broad shot-video test file is also too mixed:

```text
packages/core/src/server/media-generation/shot-video-take.test.ts      1,700+ lines
```

It currently covers preflight, production groups, dependency estimates,
reference sections, input selection, import behavior, and spec validation in one
review surface.

## Goals

- Delete `packages/core/src/client/media-generation.ts` after its contracts are
  moved to real owner files.
- Delete `packages/core/src/server/media-generation/shot-video-take.ts` after
  its implementation is moved to real owner files.
- Split `shot-video-take/reference-sections.ts` so reference scope, selection,
  inclusion, card projection, and section composition have separate owners.
- Keep `packages/core/src/client/index.ts` as the public browser-safe package
  entrypoint.
- Update callers directly to the new owner modules.
- Split the broad shot-video tests into files that correspond to the modules
  and behaviors they verify.
- Preserve current behavior except where this plan explicitly calls for a
  static or layering correction.
- Add focused architecture checks so the deleted large files and compatibility
  paths cannot quietly return.

## Non-Goals

- Do not redesign the media-generation purpose registry.
- Do not redesign dependency inventory, dependency ids, selector policies, or
  pricing states.
- Do not change database schema or add Drizzle migrations.
- Do not change Studio UI behavior.
- Do not move provider catalogs or model capability rules out of
  `packages/engines`.
- Do not add dependencies.
- Do not add broad file-size or function-size lint rules.
- Do not keep `media-generation.ts` or `shot-video-take.ts` as pass-through
  compatibility files.

## Refactor Principles

### Split By Ownership, Not By Convenience

Each new file must answer one concrete ownership question.

Good ownership questions:

- What public contract shapes describe media-generation dependency inventory?
- What public contract shapes describe shot-video contexts, specs, and reports?
- How is a shot group resolved from a scene shot list?
- How are rail groups persisted and carried forward?
- Which dependency slots does shot video declare?
- How is a dependency inventory built from a shot-video production plan?
- How are prepared inputs projected into preflight checklist items?
- How is a final provider payload built from a validated spec?
- How are generated or imported files attached to shot-video metadata?

Bad ownership names:

- `helpers.ts`
- `utils.ts`
- `common.ts`
- `shot-video-take-core.ts`
- `media-generation-types.ts`
- `index.ts` as a pure local barrel
- a new `media-generation.ts` or `shot-video-take.ts` that only delegates

### Keep Imports Directional

Public client contracts may import only:

- other `packages/core/src/client/*` contract files;
- type-only contracts from `@gorenku/studio-diagnostics`;
- type-only `GenerationEstimate` from `@gorenku/studio-engines`.

Client contract files must not import:

- `packages/core/src/server/*`;
- Node built-ins;
- runtime provider functions;
- database access;
- project data services.

Server shot-video modules may import:

- public client contracts;
- database access modules only in owner modules that read or mutate project
  data;
- `@gorenku/studio-engines` route and provider functions only in model,
  route, provider payload, estimate, and run modules;
- shared media-generation inventory and lifecycle modules where appropriate.

Server shot-video modules must not:

- parse dependency ids outside dependency id helpers or narrow projection
  modules that receive parsed data from core helpers;
- construct dependency prices outside dependency inventory or provider estimate
  code;
- mutate shot lists from read-only plan/report modules;
- do file IO from context, dependency, route, provider payload, or reference
  section modules;
- import Studio UI code.

### Keep Public Entrypoints Deliberate

`packages/core/src/client/index.ts` is the package-public browser-safe entrypoint
and may re-export from the new client contract owners.

No other new re-export-only file is allowed.

In particular:

- do not keep `packages/core/src/client/media-generation.ts`;
- do not create `packages/core/src/client/media-generation/index.ts` as a
  barrel;
- do not keep `packages/core/src/server/media-generation/shot-video-take.ts`;
- do not create `packages/core/src/server/media-generation/shot-video-take/index.ts`
  as a barrel.

Callers inside `packages/core` should import from the file that owns the
concept. Package consumers should continue using `@gorenku/studio-core/client`
through `client/index.ts`.

## Target Client Contract Structure

Replace `packages/core/src/client/media-generation.ts` with focused contract
files under `packages/core/src/client`.

Proposed files:

```text
packages/core/src/client/media-generation-purpose.ts
packages/core/src/client/media-generation-target.ts
packages/core/src/client/media-generation-dependency.ts
packages/core/src/client/media-generation-lifecycle.ts
packages/core/src/client/lookbook-media-generation.ts
packages/core/src/client/cast-media-generation.ts
packages/core/src/client/location-media-generation.ts
packages/core/src/client/scene-audio-generation.ts
packages/core/src/client/scene-storyboard-media-generation.ts
packages/core/src/client/shot-video-take-generation.ts
```

### `media-generation-purpose.ts`

Owns:

- purpose constants such as `LOOKBOOK_IMAGE_GENERATION_PURPOSE`;
- `MediaKind`;
- `MediaGenerationPurpose`.

Rules:

- No domain context, spec, model report, run, or dependency inventory shapes.
- No server imports.

### `media-generation-target.ts`

Owns:

- `LookbookImageGenerationTarget`;
- `CastMediaGenerationTarget`;
- `LocationMediaGenerationTarget`;
- `SceneMediaGenerationTarget`;
- `SceneDialogueMediaGenerationTarget`;
- `SceneShotMediaGenerationTarget`;
- `SceneShotMediaGenerationRequestTarget`;
- `MediaGenerationTarget`;
- `MediaGenerationRequestTarget`.

Rules:

- Keep target shapes browser-safe and JSON-safe.
- Do not add setup or database record suffixes here.

### `media-generation-dependency.ts`

Owns:

- dependency kind and selector contracts;
- dependency slot contracts;
- dependency inventory line contracts;
- plan line contracts;
- inventory estimate/checklist contracts.

Rules:

- Dependency ids remain string values in the public contract, but construction
  and parsing remain server-owned in `dependency-identifiers.ts`.
- Do not add graph execution fields, topological fields, or automatic run
  language.
- Do not import purpose-specific context objects except where a public union
  genuinely requires `MediaGenerationPurpose` or `MediaGenerationTarget`.

### `media-generation-lifecycle.ts`

Owns:

- `MediaGenerationSpecRecord`;
- `MediaGenerationRun`;
- `MediaGenerationEstimateReport`;
- `PreparedMediaGeneration`;
- `MediaGenerationRunReport`;
- unions that describe any persisted media generation spec.

Rules:

- This file may import purpose-specific spec/model-choice types.
- It must not own purpose-specific context/report details.

### Purpose-Specific Client Files

Purpose-specific files own their public context, spec, model report, and import
report shapes:

- `lookbook-media-generation.ts`
- `cast-media-generation.ts`
- `location-media-generation.ts`
- `scene-audio-generation.ts`
- `scene-storyboard-media-generation.ts`
- `shot-video-take-generation.ts`

Rules:

- Keep a shape near the purpose that owns it.
- Avoid broad cross-purpose imports except for shared purpose constants,
  target types, dependency contracts, and lifecycle contracts.
- Keep shot-video production-plan and reference-section report contracts in
  `shot-video-take-generation.ts`.

### Client Caller Updates

Update direct imports from `./media-generation.js` or
`../client/media-generation.js` to the new owner files or to
`../client/index.js` when the caller is consuming the package-public contract.

Known direct callers to update include:

- `packages/core/src/client/index.ts`
- `packages/core/src/client/resources.ts`
- `packages/core/src/server/scene-shot-list-json/validator.ts`

Use `rg "media-generation\\.js|client/media-generation"` during implementation
and update every remaining direct import.

## Target Server Structure

Replace `packages/core/src/server/media-generation/shot-video-take.ts` with
focused modules under:

```text
packages/core/src/server/media-generation/shot-video-take/
```

Proposed files:

```text
shot-video-take/
  diagnostics.ts
  purpose-config.ts
  project-session.ts
  shot-group.ts
  context.ts
  resource-keys.ts
  production-groups.ts
  model-list.ts
  route-settings.ts
  provider-payloads.ts
  dependency-slots.ts
  dependency-inventory.ts
  dependency-draft-specs.ts
  reference-scope.ts
  reference-selection.ts
  reference-inclusions.ts
  reference-card-plans.ts
  reference-sections.ts
  preflight-inputs.ts
  preflight-report.ts
  production-plan.ts
  input-selection.ts
  project-media-files.ts
  media-imports.ts
  spec-records.ts
  input-specs.ts
  final-specs.ts
  generation-runs.ts
  generation-output-paths.ts
```

This list is intentionally explicit. If implementation finds a better
domain name, update this plan before using that name for a public or
cross-module concept. Private local helper names may still be refined during
implementation.

### `diagnostics.ts`

Owns small diagnostic construction helpers for shot-video media generation.

Exports:

- `shotVideoTakeIssue`;
- narrowly named warning/error helpers if repeated in more than one module.

Rules:

- Keep stable codes.
- Do not convert package-boundary failures into loose `Error` throws.
- Do not hide real validation ownership behind generic diagnostic helpers.

### `purpose-config.ts`

Owns the mapping between shot input purposes and their dependency/input kinds.

Exports:

- `SHOT_VIDEO_TAKE_INPUT_PURPOSE_CONFIG`;
- `isShotVideoTakeInputPurpose`;
- `shotVideoTakeInputPurposeForDependencyKind`;
- `shotVideoTakeDependencyKindForPurpose`;
- `shotVideoTakeInputKindForPurpose`;
- `defaultShotVideoTakeInputParameterValues`;

Rules:

- No database, file IO, provider execution, or project context loading.
- Keep this module small and table-driven.

### `project-session.ts`

Owns shot-video project/session access helpers.

Exports:

- `withShotVideoTakeProjectSession`;
- `requireShotVideoTakeProjectRecord`;
- `requireShotVideoTakeScreenplayDocument`;
- `requireShotVideoTakeSceneHierarchy`.

Rules:

- May open/close project sessions.
- May read the project record and screenplay document.
- Must not build provider payloads, dependency inventories, reference sections,
  or production plans.

### `shot-group.ts`

Owns shot group resolution and target construction.

Exports:

- `PreparedShotVideoTakeGroup`;
- `prepareShotVideoTakeGroupInSession`;
- `normalizeShotVideoTakeShotIds`;
- `sceneShotVideoTakeTargetId`;
- `sameShotVideoTakeShotIds`;
- `requireShotVideoTakeShot`.

Rules:

- May read and persist the shot-list document only for preparing the production
  group requested by the caller.
- Persistence must stay explicit through `persist: false`.
- Must fail for empty, duplicate, unknown, or non-contiguous shot ids.
- Must not import engines, dependency inventory, provider payload, reference
  card, import, or run code.

### `context.ts`

Owns `ShotVideoTakeGenerationContext` construction.

Exports:

- `buildShotVideoTakeContext`;
- `buildShotVideoTakeContextFromPreparedGroup`.

Depends on:

- `project-session.ts`;
- `shot-group.ts`;
- `reference-scope.ts`;
- `reference-selection.ts`;
- `resource-keys.ts`.

Rules:

- May read project information, active lookbook, available shot-video inputs,
  and existing takes.
- Must not estimate, import, mutate rail groups, build provider payloads, or
  project reference cards.

### `resource-keys.ts`

Owns resource key construction for shot-video production updates.

Exports:

- `shotVideoTakeResourceKeys`.

Rules:

- Keep this tiny and domain-specific.
- Do not turn it into a generic resource event module.

### `production-groups.ts`

Owns production group and rail group mutation.

Exports:

- `updateShotVideoTakeProductionGroup`;
- `updateShotVideoTakeRailGroups`;
- `carryShotVideoTakeProductionForShotMembership`.

Private named operations should replace the current long inline mutation body:

- normalize rail group inputs;
- resolve rail group source;
- require source or merge partner production group;
- add single-shot production groups for cleared rail shots;
- keep unchanged single-shot production groups;
- order production groups for a shot list.

Rules:

- May mutate scene shot-list documents.
- Must not build preflight reports, provider payloads, dependency inventories,
  reference cards, or file imports.
- Rail split/merge behavior must stay covered by focused tests.

### `model-list.ts`

Owns shot-video and shot-input model list reports.

Exports:

- `listShotVideoTakeModels`;
- `listShotInputModels`;
- `defaultShotVideoTakeModelChoiceForInputMode`;
- `shotVideoTakeModelChoiceReports`;
- `shotVideoTakeInputModelChoiceReports`.

Rules:

- Route facts come from `@gorenku/studio-engines`.
- Do not infer model capabilities from provider model strings.
- Do not read or mutate project data except through context construction.

### `route-settings.ts`

Owns route support, parameter projection, and route setting normalization.

Exports:

- `requireShotVideoTakeRoute`;
- `normalizeShotVideoTakeRouteSettingsForContext`;
- `shotVideoTakeInputRolesForRoute`;
- `shotVideoTakeParametersForRoute`;
- `shotVideoTakeDurationSupportForRoute`;
- `shotVideoTakeRouteInputSlotLabel`;
- `shotVideoTakeRouteInputMatchesFinalInput`;
- `shotVideoTakeRouteInputMatchesPreparedInput`.

Rules:

- May import `@gorenku/studio-engines` route types.
- Must not read database records or write files.
- Dropped and invalid route settings are reported by the planning caller, not
  silently swallowed here.

### `provider-payloads.ts`

Owns provider payload construction and conversion to prepared-generation
requests.

Exports:

- `ShotVideoTakeProviderPlan`;
- `buildShotVideoTakeProviderPayload`;
- `buildShotVideoTakePricingProviderPayload`;
- `buildShotVideoTakeInputProviderPayload`;
- `toShotVideoTakeGenerationRequest`;
- `shotVideoTakeOutputName`.

Rules:

- The same payload path must serve validate, estimate, prepare, and run.
- Estimate and run must not construct different parameter shapes.
- No database access.
- No spec persistence.
- No file import.

### `dependency-slots.ts`

Already exists and owns purpose-owned dependency slot declarations.

Current export:

- `declareShotVideoTakeDependencySlots`.

Additional ownership allowed:

- slot declaration input types;
- narrow helpers that turn context/reference selections into slot declarations,
  if those helpers remain slot-focused.

Rules:

- Keep this as the only shot-video slot declaration source.
- Do not duplicate dependency id construction locally.
- Do not estimate or resolve assets here.

### `dependency-inventory.ts`

Owns the shot-video dependency inventory assembly around the shared planner.

Exports:

- `buildShotVideoTakeDependencyInventory`;
- `declareShotVideoTakeDependencies`;
- `finalShotVideoTakeEstimateFromDependencyInventory`;
- `shotVideoTakeDependencySlotsForContext`;
- `shotVideoTakeReferenceDependencySlotsForContext`.

Rules:

- Use shared dependency inventory and plan-line modules.
- Do not revive dependency maps, graph execution, topological sorting, or
  automatic dependency execution.
- Do not build Reference tab card reports here.
- Do not build provider payloads except by calling the final estimate owner.

### `dependency-draft-specs.ts`

Owns shot input dependency draft spec materialization.

Exports:

- `ShotVideoTakeDependencyRequest`;
- `buildShotInputDependencyDraftSpec`.

Rules:

- Estimate-only drafts may price dependencies but must not become runnable
  generation specs.
- Missing authored drafts must remain structured and agent-readable through
  materialization state.
- Reference-image drafts must still require a concrete title before runnable
  generation.

### `reference-scope.ts`

Owns narrative and shot-level reference scope extraction.

Exports:

- `ShotVideoTakeReferenceScope`;
- `sceneNarrativeShotVideoTakeReferenceScope`;
- `sceneShotVideoTakeReferenceScope`;
- `orderedScreenplayReferenceItems`.

Rules:

- May read screenplay blocks and scene-location relationships.
- Must not build dependency inventories, card states, or asset previews.

### `reference-selection.ts`

Owns selection semantics for cast, locations, Lookbook sheets, character sheets,
environment sheets, and location views.

Exports should replace duplicated selection helpers currently spread across
`shot-video-take.ts` and `reference-sections.ts`.

Suggested exports:

- `selectedShotVideoTakeCastIds`;
- `selectedNarrativeShotVideoTakeCastIds`;
- `defaultShotVideoTakeCastIds`;
- `selectedShotVideoTakeLocationIds`;
- `defaultShotVideoTakeLocationIds`;
- `effectiveScopedShotVideoTakeLocationSelection`;
- `selectedShotVideoTakeLookbookSheetIds`;
- `selectedShotVideoTakeCharacterSheetAssetId`;
- `selectedShotVideoTakeEnvironmentSheetAssetId`;
- `selectedShotVideoTakeLocationViewIds`.

Rules:

- This module chooses selected/default ids only.
- It must not read assets, estimate dependencies, import files, or build card
  copy.

### `reference-inclusions.ts`

Owns inclusion overrides for selected references.

Exports:

- `shotVideoTakeReferenceInclusionOverride`;
- `shotVideoTakeReferenceDependencySlotIncluded`;
- `validateShotVideoTakeRequiredReferenceInclusions`;
- `filterPreparedShotVideoTakeInputsByReferenceInclusions`;
- `shotVideoTakeInputKindIsReference`.

Rules:

- Required references cannot be excluded.
- Invalid required exclusions fail with structured diagnostics.
- This module may use dependency ids only through core-owned dependency id
  helpers.

### `reference-card-plans.ts`

Owns reference card state projection.

Exports:

- `buildShotVideoTakeReferenceCardPlan`;
- `shotVideoTakeReferenceChoiceState`;
- `shotVideoTakeReferencePreviewImagesForAsset`;
- `shotVideoTakeReferencePreviewImagesForLookbookSheet`;
- `shotVideoTakeReferencePreviewImagesForDependencyLine`;
- `shotVideoTakeReferenceInclusionForDependencyId`.

Rules:

- No session loading unless a preview cannot be supplied by the caller.
- No dependency slot declarations.
- No section composition.

### `reference-sections.ts`

Remains the owner of the full Reference tab section report, but becomes a
small composer over the reference modules.

Exports:

- `buildShotVideoTakeReferenceSections`.

Rules:

- May compose reference scope, selection, inclusion, assets, dependency lines,
  plan lines, and card projection.
- Must not own low-level selection logic, location view labels, dependency id
  parsing, or card state calculation directly.
- Should be small enough to review as a report projection module.

### `preflight-inputs.ts`

Owns prepared input and preflight checklist projection.

Exports:

- `preparedShotVideoTakeInputsForContext`;
- `shotVideoTakeLookbookSheetInputsForContext`;
- `shotVideoTakeInputsToCreateFromDependencyInventory`;
- `buildShotVideoTakePreflightInputItems`;

Rules:

- May read asset file records and Lookbook sheets needed to resolve prepared
  inputs.
- Must not build final provider payloads or mutate input selection.
- Must project from dependency inventory and plan lines, not from a second
  dependency model.

### `preflight-report.ts`

Owns preflight report construction.

Exports:

- `previewShotVideoTakeProduction`;
- `validateShotVideoTakePreflight`;
- `finalShotVideoTakeSpecForPreflight`;
- `shotVideoTakeAgentBrief`.

Rules:

- Can compose context, dependency plan, prepared inputs, prompts, and final-take
  readiness.
- If preview accepts a temporary production payload, persistence behavior must
  be explicit and covered by tests.
- Must not own dependency slot rules or reference card projection.

### `production-plan.ts`

Owns read-only production plan and production plan report construction.

Exports:

- `planShotVideoTakeProduction`;
- `estimateShotVideoTakeProduction`;
- `readShotVideoTakeProductionPlan`;
- `buildShotVideoTakeProductionPlanReport`.

Rules:

- Plan construction remains read-only unless a caller explicitly invokes the
  production-group mutation module.
- Plan totals come from dependency inventory.
- Reference tab projection is delegated to `reference-sections.ts`.
- No file IO.

### `input-selection.ts`

Owns listing, resolving, selecting, clearing, and deleting shot-video inputs.

Exports:

- `listShotVideoTakeInputs`;
- `resolveShotVideoTakeInputFile`;
- `selectShotVideoTakeInput`;
- `clearShotVideoTakeInputSelection`;
- `deleteShotVideoTakeInput`;
- `updatePreparedShotVideoTakeInputSelection`.

Rules:

- Validate production group ownership before mutating selection.
- File deletion uses `project-media-files.ts`.
- Do not build provider payloads or dependency inventories.

### `project-media-files.ts`

Owns shot-video project-relative media file safety.

Exports:

- `assertShotVideoTakeProjectPath`;
- `statShotVideoTakeProjectFile`;
- `hashShotVideoTakeProjectFile`;
- `deleteShotVideoTakeProjectFile`;
- `mimeTypeForShotVideoTakePath`.

Rules:

- This is not a generic file utility module.
- Keep the project-folder containment check local and explicit.
- File-not-found and path-escape failures must use structured project data
  errors.

### `media-imports.ts`

Owns importing existing/generated files into shot-video project metadata.

Exports:

- `importShotInputMedia`;
- `importShotFirstFrame`;
- `importShotLastFrame`;
- `importShotReferenceImage`;
- `importShotMultiShotStoryboardSheet`;
- `importShotVideoTake`;
- `importShotVideoTakeProjectFile`.

Rules:

- Generation and import remain separate.
- May insert asset and asset-file records.
- May insert shot-video input and final take records.
- Must not estimate or run providers.

### `spec-records.ts`

Owns shared shot-video spec record access where input and final spec modules
need the same persisted spec operations.

Exports:

- `readShotVideoTakeSpecRecord`;
- `listShotVideoTakeSpecRecordsForTarget`;
- `createShotVideoTakeSpecRecord`;
- `updateShotVideoTakeSpecRecord`.

Rules:

- This file is allowed only if it owns real spec-record persistence behavior.
- Do not make it a pass-through wrapper over database access with no domain
  value.
- If implementation can keep this behavior clearer inside `input-specs.ts` and
  `final-specs.ts` without duplication, skip this file.

### `input-specs.ts`

Owns first-frame, last-frame, reference-image, and multi-shot-storyboard-sheet
spec lifecycle behavior.

Exports:

- `validateShotInputSpec`;
- `validateShotFirstFrameSpec`;
- `validateShotLastFrameSpec`;
- `validateShotReferenceImageSpec`;
- `validateShotMultiShotStoryboardSheetSpec`;
- `createShotInputSpec`;
- `createShotFirstFrameSpec`;
- `createShotLastFrameSpec`;
- `createShotReferenceImageSpec`;
- `createShotMultiShotStoryboardSheetSpec`;
- `updateShotInputSpec`;
- `updateShotFirstFrameSpec`;
- `updateShotLastFrameSpec`;
- `updateShotReferenceImageSpec`;
- `updateShotMultiShotStoryboardSheetSpec`;
- `listShotInputSpecs`;
- `listShotFirstFrameSpecs`;
- `listShotLastFrameSpecs`;
- `listShotReferenceImageSpecs`;
- `listShotMultiShotStoryboardSheetSpecs`;
- `prepareShotInputSpec`;
- `prepareShotInputDraftSpec`;
- `prepareShotFirstFrameSpec`;
- `prepareShotLastFrameSpec`;
- `prepareShotReferenceImageSpec`;
- `prepareShotMultiShotStoryboardSheetSpec`;
- `estimateShotInputSpec`;
- `estimateShotFirstFrameSpec`;
- `estimateShotLastFrameSpec`;
- `estimateShotReferenceImageSpec`;
- `estimateShotMultiShotStoryboardSheetSpec`.

Rules:

- Input spec normalization and validation live here.
- Provider payload construction is delegated to `provider-payloads.ts`.
- Shared generation service usage remains consistent with the current purpose
  registry contract.

### `final-specs.ts`

Owns final `shot.video-take` spec lifecycle behavior.

Exports:

- `validateShotVideoTakeSpec`;
- `createShotVideoTakeSpec`;
- `updateShotVideoTakeSpec`;
- `listShotVideoTakeSpecs`;
- `prepareShotVideoTakeSpec`;
- `prepareShotVideoTakeDraftSpec`;
- `estimateShotVideoTakeSpec`.

Rules:

- Final spec validation must require resolved route inputs.
- Provider payload construction is delegated to `provider-payloads.ts`.
- Do not add old API aliases.

### `generation-runs.ts`

Owns run execution and run recording for shot input and final video specs.

Exports:

- `runShotInputSpec`;
- `runShotFirstFrameSpec`;
- `runShotLastFrameSpec`;
- `runShotReferenceImageSpec`;
- `runShotMultiShotStoryboardSheetSpec`;
- `runShotVideoTakeSpec`;
- `recordShotVideoTakeGenerationRun`.

Rules:

- May call `estimateGeneration` and `runGeneration`.
- May record run rows.
- Must not import media files into project metadata.

### `generation-output-paths.ts`

Owns output folder resolution for shot-video generation runs.

Exports:

- `resolveShotVideoTakeGenerationOutputPaths`.

Rules:

- Keep generated output roots stable.
- Do not insert asset records or generation run records.

## Caller Updates

Update callers directly to the new owner modules.

Known server callers:

- `packages/core/src/server/project-data-service-wiring/shot-video-take.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`

Known tests/static checks:

- `packages/core/src/server/media-generation/shot-video-take.test.ts`
- `packages/core/tests/integration/media-generation-dependency-static-contracts.test.ts`
- `packages/core/tests/integration/media-generation-dependency-slots.test.ts`
- `packages/core/tests/integration/media-generation-dependency-inventory.test.ts`
- `packages/core/tests/integration/media-generation-dependency-draft-estimates.test.ts`

Required import rule:

- `project-data-service-wiring/shot-video-take.ts` must import each operation
  from its owner module, not from a shot-video namespace barrel.
- `purpose-registry.ts` must import each operation from its owner module.
- Tests should import from the service surface when testing service behavior and
  from owner modules only when testing module-specific contracts.

## Test Refactor Plan

Split the broad test file into behavior-focused files that correspond to the
new module ownership.

Preferred location:

```text
packages/core/src/server/media-generation/shot-video-take/
```

Proposed test files:

```text
shot-video-take/context.test.ts
shot-video-take/production-groups.test.ts
shot-video-take/production-plan.test.ts
shot-video-take/preflight-report.test.ts
shot-video-take/reference-sections.test.ts
shot-video-take/input-selection.test.ts
shot-video-take/media-imports.test.ts
shot-video-take/spec-validation.test.ts
shot-video-take/dependency-draft-specs.test.ts
```

Shared fixture owner:

```text
packages/core/src/server/testing/shot-video-take-fixtures.ts
```

Fixture responsibilities:

- create a temporary configured home directory;
- create the sample movie project;
- read stable scene, cast, and location ids;
- write a sample shot list with a requested shot count;
- write project media files under the current project folder;
- create and activate a sample Lookbook;
- import a Lookbook sheet, character sheet, location environment sheet, and
  shot input when a test needs those records;
- check whether a project file exists after deletion behavior.

Fixture rules:

- Use domain names such as `createShotVideoTakeTestProject`,
  `writeShotVideoTakeShotList`, and `writeShotVideoTakeProjectFile`.
- Do not add vague helpers such as `setupEverything`.
- Keep test state visible at the call site.
- Do not place reusable test-only behavior in production modules.

### Test Case Mapping

`preflight-report.test.ts`:

- reports requested input slots as non-blocking dependency suggestions;
- preserves imported input file paths in preflight prepared inputs;
- builds input plan items from dependency inventory lines;
- sets `finalTake.canCreateSpec` from route input readiness and diagnostics;
- keeps excluded default multi-shot storyboard references visible for restore
  if this behavior remains owned by preflight/report composition.

`production-groups.test.ts`:

- persists and clears one-shot rail groups without deleting single-shot
  settings;
- copies group settings on split and marks copied prompts stale for new shot
  ids;
- keeps upper group settings when two rail groups merge;
- rejects overlapping and non-contiguous rail groups with structured core
  errors;
- preserves requested input and prepared input membership rules when shots move
  between groups.

`production-plan.test.ts`:

- estimates a first-frame take when saved duration is numeric but the provider
  expects a string enum;
- drops stale settings unsupported by the selected route before estimating;
- includes planned dependency costs in the plan total;
- prices selected missing visual references for text-only shot video plans;
- keeps selected generated locations ready in the dependency inventory;
- excludes optional reference-image dependencies from shot-video plans when
  excluded by current inclusion rules.

`reference-sections.test.ts`:

- reports an active Lookbook reference as needed when no reference image exists;
- shows scene cast choices without planning unselected character-sheet
  dependencies;
- excludes voice-over cast members from shot character-sheet references;
- uses the selected Lookbook sheet as the concrete ready reference input;
- shows shot-scoped planned reference image dependencies in the production plan;
- rejects excluding first-frame references required by the selected route;
- shows multiple imported image input takes once with one selected.

`input-selection.test.ts`:

- validates selected input ownership before mutating another group selection;
- clears selected inputs by kind and subject;
- deletes an input take and promotes another matching take when selected;
- deletes the project file through the project-media file owner.

`media-imports.test.ts`:

- imports first-frame, last-frame, reference-image, and multi-shot storyboard
  sheet inputs with stable asset/file/input records;
- imports final shot video takes with stable take records;
- resolves prepared cast sheet inputs without a shot video take input row if
  that behavior stays in prepared-input projection;
- rejects source paths outside the project folder.

`spec-validation.test.ts`:

- rejects a multi-shot final spec without the required storyboard sheet;
- validates input specs against shot group context;
- validates final specs against route requirements;
- rejects stale shot groups;
- rejects unsupported route parameters with structured errors;
- requires authored prompts and reference-image titles where current contracts
  require them.

`dependency-draft-specs.test.ts`:

- returns estimate-only draft specs for pricing before dependency prompts are
  authored;
- returns `needs-authored-draft` for dependency materialization when prompt
  authoring is missing;
- returns `generatable` for authored dependency drafts;
- rejects unsupported dependency kinds and invalid targets with structured
  errors.

Shared dependency inventory tests should remain in `packages/core/tests/integration`
unless they are truly shot-video-module tests:

- `media-generation-dependency-inventory.test.ts`
- `media-generation-dependency-slots.test.ts`
- `media-generation-dependency-draft-estimates.test.ts`
- `media-generation-dependency-static-contracts.test.ts`

## Static And Architecture Checks

Add focused checks after the refactor lands.

Do not add a global source-size checker.

Recommended updates:

- add `packages/core/src/client/media-generation.ts` to deleted-path checks;
- add `packages/core/src/server/media-generation/shot-video-take.ts` to
  deleted-path checks;
- update `media-generation-dependency-static-contracts.test.ts` so it checks
  current owner modules instead of reading the deleted shot-video file;
- add a Core architecture test that rejects
  `packages/core/src/server/media-generation/shot-video-take/index.ts`;
- add a Core architecture test that rejects
  `packages/core/src/client/media-generation/index.ts`;
- add a Core architecture test that rejects direct imports from the deleted
  `client/media-generation.js` path;
- add a Core architecture test that keeps dependency graph execution fields out
  of public client contracts and source, preserving the `0064` cleanup.

Optional scoped lint after the split:

- apply `complexity`, `max-depth`, and `no-nested-ternary` only to the new
  shot-video module folder if the resulting rule is low-noise;
- do not add `max-lines` or `max-lines-per-function` unless a future accepted
  plan changes the enforcement policy from `0066`.

## Implementation Order

### Slice 1: Characterize Current Behavior

Run focused tests before moving code.

Suggested commands:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/shot-video-take.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-inventory.test.ts tests/integration/media-generation-dependency-slots.test.ts tests/integration/media-generation-dependency-draft-estimates.test.ts tests/integration/media-generation-dependency-static-contracts.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/architecture.test.ts --no-file-parallelism
```

If unrelated local changes make these fail, record the failure before moving
code and keep this refactor focused.

### Slice 2: Split Client Contracts

Create the new client contract files.

Move one public contract group at a time:

- purposes;
- targets;
- dependency inventory;
- lifecycle records;
- purpose-specific context/spec/model/import reports.

Update:

- `packages/core/src/client/index.ts`;
- direct internal imports from `media-generation.js`;
- typecheck-visible references.

Delete `packages/core/src/client/media-generation.ts` only after every caller
has moved.

### Slice 3: Extract Server Foundation

Create and wire:

- `diagnostics.ts`;
- `purpose-config.ts`;
- `project-session.ts`;
- `shot-group.ts`;
- `context.ts`;
- `resource-keys.ts`;
- `reference-scope.ts`;
- `reference-selection.ts`;
- `reference-inclusions.ts`.

Keep behavior unchanged for:

- context shape;
- target ids;
- resource keys;
- shot id normalization;
- required reference inclusion failures.

### Slice 4: Extract Route, Model, And Provider Modules

Create and wire:

- `model-list.ts`;
- `route-settings.ts`;
- `provider-payloads.ts`.

Keep behavior unchanged for:

- route-specific parameter reports;
- duration normalization;
- stale setting warning inputs;
- input-slot matching;
- pricing payload input counts;
- final provider payloads;
- shot input provider payloads.

Acceptance check:

- validation, estimate, prepare, and run use the same provider payload builders.

### Slice 5: Extract Production Group Mutations

Create and wire:

- `production-groups.ts`.

Keep behavior unchanged for:

- creating and updating production groups;
- rail split, merge, and clear behavior;
- copied prompt staleness after membership changes;
- single-shot group preservation;
- structured errors for invalid rail groups.

### Slice 6: Extract Dependency Inventory And Draft Specs

Create and wire:

- `dependency-inventory.ts`;
- `dependency-draft-specs.ts`.

Keep the existing `dependency-slots.ts` and adjust it only as needed to import
from new context/selection owners.

Keep behavior unchanged for:

- `declareShotVideoTakeDependencies`;
- optional and required dependency slots;
- selected reference context dependencies;
- dependency inventory totals;
- estimate-only draft specs;
- `needs-authored-draft` materialization state.

Acceptance check:

- no dependency map, dependency graph execution, or topological execution
  language is introduced.

### Slice 7: Extract Preflight And Production Plan Projection

Create and wire:

- `preflight-inputs.ts`;
- `preflight-report.ts`;
- `production-plan.ts`.

Keep behavior unchanged for:

- `previewShotVideoTakeProduction`;
- `estimateShotVideoTakeProduction`;
- `planShotVideoTakeProduction`;
- `readShotVideoTakeProductionPlan`;
- `inputsToCreate`;
- `inputPlanItems`;
- `finalTake.canCreateSpec`;
- `agentBrief`.

Acceptance check:

- plan totals are read from dependency inventory;
- plan/report code does not import file IO or import modules.

### Slice 8: Split Reference Section Projection

Refactor the current `reference-sections.ts` into:

- `reference-card-plans.ts`;
- `reference-sections.ts`;
- already-created reference scope, selection, and inclusion modules.

Keep behavior unchanged for:

- General reference choices;
- Lookbook reference choices;
- Cast member reference groups;
- Location reference groups;
- card states;
- preview images;
- out-of-scope diagnostics;
- selected/default/included/required flags.

Acceptance check:

- `reference-sections.ts` is a report composer, not a duplicate owner of
  selection, inclusion, preview, and card-state logic.

### Slice 9: Extract Selection, Import, Spec, And Run Modules

Create and wire:

- `input-selection.ts`;
- `project-media-files.ts`;
- `media-imports.ts`;
- `spec-records.ts` if needed;
- `input-specs.ts`;
- `final-specs.ts`;
- `generation-runs.ts`;
- `generation-output-paths.ts`.

Keep behavior unchanged for:

- listing and resolving inputs;
- selecting, clearing, deleting, and promoting inputs;
- project-relative file safety;
- importing shot input media;
- importing final shot video takes;
- input and final spec validation;
- prepare, estimate, run, and run recording.

Acceptance check:

- generation remains separate from import;
- file deletion cannot escape the project folder;
- project media import code does not call provider execution.

### Slice 10: Update Service Wiring And Purpose Registry

Update direct imports in:

- `project-data-service-wiring/shot-video-take.ts`;
- `media-generation/purpose-registry.ts`.

Rules:

- Import each operation from its owner module.
- Do not use namespace imports from a local shot-video barrel.
- Keep shared generation service wiring unchanged where it already owns the
  public service operation.

### Slice 11: Split Tests

Create the fixture owner and move test cases into the corresponding focused
test files.

Rules:

- Move behavior tests with the module/behavior they describe.
- Keep shared dependency inventory contract tests in `tests/integration`.
- Delete `shot-video-take.test.ts` once every case has a new owner.
- Avoid broad fixture helpers that hide important state.

### Slice 12: Add Static Checks

Update focused architecture/static checks:

- deleted client/server large files stay deleted;
- local shot-video/client media-generation barrels stay absent;
- direct imports from deleted paths stay absent;
- dependency graph execution fields stay absent.

Run `pnpm check:architecture` after these changes.

### Slice 13: Final Verification

Run focused commands:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/shot-video-take --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-inventory.test.ts tests/integration/media-generation-dependency-slots.test.ts tests/integration/media-generation-dependency-draft-estimates.test.ts tests/integration/media-generation-dependency-static-contracts.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/architecture.test.ts --no-file-parallelism
pnpm lint:core
pnpm type-check:core
pnpm test:typecheck:core
```

Then run:

```bash
pnpm check
```

## Review Guidance

Reviewers should reject an implementation if it:

- keeps either giant file as a compatibility path;
- creates a local pure re-export barrel to avoid updating imports;
- moves code into vague helper files;
- duplicates dependency slot/id behavior;
- revives dependency graph execution language;
- computes Studio or CLI prices outside dependency inventory;
- mixes file IO with provider payload or dependency planning;
- hides invalid state behind quiet fallbacks;
- leaves the broad shot-video test file intact.

Reviewers should accept small implementation-only deviations if they:

- keep ownership clear;
- reduce coupling;
- keep module names domain-specific;
- preserve current public behavior;
- improve structured diagnostics;
- make the test mapping easier to understand.

## Completion Checklist

### Review Area

- [x] Confirm `0067` supersedes the file-structure portions of `0062`.
- [x] Confirm dependency planning follows the `0063`/`0064` dependency inventory
  architecture.
- [x] Confirm no dependency graph execution, dependency map, execution level,
  or topological-node language is introduced.
- [x] Confirm no compatibility files, old-path aliases, local barrels, or
  pass-through wrappers are added.
- [x] Confirm all new file names are domain-specific and avoid vague helper
  names.
- [x] Confirm public contract names follow
  `docs/architecture/naming-guidelines.md`.

### Client Contract Split

- [x] Create `media-generation-purpose.ts`.
- [x] Create `media-generation-target.ts`.
- [x] Create `media-generation-dependency.ts`.
- [x] Create `media-generation-lifecycle.ts`.
- [x] Create `lookbook-media-generation.ts`.
- [x] Create `cast-media-generation.ts`.
- [x] Create `location-media-generation.ts`.
- [x] Create `scene-audio-generation.ts`.
- [x] Create `scene-storyboard-media-generation.ts`.
- [x] Create `shot-video-take-generation.ts`.
- [x] Move purpose constants and `MediaGenerationPurpose` to the purpose owner.
- [x] Move target shapes to the target owner.
- [x] Move dependency inventory and plan-line contracts to the dependency owner.
- [x] Move spec/run/prepare lifecycle contracts to the lifecycle owner.
- [x] Move purpose-specific contexts, specs, model reports, and import reports
  to their purpose owners.
- [x] Update `packages/core/src/client/index.ts` to re-export from the new
  owner files.
- [x] Update all direct imports from `client/media-generation.js`.
- [x] Delete `packages/core/src/client/media-generation.ts`.
- [x] Confirm no `packages/core/src/client/media-generation/index.ts` barrel is
  created.

### Server Foundation

- [x] Create `diagnostics.ts`.
- [x] Create `purpose-config.ts`.
- [x] Create `project-session.ts`.
- [x] Create `shot-group.ts`.
- [x] Create `context.ts`.
- [x] Create `resource-keys.ts`.
- [x] Move shot input purpose config and purpose/kind helpers.
- [x] Move project/session helpers.
- [x] Move screenplay and scene hierarchy requirements.
- [x] Move shot id normalization and shot group preparation.
- [x] Move context construction.
- [x] Move resource key construction.
- [x] Confirm context code does not import provider payload, dependency
  inventory, import, or run modules.

### Route, Model, And Provider Payloads

- [x] Create `model-list.ts`.
- [x] Create `route-settings.ts`.
- [x] Create `provider-payloads.ts`.
- [x] Move shot-video model list report construction.
- [x] Move shot input model list report construction.
- [x] Move default model choice behavior.
- [x] Move route requirement and route parameter projection.
- [x] Move duration support normalization.
- [x] Move route setting normalization.
- [x] Move final provider payload construction.
- [x] Move pricing provider payload construction.
- [x] Move shot input provider payload construction.
- [x] Move prepared generation request conversion.
- [x] Confirm validation, estimate, prepare, and run use the same payload
  builders.
- [x] Confirm provider payload modules do not read databases or write files.

### Production Groups

- [x] Create `production-groups.ts`.
- [x] Move `updateShotVideoTakeProductionGroup`.
- [x] Move `updateShotVideoTakeRailGroups`.
- [x] Move rail group input normalization.
- [x] Move source/merge partner resolution.
- [x] Move single-shot group preservation.
- [x] Move copied production plan membership behavior.
- [x] Move production group ordering.
- [x] Confirm production group mutation code does not import provider,
  dependency inventory, reference card, import, or run modules.

### Dependency Inventory

- [x] Keep `dependency-slots.ts` as the only slot declaration owner.
- [x] Create `dependency-inventory.ts`.
- [x] Create `dependency-draft-specs.ts`.
- [x] Move `buildShotVideoTakeDependencyInventory`.
- [x] Move `declareShotVideoTakeDependencies`.
- [x] Move dependency slot construction from context.
- [x] Move final estimate extraction from dependency inventory.
- [x] Move shot input dependency draft spec construction.
- [x] Confirm dependency inventory uses shared planner and plan lines.
- [x] Confirm no local dependency-map or graph execution model is introduced.
- [x] Confirm dependency draft specs preserve estimate-only and
  needs-authored-draft behavior.

### References

- [x] Create `reference-scope.ts`.
- [x] Create `reference-selection.ts`.
- [x] Create `reference-inclusions.ts`.
- [x] Create `reference-card-plans.ts`.
- [x] Refactor `reference-sections.ts` into a small composer.
- [x] Move narrative reference scope extraction.
- [x] Move shot reference scope extraction.
- [x] Move selected/default cast helpers.
- [x] Move selected/default location helpers.
- [x] Move selected Lookbook sheet helpers.
- [x] Move selected character/environment sheet helpers.
- [x] Move selected location view helpers.
- [x] Move reference inclusion override validation.
- [x] Move prepared input filtering by reference inclusion.
- [x] Move card state projection.
- [x] Move asset and dependency preview projection.
- [x] Confirm selection logic is not duplicated between context and reference
  sections.
- [x] Confirm selected generated dependencies never fall back to quiet
  `not-applicable` pricing.

### Preflight And Production Plans

- [x] Create `preflight-inputs.ts`.
- [x] Create `preflight-report.ts`.
- [x] Create `production-plan.ts`.
- [x] Move prepared input projection.
- [x] Move Lookbook sheet prepared input projection.
- [x] Move `inputsToCreate` projection from dependency inventory.
- [x] Move preflight input checklist item projection.
- [x] Move preflight validation.
- [x] Move final spec construction for preflight.
- [x] Move agent brief projection.
- [x] Move `previewShotVideoTakeProduction`.
- [x] Move `planShotVideoTakeProduction`.
- [x] Move `estimateShotVideoTakeProduction`.
- [x] Move `readShotVideoTakeProductionPlan`.
- [x] Confirm production plan construction is read-only.
- [x] Confirm plan totals come from dependency inventory.
- [x] Confirm plan/report code has no file IO or import behavior.

### Selection, Imports, Specs, And Runs

- [x] Create `input-selection.ts`.
- [x] Create `project-media-files.ts`.
- [x] Create `media-imports.ts`.
- [x] Create `spec-records.ts` only if it owns real spec-record behavior.
- [x] Create `input-specs.ts`.
- [x] Create `final-specs.ts`.
- [x] Create `generation-runs.ts`.
- [x] Create `generation-output-paths.ts`.
- [x] Move input listing and file resolution.
- [x] Move input selection, clearing, deletion, and promotion behavior.
- [x] Move prepared input selection mutation.
- [x] Move project file stat/hash/delete/path-safety behavior.
- [x] Move shot input import behavior.
- [x] Move final video import behavior.
- [x] Move input spec normalization and validation.
- [x] Move final spec normalization and validation.
- [x] Move input and final spec list/prepare/estimate behavior.
- [x] Move generation output path resolution.
- [x] Move run execution and run recording.
- [x] Confirm import remains separate from generation.
- [x] Confirm project-relative paths cannot escape the project folder.

### Caller Updates

- [x] Update `project-data-service-wiring/shot-video-take.ts` to import from
  owner modules.
- [x] Update `purpose-registry.ts` to import from owner modules.
- [x] Remove namespace import from the deleted shot-video module.
- [x] Update all tests that imported or read the old shot-video file.
- [x] Use `rg "shot-video-take\\.js|media-generation\\.js" packages` to find
  stale imports after the move.
- [x] Delete `packages/core/src/server/media-generation/shot-video-take.ts`.
- [x] Confirm no `shot-video-take/index.ts` barrel is created.

### Test Refactor

- [x] Create `packages/core/src/server/testing/shot-video-take-fixtures.ts`.
- [x] Move shared setup from `shot-video-take.test.ts` into domain-named
  fixture helpers.
- [x] Create `context.test.ts` if context-specific behavior needs direct
  coverage. Not needed: context behavior remains covered through the
  production-plan, reference-section, preflight, and dependency inventory tests.
- [x] Create `production-groups.test.ts`.
- [x] Create `production-plan.test.ts`.
- [x] Create `preflight-report.test.ts`.
- [x] Create `reference-sections.test.ts`.
- [x] Create `input-selection.test.ts`.
- [x] Create `media-imports.test.ts`.
- [x] Create `spec-validation.test.ts`.
- [x] Create `dependency-draft-specs.test.ts`.
- [x] Move each existing broad test case into its new owner file.
- [x] Keep shared inventory tests in `packages/core/tests/integration`.
- [x] Delete `packages/core/src/server/media-generation/shot-video-take.test.ts`.
- [x] Confirm fixture helpers do not hide important state behind broad setup
  names.

### Static And Architecture Checks

- [x] Add deleted-path coverage for `packages/core/src/client/media-generation.ts`.
- [x] Add deleted-path coverage for
  `packages/core/src/server/media-generation/shot-video-take.ts`.
- [x] Add coverage that rejects `packages/core/src/client/media-generation/index.ts`.
- [x] Add coverage that rejects
  `packages/core/src/server/media-generation/shot-video-take/index.ts`.
- [x] Update dependency static contracts to inspect current owner modules.
- [x] Keep dependency graph execution fields and obsolete imports rejected.
- [x] Confirm no broad source-size check is added in this implementation.
- [x] Add scoped complexity/depth lint only if it stays low-noise and passes
  cleanly after the split. Not needed: the existing architecture tests and
  no-forbidden-reexports check cover the split without adding noisy size rules.

### Documentation

- [x] Update `docs/architecture/media-generation.md` if file ownership details
  become durable architecture.
- [x] Update `docs/architecture/reference/media-generation.md` only if public
  contract names or meanings change. Not needed: ownership changed, not public
  contract meaning.
- [x] Add an ADR only if implementation changes a durable architecture rule,
  not merely because files moved. Not needed: this completed the planned module
  ownership split without creating a new durable rule.
- [x] Do not edit old historical plans just to replace stale names.
- [x] Mark or annotate `0062` only if the team wants historical plans to point
  to this replacement; do not rewrite its old implementation details. Not
  needed: no request was made to edit historical plans.

### Validation

- [x] Run the focused shot-video module tests.
- [x] Run focused dependency inventory tests.
- [x] Run focused dependency slot tests.
- [x] Run focused dependency draft estimate tests.
- [x] Run focused dependency static contract tests.
- [x] Run Core architecture tests.
- [x] Run `pnpm lint:core`.
- [x] Run `pnpm type-check:core`.
- [x] Run `pnpm test:typecheck:core`.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm check`.

### Final Verification

- [x] Confirm the old client and server giant files are deleted.
- [x] Confirm no compatibility stubs or local barrels remain.
- [x] Confirm
  `rg "client/media-generation\\.js|media-generation/shot-video-take\\.js" packages`
  returns no stale imports.
- [x] Confirm
  `rg "dependency-map|dependency graph|execution\\.levels|topologicalNodeIds" packages`
  does not find revived dependency graph contracts in source or tests.
- [x] Confirm git diff contains only the planned refactor, test split,
  architecture checks, and necessary import updates.
- [x] Confirm all verification commands pass or document any pre-existing
  unrelated failures.
