# 0088 Shot Video Take Structure Modes

Status: implemented
Date: 2026-06-27

## Summary

Shot Video Takes need a durable structure mode that distinguishes two different
ways a grouped take can be authored:

- `continuous`: one unbroken generated move where grouped shots act as
  keyframes, story beats, or spatial anchors;
- `multi-cut`: one generated video containing separate cuts, where each grouped
  shot has its own direction.

This plan focuses only on the first implementation slice:

- the core data model;
- validation and one-way development-data conversion;
- mode-switching behavior;
- Studio editing behavior;
- the chosen Option B toggle UI beside the grouped-shot count pill;
- tests and documentation for the new mode architecture.

The CLI and source skill work is deliberately separated into:

- `plans/active/0089-agent-shot-video-take-cli-and-skills.md`

Plan `0089` should not be implemented until the structure contract in this plan
is accepted.

The proposed architecture reference is:

- `docs/architecture/shot-video-take-structure-modes.md`

## Product Direction

The agent is the primary generation authoring surface. Studio is the visual
review, override, and instruction surface.

For this slice, that means Studio must make the take structure visible and
editable without pretending to be the whole generation workflow. The user should
be able to look at a grouped take and answer one crucial question:

```text
Are these shots beats in one continuous move, or separate cuts in one video?
```

The answer changes how the rest of the take editor behaves:

- in `continuous`, Composition, Motion, Dialogs, and References are shared
  across the grouped take;
- in `multi-cut`, Composition, Motion, Dialogs, and References are edited shot
  by shot;
- AI Production remains take-level in both modes.

## Current Problem

Today the take state stores per-shot design values in:

```text
shotDesignByShotId
```

and take-level reference selections separately.

That shape cannot cleanly represent the two product modes:

- a continuous drone flyover should not need duplicated per-shot values just so
  every shot appears to share the same direction;
- a multi-cut sequence must be able to keep different Composition, Motion,
  Dialogs, and References per shot;
- reference selections should not live in a separate take-level bucket when
  their intended scope changes by mode;
- React-side "apply to all" copying would create hidden synchronization and
  drift;
- CLI-side JSON rewriting would bypass the core ownership boundary.

This must be a core-owned data model change, not a UI workaround.

## Data Model Direction

Replace the current take state structure with a discriminated union.

Proposed public contract:

```ts
export type SceneShotVideoTakeStructureMode = "continuous" | "multi-cut";

export interface SceneShotVideoTakeState {
  version: 2;
  structure: SceneShotVideoTakeStructure;
  production: SceneShotVideoTakeProductionState;
  promptState?: SceneShotVideoTakePromptState;
}

export type SceneShotVideoTakeStructure =
  | {
      mode: "continuous";
      sharedDirection: SceneShotVideoTakeDirection;
    }
  | {
      mode: "multi-cut";
      directionsByShotId: Record<string, SceneShotVideoTakeDirection>;
    };
```

`SceneShotVideoTakeDirection` replaces the narrower
`SceneShotVideoTakeShotDesign` concept. The old name is too narrow because the
state now owns more than visual shot design.

`SceneShotVideoTakeDirection` should own:

- Composition;
- Motion;
- Dialogs;
- Cast and Character Sheet references;
- Location and Location Sheet references;
- Lookbook references;
- custom reference image inputs;
- explicit include/exclude choices.

AI Production stays outside the structure union:

- input mode;
- model choice;
- route parameters;
- dependency prompt drafts;
- final prompt draft;
- provider payload preview;
- estimate;
- approval state.

Those all apply to the whole take in both modes.

## Continuous Mode

Continuous mode persists exactly one shared direction:

```ts
{
  mode: "continuous",
  sharedDirection: { ... }
}
```

Studio behavior:

- Composition, Motion, Dialogs, and References edit `sharedDirection`;
- selecting another grouped shot changes visual context and keyframe/beat focus;
- selecting another grouped shot does not change which direction object is being
  edited;
- edits apply to the whole continuous take because there is only one stored
  direction;
- no hidden per-shot overrides exist in the first version.

Generation interpretation:

- grouped shots remain ordered beats/keyframes;
- source shot list data still provides baseline shot descriptions, storyboard
  images, cast, locations, and dialogue references;
- required references are aggregated across all grouped shots;
- selected references and explicit exclusions live in `sharedDirection`;
- prompts describe one unbroken move.

