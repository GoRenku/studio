# 0090 Shot Video Take Reference Scope Remediation

Status: active
Date: 2026-06-28

## Summary

This plan fixes the architecture gap exposed by the third review of Shot Video
Take structure modes.

The current implementation persists reference selections inside
`SceneShotVideoTakeDirection` and writes multi-cut reference mutations with a
`shotId`, but several read paths still treat selected references as a take-wide
aggregate. That lets Studio write shot-scoped state correctly while rendering
the wrong selected state for the active shot.

This is not a line-level bug. It is a read-model ownership problem:

- editor projection needs exactly one direction scope;
- generation planning needs the full take direction set;
- mutation commands need one validated write scope;
- those scopes must be named and enforced in core.

The accepted ADR for this remediation is:

- `docs/decisions/0038-use-scoped-shot-video-take-reference-projections.md`

The current architecture reference to update alongside this plan is:

- `docs/architecture/shot-video-take-structure-modes.md`

## Problem

Plan `0088-shot-video-take-structure-modes.md` introduced two durable take
modes:

- `continuous`: one shared direction for the whole take;
- `multi-cut`: one direction per grouped shot id.

The storage and mutation side mostly follows that model. The read side does
not. Helpers such as:

```text
selectedCharacterSheetAssetIdForTakeState
referencedEnvironmentSheetAssetIdsForTakeState
selectedLookbookSheetIdsForTakeState
selectedDialogueAudioTakeIdForContext
referenceInclusionOverride
```

walk every direction in the take. That aggregate read is valid for generation
dependencies, but invalid for the References and Dialogs editor tabs in
multi-cut mode.

Concrete example:

- `shot_001` selects character sheet asset `A`;
- `shot_002` selects character sheet asset `B`;
- the user opens `shot_002` in the References tab;
- the read helper scans all directions and returns the first selected sheet for
  that Cast Member, which can be `A`;
- the UI now shows `A` while sending updates scoped to `shot_002`;
- the user can overwrite shot 2 while looking at shot 1 state.

The same class of bug affects:

- Character Sheet selected state;
- Location Sheet referenced state;
- Lookbook Sheet selected state;
- Dialogue Audio selected take state;
- explicit include/exclude reference choices.

There is also a mutation-scope bug: continuous reference mutations drop
`input.shotId` before calling the core state updater, so stale multi-cut
requests can mutate the shared continuous direction instead of failing with the
existing structured scope diagnostic.

## Architecture Requirements

This remediation must preserve the hard ownership boundaries:

- Core owns take structure semantics, reference scope resolution, validation,
  and durable mutation.
- Studio server handlers remain thin HTTP adapters.
- React feature code consumes core projections and sends user intent. It must
  not decide whether a reference belongs to a shared or shot-scoped direction.
- CLI and future agent paths must use the same core scope contract.
- Generation dependency planning may aggregate, but only through explicitly
  named generation read helpers.

No fix may:

- add route-local validation that compensates for missing core validation;
- add React-local branching as the source of truth for reference state;
- add generic take-state patches;
- keep parallel take-level reference mirrors;
- preserve obsolete state shapes or compatibility readers.

## Target Model

Introduce three explicit core concepts.

### Editor Direction Scope

The editor direction scope resolves to one direction.

Rules:

- continuous takes resolve to `sharedDirection`;
- continuous editor reads and writes must not require or accept `shotId`;
- multi-cut editor reads and writes require a valid grouped `shotId`;
- multi-cut editor reads use `directionsByShotId[selectedShotId]`;
- missing or foreign shot ids fail fast with
  `CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH`.

This scope is used by:

- Composition tab;
- Motion tab;
- Dialogs tab;
- References tab;
- focused reference mutation commands.

### Generation Direction Set

The generation direction set resolves to every direction relevant to the final
take.

Rules:

- continuous takes produce a single-element set containing `sharedDirection`;
- multi-cut takes produce ordered directions by `take.shotIds`;
- helpers that union selected assets or inclusion overrides must be named as
  generation or take-dependency helpers;
- generation code must not reuse editor-selected-state helpers.

This scope is used by:

- dependency inventory;
- preflight inputs;
- final provider payload creation;
- estimate and validation paths that reason about the whole generated take.

### Mutation Direction Scope

Focused mutations must resolve their write scope before reading current
reference selections and before persisting updated selections.

Rules:

- continuous plus `shotId` is invalid;
- multi-cut without `shotId` is invalid;
- multi-cut with a shot id outside the take is invalid;
- the resolved scope is passed through to the core state update path;
- no wrapper may silently drop `shotId`.

