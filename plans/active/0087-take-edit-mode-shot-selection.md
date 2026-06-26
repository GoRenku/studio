# 0087 Take Edit Mode Shot Selection

Status: implemented
Date: 2026-06-25

## Summary

The current take editor lets the user focus any shot in the rail, shows all
editing tabs for that focused shot, and only later reports a core validation
error if the shot is not actually part of the current take.

That is product-wrong even though core is behaving correctly. Core should
reject edits for shots outside `take.shotIds`; the UI should make that rule
obvious before the user tries to edit.

This plan changes the take editor from an implicit "grouping" affordance to an
explicit "edit mode shot selection" affordance:

- row click focuses a shot for inspection;
- the rail icon selects, expands, or stops selecting shots for the current take;
- selected-for-edit shots use a distinct light green treatment;
- non-selected shots show only the read-only Description tab;
- editable tabs appear only for shots currently selected in the take;
- pending selection changes are reviewed through an `Edit Mode` dialog before
  they are persisted.

The architecture rule stays the same: `packages/core` owns durable take
membership and validation. Studio displays the source shot list, edits a local
selection draft, and persists that draft through the focused core-owned take
membership command.

## Diagnosis

The screenshot exposes two different states that currently look like one state:

- `shot_003` is focused in the rail, because the user clicked it.
- `shot_003` is not selected for the open take, because the take only contains
  `shot_001` and `shot_002`.

Core then correctly rejects a Composition save:

```text
PROJECT_DATA422: Shot id is not in the Scene Shot Video Take: shot_003.
```

The bug is not that core rejects the write. The bug is that Studio still shows
Composition, Motion, Dialogs, References, and AI Production controls for a shot
that cannot accept those edits.

The old rail language also makes the issue harder to understand:

- `Cycle Shot Group` sounds like a grouping mechanic, not a selection mechanic.
- `Review Groups` sounds like a layout/grouping review, not entering edit mode
  for a take.
- The selected rail row uses the same yellow-ish visual language as ordinary
  focus/active navigation, so it does not communicate "this shot belongs to the
  take and can be edited."

The desired model is simpler:

- every take has a source shot list;
- every take has selected shot ids inside that source shot list;
- only selected shot ids are editable inside that take;
- any source-list shot can be inspected read-only before the user selects it
  for editing.

## Product Vocabulary

Use these terms in implementation names, tests, and user-visible copy.

`focused shot`

The shot currently shown in the detail pane. Focusing a shot does not mutate
the take and does not imply the shot can be edited.

`selected shot`

A shot whose `shotId` is currently in `take.shotIds` or in the unapplied local
selection draft. Selected shots are the shots that will be editable after the
current edit-mode state is applied.

`persisted selection`

The shot ids currently stored on the take in the project database.

`selection draft`

The local browser-side selection state produced by the rail icon clicks before
the user accepts the `Edit Mode` dialog.

`source shot list`

The shot list version owned by the take. Existing takes may use an older source
shot list even when the scene has a newer active shot list.

## Intended UX

### Rail Interaction

The rail still shows all shots from the relevant shot list:

- for a new take, the active scene shot list;
- for an existing take, the take's source shot list.

Clicking the row body focuses the shot. It does not add or remove the shot from
the take.

Clicking the rail icon changes the selection draft. It uses the same adjacency
rules as the existing grouping cycle, but the labels become selection labels:

- `Select Shot` when the shot is not selected and has no direct selected
  neighbor;
- `Expand Select` when the shot is not selected and would extend an adjacent
  selected range;
- `Stop Select` when the shot is already selected and the next action removes
  or splits that selection.

The button `aria-label` and tooltip must use this vocabulary. Existing
`Cycle grouping for Shot N` labels should be replaced.

### Visual Treatment

The rail must distinguish focus from edit selection.

Selected-for-edit shots get a light green background and border that work in
both light and dark themes. This should be represented through theme tokens,
not one-off hard-coded colors inside the feature component.

