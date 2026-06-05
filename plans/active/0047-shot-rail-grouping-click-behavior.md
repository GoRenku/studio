# 0047 Shot Rail Grouping Click Behavior

Status: implemented
Date: 2026-06-04

## Summary

The shot rail grouping button in the Shot details screen should behave like a
fast local editing control for contiguous shot groups. The first group-icon
click starts an explicit `Editing Groups` session and applies that first draft
action locally. The user then reviews the draft and chooses whether to apply or
discard it.

This plan fixes three connected problems:

- the group-link button is visually misplaced and its tooltip can be clipped by
  the scrollable shot rail;
- the click cycle does not match the intended user rules for isolated shots,
  adjacent groups, ambiguous gaps, and splitting a group from the middle;
- the current save path tries to remove groups by sending `shotIds: []` to the
  single production-group patch endpoint, which core rejects with
  `PROJECT_DATA379`;
- generated prompts and production plans are not explicitly marked stale when
  grouping clicks change the shot ids they were generated for.

The important behavioral change is that the browser owns an immediate local
draft of the rail grouping state. The server remains the source of truth after
save, but clicks do not wait on the network and do not persist until the user
applies the reviewed changes.

This revision deliberately treats one-shot groups as real persisted groups. That
keeps the workflow deterministic: when a user clicks one shot to start a group,
the group exists as a visible state and can later be extended, cleared, or
reloaded without depending on an invisible transient staging selection.

This revision also deliberately prevents exploratory grouping clicks from
invalidating prompts or production plans. Prompt/plan freshness changes only
when the user applies the reviewed grouping changes.

## Relationship To Existing Plans

This plan updates the shot rail group-selection behavior described in:

- `plans/active/0039-shot-ai-production-tab.md`
- `plans/active/0040-shot-video-take-core-cli.md`
- `plans/active/0041-shot-ai-production-studio-ui.md`

Where this plan conflicts with older rail grouping text, this plan wins for the
Studio browser shot rail.

This plan does not replace the shot-video generation architecture. It only
fixes how Studio edits which adjacent shots share a rail group.

## Current Problems

### The Button Is In The Wrong Place

`SceneShotRail` currently renders the group button as an absolutely positioned
overlay at the lower-right of the entire rail card. In the current visual
layout, that places the control over the image/card body instead of in the row
footer beside the `Shot 1` label.

Expected behavior:

- keep the row click target for selecting the shot;
- put the group-link icon in the footer row, all the way to the right;
- use the local shadcn-style `Button` primitive, not a raw `<button>`;
- keep the icon control compact and image-led, with no extra visible filler
  text on the card.

### The Tooltip Is Clipped

The current local `Tooltip` implementation renders absolute tooltip content
inside the same DOM tree as the trigger. Because the shot rail is scrollable and
uses overflow, the tooltip can be cut off by the rail container.

Expected behavior:

- keep using a local `src/ui/tooltip` primitive;
- make that primitive safe inside scrollable panes, preferably by backing it
  with the Radix tooltip portal already available through the Studio dependency
  set;
- keep feature code consuming `Tooltip`, `TooltipTrigger`, and
  `TooltipContent`, rather than inventing one-off tooltip markup.

### The Save Path Sends An Invalid Empty Group

`SceneShotsTab` currently computes desired groups, then removes missing groups
by calling `updateShotVideoTakeProduction` with the old group and
`shotIds: []`.

That immediately hits core validation:

```text
PROJECT_DATA379: Shot video take target requires at least one shot id.
```

The bug happens whenever a click removes a group. For example:

1. Shot 1 is in a group.
2. User clicks the link button again to discard that group.
3. Studio sends the old group with `shotIds: []`.
4. Core rejects it before grouping can be saved.

Expected behavior:

- do not use an empty `shotIds` update as a delete signal;
- persist the whole normalized rail grouping state atomically;
- keep the existing single production-group patch endpoint for AI Production
  settings, not for deleting rail groups.

### Accidental Clicks Should Not Commit Or Invalidate Work

Grouping changes can invalidate agent-authored prompts and production plans.
That makes the group-link button high-impact even though it is visually small.