## Implementation Slices

### Slice 1: Core Scope Helpers

Add focused helpers in the shot video take domain layer. Exact names may be
adjusted during implementation only if they are clearer and equally scoped.

Suggested public or module-local names:

```text
resolveSceneShotVideoTakeEditorDirection
resolveSceneShotVideoTakeReferenceMutationScope
sceneShotVideoTakeGenerationDirections
sceneShotVideoTakeEditorReferenceSelections
sceneShotVideoTakeGenerationReferenceSelections
```

The helpers should live close to `take-state.ts` or a focused sibling module if
that keeps `take-state.ts` from becoming broad.

### Slice 2: Reference Selection Read Models

Split current aggregate helpers into explicit read models.

Editor helpers should read one resolved direction:

- selected Character Sheet asset for a Cast Member;
- referenced Location Sheet asset ids for a Location;
- selected Lookbook Sheet id;
- selected Dialogue Audio Take id;
- explicit inclusion override for a dependency id.

Generation helpers should read the ordered generation direction set and
aggregate intentionally:

- union selected concrete assets for preflight inputs;
- union selected Lookbook sheets where generation actually supports that;
- resolve duplicate dialogue audio inputs deterministically;
- resolve inclusion overrides per dependency with documented precedence.

Do not leave vague names such as `ForTakeState` when the behavior depends on
editor versus generation scope.

### Slice 3: Reference Sections And Dialogue Audio

Make `buildShotVideoTakeReferenceSections` receive or derive an editor
direction scope.

For multi-cut editor projection, the read path must use the selected shot for:

- selected/default Cast Members shown as selected for the shot;
- selected/default Locations shown as selected for the shot;
- Character Sheet selected state;
- Location Sheet referenced state;
- Lookbook selected state;
- Dialogue Audio picked take;
- inclusion override shown on cards.

For continuous editor projection, the read path must use the shared direction
while still displaying the grouped take context.

Dialogue audio resolution needs the same scope split:

- editor references show the selected shot direction's picked take and
  inclusion choice;
- generation inputs aggregate dialogue audio references across the take.

### Slice 4: Service Contracts And Studio Reads

Thread selected-shot scope through core read contracts where the UI needs
editor projection.

The current Studio write path already passes `shotId` for multi-cut mutations.
The read path must be able to ask core for the same selected-shot view.

Potential contract options:

- add `selectedShotId?: string` to `PlanShotVideoTakeProductionInput` and use
  it only for the `references` editor projection while keeping the generation
  plan whole-take scoped;
- or add a separate core read command for editor references and leave production
  planning strictly generation-scoped.

The implementation should choose the clearer contract after reviewing current
call sites. Avoid mixing unrelated responsibilities in one response if that
would keep the ambiguity alive.

### Slice 5: Mutation Validation

Fix `updateSceneShotVideoTakeReferenceSelections` so it does not drop
`input.shotId` for continuous takes.

The core mutation wrapper should:

- resolve mutation direction scope once;
- use that scope to read existing reference selections;
- pass that same scope into
  `updateSceneShotVideoTakeReferenceSelectionsRecord`;
- let the core state updater enforce continuous and multi-cut mismatches.

Do not duplicate the invariant only in Studio routes.

### Slice 6: Tests

Add tests that prove shot-by-shot behavior, not only persistence into the first
direction.

Core tests should cover:

- multi-cut editor read for shot 1 and shot 2 with different Character Sheets;
- multi-cut editor read for different Location Sheet references;
- multi-cut editor read for different Lookbook sheets;
- multi-cut editor read for different Dialogue Audio takes;
- multi-cut editor read for different include/exclude overrides;
- generation dependency planning still includes the whole take's needed
  references;
- continuous reference mutation with `shotId` rejects;
- multi-cut reference mutation without `shotId` rejects;
- multi-cut reference mutation with a foreign `shotId` rejects.

Studio/service tests should cover:

- selected shot id is sent for reference plan/editor reads when needed;
- a refresh after mutation displays the selected shot's state;
- switching selected shots changes the rendered reference selection without
  mutating state.

## Expected File Areas

Likely core files:

- `packages/core/src/server/media-generation/shot-video-take/take-state.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-sections.ts`
- `packages/core/src/server/media-generation/shot-video-take/dialogue-audio-references.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-inclusions.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection-mutations.ts`
- `packages/core/src/server/media-generation/shot-video-take/preflight-inputs.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-inventory.ts`
- `packages/core/src/server/project-data-service-contracts.ts`

