# 0074 Remaining Take Production References And Final Take UI

Status: proposed
Date: 2026-06-17

## Summary

This plan captures only the remaining work after the partial implementation of
`0073-takes-tab-and-take-scoped-grouping-restoration.md`.

The previous slice restored the most urgent regression: take-scoped shot
grouping behavior and the restored grouping tests. This plan must not reopen
that logic unless a new regression is found. The unfinished work is now centered
on production references, final take cards, final video playback, picked takes,
view-only takes, and the CLI/skill contract that lets agents address takes
without relying only on Studio focus.

The target end state is:

- Core owns production scene numbers, visible shot number resolution, and final
  take number projection.
- Studio exposes `Narrative`, `Shots`, and `Takes` with production scene/shot/take
  labels visible where users and agents can refer to them.
- The `Shots` tab remains review-only.
- The `Takes` tab list shows final video takes, not editable take-generation
  workspaces.
- The `Takes - Edit` and `Takes - New` workspaces continue to use the restored
  take-scoped grouping and AI Production flow.
- View-only final takes show video and compatibility notice only.
- The CLI and source skills can create, find, update, and use takes by explicit
  production scene/shot/take references, with Studio focus as a confirmed
  fallback rather than the only addressing mechanism.

## Already Implemented And Out Of Scope For This Plan

Do not redo these unless tests reveal a concrete regression:

- The take-scoped ownership model from 0072 remains in force:
  - Scene Shot Lists own ordered shots and storyboard images.
  - Scene Shot Video Take Generations own editable shot membership and AI
    Production setup.
  - Scene Shot Video Takes own final generated or imported video outputs.
- The Studio pure grouping module has been restored under take-generation names.
- The restored Studio grouping test matrix has been adapted and passes.
- Core membership carry behavior has been added for
  `SceneShotVideoTakeGeneration.production`.
- Core focused tests cover:
  - prepared inputs preserved when membership is unchanged;
  - prepared inputs dropped when membership changes;
  - stale prompt state preserved or set on membership change;
  - split-like membership changes preserving copied settings;
  - merge-like expansion preserving open settings;
  - duplicate and non-contiguous shot ids rejected with structured errors.
- Scene selection state now supports `narrative`, `shots`, and `takes`.
- Scene selection state now supports take workspace mode and take generation id.
- The basic `Shots` tab review surface exists.
- The basic `Takes`, `Takes - Edit`, and `Takes - New` routing state exists.
- The Takes edit workspace restores draft/review/apply grouping behavior.
- Basic durable-id CLI commands exist for:
  - `generation take list`
  - `generation take show`
  - `generation take update-shots`
- Source skill docs have started to describe working take-generation context and
  focus confirmation.

## Remaining Gaps

### Production Scene Numbers Are Not Implemented

Core does not yet own production scene numbering. This is the largest remaining
architecture gap.

The system still needs a durable production reference layer that supports:

- scene numbers as strings;
- draft, locked, and omitted scene-number states;
- stable locked numbers after screenplay reordering;
- omitted numbers that are not reused after scene deletion;
- inserted scene numbering under one documented default standard;
- structured diagnostics for unknown, omitted, ambiguous, and conflicting
  scene-number references;
- Studio read models that can display production scene numbers prominently;
- CLI and skill commands that resolve production scene numbers without guessing.

This must not be implemented as a Studio-only derived index or a CLI-only parser.
It must be Core-owned data and Core-owned resolution behavior.

### Visible Shot Numbers Are Not A CLI/Core Contract

The UI can show `Shot N`, but Core and CLI do not yet resolve visible shot
numbers against an explicit production scene number.

The system still needs:

- visible shot number list parsing, such as `1,2,3`;
- visible shot number range parsing, such as `1-3`;
- conversion from visible numbers to durable `shotIds`;
- structured diagnostics for out-of-range shot references;
- structured diagnostics when contiguity is required but not satisfied;
- a clear distinction between public `--shots` visible numbers and any future
  durable `--shot-ids` escape hatch.

### Final Take Cards Are Not Implemented

The current Takes list is still a temporary take-generation list. The required
product surface is a final take video grid.

The system still needs a Core and Studio read model for final take cards that
includes:

- final `SceneShotVideoTake` id;
- owning `takeGenerationId`;
- production scene number;
- take number;
- final video file URL;
- captured shot ids;
- first shot title;
- shot number or shot number range label;
- picked state;
- compatibility/editability state.