The current drone flyover example belongs in continuous mode.

## Multi-Cut Mode

Multi-cut mode persists one direction per grouped shot:

```ts
{
  mode: "multi-cut",
  directionsByShotId: {
    shot_001: { ... },
    shot_001b: { ... },
    shot_001c: { ... },
    shot_002: { ... }
  }
}
```

Studio behavior:

- Composition, Motion, Dialogs, and References edit the selected shot's
  direction;
- selecting another grouped shot changes which direction object is being edited;
- each shot can have distinct Composition, Motion, Dialogs, and References;
- AI Production still edits the whole take.

Generation interpretation:

- grouped shots are separate cuts;
- each shot direction maps to that cut;
- reference requirements are aggregated across all shot directions;
- provider preview must make the per-shot mapping visible for debugging.

## Saved State And Toggle Behavior

Saving does not store both modes. Saving persists exactly the current mode's
shape.

When the user later toggles modes, Studio calls a core-owned conversion command.
The toggle is not a temporary UI view over hidden duplicated state.

### Continuous To Multi-Cut

Starting state:

```ts
{
  mode: "continuous",
  sharedDirection: { ... }
}
```

When toggled to `multi-cut`:

- core creates `directionsByShotId` for every grouped shot id;
- each direction starts as a copy of `sharedDirection`;
- this is non-lossy;
- after conversion, directions are independent;
- future edits do not synchronize back to the original shared direction.

Example:

```text
shot_001  -> copied direction
shot_001b -> copied direction
shot_001c -> copied direction
shot_002  -> copied direction
```

This gives the user a clean starting point for turning a continuous idea into a
shot-by-shot multi-cut sequence.

### Multi-Cut To Continuous

Starting state:

```ts
{
  mode: "multi-cut",
  directionsByShotId: {
    shot_001: { ... },
    shot_001b: { ... },
    shot_001c: { ... },
    shot_002: { ... }
  }
}
```

When toggled to `continuous`, core first compares the shot directions.

If every direction is equivalent:

- core collapses them into one `sharedDirection`;
- this is non-lossy;
- Studio can switch immediately.

If directions differ:

- core must not guess how to merge them;
- core returns a structured diagnostic unless the caller supplies a source shot
  id;
- Studio must show a confirmation dialog;
- the user chooses which shot direction becomes the shared direction;
- the other per-shot directions are discarded as part of the explicit lossy
  conversion.

Confirmation copy should be plain and concrete:

```text
This take has different settings per shot.
Choose which shot should become the shared Continuous Move direction.
```

Suggested actions:

- `Use Shot 1`
- `Use Shot 2`
- `Use Shot 3`
- `Use Shot 4`
- `Cancel`

Core command shape for the lossy path:

```bash
renku take structure set --take <take-id> --mode continuous --source-shot <shot-id> --json
```

The first version should default to explicit source-shot choice rather than
trying to merge fields.

## Shot Membership Changes

Changing take shot membership must preserve the structure invariant.

In `continuous` mode:

- keep `sharedDirection`;
- update the ordered shot ids;
- treat the new shot ids as the continuous take's beats/keyframes;
- carry AI Production shot metadata through the existing production carry path.

In `multi-cut` mode:

- keep directions for retained shot ids;
- remove directions for removed shot ids;
- create empty directions for newly added shot ids;
- reject persisted state that contains directions for shots outside the take.

## Studio UX Direction

Use Option B from the visual exploration:

- compact sliding icon toggle;
- located beside the grouped-shot count pill, for example near `4 SHOTS`;
- one active icon state visible at a time;
- continuous icon: one smooth path passing through keyframe dots;
- multi-cut icon: separated frames or cut marks on a timeline;
- tooltip labels:
  - `Continuous Move`;
  - `Multi-Cut Sequence`;
- no long explanatory copy in the tab row.

The control should be sized for the current dense toolbar, use local
shadcn-style primitives from `packages/studio/src/ui`, and respect existing
dark Studio styling.

Mode-specific editor behavior:

- in `continuous`, non-AI-Production tabs edit `sharedDirection`;
- in `multi-cut`, non-AI-Production tabs edit the selected shot direction;
- AI Production remains take-level in both modes.

