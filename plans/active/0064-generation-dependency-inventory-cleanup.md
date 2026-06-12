# 0064 Generation Dependency Inventory Cleanup

Status: implemented
Date: 2026-06-12

## Implementation Result

Implemented on 2026-06-12.

The cleanup keeps dependency inventory as the pricing and reference source of
truth, removes the duplicate shot-video slot/id path, moves dependency id and
draft estimate ownership into focused core modules, makes selector defaulting
explicit, and surfaces dependency diagnostics in Studio.

Final verification run:

- `pnpm test:core`
- `pnpm test:studio`
- `pnpm test:typecheck`
- `pnpm lint`
- `pnpm check`

Additional focused verification run during implementation:

- focused dependency slot tests;
- focused dependency inventory tests;
- focused dependency draft estimate classification tests;
- focused dependency static contract tests;
- focused shot-video core regression tests;
- focused Studio References and AI Production tab tests;
- full Studio shot-video estimate matrix.

Desktop Chrome verification was completed against the local Studio app for the
two screenshot-like scenes from `0063`:

- The First Patron (`scene_zp6ysnpy`, `shot_001`) showed priced selected first
  and last frames, selected missing cast sheets, and a selected missing location
  sheet in References; AI Production showed an estimated total of `$2.10`.
- Bombardment (`scene_djkfgf9p`, `shot_001`) showed priced selected first frame,
  selected cast sheets, selected location sheets, and a Reference Issues
  diagnostic; AI Production showed an estimated total of `$0.62`.

Screenshots were saved during verification:

- `/private/tmp/renku-first-patron-references.png`
- `/private/tmp/renku-first-patron-ai-production.png`
- `/private/tmp/renku-bombardment-references.png`
- `/private/tmp/renku-bombardment-ai-production.png`

## Summary

The dependency inventory rewrite in `0063` moved the product in the right
direction: public graph execution fields are gone, inventory lines now carry
pricing, and selected generated Reference cards are mostly inventory-backed.

This cleanup plan is the next pass. It focuses on the remaining architecture
risk rather than adding new product behavior:

- remove duplicated shot-video dependency slot and dependency-id logic;
- replace implicit fallbacks with explicit, product-sanctioned states;
- fail fast with structured diagnostics when declarations, selectors, or
  estimates are invalid;
- surface dependency diagnostics consistently in Studio;
- add the missing selector, duplicate declaration, cycle, and static tests;
- keep the cleanup scoped enough that reviewers can reason about it.

The goal is not to make every media-generation file small. The goal is to make
the dependency inventory contract impossible to accidentally bypass.

## Relationship To Existing Plans

This plan follows `0063-generation-dependency-inventory-rewrite.md`.

It also resolves the dependency-related conflict in
`0062-shot-video-take-core-refactor.md`. `0062` still describes a dependency
graph bridge and dependency-map file. That language is now obsolete. Before this
cleanup is implemented, `0062` must be revised or explicitly superseded for
dependency planning so future file-splitting work does not preserve the old
graph shape under new filenames.

This plan does not replace all of `0062`. The broader shot-video file-size
cleanup can still happen later, but it must build on the inventory contract
from `0063` and this plan.

## Product Rule For Fallbacks

Fallback behavior is allowed only when it is a named product alternative with a
known owner, a stable state, and tests.

Allowed current fallback-like states:

- `inputPolicy.defaultMode: "auto"` may reuse a real selected asset when the
  selector resolves exactly one valid asset.
- `inputPolicy.defaultMode: "regenerate"` may intentionally ignore an existing
  asset and plan a generated dependency, because the user or agent selected
  regeneration.
- A satisfied dependency contributes `$0.00`.
- A manual attachment dependency uses `not-applicable` pricing because it is not
  generation work.
- Unselected Reference tab alternatives, including location view cards, may use
  quiet `not-applicable` card pricing because they are not selected dependency
  work.
- A generation route may return `unpriced` only when the route is valid and
  provider-supported, but Studio intentionally lacks pricing metadata for that
  exact route. Invalid routes, malformed specs, and internal failures must
  return structured diagnostics instead.

Not allowed:

- treating unknown selector kinds as missing;
- treating wrong request shapes as missing;
- picking the first asset or first Lookbook sheet unless that default is
  explicitly part of the selector contract;
- converting thrown planner or root-estimate bugs into an empty diagnostic list;
- merging duplicate dependency declarations with different targets, selectors,
  labels, or dependency kinds;