### Final Take Video Playback Is Not Implemented

The Takes list cards do not yet show playable final videos.

The system still needs:

- a Studio route that serves final shot-video take files;
- video cards that use the same overlay-card visual language as the rest of
  Studio;
- a centered play/stop button;
- event handling so play/stop does not open edit mode;
- only one card playing at a time;
- accessible playback state labels.

### Picked Takes Are Not Implemented

The final take grid does not yet support pick/unpick.

The system still needs:

- Core selected/picked state for final shot-video takes;
- a mutation to update that picked state;
- one selected final take per take generation, unless a later product decision
  explicitly changes this;
- lower-right `ImageSelectionControl` on cards;
- selected cards first only when the list first loads;
- no immediate resort after the user toggles a card in the current rendered
  list;
- stable take numbers that do not change when picked state changes.

### View-Only Takes Are Not Implemented

The plan requires view-only behavior for uneditable or incompatible final takes.
The current UI does not yet implement that mode.

The system still needs:

- Core compatibility/editability state for final take cards;
- `Takes - Edit` to switch to view-only mode when editing is not possible;
- final video preview;
- compatibility notice below the preview;
- no shot rail;
- no Composition, Motion, Dialogs, References, or AI Production tabs;
- no generation actions;
- optional read-only Description only when meaningful current description data
  exists.

### Production Scene Numbers Are Not Visible In Studio

The scene header and relevant card/detail surfaces do not yet prominently show
production scene numbers.

The system still needs:

- visible production scene number in the scene header;
- visible shot numbers in Shots cards and details;
- visible shot number ranges and take numbers in Takes cards;
- labels that are stable enough for users to say things like
  `Scene 23, shots 1-3, take 2`.

### CLI Production Reference Commands Are Not Implemented

The current CLI additions are durable-id take-generation commands. They are not
yet the production-facing commands agents and users need.

The system still needs:

- production scene-number commands;
- take create/list/show/update by production scene number and visible shot
  numbers;
- final take lookup by production take number;
- `--take-generation` flows that avoid repeating shot context after the working
  take generation is established;
- focused CLI tests for explicit references and diagnostics.

### Studio Focus Is Not Yet Complete Enough For Agent Use

Agents must still be able to read the current Studio focus and use it as a
candidate context.

The system still needs:

- a `renku studio current --json` command or equivalent existing command
  contract documented and tested;
- durable ids plus production scene/shot/take references in the focus payload;
- structured diagnostics when focus is unavailable or stale;
- skill guidance that focus-derived context must be confirmed before mutation
  or paid generation.

### Skills Are Only Partially Updated

The source skills have started to mention working take generation context, but
they still need a full pass once the CLI/Core contracts exist.

The remaining skill update must cover:

- explicit scene/shot/take reference resolution;
- examples for `Scene 23, shots 1-3`;
- examples for `Scene 23, Take 3`;
- examples for `use this take`;
- continuing downstream generation commands with `takeGenerationId`;
- avoiding old `--shot-list`, durable shot-id-as-public-shots, and production
  group wording.

## Product Rules For The Remaining Implementation

- Do not restore global Scene Shot List grouping fields.
- Do not add compatibility aliases, route shims, re-export stubs, or wrappers.
- Do not make `act:sequence:scene` the public reference model for take
  generation.
- Do not rely on Studio focus as the only way to address a take.
- Do not list take generations as final video takes in the finished Takes grid.
- Do not invent visible UI text for missing data.
- Do not show raw ids, filenames, generated role names, or asset ids on visual
  cards.
- Do not put AI Production or grouping controls back into the Shots review tab.
- Do not use raw browser interactive controls in `packages/studio` feature code.
- Do not optimize or verify mobile layouts for this work.

## Implementation Slices

### Slice 1: Core Production Scene Numbering

Add a Core-owned production scene number contract and storage/update behavior.

The public contract should include:

```ts
interface SceneProductionNumber {
  sceneId: string;
  number: string;
  state: 'draft' | 'locked' | 'omitted';
  sortKey: string;
}
```

The exact storage shape can be integrated into the current screenplay scene
model or added as a separate table/document area, but Core must own it.

Implementation requirements:

- scene numbers are strings;
- draft numbers can be generated from current screenplay order;
- locked numbers stay stable after reorder;
- deleted locked scenes become omitted rather than reusable;
- inserted scenes near locked numbers use the documented default standard;
- explicit renumbering is deliberate and diagnostic-backed;
- Core returns all actionable diagnostics in structured form.

### Slice 2: Visible Shot And Take Reference Resolution

Add Core functions that resolve production references to durable ids.

Implementation requirements:

- resolve production scene number to durable `sceneId`;
- resolve visible shot number lists against the active/source shot list;
- resolve visible shot number ranges against the active/source shot list;
- return durable `shotIds` after resolution;
- project final take numbers for `SceneShotVideoTake` rows;
- keep take numbers stable across pick/unpick;
- return structured diagnostics for unknown, omitted, ambiguous, out-of-range,
  and non-contiguous references.

### Slice 3: Final Take Card Read Model And Routes

Add the read/write surface required by the Takes grid.

Implementation requirements:

- Core list operation for final take cards by scene;
- Core mutation for picked state;
- Studio HTTP route to list final take cards;
- Studio HTTP route to serve final take video files;
- Studio HTTP route to update picked state;
- Studio service functions for list, file URL, and pick/unpick.

The read model should expose domain-ready UI fields instead of making the React
component reconstruct production labels.

### Slice 4: Production Scene Number Display

Make production references visible in Studio.

Implementation requirements:

- scene header shows production scene number prominently;
- Shots tab cards show title and `Shot N`;
- Shots detail pane shows the selected shot number;
- Takes cards show first shot title and `Shot N / Take T` or
  `Shots N-M / Take T`;
- all card overlay rows truncate cleanly;
- no raw ids or filenames appear as fallback copy.

### Slice 5: Final Takes List UI

Replace the temporary take-generation list with the final take video card grid.

Implementation requirements:

- cards use movie aspect ratio;
- cards lay out horizontally first and wrap vertically;
- final video is the main card content;
- bottom gradient overlay matches the existing card visual language;
- centered play/stop control previews the take;
- play/stop does not open edit mode;
- clicking elsewhere opens `Takes - Edit`;
- lower-right `ImageSelectionControl` toggles picked state;
- pick/unpick does not open edit mode;
- selected cards sort first only on initial list load;
- toggling picked state does not resort the current rendered list;
- same-size create card appears last;
- create card opens `Takes - New`;
- when no takes exist, only the create card is shown.

### Slice 6: Edit, New, And View-Only Workspace Completion

Finish the workspaces opened from the Takes tab.

Editable mode requirements:

- keep the restored shot rail grouping behavior;
- keep grouping review/apply/discard;
- persist only the open take generation's membership;
- show all shot design tabs that are currently editable;
- bind AI Production by `takeGenerationId`;
- show final take video preview when a final take exists for the generation.

New mode requirements:

- create a take-generation workspace from the active shot list;
- seed generic new take from the first shot in order;
- do not create hidden fallback state when no active shot list exists;
- keep `Takes - New` label until the user closes or navigates.

View-only mode requirements:

- use Core compatibility state;
- show video preview and compatibility notice;
- hide shot rail and generation tabs;
- hide generation actions;
- show optional read-only Description only when meaningful data exists.

### Slice 7: CLI Production Reference Surface

Add production-facing CLI commands and tests.

Required command shape:

```bash
renku screenplay scene-number list --json
renku screenplay scene-number assign --scene <scene-id> --number <scene-number> --json
renku screenplay scene-number lock --scene <scene-id> --json
renku screenplay scene-number omit --scene <scene-id> --json
renku screenplay scene-number resolve --scene-number <scene-number> --json

renku generation take create --purpose shot.video-take --scene-number <scene-number> --shots <shot-number-list-or-range> --json
renku generation take list --purpose shot.video-take --scene-number <scene-number> --json
renku generation take show --purpose shot.video-take --scene-number <scene-number> --take-number <take-number> --json
renku generation take update-shots --purpose shot.video-take --take-generation <take-generation-id> --shots <shot-number-list-or-range> --json
```

After a take generation is established, downstream commands should accept
`--take-generation` without forcing the caller to repeat `--scene-number` or
`--shots`:

```bash
renku generation context --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation model list --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation production update --purpose shot.video-take --take-generation <take-generation-id> --file <production.json> --json
renku generation preflight --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation input list --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation input select --purpose shot.video-take --take-generation <take-generation-id> --input <input-id> --json
renku media import --purpose shot.video-take --take-generation <take-generation-id> --source <project-relative-video-path> --json
```

Existing `--scene` must continue to mean durable `sceneId`. Do not overload it
with production scene numbers.

### Slice 8: Studio Focus And Agent Context

Add or formalize the command agents use to inspect Studio focus.

The focus payload must include:

- project identity;
- durable scene id;
- production scene number when available;
- selected tab;
- selected shot id and visible shot number when available;
- selected take generation id when available;
- selected final take id and take number when available;
- compatibility/editability state when relevant;
- structured diagnostics if focus cannot be resolved.

Skill behavior:

- If the user gives explicit production references, use those first.
- If the user says "this take" or omits references, inspect Studio focus.
- If focus points at a candidate scene/take, ask for confirmation before
  mutating project state or preparing paid generation.
- If focus is missing or ambiguous, ask for production scene/take references.

### Slice 9: Source Skill Updates

Update source skills under:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Required files to inspect and update:

- `media-producer/SKILL.md`
- `media-producer/references/shot-video-take.md`
- `media-producer/references/shot-multi-shot-storyboard-sheet.md`
- `media-producer/references/shot-first-last-frame.md`
- `media-producer/references/shot-reference-images.md`
- `movie-director/references/workflow-playbooks.md`
- `movie-director/references/department-map.md`

Skill docs must show:

- creating a new multi-shot take from explicit production references;
- using an existing take by production take number;
- using an existing take by durable take generation id;
- using Studio focus as a confirmed candidate;
- continuing with `takeGenerationId` after resolution;
- avoiding obsolete production-group and old shot-list wording.

### Slice 10: Cleanup, Tests, And Desktop Verification

Run focused cleanup searches, automated tests, and desktop verification.

Cleanup searches:

- old AI Production behavior under the Shots tab;
- stale code treating `shots` as the take-generation edit tab;
- `ShotVideoTakeRailGroup`;
- `ShotVideoTakeProductionGroup`;
- `productionGroupId`;
- old public `--shot-list` examples;
- old public `--shots <shot-id>` examples;
- public `act:sequence:scene` addressing in the shot-video take workflow.

Automated verification:

- focused Core production scene number tests;
- focused Core shot/take reference tests;
- focused Studio service and route tests;
- focused Studio scene UI tests;
- focused CLI production reference tests;
- `pnpm build:core`;
- `pnpm --filter @gorenku/studio test`;
- `pnpm check`.

Desktop browser verification:

- use desktop viewport only;
- verify scene header production number;
- verify Shots review grid and detail pane;
- verify Takes final video grid;
- verify video play/stop behavior;
- verify pick/unpick behavior;
- verify create card opens `Takes - New`;
- verify edit card opens `Takes - Edit`;
- verify Narrative/Shots/Takes switching preserves edit/new workspace state;
- verify close returns to Takes list;
- verify view-only takes hide editing controls.

## Completion Checklist

### Review Scope

- [ ] Confirm this plan tracks only work remaining after the restored grouping
      slice.
- [ ] Confirm the take-scoped ownership model remains unchanged.
- [ ] Confirm restored grouping logic and tests are not rewritten.
- [ ] Confirm no global Scene Shot List grouping fields are restored.
- [ ] Confirm no compatibility aliases, route shims, wrappers, or re-export
      stubs are introduced.
- [ ] Confirm `act:sequence:scene` is not used as the public take reference
      language.
- [ ] Confirm Studio focus is a confirmed fallback, not the only addressing
      mechanism.
- [ ] Confirm all `packages/studio` feature controls use local shadcn UI
      primitives.
- [ ] Confirm verification remains desktop-only.

### Core Production Scene Numbers