Expected behavior:

- the first grouping click enters `Editing Groups` mode and applies the first
  draft action locally;
- while `Editing Groups` is active, all grouping clicks update only the local
  draft;
- no grouping draft is persisted until the user reviews and applies it;
- no prompt or production plan is marked stale until the user applies it;
- the user can discard the whole draft without affecting persisted groups,
  prompts, plans, or AI Production settings.

### Single-Shot Groups Need To Be Deterministic

An earlier interpretation tried to treat one-shot groups as local-only anchors.
That sounds tidy in the data model, but it is risky in the actual UI.

Example:

1. User clicks Shot 3 to start a group.
2. The click creates only an unsaved local anchor.
3. A background refresh, reload, navigation, or stale save response occurs.
4. Shot 3 no longer appears to be the chosen grouping start.

That is frustrating because the user's first click looked meaningful but was
not durable enough.

Expected behavior:

- one-shot groups are valid rail groups;
- one-shot groups render in the sidebar and the shot-detail group tag;
- one-shot groups persist through the same rail-group save path as multi-shot
  groups;
- clicking a one-shot group again clears the visible rail group while preserving
  the shot's AI Production settings;
- core still rejects empty groups, but it should accept any non-empty
  `shotIds` array.

This matches the existing core production-group contract better than the
local-only anchor approach because `ShotVideoTakeProductionGroup.shotIds` is
already valid when it contains one shot.

## Intended Click Model

The shot rail should keep an in-memory draft made of contiguous ranges.

Terminology:

- `above` means the shot immediately before the clicked shot in shot-list order;
- `below` means the shot immediately after the clicked shot in shot-list order;
- a `direct group above` is the group containing `above`;
- a `direct group below` is the group containing `below`;
- a one-shot group behaves like any other group, except its shot-video options
  remain single-shot options;
- a click may merge the group above and the group below only in the explicit
  ambiguous cycle state described below.

### Ungrouped Shot, No Direct Group Above Or Below

Example:

```text
1   2   3   4
        ^
```

Click Shot 3:

```text
1   2  [3]  4
```

Shot 3 becomes a one-shot group. It renders as grouped in the rail and the shot
detail surface. It saves as a persisted production group with one shot.

Click Shot 3 again:

```text
1   2   3   4
```

The one-shot group is cleared.

### Ungrouped Shot With One Direct Neighbor Group

Example with a group above:

```text
[1 2]  3   4
       ^
```

Click Shot 3:

```text
[1 2 3]  4
```

Click Shot 3 again:

```text
[1 2]  3   4
```

Shot 3 leaves the group and returns to the previous ungrouped state.

The same rule applies when the direct group is below:

```text
1   2  [3 4]
    ^
```

Click Shot 2:

```text
1  [2 3 4]
```

Click Shot 2 again:

```text
1   2  [3 4]
```

### Ungrouped Shot Between Two Direct Neighbor Groups

Example:

```text
[1 2]  3  [4 5]
       ^
```

The ambiguity cycle is:

1. join the group above;
2. join the group below;
3. merge the group above and the group below into one contiguous group;
4. clear back to the original two-group gap.

State sequence:

```text
[1 2]  3  [4 5]
[1 2 3]  [4 5]
[1 2]  [3 4 5]
[1 2 3 4 5]
[1 2]  3  [4 5]
```

The merge state is explicit. It must not happen on the first accidental click.

When the merged state is saved, it is a real merge. The implementation must
define which group's production settings survive; see the risks section below.

### Shot Already In A Group

When the clicked shot is in a non-ambiguous group, clicking removes it from that
group.

Top edge example:

```text
[1 2 3]
 ^
```

Click Shot 1:

```text
1  [2 3]
```

Bottom edge example:

```text
[1 2 3]
     ^
```

Click Shot 3:

```text
[1 2]  3
```

One-shot group example:

```text
[2]
 ^
```

Click Shot 2:

```text
2
```

The one-shot group is cleared.

Two-shot group example:

```text
[1 2]
   ^
```

Click Shot 2:

```text
[1]  2
```

The remaining `[1]` is still a real one-shot group. It renders as grouped and
saves as a persisted production group.

### Shot In The Middle Of A Group

Example:

```text
[1 2 3 4 5]
     ^
```

Click Shot 3:

```text
[1 2]  3  [4 5]
```

The original group splits into two separate groups. The clicked shot leaves the
group.

Click Shot 3 again:

```text
[1 2 3]  [4 5]
```

Click Shot 3 again:

```text
[1 2]  [3 4 5]
```

Click Shot 3 again:

```text
[1 2 3 4 5]
```

Click Shot 3 again:

```text
[1 2]  3  [4 5]
```

For a three-shot group, the split creates two one-shot groups:

```text
[1 2 3]
   ^

[1]  2  [3]
```

Those one-shot groups must still drive the next click cycle:

```text
[1 2]  [3]
[1]  [2 3]
[1 2 3]
[1]  2  [3]
```

Those one-shot groups render and persist.

## Determinism Risks

### Risk: Draft Edits Must Not Commit Or Invalidate Automatically

The grouping edit session should decide what the user is trying to do before
the backend is updated. A grouping click must not by itself commit data or mark
prompts stale.

Required behavior:

- every click updates the local draft synchronously;
- subsequent clicks read from the local draft, not the last saved server
  resource;
- background resource refreshes do not overwrite a dirty local draft;
- no save request is sent until the user chooses `Apply Changes` in the review
  dialog;
- prompt/plan stale state is not changed until `Apply Changes` succeeds;
- applying a draft that is identical to the original grouping does nothing and
  does not mark anything stale;
- discarding the draft restores the persisted grouping exactly.

Remaining limitation:

- if the user navigates away or reloads while `Editing Groups` is active, the
  draft is not persisted. Studio should ask whether to discard pending grouping
  changes before leaving the scene.

### Risk: Rail Membership Must Not Delete AI Production Settings

Grouping clicks should change membership. They should not silently erase the
AI Production choices a user already made.

Stable, user-authored AI Production settings include:

- selected input mode;
- selected model;
- parameter values;
- requested input policy and reusable input choices when those choices still
  refer to valid project assets;
- custom prompt notes authored by the user.

Required behavior:

- if a shot joins a group, it adopts that group's active AI Production settings;
- if a group is split, every resulting group gets the same stable AI Production
  settings as the original group;
- if a one-shot rail group is cleared, the shot keeps its single-shot AI
  Production settings even though it no longer renders as grouped in the rail;
- if two groups merge, the upper group's active AI Production settings win;
- no grouping click sends an operation whose purpose is to delete user-authored
  AI Production settings.

This means the implementation must not treat "remove from rail group" as
"delete the production plan." If the current `videoTakeProductionGroups` shape
cannot express that cleanly, the implementation should introduce an explicit
separation between rail grouping membership and single-shot production settings
rather than hiding settings in an invisible compatibility fallback.

### Risk: Merging Two Groups Needs A Deterministic Settings Winner

The new ambiguous cycle includes a merged state:

```text
[1 2]  3  [4 5] -> [1 2 3 4 5]
```

If `[1 2]` and `[4 5]` have different AI Production settings, a single merged
group needs one active settings set.

Proposed deterministic rule:

- when merging two direct groups, keep the upper group's `productionGroupId`;
- keep the upper group's user-facing production settings;
- remove the lower group from active rail membership when the merged state is
  saved;
- while the merge exists only in the unsaved local draft, preserve enough local
  provenance to let the next click restore the prior upper and lower group ids
  before the save is committed;
- after the merged state is saved and the page reloads, the merge is treated as
  intentional and the lower group's previous settings are not resurrected.

This rule is simple and testable. The lower group's settings no longer remain
active after the merge, but the user made an explicit merge choice by cycling to
that state. The implementation should make the cycle visually obvious enough
that the user can click once more to return to the two-group gap before the
merged state is saved.

### Risk: Prompts And Plans Become Stale When Membership Changes