- parsing dependency ids in React to infer mutation behavior;
- falling back to `not-applicable` pricing for selected generated dependencies.

## Findings

### 1. Shot Video Has Two Dependency Slot Systems

`packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts`
defines the intended purpose-owned slot declarations.

`packages/core/src/server/media-generation/shot-video-take.ts` still defines and
uses a second system:

- `RequiredShotVideoTakeInputSlot` at `shot-video-take.ts:190`;
- `requiredInputSlots` at `shot-video-take.ts:3933`;
- `referenceBundleSlots` at `shot-video-take.ts:3968`;
- `dependencyForInputKind` at `shot-video-take.ts:4081`;
- `dependencyIdForInput` at `shot-video-take.ts:4153`;
- `toMediaGenerationDependencySlot` at `shot-video-take.ts:1970`;
- `selectorForRequiredInputSlot` at `shot-video-take.ts:1984`.

Impact:

- The generic shared planning path and the shot-video production preflight path
  can drift.
- Requiredness can be changed in one path without changing the other.
- Dependency ids are generated in multiple places.
- A future cleanup could split files while preserving duplicate behavior.

Expected cleanup:

- `declareShotVideoTakeDependencySlots` becomes the only shot-video slot
  declaration source.
- `RequiredShotVideoTakeInputSlot` and conversion helpers are deleted.
- `inputsToCreate`, `inputPlanItems`, and Reference cards are projections from
  inventory lines, not from a second slot model.

### 2. Dependency Ids Are Built And Parsed In Too Many Places

Stable dependency ids are currently constructed in shared slot definitions, in
shot-video core, and parsed again in Studio:

- `dependency-slot-definitions.ts:15`, `:37`, `:60`, `:92`;
- `shot-video-take.ts:4153`;
- `shot-video-take.ts:2493`;
- `scene-shot-references-tab.tsx:338`.

Impact:

- React can silently fail to clear a selected dependency if the id grammar
  changes.
- Core projection code can parse an id into the wrong input kind and still
  return a plausible UI label.
- The dependency id grammar is architecture, but it is not represented as one
  tested contract.

Expected cleanup:

- Core owns dependency id construction and parsing in one deliberately named
  module, such as `dependency-identifiers.ts`.
- Studio receives explicit mutation data from core, for example a
  `clearInputSlot` field on selected general reference choices, and stops
  parsing dependency ids.
- All dependency id parsing becomes exhaustive and covered by static and unit
  tests.

### 3. Selectors Use Silent Missing And First-Row Defaults

`resolveMediaGenerationDependencySelection` returns `noAsset()` for several
cases that are not all product-sanctioned missing states:

- unknown selector kind falls through to `noAsset()` at
  `dependency-selectors.ts:75`;
- shot-video selector with the wrong request kind returns `noAsset()` at
  `dependency-selectors.ts:82`;
- shot-video selector with the wrong purpose returns `noAsset()` at
  `dependency-selectors.ts:86`;
- asset relationships use `selectedAssets[0] ?? first available asset` at
  `dependency-selectors.ts:159`;
- Lookbook selector picks `listLookbookSheets(...)[0]` at
  `dependency-selectors.ts:53`.

Impact:

- A broken selector request can look like a normal missing dependency.
- A dependency can be satisfied by an arbitrary first row rather than a
  user-selected or explicitly defaulted asset.
- Lookbook behavior depends on list order instead of a selector policy that
  names whether defaulting is allowed.

Expected cleanup:

- Selector input contracts must name selection policy explicitly, for example
  `selected-only` or `selected-or-default`.
- Each selector kind must be handled exhaustively.
- Wrong request shape should emit a structured invalid selector diagnostic, not
  a quiet missing state.
- Default selection is allowed only where the product has accepted it and tests
  prove the default source.

### 4. Location Environment Sheet Metadata Failures Are Too Generic

Location environment sheet dependencies require a composite image role. The
selector looks up the environment sheet metadata and composite file id at
`dependency-selectors.ts:190`.

If metadata is absent, the selector currently reports the same missing-file
error used for ordinary image assets.

Impact:

- The user or agent is told to import/regenerate a file when the real problem
  might be invalid environment-sheet metadata.
- The inventory cannot distinguish "asset exists but is not a valid location
  environment sheet" from "asset has no image file."