- [ ] Add Core-owned production scene number contract.
- [ ] Store or derive draft scene numbers through Core, not Studio.
- [ ] Treat scene numbers as strings.
- [ ] Add scene-number list operation.
- [ ] Add scene-number assign operation.
- [ ] Add scene-number lock operation.
- [ ] Add scene-number omit operation.
- [ ] Add scene-number resolve operation.
- [ ] Keep locked scene numbers stable after screenplay reorder.
- [ ] Mark deleted locked scenes as omitted.
- [ ] Prevent omitted scene numbers from being silently reused.
- [ ] Assign inserted scene numbers under the documented default standard.
- [ ] Add structured diagnostic for unknown scene number.
- [ ] Add structured diagnostic for omitted scene number.
- [ ] Add structured diagnostic for ambiguous scene number.
- [ ] Add structured diagnostic for renumber conflict.
- [ ] Return production scene numbers to Studio read models.
- [ ] Add tests for draft numbering from screenplay order.
- [ ] Add tests for locked reorder stability.
- [ ] Add tests for omitted scene behavior.
- [ ] Add tests for inserted scene numbering.
- [ ] Add tests for scene-number diagnostics.

### Core Shot And Take Reference Resolution

- [ ] Resolve production scene number to durable scene id.
- [ ] Resolve visible shot number to durable shot id.
- [ ] Resolve comma-separated visible shot lists.
- [ ] Resolve visible shot number ranges.
- [ ] Preserve durable shot ids after public reference resolution.
- [ ] Return structured diagnostic for out-of-range shot numbers.
- [ ] Return structured diagnostic for invalid shot range syntax.
- [ ] Return structured diagnostic for non-contiguous shot membership when
      contiguity is required.
- [ ] Project stable final take numbers for a scene.
- [ ] Keep take numbers stable after pick/unpick.
- [ ] Return take numbers in Core final take card read models.
- [ ] Add tests for shot list parsing.
- [ ] Add tests for shot range parsing.
- [ ] Add tests for take-number stability.

### Final Take Card Contracts And Routes

- [ ] Add final take card client contract.
- [ ] Include final take id.
- [ ] Include take generation id.
- [ ] Include production scene number.
- [ ] Include take number.
- [ ] Include final video file URL.
- [ ] Include captured shot ids.
- [ ] Include first shot title.
- [ ] Include shot number label or range label.
- [ ] Include picked state.
- [ ] Include compatibility/editability state.
- [ ] Add Core list operation for final take cards by scene.
- [ ] Add Core picked-state mutation.
- [ ] Enforce one picked final take per take generation unless product rules
      change.
- [ ] Add Studio route for final take cards.
- [ ] Add Studio route for final take video file response.
- [ ] Add Studio route for picked-state mutation.
- [ ] Add Studio service functions for final take cards.
- [ ] Add Studio service functions for picked-state update.
- [ ] Add route tests.
- [ ] Add service tests.

### Studio Production Reference Display

- [ ] Show production scene number prominently in the scene header.
- [ ] Show shot number in Shots card overlay row two.
- [ ] Show shot number in Shots detail pane.
- [ ] Show first shot title in Takes card overlay row one.
- [ ] Show shot range and take number in Takes card overlay row two.
- [ ] Truncate all card overlay rows.
- [ ] Avoid raw ids, filenames, generated role names, and asset ids as fallback
      copy.
- [ ] Add or update tests for the new labels where practical.

### Takes Final Video Grid

- [ ] Replace temporary take-generation list with final take card list.
- [ ] Keep create-new card as the final card.
- [ ] Show only create-new card when no final takes exist.
- [ ] Use movie aspect ratio for all cards.
- [ ] Lay cards horizontally first and wrap vertically.
- [ ] Render final video as main card content.
- [ ] Add centered play/stop control.
- [ ] Prevent play/stop click from opening edit mode.
- [ ] Stop currently playing card when another card starts.
- [ ] Add bottom gradient overlay.
- [ ] Add lower-right `ImageSelectionControl`.
- [ ] Prevent pick/unpick click from opening edit mode.
- [ ] Sort picked cards first on initial list load.
- [ ] Do not resort current rendered list after pick/unpick.
- [ ] Open `Takes - Edit` when clicking card body.
- [ ] Open `Takes - New` when clicking create card.
- [ ] Add focused UI tests for card interactions where practical.

### Take Workspaces

- [ ] Keep restored grouping behavior in editable workspace.
- [ ] Keep grouping review/apply/discard in editable workspace.
- [ ] Keep split sibling groups local.
- [ ] Persist only open take generation membership.
- [ ] Bind AI Production by take generation id.
- [ ] Show final take video preview in editable mode when available.
- [ ] Keep `Takes - New` label while the new workspace is open.
- [ ] Do not create hidden fallback state when no active shot list exists.
- [ ] Add view-only workspace mode from Core compatibility state.
- [ ] Show video preview in view-only mode.
- [ ] Show compatibility notice in view-only mode.
- [ ] Hide shot rail in view-only mode.
- [ ] Hide editing tabs in view-only mode.
- [ ] Hide generation actions in view-only mode.
- [ ] Show optional read-only Description only when meaningful data exists.