Agent-authored prompts and generated production plans are derived from the
current committed shot ids. A grouping draft may propose new shot ids, but the
previous prompt and full generation plan should remain valid until the draft is
applied.

This applies when:

- a shot is added to a group;
- a shot is removed from a group;
- a one-shot group is created or cleared;
- a group is split;
- two groups are merged.

After `Apply Changes` succeeds:

- stable user-authored settings carry forward according to the rules above;
- generated `agentProposal` prompt drafts are marked stale when the group shot
  ids change;
- generated dependency drafts and prepared inputs are marked stale and are not
  silently reused when they were produced for the old shot ids;
- plan/preflight output must not be presented as valid for the new shot ids;
- the prompt surface shows an explicit stale indicator next to the prompt;
- the indicator should tell the user that the prompt needs agent regeneration,
  not that the model/settings themselves were lost.

While `Editing Groups` is active:

- the review dialog may preview which prompts/plans will become stale if the
  draft is applied;
- the prompt surface should not show the committed prompt as stale yet;
- discarding the draft leaves prompt/plan freshness unchanged.

Implementation contract:

- add shot-membership provenance to agent-generated artifacts, such as
  `basedOnShotIds` or a stable target revision;
- core compares that provenance with the current group shot ids;
- core returns a structured prompt/plan freshness state to Studio;
- Studio renders that state beside the prompt in the AI Production surface;
- tests cover every applied membership-changing draft as a prompt invalidation
  event.

### Risk: Four-State Ambiguous Cycles Are Harder To Discover

The cycle `above -> below -> merged -> none` is more powerful than a three-state
cycle, but it is less obvious.

Mitigations:

- use consistent visual feedback after every click;
- keep the tooltip short but accurate, for example `Cycle shot group`;
- ensure repeated clicks on the same shot always advance through the same
  sequence;
- add tests that assert the exact sequence for groups with different lengths.

## Edge Cases To Cover

The implementation should explicitly test these cases:

- first shot clicked with no shot above;
- last shot clicked with no shot below;
- isolated shot clicked twice;
- isolated shot clicked once, then an adjacent shot clicked to form a real
  two-shot group;
- ungrouped shot joins a direct group above, then leaves on second click;
- ungrouped shot joins a direct group below, then leaves on second click;
- ungrouped shot between two groups cycles above, below, merged, none;
- edge shot in a multi-shot group leaves without creating an empty group;
- one-shot group clears on click;
- edge shot in a two-shot group leaves one one-shot group;
- middle shot in an odd-length group splits into two groups;
- middle shot in a three-shot group splits into two one-shot groups;
- after a split, repeated clicks on the middle shot cycle above, below, merged,
  none;
- adjacent groups merge only on the explicit merged step;
- two adjacent groups render with a visible gap or divider even when no
  ungrouped shot sits between them;
- one-shot groups render in the rail and detail tag;
- clearing a one-shot group clears visible rail grouping but preserves the
  shot's single-shot AI Production settings;
- merging two groups keeps the upper group id and settings;
- cycling away from an unsaved merge restores the prior two groups;
- applying a membership-changing draft marks the affected generated prompts and
  production plans stale;
- stale shot ids from an old resource do not create local draft membership;
- unknown shot ids, duplicate shot ids, overlapping groups, and non-contiguous
  groups fail with structured server/core errors;
- a save failure does not erase the local draft;
- a late server response from an older save does not overwrite a newer local
  click state.

## Proposed Implementation

### 1. Separate Rail Membership From AI Production Settings

The fix should make a clear contract distinction:

- **rail membership** describes which shots are visually grouped in the sidebar;
- **AI Production settings** describe the active generation setup for a selected
  shot or shot group.

A shot can be visually ungrouped and still have single-shot AI Production
settings. Clearing visible grouping must not delete those settings.

This may require changing the current storage/resource shape so rail groups are
not the only place where single-shot production settings can live. Do that
directly in the current contracts rather than adding a compatibility shim.

### 2. Split Local Rail Drafts From Persisted Production Records

Add a local browser-only type in
`packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.ts`:

```ts
interface ShotRailGroupDraft {
  draftGroupId: string;
  productionGroupId?: string;
  sourceProductionGroupId?: string;
  mergePartnerProductionGroupId?: string;
  shotIds: string[];
}
```

Rules:

- `draftGroupId` is only for fast browser rendering and click cycling;
- `productionGroupId` is present when the draft range came from an existing
  persisted production group;
- `sourceProductionGroupId` records where production settings should be copied
  from when a split creates a new durable group;
- `mergePartnerProductionGroupId` records the second group involved in an
  unsaved merge so the next click can restore the prior two-group shape before
  persistence;
- `shotIds` are always stored in active shot-list order;
- draft ranges may contain one shot;
- persisted rail grouping requests may contain one or more shots.

Rename or replace `cycleShotGroupMembership` with a more precise pure function:

```ts
cycleShotRailGroupMembership(input: {
  shots: SceneShot[];
  draftGroups: ShotRailGroupDraft[];
  clickedShotId: string;
  createDraftGroupId: () => string;
}): ShotRailGroupDraft[];
```

This function must not call React hooks, browser APIs, fetch, or server code.

### 3. Build A Rail Projection From Draft Groups

Update `buildShotGroupingProjection` so the rail receives a projection from the
local draft, not directly from persisted production groups.

Projection rules:

- one-shot groups participate in click adjacency;
- one-shot groups get visible group treatment in the rail and detail tag;
- multi-shot draft groups render one continuous group background;
- adjacent multi-shot groups use a visible gap or alternating restrained
  background variants;
- selected-row styling remains stronger than the group background.

Existing helpers such as `findGroupForShot` and `groupTagLabel` should treat
one-shot groups as visible groups. A one-shot detail tag can use the same
meaningful display label as the rail, for example `Shot 3`.

### 4. Run An Explicit `Editing Groups` Session

`SceneShotsTab` should initialize a local draft from the active resource:

- all explicit rail membership records become rail draft groups, including
  visible one-shot groups;
- single-shot production settings without visible rail membership do not become
  rail draft groups;
- local draft is reset from the resource when the scene or active shot list
  changes;
- a background resource refresh must not clobber unsaved local draft clicks.

Click behavior:

- the first group-icon click enters `Editing Groups` mode and applies that
  first grouping action locally;
- `onCycleShotGroup` updates the local draft synchronously while the mode is
  active;
- the selected shot should not change when the group icon is clicked;
- the detail surface should receive the local visible group projection so the
  tag and current AI Production shot ids feel immediate;
- no server mutation runs while the user is still editing the draft.

Header behavior:

- show an `Editing Groups` button/status control at the far right of the scene
  header, on the same top row as the scene title such as `BOMBARDMENT`;
- use the established compact status/control styling used for save state, not a
  large marketing-style callout;
- clicking `Editing Groups` opens the review dialog;
- keep the state visually obvious enough that the user knows grouping clicks
  are editing a draft.

The review action opens a local shadcn `Dialog`.

Dialog behavior:

- title: `Review Changes`;
- summarize added, removed, expanded, shrunk, split, merged, and one-shot group
  changes with meaningful shot labels such as `Shot 3` or `Shots 3-5`;
- summarize impact, including how many prompts/plans will need regeneration if
  applied;
- state that AI Production settings will be preserved;
- state that merged groups use the upper group's active AI Production settings;
- actions: `Apply Changes`, `Discard`, and `Cancel`;
- `Apply Changes` sends the rail-group membership update and then marks affected
  prompts/plans stale according to core freshness metadata;
- `Discard` throws away the draft and restores persisted grouping;
- `Cancel` closes the dialog and returns to `Editing Groups` mode.

If the draft equals the persisted grouping, `Review Changes` should either be
disabled or the dialog should show `No grouping changes to apply`.

### 5. Add A Dedicated Server API For Rail Group Membership

Add a Studio service call:

```ts
updateShotVideoTakeRailGroups(projectName, sceneId, railGroups)
```

Route:

```text
PATCH /studio-api/projects/:projectName/screenplay/scenes/:sceneId/video-take-production/rail-groups
```

Request body:

```ts
interface ShotVideoTakeRailGroupsRequest {
  railGroups: Array<{
    productionGroupId?: string;
    sourceProductionGroupId?: string;
    mergePartnerProductionGroupId?: string;
    shotIds: string[];
  }>;
}
```

Server rules:

- reject unknown top-level fields;
- reject `railGroups` entries with zero shot ids;
- reject unknown shot ids;
- reject duplicate shot ids across rail groups;
- reject non-contiguous rail groups;
- store shot ids in active shot-list order;
- allocate durable production group ids in core for new groups;
- preserve the existing `productionGroupId` and user-facing production settings
  when an existing group remains;
- when a group is split, the upper segment keeps the original
  `productionGroupId`, and the lower segment gets a new core-generated id;
- when a shot leaves a group and becomes visually ungrouped, create or update
  that shot's single-shot production settings from the source group instead of
  deleting the settings;
- when a one-shot rail group is cleared, keep that shot's single-shot
  production settings available for the AI Production tab;
- when two direct groups are merged, the merged group keeps the upper group's
  `productionGroupId` and user-facing production settings;
- copy only still-valid user-facing production choices to a new split group:
  `inputModeId`, `modelChoice`, `parameterValues`, `requestedInputs`, and
  `customPromptNote`;
- preserve generated prompt text when useful, but mark `agentProposal`,
  dependency drafts, prepared inputs, and plan/preflight output stale when they
  were produced for the old shot ids;
- preserve groups that are still present in the requested rail groups, including
  one-shot groups;
- remove groups that are absent from the requested rail groups only as visible
  rail groups; do not delete the user-authored AI Production settings needed by
  the resulting single-shot targets;
- return the refreshed `SceneShotListResourceResponse` and resource keys.

This avoids using `shotIds: []` as a delete signal and prevents
`PROJECT_DATA379` during grouping.

### 6. Keep The Existing Production Settings API

Keep this existing endpoint for AI Production autosave:

```text
PATCH /studio-api/projects/:projectName/screenplay/scenes/:sceneId/video-take-production
```

That endpoint saves settings for the selected shot or selected visible group.
It should not be used to replace the full rail grouping layout.

### 7. Move The Icon Into The Footer

Update `SceneShotRailRow` to render a footer with:

- the existing shot label/title stack on the left;
- the group-link icon button on the right;
- a stable footer height so hover/focus states do not resize the card;
- the local shadcn `Button`;
- the lucide `Link2` or a more appropriate lucide link/grouping icon;
- no raw button, input, select, textarea, or dialog controls.

The button should be available on hover and focus, but it should not cover the
image or title text.

### 8. Fix Tooltip Clipping In The UI Primitive

Update `packages/studio/src/ui/tooltip.tsx` so tooltip content can escape
scroll containers.

Preferred implementation:

- use the available Radix tooltip primitive through the local UI wrapper;
- render `TooltipContent` in a portal;
- keep the current local import path stable for feature code;
- preserve current styling tokens;
- support side/align enough for the rail button to show content to the right or
  above without clipping.

Feature code should continue importing from `@/ui/tooltip`.

## Test Plan

### Pure Grouping Tests

Expand
`packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.test.ts`
to cover the full click matrix:

- isolated shot: none to one-shot group to none;
- isolated one-shot group plus adjacent click becomes a two-shot group;
- group above: join, then leave;
- group below: join, then leave;
- groups above and below: above, below, merged, none;
- top edge removal;
- bottom edge removal;
- one-shot group clears on click;
- two-shot edge removal leaves a one-shot group;
- middle split for five shots;
- middle split for three shots creates two one-shot groups;
- post-split cycling: above, below, merged, none;
- first-shot and last-shot boundaries;
- adjacent groups merge only on the explicit merged step;
- output shot ids are ordered;
- output groups never overlap;
- visible projection includes one-shot groups;
- visible projection excludes single-shot production settings that do not have
  rail membership;
- save projection includes one-shot groups;
- merge projection keeps the upper group id and records the lower group as the
  merge partner while the draft is unsaved.