Expected cleanup:

- Missing environment-sheet metadata gets its own structured diagnostic code,
  such as `CORE_MEDIA_DEPENDENCY_ENVIRONMENT_SHEET_METADATA_MISSING`.
- Missing composite file id and missing composite file record are separate
  selector diagnostics.
- Tests cover each invalid location state.

### 5. Planner Duplicate Declarations Are Merged Too Loosely

`planMediaGenerationDependencyInventory` dedupes by stable dependency id and
mutates requiredness:

```ts
existing.required = existing.required || slot.required;
```

That happens at `dependency-inventory.ts:100`.

Impact:

- Two declarations with the same id but different kind, target, selector,
  media kind, or label are silently merged.
- A bad recursive declaration can alter requiredness and lineage instead of
  failing at the source.
- Reviewers cannot trust that dedupe means the declarations were actually the
  same dependency.

Expected cleanup:

- Duplicate declarations are accepted only when the structural dependency
  identity matches.
- Conflicting declarations emit a structured diagnostic, such as
  `CORE_MEDIA_DEPENDENCY_CONFLICTING_DECLARATION`.
- Requiredness merging remains allowed only for structurally identical
  declarations.
- Tests cover identical dedupe, conflicting dedupe, cycle detection, and max
  depth.

### 6. Generated Draft And Estimate Failures Are Too Forgiving

`buildMediaGenerationDependencyDraftSpec` defaults missing
`materializationState` to `generatable` at `dependency-draft-specs.ts:59`.

`planMediaGenerationDependencyInventory` initializes generated dependency
pricing as `not-applicable` before estimating at `dependency-inventory.ts:217`.

`shared-generation-service.ts` catches root estimate failures at
`shared-generation-service.ts:202` and returns an unpriced root line with
`diagnostics: []`.

Impact:

- A purpose can forget to declare whether a dependency draft is runnable and the
  planner assumes it is runnable.
- A root estimate failure can disappear from diagnostics.
- A planner bug can become "unpriced" instead of a structured failure that
  tells the caller what broke.

Expected cleanup:

- Dependency draft builders must return an explicit materialization state.
- Missing materialization state is a structured draft-builder error.
- Root estimate failures include structured diagnostics.
- Only provider pricing absence should produce `unpriced`; invalid draft specs
  and thrown root-estimate errors should be diagnosed distinctly.

### 7. Reference Issues Filters Out Inventory Diagnostics

`SceneShotReferencesTab` filters diagnostics through
`isReferenceDiagnosticIssue` at `scene-shot-references-tab.tsx:259`. The filter
includes shot-specific prefixes but not general
`CORE_MEDIA_DEPENDENCY_*` selector and inventory diagnostics.

Impact:

- Invalid selector diagnostics can be present in the production plan but absent
  from the Reference Issues section.
- The user sees a missing or unavailable card without the actionable reason.

Expected cleanup:

- Reference Issues includes inventory diagnostics that affect Reference tab
  cards.
- Diagnostic filtering should be driven by core-provided reference diagnostics
  or explicit diagnostic locations, not only string prefixes in React.

### 8. Shot Video Core Is Still Too Complex Around Dependency Work

`shot-video-take.ts` is currently about 5,038 lines. Its dependency and
reference projection responsibilities are mixed with rail grouping, provider
payloads, import behavior, validation, context construction, and UI report
projection.

Impact:

- Small dependency changes touch a large file with unrelated behavior.
- Private functions rely on local string parsing and implicit defaults.
- Tests are broad and expensive to use as a safety net for focused dependency
  behavior.

Expected cleanup:

- Extract only dependency inventory and reference projection ownership needed
  for this cleanup.
- Do not perform the full `0062` mechanical split.
- Use names that describe product responsibilities, such as
  `shot-video-take/dependency-inventory.ts` and
  `shot-video-take/reference-sections.ts`.

## Target Contract Changes

### `MediaGenerationDependencySelectorInput`

Selector contracts should make defaulting explicit.

Proposed shape:

```ts
type MediaGenerationAssetSelectionPolicy =
  | 'selected-only'
  | 'selected-or-default';

type MediaGenerationDependencySelectorInput =
  | {
      kind: 'shot-video-input';
      inputKind: ShotVideoTakeInputKind;
      productionGroupId: string;
      shotIds: string[];
      subjectKind?: ShotVideoTakeInputSubjectKind;
      subjectId?: string;
    }
  | {
      kind: 'asset-relationship';
      target: AssetTarget;
      role: string;
      mediaKind: MediaKind;
      fileRole?: string;
      selectionPolicy: MediaGenerationAssetSelectionPolicy;
    }
  | {
      kind: 'lookbook-sheet';
      lookbookId: string;
      lookbookSheetId?: string;
      selectionPolicy: MediaGenerationAssetSelectionPolicy;
    }
  | {
      kind: 'manual-attachment';
      target: MediaGenerationTarget;
    };
```

Rules:

- `selected-only` means no selected asset is `missing`, not "use the first
  available asset."
- `selected-or-default` must name where default comes from and must be tested.
- `lookbookSheetId` is a concrete selected sheet, not a display preference.
- Invalid selected/default records are `invalid-selection` with structured
  diagnostics.

### Dependency Id Ownership

Add one dependency-id contract module in core, not a generic helper barrel.

Required responsibilities:

- build dependency ids for supported dependency kinds;
- parse dependency ids used by shot-video input projections;
- reject malformed ids through typed results or structured diagnostics;
- provide the exact clear-input slot data needed by Studio so React does not
  parse ids.

Potential file:

```text
packages/core/src/server/media-generation/dependency-identifiers.ts
```

This file owns the dependency id grammar. It must not re-export unrelated
media-generation types.

### Reference Card Mutation Data

Reference tab data should carry explicit mutation data.

Example:

```ts
interface ShotVideoTakeGeneralReferenceChoice {
  id: string;
  kind: ShotVideoTakeGeneralReferenceKind;
  title: string;
  selected: boolean;
  clearInputSlot: ShotVideoTakeInputSlot | null;
  card: ShotVideoTakeReferenceCardPlan;
}
```

Rules:

- Studio calls `onClearInput(clearInputSlot)` only when the field is present.
- Studio does not derive mutation behavior from `dependencyId`.
- Core is responsible for keeping dependency ids and mutation slots consistent.

### Structured Diagnostics

Add or confirm these diagnostic codes:

```text
CORE_MEDIA_DEPENDENCY_SELECTOR_REQUEST_INVALID
CORE_MEDIA_DEPENDENCY_SELECTOR_KIND_UNHANDLED
CORE_MEDIA_DEPENDENCY_CONFLICTING_DECLARATION
CORE_MEDIA_DEPENDENCY_ENVIRONMENT_SHEET_METADATA_MISSING
CORE_MEDIA_DEPENDENCY_ENVIRONMENT_SHEET_COMPOSITE_FILE_MISSING
CORE_MEDIA_DEPENDENCY_DRAFT_MATERIALIZATION_STATE_MISSING
CORE_MEDIA_DEPENDENCY_ROOT_ESTIMATE_FAILED
```

The exact code names can change during implementation if a clearer domain name
is chosen, but each failure class must remain distinct.

## Implementation Plan

### Slice 1: Mark Plan Ownership And Remove Obsolete Direction

Update `0062` so it no longer directs future work toward dependency graph
bridges, dependency maps, execution levels, or graph-preserving file splits.

Do not rewrite all of `0062`. Add a clear note that dependency planning is owned
by `0063` and this cleanup plan, and that any future shot-video split must use
the inventory contract.

### Slice 2: Add Failing Characterization Tests

Add focused tests before changing behavior.

Required failures to capture:

- selector wrong request shape is not silently missing;
- unknown selector kind is not silently missing;
- asset relationship selector does not default to the first asset unless the
  selector declares `selected-or-default`;
- Lookbook selector respects selected sheet id and invalid selected sheet
  diagnostics;
- location environment sheet missing metadata is not reported as a generic
  missing image file;
- duplicate dependency declarations with conflicting kind, target, selector,
  or label fail with structured diagnostics;
- dependency cycles are reported with
  `CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED`;
- root estimate failures include diagnostics;
- Reference Issues renders `CORE_MEDIA_DEPENDENCY_*` issues.

### Slice 3: Centralize Dependency Ids

Create the dependency id contract module and move all construction/parsing logic
there.

Update:

- `dependency-slot-definitions.ts`;
- `shot-video-take.ts`;
- `shot-video-take/dependency-slots.ts`;
- Reference projection code;
- Studio service response types if mutation data is added.

Delete duplicated local parsers after callers move.

### Slice 4: Make Selector Defaults Explicit