### CLI

- [ ] Add `renku screenplay scene-number list --json`.
- [ ] Add `renku screenplay scene-number assign --scene <scene-id> --number
      <scene-number> --json`.
- [ ] Add `renku screenplay scene-number lock --scene <scene-id> --json`.
- [ ] Add `renku screenplay scene-number omit --scene <scene-id> --json`.
- [ ] Add `renku screenplay scene-number resolve --scene-number
      <scene-number> --json`.
- [ ] Add take create by `--scene-number` and visible `--shots`.
- [ ] Add take list by `--scene-number`.
- [ ] Add take show by `--scene-number` and `--take-number`.
- [ ] Add take update-shots by `--take-generation` and visible `--shots`.
- [ ] Keep existing `--scene` as durable scene id.
- [ ] Ensure public `--shots` means visible shot numbers/ranges.
- [ ] Add durable `--shot-ids` only if direct id input is deliberately needed.
- [ ] Ensure downstream generation commands work with `--take-generation`.
- [ ] Add CLI tests for scene-number commands.
- [ ] Add CLI tests for take creation by production references.
- [ ] Add CLI tests for take lookup by take number.
- [ ] Add CLI tests for `--take-generation` downstream context.
- [ ] Add CLI tests for diagnostics.

### Studio Focus And Skills

- [ ] Add or formalize `renku studio current --json`.
- [ ] Include durable ids in focus payload.
- [ ] Include production scene number in focus payload.
- [ ] Include visible shot number in focus payload when available.
- [ ] Include take generation id in focus payload when available.
- [ ] Include final take id and take number in focus payload when available.
- [ ] Include compatibility/editability state in focus payload when relevant.
- [ ] Return structured diagnostics when focus cannot be resolved.
- [ ] Update `media-producer/SKILL.md`.
- [ ] Update `media-producer/references/shot-video-take.md`.
- [ ] Update `media-producer/references/shot-multi-shot-storyboard-sheet.md`.
- [ ] Update `media-producer/references/shot-first-last-frame.md`.
- [ ] Update `media-producer/references/shot-reference-images.md`.
- [ ] Update `movie-director/references/workflow-playbooks.md`.
- [ ] Update `movie-director/references/department-map.md`.
- [ ] Add skill examples for `Scene 23, shots 1-3`.
- [ ] Add skill examples for `Scene 23, Take 3`.
- [ ] Add skill examples for `use this take`.
- [ ] Document focus confirmation before mutation or paid generation.
- [ ] Remove obsolete skill references to old production groups.
- [ ] Remove obsolete skill examples using public durable shot ids as `--shots`.

### Cleanup And Verification

- [ ] Search for stale Shots-tab AI Production behavior.
- [ ] Search for stale `shots` tab take-edit assumptions.
- [ ] Search for `ShotVideoTakeRailGroup`.
- [ ] Search for `ShotVideoTakeProductionGroup`.
- [ ] Search for `productionGroupId`.
- [ ] Search for old public `--shot-list` examples.
- [ ] Search for old public `--shots <shot-id>` examples.
- [ ] Search for public `act:sequence:scene` addressing in shot-video take
      workflow docs.
- [ ] Run focused Core scene-number tests.
- [ ] Run focused Core shot/take reference tests.
- [ ] Run focused Studio service tests.
- [ ] Run focused Studio route tests.
- [ ] Run focused Studio scene UI tests.
- [ ] Run focused CLI production-reference tests.
- [ ] Run `pnpm build:core`.
- [ ] Run `pnpm --filter @gorenku/studio test`.
- [ ] Run `pnpm check`.
- [ ] Run desktop browser verification for production scene number display.
- [ ] Run desktop browser verification for Shots review tab.
- [ ] Run desktop browser verification for Takes final video grid.
- [ ] Run desktop browser verification for play/stop behavior.
- [ ] Run desktop browser verification for pick/unpick behavior.
- [ ] Run desktop browser verification for edit, new, and view-only workspaces.