Focused rows keep the normal active/focus visual treatment. If a row is both
focused and selected for edit, the selected-for-edit treatment remains visible
and the focused state is shown with a stronger border or outline.

The existing yellow-ish `item-active` treatment should no longer be the only
signal for edit membership.

### Detail Pane

When the focused shot is selected for the current take:

- show Description, Composition, Motion, Dialogs, References, and
  AI Production;
- initialize take-owned providers and hooks with the take id;
- allow persistence through the existing take-owned API paths.

When the focused shot is not selected for the current take:

- show only the Description tab;
- keep Description read-only;
- do not mount Composition, Motion, Dialogs, References, or AI Production;
- do not initialize autosave hooks or reference/production hooks for that shot;
- normalize the route tab to `description` if the URL requests a hidden tab.

This removes the current failure mode where the user can click a Composition
control, trigger a save, and only then learn the shot is not editable.

### Edit Mode

Rename the header action from `Review Groups` to `Edit Mode`.

The button appears when the local selection draft differs from the persisted
take selection. It appears for single-shot changes as well as multi-shot
changes.

The dialog title should be `Edit Mode`.

The dialog copy should explain that applying the change updates which shots are
editable in the current take. It should still warn when prompt drafts or
production planning will be refreshed because of the membership change.

Applying `Edit Mode` persists the selection draft through the take membership
save path. Discarding reverts the draft to the persisted take selection.

If an existing take already contains the focused shot, no dialog is needed
before showing editing tabs. The shot is already selected and editable.

### New Take Behavior

Creating a new take should still create a take with an initial selected shot.
That initial shot is immediately editable because it is already in the newly
persisted take.

If the user then selects additional shots, `Edit Mode` appears and the same
review/apply flow is used.

## Architecture Boundaries

`packages/core` owns:

- validating that take shot ids belong to the take source shot list;
- validating that take-owned shot edits target `take.shotIds`;
- updating `SceneShotVideoTake.shotIds`;
- pruning or preserving take-owned state during membership changes;
- structured diagnostics such as `PROJECT_DATA325` and `PROJECT_DATA422`.

`packages/studio/server` remains a thin adapter:

- read HTTP params and body;
- call the focused core command;
- serialize the core response;
- translate structured diagnostics.

`packages/studio/src/services` remains the HTTP client contract layer. It must
not decide whether a shot can belong to a take.

`packages/studio/src/features/movie-studio` owns the interaction projection:

- row focus;
- local selection draft;
- icon labels and tooltips;
- hiding edit tabs for non-selected focused shots;
- applying or discarding the draft.

If implementation discovers that a source-list or take-membership rule is
missing in core, the core rule must be added first. React must not become the
only place where take membership validity is enforced.

## Naming And Refactor Direction

The current UI helper names describe "grouping." This feature is no longer
primarily a group-editing affordance; it is take shot selection. Because naming
is architecture, implementation should rename the local UI projection rather
than keep compatibility aliases.

Planned file rename:

- from `scene/shot-video-take-grouping.ts`
- to `scene/shot-video-take-selection.ts`

Planned public names:

- `TakeShotSelectionDraft`
- `TakeShotSelectionProjection`
- `TakeShotSelectionEntry`
- `createTakeShotSelectionDraftsFromTakes`
- `cycleTakeShotSelection`
- `summarizeTakeShotSelectionChanges`
- `takeShotSelectionForSave`
- `findTakeShotSelectionForShot`

The save API name `updateSceneShotVideoTakeShots` can remain because it already
describes the durable core-owned mutation.

No wrapper file, re-export stub, or compatibility alias should be kept under
the old grouping name.

## Source-Aware Projection Requirement

This UI work depends on the take editor using source-aware projections.

For existing takes:

- the rail shots must come from the take source shot list;
- the rail storyboard images must come from that same source shot list;
- the selected/editable shot ids must come from the take;
- active-shot-list-only shot ids must not appear in an old take's edit rail.

For new takes:

- the rail shots and storyboard images come from the active scene shot list;
- the newly created take stores that active shot-list id as its source.

