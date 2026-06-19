# 0081 Takes Card Delete, Pick, And Storyboard Previews

Date: 2026-06-19

Status: implemented

Owner package: `packages/core` for durable take state, `packages/studio` for
the browser projection and controls.

## Implementation Status

Completed on 2026-06-19.

- Take deletion is now a focused core-owned operation exposed through thin
  Studio server and browser service layers.
- Take picks are persisted as `SceneShotVideoTake.picked`, ordered picked-first
  by core, and toggled from the Takes tab with the shared pick control.
- Take cards now compose the shared image overlay card, include hover/focus
  delete confirmation, and render storyboard previews in a `16:9` surface.
- The card grid size is controlled by
  `TAKE_CARD_GRID_MIN_WIDTH_PX` in
  `packages/studio/src/features/movie-studio/scenes/scene-take-card.tsx`.
- Selected generated video output thumbnails were not added to the take-list
  projection in this slice; storyboard fallback for takes without generated
  video output is complete.

## Problem

The scene Takes tab currently renders each `SceneShotVideoTake` as a small
custom button card. That card is missing behavior already available on other
visual cards:

- there is no top-right hover delete action;
- there is no confirmation dialog before deleting;
- there is no bottom-right pick control;
- picked takes are not ordered first;
- cards show a quiet text placeholder that says `Take` instead of showing the
  storyboard images already known for the take's selected shots;
- card sizing is hard-coded in the grid and is too small to tune cleanly.

The missing behavior should be added without moving take business rules into
React or Studio server route handlers. `packages/core` must own durable take
deletion, pick state, pick ordering, validation, and dependent-record cleanup.

## Product Behavior

### Delete

Each take card should show a delete icon in the top-right corner only while the
card is hovered or focused, matching `ImageOverlayCard` surfaces such as
Lookbook and image collection cards.

Deleting a take must open the existing `DeleteConfirmDialog`. The confirm copy
should describe the take domain without showing raw ids or filenames. Example:

```text
Title: Delete Take?
Message: Remove this take and its take-owned media. This cannot be undone.
```

After deletion, the card should disappear from the list. If the deleted take is
currently addressed by URL state during implementation, the UI should navigate
back to the Takes list for the scene instead of leaving a dead `takeId` route.

### Picks

Take picks should use the same bottom-right circular pick affordance as other
image cards by composing `ImageSelectionControl`.

Recommended contract for this plan:

- `SceneShotVideoTake.picked: boolean`;
- multiple takes in the same scene may be picked at the same time;
- picked takes are listed before unpicked takes;
- within each picked/unpicked group, the existing newest-first ordering remains.

This is intentionally a take-level pick, not a selected generated video output.
`SceneShotVideoTakeOutput.selected` remains scoped to choosing one generated
output inside one editable take. The Takes tab card pick is about promoting one
or more editable takes in the scene-level take list.

### Card Preview

The Takes list card preview should prefer real media over placeholders:

1. If the take list projection exposes a selected generated video output with a
   usable preview surface, show that output preview.
2. Otherwise, show storyboard images for the take's selected `shotIds`.
3. If one selected shot has a storyboard image, show that image full-bleed.
4. If multiple selected shots have storyboard images, show a maximum `2x2` grid
   in the same `16:9` card area.
5. If some selected shots do not have storyboard images, their grid cells should
   be quiet image-empty cells, not text labels.
6. If no selected shot has a storyboard image and no generated output preview is
   available, the card should stay visually quiet with the existing icon-only
   empty image treatment. It should not show the word `Take`.

Cards must keep a `16:9` aspect ratio. The implementation should introduce a
named exported or nearby feature-local constant for tuning card width, for
example:

```ts
const TAKE_CARD_GRID_MIN_WIDTH_PX = 280;
const TAKE_CARD_ASPECT_RATIO = 16 / 9;
```

The card grid should use that constant so the size can be adjusted after the
implementation without hunting through Tailwind strings.

## Architecture

### Core Ownership

`packages/core` owns these rules:

- whether a take exists and belongs to a scene;
- how a take is deleted;
- how take-owned dependent rows and media assets are cleaned up;
- how take pick state is persisted;
- how take list results are ordered;
- how structured errors are reported for missing takes or scene mismatches.

Do not implement durable delete or pick behavior by locally filtering React
state, by letting Studio server delete database rows directly, or by adding a
generic state patch API.

### Studio Server Ownership