Update `MediaGenerationDependencySelectorInput`.

Then update shared slot constructors:

- cast character sheets use the accepted cast policy;
- location environment sheets use the accepted location policy;
- Lookbook sheets use explicit selected/default policy;
- manual attachments are handled by an explicit manual selector branch.

Replace fallthrough `noAsset()` with exhaustive handling and structured
diagnostics for invalid selector/request cases.

### Slice 5: Collapse Shot Video Onto One Slot Declaration Path

Update shot-video production planning so it uses
`declareShotVideoTakeDependencySlots` directly.

Delete:

- `RequiredShotVideoTakeInputSlot`;
- `requiredInputSlots`;
- `referenceBundleSlots`;
- `lookbookSheetReferenceSlots`;
- `requiredSlotForRequestedInput`;
- `requiredSlotForInputKind`;
- `dependencyForInputKind`;
- `toMediaGenerationDependencySlot`;
- `selectorForRequiredInputSlot`;
- local duplicate dependency id construction.

Keep only projections needed for `inputsToCreate`, `inputPlanItems`, and
Reference sections, and derive those from `MediaGenerationDependencyInventory`.

### Slice 6: Tighten Planner Failure Semantics

Refactor `dependency-inventory.ts` enough to make failure paths explicit.

Required changes:

- validate duplicate declarations before merging;
- keep identical dedupe and `requiredBy` lineage;
- reject conflicting duplicate declarations;
- treat missing generated dependency targets as invalid declarations;
- split selection, draft building, pricing, aggregation, and checklist
  projection into named internal functions;
- remove temporary `not-applicable` initialization for generated dependency
  lines;
- ensure root estimate failures carry structured diagnostics;
- require dependency draft materialization state explicitly.

### Slice 7: Split Draft Specs From Draft Estimates

Create:

```text
packages/core/src/server/media-generation/dependency-draft-estimates.ts
```

Expected ownership:

- classify dependency estimate results;
- distinguish unsupported pricing from invalid draft or thrown estimate errors;
- return structured diagnostics with dependency-line locations.

Keep `dependency-draft-specs.ts` focused on building draft specs and validating
the draft-builder contract.

Do not add a compatibility re-export.

### Slice 8: Surface Reference Diagnostics In Studio

Update core Reference report projection or Studio rendering so the Reference
Issues section includes dependency inventory diagnostics relevant to references.

Preferred direction:

- core serializes reference-relevant diagnostics in
  `ShotVideoTakeProductionPlanReport.diagnostics`;
- Studio displays those diagnostics without maintaining a fragile code-prefix
  allowlist.

If a frontend filter remains, it must include `CORE_MEDIA_DEPENDENCY_*` and be
covered by tests.

### Slice 9: Targeted File Structure Cleanup

Move only dependency and reference projection code needed for this cleanup out
of `shot-video-take.ts`.

Candidate files:

```text
packages/core/src/server/media-generation/shot-video-take/dependency-inventory.ts
packages/core/src/server/media-generation/shot-video-take/reference-sections.ts
```

Rules:

- no broad mechanical split;
- no wrappers or pass-through facades;
- extracted files must own real product behavior;
- tests should import public service behavior unless a focused domain function
  is intentionally exported for testability.

### Slice 10: Documentation And Verification

Update accepted docs after behavior changes:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- this plan's checklist;
- `0062` note or supersession text.

Then run focused and broad verification.

## Test Strategy

Use no-mock core tests for selector and planner behavior whenever possible.

Core integration tests:

- add invalid selector tests for location, Lookbook, and shot-video inputs;
- add duplicate declaration and cycle tests;
- add root-estimate diagnostic tests;
- add selected/default policy tests.

Core unit or focused tests:

- dependency id construction and parsing;
- selector exhaustive handling;
- planner duplicate declaration validation.

Studio tests:

- Reference Issues renders dependency inventory diagnostics;
- general reference clear action uses core-provided mutation slot, not parsed
  dependency id;
- selected planned cards keep pricing from core;
- unselected alternatives remain quiet and unpriced.

Static tests:

- no `RequiredShotVideoTakeInputSlot`;
- no local `dependencyIdForInput` or `parseDependencyId` in
  `shot-video-take.ts`;
- no dependency-id parsing in Studio React components;
- no `resolveMediaGenerationDependencySelection` fallthrough to `noAsset`;
- no obsolete `execution.levels`, `topologicalNodeIds`, or dependency graph
  imports.