This protects the old-take scenario where `shot_001` and `shot_002` exist in
both an older and newer shot list but point to different storyboard images and
different shot text.

The take list grid has the same requirement. A take card must not borrow the
scene's active shot titles or active storyboard images unless that take's
`sourceShotListId` is the active shot list. Each take card needs a source-aware
overview projection that includes:

- the take;
- the take source shot-list summary needed for card labels;
- the take's selected shot labels in source-shot-list order;
- source-shot-list storyboard previews for the take's selected shots.

This source-aware overview should come from core/service projection, not from
React stitching active scene data onto take rows.

## Coverage Of Earlier Diagnosis

This plan intentionally covers the earlier take/source-shot-list diagnosis.

Covered here:

- old takes remain tied to `take.sourceShotListId`;
- editing a selected shot in an old take persists to that take, not the active
  scene shot list;
- same shot ids in old and active shot lists can carry different text and
  storyboard images;
- old-take edit rails use source-shot-list storyboard images;
- old-take take cards use source-shot-list storyboard images;
- active-list-only shots are not shown or sent while editing an old-source
  take;
- non-member source-list shots are inspectable but not editable until selected
  into the take;
- adding a source-list shot to a take uses the existing membership save path;
- References, Dialogs, and AI Production stay anchored to the open take across
  active shot-list changes;
- new take creation still uses the current active shot-list id.

The plan does not change the core persistence model from the previous
conversation. It makes the UI and read projections consistently respect that
model.

## Implementation Slices

### Slice 1: Rename Local Selection Model

- Rename the local grouping projection module to
  `shot-video-take-selection.ts`.
- Rename exported types and functions to selection vocabulary.
- Update imports and tests directly.
- Keep the pure adjacency/cycling behavior intact unless a test exposes a
  mismatch with the new labels.

### Slice 2: Selection Projection And Labels

- Extend the pure projection so each shot reports:
  - whether it is focused;
  - whether it is selected for edit;
  - the next selection action label;
  - whether it starts or ends a selected range.
- Add deterministic tests for `Select Shot`, `Expand Select`, and
  `Stop Select`.
- Keep the projection independent of React and HTTP.

### Slice 3: Rail Visual And Interaction Update

- Update `SceneShotRail` and `SceneShotRailRow` props to separate focus from
  selected-for-edit.
- Replace the `Link2`/grouping affordance with a selection affordance using
  lucide icons that match the action.
- Replace tooltip and `aria-label` text with selection language.
- Add theme tokens for selected-for-edit rail backgrounds and borders.
- Ensure all controls still use local shadcn UI primitives.

### Slice 4: Description-Only Non-Selected Detail State

- Add an explicit prop to `SceneShotDetail` for whether the focused shot is
  editable in the current take.
- When not editable, render Description only.
- Do not mount take-owned autosave, reference, dialog, or production hooks for
  non-selected shots.
- If the selected route tab is hidden, normalize the selection back to
  `description`.

### Slice 5: Rename And Tighten Edit Mode Review

- Rename the header action from `Review Groups` to `Edit Mode`.
- Rename the dialog title to `Edit Mode`.
- Rewrite summary messages to selection language.
- Keep the prompt-refresh warning, but remove "group" vocabulary from
  user-visible copy unless the text is describing a generated prompt group
  concept that still exists in core.
- Ensure single-shot membership changes still show the `Edit Mode` review.

### Slice 6: Source-Aware Images And Old Takes

- Ensure edit context and production context expose storyboard image references
  for the take source shot list.
- Convert those references to Studio HTTP image URLs in the server adapter.
- Pass the source-aware image map to the rail while editing an existing take.
- Add or extend a source-aware take overview projection for the list-mode take
  cards.
- Pass source-aware shot labels and storyboard previews to take cards.
- Keep the active scene shot-list image map for the Shots tab and new-take flow.

### Slice 7: Verification And Cleanup