Studio server routes stay thin:

- read route params and request bodies;
- call the focused core command;
- serialize the core response;
- translate structured errors through the existing route error helpers.

The server must not decide whether a take can be deleted or how pick ordering
works.

### Studio Frontend Ownership

The browser UI should:

- render the list projection;
- call Studio service functions for delete and pick mutations;
- use `DeleteConfirmDialog`, `Button`, `Tooltip`, `ImageOverlayCard`, and
  `ImageSelectionControl` from `packages/studio/src/ui`;
- avoid raw interactive browser controls in feature code;
- avoid raw filenames, ids, generated role names, or generic placeholder labels
  on the cards.

## Implementation Plan

### 1. Core Take Contract

Update the public take contract in `packages/core/src/client/shot-video-take.ts`:

```ts
export interface SceneShotVideoTake {
  takeId: string;
  sceneId: string;
  sourceShotListId: string;
  title: string;
  shotIds: string[];
  picked: boolean;
  state: SceneShotVideoTakeState;
  status: SceneShotVideoTakeStatus;
  createdAt: string;
  updatedAt: string;
}
```

Add the matching Drizzle schema column to `scene_shot_video_take`:

```ts
isPicked: integer('is_picked', { mode: 'boolean' }).notNull().default(false)
```

Generate the migration with Drizzle Kit from `packages/core` using the documented
workflow. Because current runtime reads will require the new column, the
implementation should evaluate this as a schema-generation change and update
`PRAGMA user_version` if the current project-store generation policy requires
it.

### 2. Core Commands

Add focused core operations in the shot-video take module:

- `deleteSceneShotVideoTake(input)`
- `updateSceneShotVideoTakePick(input)`

Recommended input names:

```ts
export interface DeleteSceneShotVideoTakeInput extends ShotVideoTakeContextInput {}

export interface UpdateSceneShotVideoTakePickInput extends ShotVideoTakeContextInput {
  picked: boolean;
}
```

`deleteSceneShotVideoTake` should:

- require the take and scene relationship through the existing take context path;
- fail with a structured `ProjectDataError` if the take does not exist or
  belongs to another scene;
- delete the take through core-owned database access;
- clean up take-owned media input/output assets deliberately instead of relying
  on route-local row deletion;
- return resource keys for the scene shot/take surfaces that need refreshing.

`updateSceneShotVideoTakePick` should:

- require the take and scene relationship through the existing take context path;
- set the durable `picked` value;
- update `updatedAt`;
- return the updated take and resource keys.

### 3. Core List Ordering

Change `listSceneShotVideoTakes` to return picked takes first from core.

Recommended order:

```text
picked desc, updatedAt desc, id desc
```

This keeps UI behavior deterministic and prevents the React component from
owning product ordering rules.

### 4. Optional Take List Preview Projection

The current browser list endpoint returns only `SceneShotVideoTake` records. It
does not expose generated video output preview information.

If the implementation wants card previews to show selected generated video
outputs before storyboard fallback, add a focused core projection instead of
making one browser request per card. A suitable shape is:

```ts
export interface SceneShotVideoTakeListItem {
  take: SceneShotVideoTake;
  selectedOutput: SceneShotVideoTakeOutput | null;
}

export interface SceneShotVideoTakeListReport {
  takes: SceneShotVideoTakeListItem[];
}
```

If this projection is added, update callers directly to the new list item shape
and do not keep a compatibility branch for the previous `{ takes:
SceneShotVideoTake[] }` response.

If selected output preview data is deferred, the implementation should still
complete the storyboard fallback behavior for cards without a generated output.

### 5. Studio HTTP And Service Layer

Add thin Studio route coverage under the existing scene take routes:

```text
DELETE /screenplay/scenes/:sceneId/takes/:takeId
PATCH  /screenplay/scenes/:sceneId/takes/:takeId/pick
```

The pick request body should be explicit and narrow:

```json
{ "picked": true }
```

Add request-body parsing beside
`packages/studio/server/http/scene-shot-video-take-production-request.ts` or in
a more precisely named take request file if that keeps responsibilities clearer.
Unknown fields should be structured request errors.

Add browser service functions in
`packages/studio/src/services/studio-shot-video-takes-api.ts`:

- `deleteSceneShotVideoTake(projectName, sceneId, takeId)`
- `updateSceneShotVideoTakePick(projectName, sceneId, takeId, picked)`