## Verification Commands

Focused commands:

```bash
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-slots.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-inventory.test.ts --no-file-parallelism
pnpm --filter @gorenku/studio exec vitest run src/features/movie-studio/scenes/scene-shot-references-tab.test.tsx src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx --no-file-parallelism
pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism
```

Broader commands:

```bash
pnpm test:core
pnpm test:studio
pnpm test:typecheck
pnpm lint
pnpm check
```

Desktop verification:

- run or reuse `pnpm dev:studio`;
- verify the two screenshot-like scenes from `0063`;
- confirm missing selected generated dependencies show consistent estimates;
- confirm invalid dependency diagnostics appear in Reference Issues;
- confirm AI Production total matches the core inventory total.

## Completion Checklist

### Review Area

- [x] Confirm this plan is accepted as the cleanup successor to `0063`.
- [x] Add a note to `0062` deferring or superseding dependency graph bridge
  language.
- [x] Confirm no database schema change is required.
- [x] Confirm no dependency installation is required.
- [x] Confirm no backwards compatibility layer will be kept.
- [x] Confirm no automatic dependency execution scheduler will be introduced.
- [x] Confirm current dirty worktree changes are not reverted.

### Fallback Policy

- [x] Document allowed dependency fallback-like states in accepted docs.
- [x] Document forbidden selector and planner fallbacks in accepted docs.
- [x] Remove selector fallthrough to quiet missing state.
- [x] Remove root-estimate failure fallback with empty diagnostics.
- [x] Remove generated dependency temporary `not-applicable` initialization.
- [x] Keep `not-applicable` only for manual dependencies and unselected
  non-dependency Reference alternatives.
- [x] Add tests proving selected generated cards never receive fallback
  `not-applicable` pricing.

### Dependency Id Ownership

- [x] Add a core dependency id contract module with deliberate domain naming.
- [x] Move cast character sheet dependency id construction into the contract
  module.
- [x] Move location environment sheet dependency id construction into the
  contract module.
- [x] Move Lookbook sheet dependency id construction into the contract module.
- [x] Move shot-video input dependency id construction into the contract
  module.
- [x] Add typed parse results for shot-video input dependency ids.
- [x] Add malformed dependency id tests.
- [x] Replace `dependencyIdForInput` in `shot-video-take.ts`.
- [x] Replace `parseDependencyId` in `shot-video-take.ts`.
- [x] Remove dependency-id parsing from Studio React components.
- [x] Add explicit core-provided mutation data for clearing selected general
  references.

### Selector Contracts

- [x] Add explicit selector selection policy to client types.
- [x] Update shared slot constructors to pass the intended selection policy.
- [x] Add an explicit manual attachment selector branch.
- [x] Add an exhaustive selector-kind guard.
- [x] Treat invalid request shape as a structured selector diagnostic.
- [x] Treat invalid shot-video purpose as a structured selector diagnostic.
- [x] Make asset relationship default selection policy explicit.
- [x] Make Lookbook default selection policy explicit.
- [x] Support concrete selected Lookbook sheet ids.
- [x] Add structured diagnostics for missing Lookbook sheet files.
- [x] Add structured diagnostics for missing location environment sheet
  metadata.
- [x] Add structured diagnostics for missing location composite file ids.
- [x] Add structured diagnostics for missing location composite file records.

### Shot Video Slot Cleanup

- [x] Update shot-video production planning to call
  `declareShotVideoTakeDependencySlots` directly.
- [x] Delete `RequiredShotVideoTakeInputSlot`.
- [x] Delete `requiredInputSlots`.
- [x] Delete `referenceBundleSlots`.
- [x] Delete `lookbookSheetReferenceSlots`.
- [x] Delete `requiredSlotForRequestedInput`.
- [x] Delete `requiredSlotForInputKind`.
- [x] Delete `dependencyForInputKind`.
- [x] Delete `toMediaGenerationDependencySlot`.
- [x] Delete `selectorForRequiredInputSlot`.
- [x] Derive `inputsToCreate` from inventory lines.
- [x] Derive `inputPlanItems` from inventory lines.
- [x] Preserve requested optional dependency behavior through the new slot path
  or remove it if it is obsolete product behavior.
- [x] Preserve selected Lookbook sheet behavior through explicit selector
  inputs.

### Planner Semantics