- Remove old grouping vocabulary from feature tests and user-visible strings.
- Keep core validation behavior intact.
- Run focused Tier 2 and Tier 3 tests.
- Run Studio typecheck and lint.
- Manually verify the current `urban-basilica` take editor scenario in Chrome.

## Tier 2 Service/Core Coverage

Tier 2 tests should run below the browser but through real Studio service/API
and core paths where practical.

Add or extend coverage for:

- existing take with an older source shot list remains anchored to that source
  after the scene active shot list changes;
- source-list storyboard images are returned for old-take edit context;
- active-list storyboard images are returned for new-take flow;
- list-mode take cards are projected from each take's source shot list;
- updating shot membership with a source-list shot succeeds;
- updating shot membership with an active-list-only shot fails with the
  existing structured diagnostic;
- Composition or Motion persistence for a shot outside `take.shotIds` fails
  through core and does not mutate the take;
- after membership is updated to include that shot, Composition or Motion
  persistence succeeds and reloads correctly;
- editing Composition or Motion for an old take does not mutate a newer active
  take that reuses the same `shotId`;
- References, Dialogs, and AI Production persistence remain anchored to the
  open take after active shot-list changes;
- grouping/selection changes preserve unrelated take-owned state as covered by
  plan `0085`.

## Tier 3 Component And Hook Coverage

Tier 3 tests should verify the UI projection and intent paths.

Add or extend coverage for:

- opening an existing take shows full edit tabs for shots in `take.shotIds`;
- focusing a source-list shot outside `take.shotIds` shows Description only;
- focusing a non-selected shot does not mount autosave or production hooks;
- requesting `shotTab=composition` for a non-selected shot normalizes back to
  Description;
- the rail body click focuses a shot without changing the selection draft;
- the rail icon changes the selection draft without immediately persisting it;
- selection icon tooltip and `aria-label` use `Select Shot`,
  `Expand Select`, and `Stop Select`;
- selected-for-edit rows receive a semantic selected-for-edit marker or class
  that tests can assert without depending on fragile full class strings;
- the header action is `Edit Mode`, not `Review Groups`;
- applying `Edit Mode` calls `updateSceneShotVideoTakeShots` with the draft
  shot ids in source-shot-list order;
- discarding `Edit Mode` restores the persisted selection draft;
- after applying a draft that adds the focused shot, edit tabs become visible;
- source-aware rail images are used while editing an old-source take;
- source-aware take card previews are used in list mode;
- active-shot-list-only shots are not rendered in an old-source take rail.

## Manual Browser Verification

Use `/Users/keremk/renku-movies/urban-basilica` and the current Bombardment
take scenario.

Verify:

1. Open the old take whose source shot list has shots 1-8 while the active scene
   shot list has newer inserted shots.
2. Confirm the rail shows only the take source shot list.
3. Confirm selected-for-edit shots have the green treatment.
4. Focus a non-selected shot.
5. Confirm only Description is visible.
6. Confirm Composition, Motion, Dialogs, References, and AI Production are not
   clickable for that non-selected shot.
7. Hover the rail icon and confirm the selection tooltip is correct.
8. Click the icon and confirm `Edit Mode` appears.
9. Apply `Edit Mode`.
10. Confirm the added shot now shows the full editable tabs.
11. Refresh the page and confirm membership and editable tabs persist.
12. Confirm the old take still uses source-shot-list storyboard images.

## Non-Goals

- Do not change the core rule that only `take.shotIds` are editable.
- Do not make non-selected source-list shots editable through hidden or dangling
  take state.
- Do not add route-local or React-local domain validation as the only guard.
- Do not introduce a generic take-state patch API.
- Do not add compatibility aliases for old grouping helper names.
- Do not test or optimize mobile behavior.
- Do not introduce raw HTML controls in `packages/studio` feature code.
- Do not implement full Tier 1 browser automation in this slice; plan `0086`
  covers reusable browser UI testing infrastructure separately.

## Completion Checklist

Implementation update, 2026-06-25:

- Core now returns source-aware take overviews and source-shot-list storyboard
  image references for take list, edit context, and production context.