These services should use the existing token, error, and JSON response patterns.

### 6. Takes Tab UI

Extract a feature-local take card component if that makes
`scene-takes-tab.tsx` easier to review:

```text
packages/studio/src/features/movie-studio/scenes/scene-take-card.tsx
```

The card should compose `ImageOverlayCard` rather than recreating a raw
interactive image card. Use:

- `topRightAction` for the `DeleteConfirmDialog` trigger;
- `bottomRightControl` for `ImageSelectionControl`;
- `aspectClassName='aspect-video'`;
- the take card sizing constant for the grid;
- no visible `Take` placeholder text.

Click behavior must remain clear:

- clicking the card opens the take editor;
- clicking delete opens the confirmation dialog and does not open the take;
- clicking the pick control toggles the pick and does not open the take.

### 7. Storyboard Grid Preview

Add a small feature-local preview renderer for the take card:

- input: project name, scene id, ordered shot ids, and
  `storyboardImagesByShotId`;
- output: one full-bleed image or a `2x2` maximum grid inside the card preview;
- use existing `ScreenplayImageReferenceWithHttp.url` when present;
- keep alt text domain-readable, such as `Storyboard image for Shot 2`;
- avoid raw shot ids in visible text;
- for missing cells, show a quiet icon-only empty image state.

The preview renderer should be feature-local unless another feature needs the
same exact take-preview layout.

### 8. State Refresh And Navigation

After delete or pick mutation:

- update local `takes` state from the returned take/report where possible;
- otherwise reload `listSceneShotVideoTakes`;
- preserve core's picked-first ordering;
- listen to existing Studio resource refresh events instead of adding a new
  browser event system;
- if the current URL references a deleted take, navigate back to
  `sceneTab=takes` list mode.

## Tests And Verification

### Core Tests

Add or update tests around `packages/core/src/server/media-generation/shot-video-take/takes.test.ts`
or the nearest existing shot-video take command test file:

- creating a take defaults `picked` to `false`;
- updating a take pick sets `picked` to `true`;
- clearing a take pick sets `picked` to `false`;
- listing takes orders picked records before unpicked records;
- deleting a take removes the editable take and its shot membership rows;
- deleting a take cleans up take-owned media input/output records and their
  owned assets according to the chosen core cleanup rule;
- deleting or picking a take from the wrong scene fails with a structured
  project-data error.

### Studio Server Tests

Extend `packages/studio/server/routes/screenplay-video-take-production.test.ts`
or add a focused route test:

- `DELETE /takes/:takeId` calls `projectData.deleteSceneShotVideoTake`;
- `PATCH /takes/:takeId/pick` parses `{ picked: boolean }` and calls
  `projectData.updateSceneShotVideoTakePick`;
- route handlers stay thin and serialize resource keys;
- missing or invalid request fields return structured Studio server errors;
- token-protected mutations remain token-protected.

### Studio Service Tests

Extend `packages/studio/src/services/studio-shot-video-takes-api.test.ts`:

- delete uses `DELETE /takes/:takeId`;
- pick uses `PATCH /takes/:takeId/pick`;
- both include the existing Studio API token behavior;
- both surface structured API errors through `readStudioApiError`.

### Studio UI Tests

Add a focused test file for `SceneTakesTab` if one does not already exist:

- take cards no longer render the word `Take` as the preview placeholder;
- a single-shot take renders the shot's storyboard image;
- a multi-shot take renders no more than four storyboard cells;
- the delete button opens `DeleteConfirmDialog`;
- confirming delete calls `deleteSceneShotVideoTake`;
- the pick control calls `updateSceneShotVideoTakePick`;
- picked takes render before unpicked takes after load or mutation;
- clicking delete or pick does not open the take editor;
- the new-take card still creates a take from the first shot.

### Desktop Visual Verification

Use the existing desktop Renku Studio viewport only. Do not add mobile-specific
verification for this task.

Verify in Chrome or the in-app browser:

- the Takes tab still opens at the Bombardment scene;
- card size is larger than the current 240px minimum and can be tuned through
  the named constant;
- delete appears only on hover/focus;
- pick appears in the bottom-right corner and visually matches other cards;
- single-shot and multi-shot storyboard previews keep a clean `16:9` card;
- grid cells do not overlap the title/shot-range overlay;
- no card shows raw filenames, raw ids, or generic placeholder labels.

## Completion Checklist