These tests should use concrete shot ids and expected arrays so failures are
easy to read.

### Core And Server Tests

Add focused tests around the new membership update command and route:

- route rejects unknown fields with a structured Studio server error;
- route rejects empty `railGroups` entries;
- route rejects overlapping shot ids;
- route rejects non-contiguous shot ids;
- route delegates to core with the active shot list id;
- core preserves an existing group id when the group remains;
- core assigns a new id for a split lower segment;
- core keeps the upper group id when two groups merge;
- core removes the lower group from active rail membership when a merged state
  is saved;
- core preserves user-facing production settings on split;
- core preserves single-shot production settings when a one-shot rail group is
  cleared;
- core marks prompts, dependency drafts, prepared inputs, and plan/preflight
  output stale when applied shot membership changes;
- core persists one-shot groups;
- core removes old rail groups that are not in the replacement request without
  deleting resulting single-shot production settings;
- response includes the refreshed scene shot-list resource and resource keys;
- no save path sends `shotIds: []`.

### React Tests

Expand `scene-shots-tab.test.tsx` and/or add a focused rail test:

- the rail renders one group button per shot;
- the button is part of the footer area rather than an image overlay;
- clicking the group button does not select the row;
- the first group-button click enters `Editing Groups` mode and applies the
  first draft action;
- draft clicks update the rail immediately without sending server requests;
- the far-right scene-header control shows `Editing Groups`;
- clicking `Editing Groups` opens a `Review Changes` dialog with
  `Apply Changes`, `Discard`, and `Cancel`;
- `Cancel` returns to edit mode without persisting;
- `Discard` restores the persisted grouping without marking prompts stale;
- `Apply Changes` sends one rail-groups request;
- API errors show a grouping save error without clearing the local draft;
- the selected shot detail tag updates immediately for a new two-shot group;
- one-shot groups show a detail tag;
- a stale prompt indicator appears beside the prompt only after applying a
  membership change that affects the selected group.

### UI Verification

Use desktop-only verification for Renku Studio:

- open the scene shots page in the in-app browser;
- hover the first shot and confirm the link icon sits in the footer on the far
  right;
- hover/focus the icon and confirm the tooltip is readable and not clipped;
- click through isolated, adjacent, ambiguous, and middle-split scenarios;
- confirm the scene header shows a far-right `Editing Groups` control while
  draft changes are pending;
- confirm clicking `Editing Groups` opens the `Review Changes` dialog;
- confirm the review dialog summarizes added, removed, split, merged, and
  one-shot group changes;
- confirm `Cancel` returns to edit mode without saving;
- confirm `Discard` restores the persisted grouping and does not mark prompts
  stale;
- confirm `Apply Changes` commits the grouping and then marks affected prompts
  stale after adding, removing, splitting, or merging shots;
- confirm no `PROJECT_DATA379` error appears;
- refresh the page after a saved multi-shot group and confirm it persists;
- refresh the page after a saved one-shot group and confirm it persists;
- clear a one-shot rail group and confirm the shot's AI Production settings are
  still present when the shot is selected.

## Completion Checklist

### Review And Existing Behavior

- [x] Confirm current `SceneShotRail`, `SceneShotRailRow`, and
      `shot-video-take-grouping.ts` behavior against this plan.
- [x] Confirm whether any sample project currently stores one-shot
      `videoTakeProductionGroups` with meaningful AI Production settings.
- [x] Confirm that grouping clicks must not delete user-authored AI Production
      settings.
- [x] Confirm the new plan supersedes the older single-shot rail grouping text
      in `0039` and `0041`.

### Architecture And Contracts

- [x] Separate visible rail membership from AI Production settings in the
      current contracts.
- [x] Add precise local draft types for shot rail grouping.
- [x] Add a pure click-cycle function that accepts draft groups and returns the
      next draft groups.
- [x] Add a pure save-projection function that includes one-shot groups and
      rejects empty groups.
- [x] Add a server request reader for `ShotVideoTakeRailGroupsRequest`.
- [x] Add a core/project-data service method for atomic rail group membership
      replacement.