- Studio now treats rail focus and take edit selection as separate states.
- Non-selected focused shots render Description only and do not mount editable
  take tabs.
- The rail uses selection language and selected-for-edit visual state.
- The review flow is now `Edit Mode`.
- The take editor now treats one open take as having exactly one local
  selection draft. Non-contiguous selection replaces the current editable
  shots, interior deselection keeps only the earlier contiguous portion, and an
  empty local draft preserves the take identity so selecting a later shot cannot
  fall back to the persisted selection.
- Focused core, service E2E, Studio component, typecheck, lint, and browser
  smoke verification were run. The manual browser check selected a source-list
  shot and discarded the draft to avoid mutating the real `urban-basilica`
  project; the apply path is covered by component and service tests.

### Review And Product Rules

- [ ] Confirm row focus and take edit selection are treated as separate states.
- [ ] Confirm selected-for-edit means membership in the persisted take or the
      current unapplied selection draft.
- [ ] Confirm non-selected focused shots are read-only Description-only.
- [ ] Confirm existing selected shots in an existing take show editable tabs
      without requiring a new confirmation dialog.
- [ ] Confirm single-shot membership changes still use the `Edit Mode` review
      flow.
- [ ] Confirm old-source takes never show active-list-only shots in the edit
      rail.

### Architecture And Contracts

- [ ] Confirm durable membership validation remains in `packages/core`.
- [ ] Confirm take-owned shot design validation remains in `packages/core`.
- [ ] Confirm Studio server handlers stay thin adapters.
- [ ] Confirm Studio services do not decide shot-list or take-membership
      validity.
- [ ] Confirm React feature code only projects state, edits local drafts, and
      sends user intent.
- [ ] Confirm no generic arbitrary take-state patch API is introduced.
- [ ] Confirm no compatibility aliases, re-export stubs, or old grouping
      wrapper files are added.
- [ ] Confirm no raw HTML form or interactive controls are introduced in Studio
      feature code.

### Naming And Refactor

- [ ] Rename `shot-video-take-grouping.ts` to
      `shot-video-take-selection.ts`.
- [ ] Rename grouping projection types to selection vocabulary.
- [ ] Rename grouping draft functions to selection vocabulary.
- [ ] Rename grouping summary functions to selection vocabulary.
- [ ] Update feature imports directly.
- [ ] Update tests directly.
- [ ] Remove user-visible "Review Groups" and "Cycle Shot Group" text.
- [ ] Confirm `rg "Review Groups|Cycle Shot Group|Cycle grouping"` returns no
      active feature/test references after the rename.

### Rail UI

- [ ] Add selected-for-edit theme tokens for light mode.
- [ ] Add selected-for-edit theme tokens for dark mode.
- [ ] Map those tokens into Tailwind theme variables.
- [ ] Update `SceneShotRail` to pass separate focused and selected-for-edit
      state.
- [ ] Update `SceneShotRailRow` to render focused state separately from
      selected-for-edit state.
- [ ] Replace the grouping icon affordance with a selection affordance.
- [ ] Add tooltip text for `Select Shot`.
- [ ] Add tooltip text for `Expand Select`.
- [ ] Add tooltip text for `Stop Select`.
- [ ] Update icon button `aria-label` text to match the selection action.
- [ ] Add a stable semantic marker for selected-for-edit rows for testing.

### Detail Pane Behavior

- [ ] Add an explicit editable-membership prop to `SceneShotDetail`.
- [ ] Render only Description for non-selected focused shots.
- [ ] Hide Composition for non-selected focused shots.
- [ ] Hide Motion for non-selected focused shots.
- [ ] Hide Dialogs for non-selected focused shots.
- [ ] Hide References for non-selected focused shots.
- [ ] Hide AI Production for non-selected focused shots.
- [ ] Avoid mounting take shot design autosave for non-selected focused shots.
- [ ] Avoid mounting take production autosave for non-selected focused shots.
- [ ] Avoid mounting reference/dialog mutation hooks for non-selected focused
      shots.