### Review Area

- [x] Confirm take picks are intentionally multi-select rather than a single
  active take per scene.
- [x] Confirm the public field name is `picked` and the database column is
  `is_picked`.
- [x] Confirm picked-first ordering is owned by core list projection, not by
  React-only sorting.
- [x] Confirm generated video output preview is either included through a
  focused list projection or explicitly deferred while storyboard fallback is
  completed.
- [x] Confirm delete copy is acceptable and does not expose raw ids or filenames.

### Architecture And Contracts

- [x] Update `SceneShotVideoTake` with `picked: boolean`.
- [x] Add the Drizzle schema column for take pick state.
- [x] Generate the Drizzle migration through Drizzle Kit from `packages/core`.
- [x] Update project-store schema generation and migration `PRAGMA user_version`
  if required by the current migration policy.
- [x] Add focused core command input types for deleting a take and updating a
  take pick.
- [x] Add `deleteSceneShotVideoTake` to the core shot-video take module.
- [x] Add `updateSceneShotVideoTakePick` to the core shot-video take module.
- [x] Add database access functions for take deletion and pick updates.
- [x] Keep take deletion cleanup inside core-owned services and database access.
- [x] Update `ProjectDataService` contracts and shot-video take service wiring.
- [x] Update browser-safe exports only through intentional package entrypoints.
- [x] Avoid re-export stubs, compatibility wrappers, and old response aliases.

### Studio Server

- [x] Add `DELETE /screenplay/scenes/:sceneId/takes/:takeId`.
- [x] Add `PATCH /screenplay/scenes/:sceneId/takes/:takeId/pick`.
- [x] Add a focused request parser for `{ picked: boolean }`.
- [x] Keep route handlers thin: params/body, core call, JSON response, error
  translation.
- [x] Add the new commands to `ProjectsRouteProjectData`.
- [x] Ensure both mutation routes require the Studio API token.

### Studio Services

- [x] Add `deleteSceneShotVideoTake`.
- [x] Add `updateSceneShotVideoTakePick`.
- [x] Update `listSceneShotVideoTakes` if the list response becomes a list-item
  projection.
- [x] Preserve existing structured API error handling.
- [x] Update service tests for new methods and any list response shape change.

### Studio UI

- [x] Add a named take-card sizing constant that controls the grid minimum
  width.
- [x] Replace the custom take card button with an `ImageOverlayCard`-composed
  take card.
- [x] Use `DeleteConfirmDialog` with a top-right hover/focus trigger.
- [x] Use `ImageSelectionControl` for the bottom-right pick control.
- [x] Render a single storyboard image full-bleed for single-shot takes.
- [x] Render a maximum `2x2` storyboard grid for multi-shot takes.
- [x] Keep the card aspect ratio at `16:9`.
- [x] Remove the visible `Take` placeholder from card previews.
- [x] Keep the new-take card functional and visually aligned with the larger
  grid.
- [x] Ensure delete and pick clicks do not also open the take editor.
- [x] Ensure local state after mutations preserves core-owned ordering.
- [x] Ensure the UI uses only local `packages/studio/src/ui` interactive
  controls.

### Tests

- [x] Add core tests for pick default, pick update, pick clear, and list
  ordering.
- [x] Add core tests for delete behavior and dependent cleanup.
- [x] Add core tests for structured errors on wrong-scene or missing-take
  mutations.
- [x] Add Studio server route tests for delete and pick.
- [x] Add Studio service tests for delete and pick methods.
- [x] Add Takes tab UI tests for storyboard previews.
- [x] Add Takes tab UI tests for delete confirmation.
- [x] Add Takes tab UI tests for pick toggling and picked-first ordering.
- [x] Add UI tests proving raw ids, raw filenames, and the old `Take`
  placeholder are not visible on the card surface.

### Final Verification

- [x] Run the focused core test package.
- [x] Run the focused Studio server/service/UI tests.
- [x] Run `pnpm check` or the smallest accepted workspace command that covers
  TypeScript and lint for touched packages.
- [x] Verify the Takes tab in the desktop browser viewport.
- [x] Confirm no mobile-specific work or reporting was added.
- [x] Confirm no raw browser controls were introduced in feature code.
- [x] Confirm no compatibility layers, wrappers, aliases, or re-export stubs
  were added.
- [x] Confirm implementation notes or ADR updates are added only if the final
  behavior changes accepted architecture.