When switching from divergent `multi-cut` state to `continuous`, Studio should
open a focused confirmation dialog. The route/server handler should parse the
selected source shot and call core. It must not compare or merge directions
itself.

## Core Validation

Core validation must enforce:

- known mode values only;
- `continuous` state has exactly one `sharedDirection`;
- `continuous` state does not carry `directionsByShotId`;
- `multi-cut` state has exactly one direction for every grouped shot id;
- `multi-cut` state has no directions for non-member shot ids;
- direction updates are mode-aware;
- continuous direction updates do not specify a shot id;
- multi-cut direction updates specify a valid shot id;
- mode conversion is core-owned;
- lossy multi-cut to continuous conversion requires an explicit source shot id;
- Location Sheets are required by default for referenced Locations unless
  explicitly excluded;
- Character Sheets are required by default for visible Cast Members unless
  explicitly excluded;
- missing Cast Voice blocks dialogue audio generation and does not silently
  trigger voice assignment.

Suggested diagnostic prefix:

```text
CORE_SHOT_VIDEO_TAKE_STRUCTURE_*
```

Suggested codes:

- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_UNKNOWN_MODE`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_INVALID_CONTINUOUS_STATE`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_INVALID_MULTI_CUT_STATE`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_REFERENCE_REQUIRED`

## Migration And Compatibility

This is a current-model replacement.

Do not keep:

- compatibility readers for `shotDesignByShotId`;
- aliases for old fields;
- fallback state repair in runtime code;
- tests that preserve obsolete state as a supported input shape.

If existing development databases need repair, use a one-way Drizzle/data repair
path or a project repair command as part of implementation.

The least surprising one-way transformation is:

- set `version: 2`;
- set mode to `multi-cut`;
- move existing per-shot design entries into `directionsByShotId`;
- create empty directions for grouped shots with no previous entry;
- move or recompute reference selections only when ownership can be determined
  safely;
- fail loudly for manual repair rather than guessing ambiguous reference scope.

Runtime code should recognize only the new structure after the migration.

## Implementation Slices

### Slice 1: Contracts And Validation

- Add `SceneShotVideoTakeStructureMode`.
- Add `SceneShotVideoTakeStructure`.
- Add `SceneShotVideoTakeDirection`.
- Replace state schema version `1` with version `2`.
- Update JSON Schema validation for the discriminated union.
- Add core validators for mode-specific invariants.
- Add structured diagnostics for invalid structure state and conversion
  blockers.

### Slice 2: Core Mutations

- Replace current shot-design mutation with mode-aware direction mutation.
- Add core-owned structure mode conversion.
- Update shot membership carry logic for both modes.
- Update reference selection mutations to write into the correct direction
  scope.
- Keep AI Production state outside the structure union.

### Slice 3: Studio UI

- Add the Option B structure toggle beside the grouped-shot count pill.
- Use tooltips for `Continuous Move` and `Multi-Cut Sequence`.
- Make non-AI-Production tabs read/write shared direction in continuous mode.
- Make non-AI-Production tabs read/write selected-shot direction in multi-cut
  mode.
- Add the multi-cut to continuous confirmation dialog for divergent directions.
- Keep Studio server handlers thin.

### Slice 4: Existing Data

- Add one-way development-data conversion or repair.
- Update the real Urban Basilica project data as needed.
- Do not add runtime compatibility readers.

### Slice 5: Documentation

- Update `docs/architecture/shot-video-take-structure-modes.md`.
- Update `docs/architecture/data-model-and-storage.md`.
- Update `docs/architecture/reference/media-generation.md` where take state is
  described.
- Update this plan as decisions are accepted.

## Completion Checklist

Use this checklist for implementation review and final signoff.