- [x] Validate duplicate dependency declarations before merging.
- [x] Allow identical duplicate declarations and merge `requiredBy`.
- [x] Reject conflicting duplicate dependency kinds.
- [x] Reject conflicting duplicate targets.
- [x] Reject conflicting duplicate selectors.
- [x] Reject conflicting duplicate labels when labels are user-visible.
- [x] Preserve requiredness merging only for structurally identical
  declarations.
- [x] Keep recursive expansion and cycle diagnostics.
- [x] Keep max-depth diagnostics.
- [x] Split planner internals into focused named functions.
- [x] Keep package-boundary errors structured.
- [x] Require dependency draft materialization state explicitly.
- [x] Distinguish provider-pricing unsupported from invalid draft specs.
- [x] Add root estimate failure diagnostics.

### Draft Estimate File Ownership

- [x] Add `dependency-draft-estimates.ts`.
- [x] Move dependency estimate classification into
  `dependency-draft-estimates.ts`.
- [x] Keep draft spec construction in `dependency-draft-specs.ts`.
- [x] Remove dynamic import cycles if the split makes that possible.
- [x] Do not add a compatibility re-export.
- [x] Add focused tests for unpriced provider route classification.
- [x] Add focused tests for invalid draft estimate diagnostics.

### Reference Projection

- [x] Move reference section projection into a focused product-owned module.
- [x] Keep selected General cards inventory-backed.
- [x] Keep selected Lookbook cards inventory-backed.
- [x] Keep selected Cast cards inventory-backed.
- [x] Keep selected Location cards inventory-backed.
- [x] Keep unselected alternatives separate from selected dependency lines.
- [x] Ensure selected generated card with no inventory line is a structured
  diagnostic.
- [x] Ensure selected generated card with concrete preview but missing inventory
  selection is a structured diagnostic.
- [x] Add invalid dependency diagnostics to Reference Issues.
- [x] Remove fragile React-only diagnostic prefix filtering or include all
  inventory diagnostics intentionally.

### Studio Contracts

- [x] Update Studio service response types for explicit clear-input mutation
  data.
- [x] Update References tab to use explicit mutation data.
- [x] Keep all feature controls on local shadcn UI primitives.
- [x] Ensure React does not compute dependency prices.
- [x] Ensure React does not parse dependency ids.
- [x] Preserve existing selection and clear interactions.
- [x] Add rendering coverage for dependency inventory diagnostics.

### Tests

- [x] Add invalid selector tests for location environment sheets.
- [x] Add invalid selector tests for Lookbook sheets.
- [x] Add invalid selector tests for shot-video inputs.
- [x] Add wrong request-shape selector tests.
- [x] Add unknown selector exhaustive handling tests or static coverage.
- [x] Add selected-only versus selected-or-default asset policy tests.
- [x] Add duplicate declaration tests.
- [x] Add cycle tests.
- [x] Add max-depth tests if not already covered by cycle tests.
- [x] Add root estimate failure diagnostic tests.
- [x] Add static tests for removed shot-video local slot types.
- [x] Add static tests for removed Studio dependency-id parsing.
- [x] Add static tests for removed obsolete graph fields and imports.
- [x] Keep route/model estimate matrix coverage.
- [x] Keep screenshot-state regression coverage for cast/location estimate
  consistency.
- [x] Do not delete behavioral tests unless the behavior is explicitly obsolete
  under this plan.

### Documentation

- [x] Update `docs/architecture/media-generation.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update or annotate `plans/active/0062-shot-video-take-core-refactor.md`.
- [x] Document selector selection policies.
- [x] Document dependency id ownership.
- [x] Document allowed `not-applicable` pricing cases.
- [x] Document root estimate and dependency estimate failure semantics.
- [x] Mark completed checklist items in this plan as implementation proceeds.

### Final Verification

- [x] Run focused dependency slot tests.
- [x] Run focused core inventory tests.
- [x] Run focused Studio Reference tab tests.
- [x] Run focused Studio AI Production tab tests.
- [x] Run Studio estimate matrix E2E tests.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm test:studio`.
- [x] Run `pnpm test:typecheck`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Verify the two screenshot-like scenes in desktop Chrome.
- [x] Confirm selected missing generated dependencies show consistent estimates.
- [x] Confirm invalid dependency diagnostics render in Reference Issues.
- [x] Confirm AI Production total matches the core inventory total.