Likely Studio files:

- `packages/studio/src/services/studio-shot-video-takes-api.ts`
- `packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-dialogs-tab.tsx`
- `packages/studio/server/http/scene-shot-video-take-production-request.ts`
- `packages/studio/server/routes/screenplay.ts`

Likely docs:

- `docs/architecture/shot-video-take-structure-modes.md`
- `docs/architecture/README.md`
- `docs/decisions/0038-use-scoped-shot-video-take-reference-projections.md`

## Completion Checklist

Use this checklist for implementation review and final signoff.

### Review Area

- [x] Confirm the remediation is limited to scoped reference read/write
      behavior and does not broaden into CLI authoring work from plan `0089`.
- [x] Confirm editor projection and generation planning are treated as separate
      core read models.
- [x] Confirm no Studio server route owns reference scope business logic.
- [x] Confirm no React component computes the authoritative reference scope.
- [x] Confirm no compatibility path, old-shape alias, or generic patch API is
      added.

### Architecture And Contracts

- [x] Add or update the ADR for scoped reference projections.
- [x] Update `docs/architecture/shot-video-take-structure-modes.md`.
- [x] Add explicit editor direction scope resolution in core.
- [x] Add explicit generation direction set resolution in core.
- [x] Add explicit mutation direction scope resolution in core.
- [x] Rename vague aggregate helpers or split their call sites so scope is
      visible in the function name.
- [x] Thread selected-shot read scope through the chosen core read contract.
- [x] Preserve structured diagnostics for scope mismatches.

### Core Implementation

- [x] Make Character Sheet editor reads selected-direction scoped.
- [x] Make Location Sheet editor reads selected-direction scoped.
- [x] Make Lookbook Sheet editor reads selected-direction scoped.
- [x] Make Dialogue Audio editor reads selected-direction scoped.
- [x] Make reference inclusion editor reads selected-direction scoped.
- [x] Keep dependency inventory reads generation-direction scoped.
- [x] Keep preflight input reads generation-direction scoped.
- [x] Keep final provider payload reads generation-direction scoped.
- [x] Reject continuous reference mutations that include `shotId`.
- [x] Reject multi-cut reference mutations missing `shotId`.
- [x] Reject multi-cut reference mutations with a shot id outside the take.

### Studio And Server Implementation

- [x] Keep HTTP request parsing thin and structural.
- [x] Pass selected shot id to the core read path used by References and
      Dialogs when the take is multi-cut.
- [x] Continue passing shot id to reference mutations in multi-cut mode.
- [x] Do not add Studio-only validation for reference scope.
- [x] Refresh after reference mutations using the same selected-shot read
      scope.
- [x] Keep visible UI copy unchanged unless the implementation reveals a real
      product-copy gap.

### Tests

- [x] Add core tests for shot 1 versus shot 2 Character Sheet selection.
- [x] Add core tests for shot 1 versus shot 2 Location Sheet references.
- [x] Add core tests for shot 1 versus shot 2 Lookbook selection.
- [x] Add core tests for shot 1 versus shot 2 Dialogue Audio selection.
- [x] Add core tests for shot 1 versus shot 2 inclusion override projection.
- [x] Add core tests that generation dependency planning still aggregates
      needed references across the take.
- [x] Add mutation tests for continuous `shotId` rejection.
- [x] Add mutation tests for missing and foreign multi-cut `shotId` rejection.
- [x] Add Studio/service tests for selected-shot plan refresh behavior.
- [x] Remove or rewrite tests that accidentally verify only first-shot fallback
      behavior.

### Verification

- [x] Run focused core tests for shot video take reference selection,
      reference sections, dialogue audio references, preflight inputs, and
      dependency inventory.
- [x] Run focused Studio tests for shot video take services and scene reference
      tabs.
- [x] Run package checks required by the touched packages.
- [x] Confirm with a focused two-shot multi-cut service test that each shot can
      select a different Character Sheet, Location Sheet, Lookbook Sheet, and
      Dialogue Audio take.
- [x] Confirm switching between selected shots changes the rendered editor
      state without changing persisted state.
- [x] Confirm final generation planning still sees all required whole-take
      dependencies.

## Success Criteria

This remediation is complete when a multi-cut take can hold different
reference selections per shot, Studio reads the selected shot's references
after every refresh, generation still plans from the full take, and invalid
scope combinations fail through core-owned structured diagnostics.

The code should make it hard to reintroduce this bug. A future reviewer should
be able to tell from function names and service contracts whether a read is
selected-shot editor state or whole-take generation state.