Verification note: implementation was verified on 2026-06-27 with focused core
and Studio tests, package-local TypeScript checks, package-local lint, and a
copied Urban Basilica database smoke migration. The real
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` database was
not mutated because that outside-workspace write was not approved; the copied
database at `/private/tmp/urban-basilica-0088-smoke.sqlite` migrated to
generation 29 and preserved the four-shot `City smoke before the wall` take as
v2 `multi-cut` state with directions for `shot_001`, `shot_001b`,
`shot_001c`, and `shot_002`.

### Review Area

- [x] Confirm `continuous` and `multi-cut` are the accepted contract values.
- [x] Confirm Option B is the accepted UI control.
- [x] Confirm `Continuous Move` and `Multi-Cut Sequence` are the accepted
      tooltip labels, or record the final labels.
- [x] Confirm there are no per-shot overrides inside continuous mode in the
      first version.
- [x] Confirm AI Production remains take-level in both modes.
- [x] Confirm the implementation does not introduce generic patch APIs,
      compatibility readers, or UI-side synchronization.

### Architecture And Contracts

- [x] Add `SceneShotVideoTakeStructureMode`.
- [x] Add `SceneShotVideoTakeStructure`.
- [x] Add `SceneShotVideoTakeDirection`.
- [x] Replace `shotDesignByShotId` with the structure union.
- [x] Move reference selections into the appropriate direction scope.
- [x] Keep production state outside the structure union.
- [x] Update TypeScript public contracts.
- [x] Update JSON Schemas.
- [x] Update persisted state version.
- [x] Add structured diagnostics.

### Core Behavior

- [x] Validate continuous state invariants.
- [x] Validate multi-cut state invariants.
- [x] Add continuous direction update behavior.
- [x] Add multi-cut direction update behavior.
- [x] Add continuous to multi-cut conversion.
- [x] Add multi-cut to continuous collapse when all directions are equivalent.
- [x] Add multi-cut to continuous diagnostic when directions differ and no
      source shot is supplied.
- [x] Add source-shot conversion for lossy multi-cut to continuous conversion.
- [x] Update shot membership carry behavior for continuous mode.
- [x] Update shot membership carry behavior for multi-cut mode.
- [x] Keep required reference and Cast Voice readiness validation in core.

### Studio UI

- [x] Add the compact Option B toggle beside the grouped-shot count pill.
- [x] Add tooltips for both modes.
- [x] Ensure the control fits the existing desktop toolbar.
- [x] Ensure Composition edits shared direction in continuous mode.
- [x] Ensure Motion edits shared direction in continuous mode.
- [x] Ensure Dialogs edits shared direction in continuous mode.
- [x] Ensure References edits shared direction in continuous mode.
- [x] Ensure Composition edits selected-shot direction in multi-cut mode.
- [x] Ensure Motion edits selected-shot direction in multi-cut mode.
- [x] Ensure Dialogs edits selected-shot direction in multi-cut mode.
- [x] Ensure References edits selected-shot direction in multi-cut mode.
- [x] Add divergent multi-cut to continuous confirmation.
- [x] Ensure server handlers call core and do not merge state locally.

### Tests

- [x] Add core state validation tests.
- [x] Add core conversion tests.
- [x] Add core shot membership carry tests.
- [x] Add reference selection scope tests.
- [x] Add Studio tests for toggle rendering.
- [x] Add Studio tests for mode-specific tab editing.
- [x] Add Studio tests for lossy conversion confirmation.
- [x] Add Urban Basilica smoke coverage for the drone flyover take.

### Documentation

- [x] Update the architecture proposal after implementation decisions are final.
- [x] Update data model docs.
- [x] Update media generation docs.
- [x] Link this plan from any follow-up CLI/skills plan.

### Final Verification

- [x] Create or open a grouped take with four shots.
- [x] Set mode to continuous.
- [x] Edit Composition and confirm the shared direction applies across shot
      selection.
- [x] Edit Motion and confirm the shared direction applies across shot
      selection.
- [x] Toggle to multi-cut and confirm each shot receives a copied starting
      direction.
- [x] Edit one shot in multi-cut and confirm other shots do not change.
- [x] Toggle back to continuous with divergent directions and confirm Studio
      asks for a source shot.
- [x] Choose a source shot and confirm the shared direction matches it.
- [x] Run focused tests.
- [x] Run package checks required by the implementation scope.

## Success Criteria

This plan is successful when grouped takes have an explicit persisted structure
mode, Studio edits the correct shared or per-shot direction without hidden
synchronization, and core owns every conversion between modes.

The implementation should make the drone flyover case feel natural:

- the user sees `4 SHOTS`;
- the user chooses `Continuous Move`;
- Composition and Motion edits apply to the whole take;
- the grouped shots still act as ordered beats for generation.

It should also make multi-cut generation clear:

- the user chooses `Multi-Cut Sequence`;
- each selected shot has independent Composition, Motion, Dialogs, and
  References;
- AI Production still applies to the whole generated take.