- [x] Add prompt/plan freshness metadata, including shot-membership provenance
      for agent-generated prompts.
- [x] Add a Studio API client function for the new rail-groups endpoint.
- [x] Keep the existing single production-group patch endpoint scoped to AI
      Production settings.

### Grouping Logic

- [x] Implement isolated-shot one-shot group creation and clear behavior.
- [x] Implement join/leave behavior for one direct neighbor group above.
- [x] Implement join/leave behavior for one direct neighbor group below.
- [x] Implement above, below, merged, none cycling between two direct neighbor
      groups.
- [x] Implement top-edge group removal.
- [x] Implement bottom-edge group removal.
- [x] Implement middle split into upper and lower groups.
- [x] Preserve the original group id on the upper split segment.
- [x] Assign a new durable id through core for the lower split segment.
- [x] Keep the upper group id when two groups merge.
- [x] Preserve local merge provenance until the merged state is saved or cycled
      away.
- [x] Ensure adjacent groups merge only on the explicit merged step.
- [x] Ensure one-shot groups participate in click adjacency.
- [x] Ensure one-shot groups render visibly in the rail and detail surface.

### Persistence

- [x] Replace the current `shotIds: []` deletion behavior.
- [x] Keep grouping drafts local until the user chooses `Apply Changes`.
- [x] Save applied rail grouping changes atomically through the new server
      endpoint.
- [x] Persist one-shot rail groups.
- [x] Remove absent one-shot rail groups deterministically.
- [x] Preserve user-facing production settings when a group remains or splits.
- [x] Preserve user-facing production settings when a one-shot group is cleared
      from the rail.
- [x] Preserve generated prompt text where useful but mark prompts, dependency
      drafts, prepared inputs, and plan/preflight output stale when membership
      changes.
- [x] Return and consume refreshed resource keys after save.
- [x] Prevent failed apply responses from discarding the local draft.

### UI

- [x] Move the grouping button into the shot row footer.
- [x] Keep the shot row itself selectable.
- [x] Stop propagation from the icon button so grouping does not also select
      the row.
- [x] Add the far-right scene-header `Editing Groups` control styled like the
      existing compact save/status controls.
- [x] Make the `Editing Groups` control open the `Review Changes` dialog.
- [x] Add the `Review Changes` dialog with `Apply Changes`, `Discard`, and
      `Cancel` actions.
- [x] Summarize group additions, removals, expansions, shrinks, splits, merges,
      one-shot groups, setting preservation, and prompt/plan regeneration impact
      in the review dialog.
- [x] Use local shadcn-style `Button` and `Tooltip` primitives only.
- [x] Use the local shadcn-style `Dialog` primitive for review.
- [x] Update the local tooltip primitive so rail tooltips are not clipped.
- [x] Keep group backgrounds quiet and image-led.
- [x] Keep visible group copy meaningful: no raw shot ids or filler labels.
- [x] Show a stale prompt indicator next to the prompt when membership changes
      invalidate agent-generated prompt content.
- [x] Keep desktop layout stable; do not add mobile-specific behavior.

### Tests

- [x] Add complete pure grouping tests for every edge case listed above.
- [x] Add save-projection tests for one-shot and multi-shot groups.
- [x] Add core tests for validation, split preservation, and stale data cleanup.
- [x] Add core tests for preserving user-authored AI Production settings through
      join, split, ungroup, and merge operations.
- [x] Add tests for prompt/plan stale metadata after applied
      membership-changing drafts.
- [x] Add Studio route tests for the new rail-groups endpoint.
- [x] Add Studio API client tests for the new request body and error handling.
- [x] Add React tests for edit-mode entry, immediate draft behavior, review
      dialog actions, explicit apply, and discard.
- [x] Add tooltip/component coverage where practical.

### Final Verification

- [x] Run `pnpm --dir packages/studio test`.
- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --dir packages/studio test:typecheck`.
- [x] Run focused route/server tests for screenplay video-take production.
- [x] Use the desktop browser to verify placement, tooltip visibility, click
      cycles, persistence after refresh, and absence of `PROJECT_DATA379`.