- [ ] Normalize hidden route tabs back to `description`.
- [ ] Keep Description content available for all source-list shots.

### Edit Mode Flow

- [ ] Rename the header action to `Edit Mode`.
- [ ] Rename the dialog title to `Edit Mode`.
- [ ] Update dialog description to explain editable shot selection.
- [ ] Keep prompt-refresh warning in the dialog.
- [ ] Rewrite create/add summary messages to selection language.
- [ ] Rewrite expand summary messages to selection language.
- [ ] Rewrite remove/stop summary messages to selection language.
- [ ] Ensure the `Edit Mode` button appears when a single-shot selection draft
      changes.
- [ ] Ensure Apply persists source-shot-list-ordered shot ids.
- [ ] Ensure Discard restores the persisted take selection.
- [ ] Ensure applying a draft updates local take state from the persisted
      response.

### Source-Aware Projection

- [ ] Populate source-shot-list storyboard image references in take edit
      context.
- [ ] Populate source-shot-list storyboard image references in take production
      context if the take editor consumes that context after save.
- [ ] Serialize those references with Studio HTTP image URLs.
- [ ] Use source-aware images in the edit rail for existing takes.
- [ ] Add or extend a source-aware take overview projection for list-mode take
      cards.
- [ ] Use source-aware shot labels in list-mode take cards.
- [ ] Use source-aware storyboard previews in list-mode take cards.
- [ ] Keep active-shot-list images in the Shots tab.
- [ ] Keep active-shot-list images for new take creation.
- [ ] Confirm same shot ids in old and active shot lists can show different
      images without cross-contamination.

### Tier 2 Service/Core Tests

- [ ] Cover old-source take edit context after active shot-list changes.
- [ ] Cover old-source storyboard images in edit context.
- [ ] Cover active-list storyboard images for new take flow.
- [ ] Cover source-aware list-mode take card projection.
- [ ] Cover source-list shot membership update success.
- [ ] Cover active-list-only shot membership update failure.
- [ ] Cover non-member Composition or Motion persistence failure through core.
- [ ] Cover Composition or Motion persistence success after membership update.
- [ ] Cover old-take Composition or Motion persistence leaving the active new
      take unchanged when the same `shotId` exists in both shot lists.
- [ ] Cover References persistence after active shot-list changes.
- [ ] Cover Dialogs persistence after active shot-list changes.
- [ ] Cover AI Production persistence after active shot-list changes.
- [ ] Cover selection changes preserving unrelated take-owned state.

### Tier 3 Component And Hook Tests

- [ ] Cover editable tabs visible for selected shots.
- [ ] Cover Description-only rendering for non-selected shots.
- [ ] Cover hidden-tab route normalization for non-selected shots.
- [ ] Cover row click focusing without draft mutation.
- [ ] Cover selection icon changing draft without immediate persistence.
- [ ] Cover `Select Shot` tooltip and aria label.
- [ ] Cover `Expand Select` tooltip and aria label.
- [ ] Cover `Stop Select` tooltip and aria label.
- [ ] Cover selected-for-edit row marker.
- [ ] Cover `Edit Mode` header action.
- [ ] Cover Apply calling `updateSceneShotVideoTakeShots`.
- [ ] Cover Discard restoring persisted selection.
- [ ] Cover full tabs appearing after applied membership includes focused shot.
- [ ] Cover source-aware images in old-source take rail.
- [ ] Cover source-aware images and labels in list-mode take cards.
- [ ] Cover active-list-only shots absent from old-source take rail.

### Verification

- [ ] Run focused core tests for take membership and take context.
- [ ] Run focused Studio service e2e tests for take persistence and source
      shot-list context.
- [ ] Run focused Studio component tests for `SceneTakesTab`,
      `SceneShotRail`, and `SceneShotDetail`.
- [ ] Run Studio typecheck.
- [ ] Run Studio lint.
- [ ] Manually verify the `urban-basilica` old-take edit scenario in Chrome.
- [ ] Update this checklist before marking the plan complete.
