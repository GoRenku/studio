# 0033 Storyboard And Shot Surfaces UI — Scaffold

Date: 2026-05-30

Status: proposed

> This plan replaces the earlier `0033-scene-shot-list-ui.md` draft, which only
> covered the Scene Shots tab and left the primary layout deferred. The scope is
> now the full storyboard navigation experience across Acts, Sequences, and
> Scenes, plus the structural scaffold of the per-shot design surface. The
> detailed design of the five shot-design tabs lives in the companion plan
> `0036-shot-design-tabs.md`.

## Goal

Surface the storyboard images authored by the `scene-shot-designer` skill (plan
`0032`) as the primary way to view and navigate a movie's coverage, at three
levels of the screenplay hierarchy, and scaffold the per-shot design surface
where finished shots will eventually play.

This plan delivers four connected surfaces:

1. **Act storyboard overview** — a new Act detail page that shows every scene in
   the act as storyboard coverage, grouped by sequence. Clicking any shot
   navigates to that scene's Shots tab with the shot selected.
2. **Sequence storyboard cards** — the existing Sequence detail page, upgraded so
   each scene card shows its storyboard sheet (4:3) or a placeholder, using the
   shared image-card treatment with size levers.
3. **Scene Shots tab** — a two-pane master/detail surface: a narrow left rail of
   per-shot storyboard thumbnails that selects the active shot, and a wide right
   pane that hosts that shot's design surface.
4. **Shot design surface scaffold** — the right pane shell: a top video stage
   (empty placeholder with transport controls) and a bottom tab bar
   (Description, Camera Framing, Camera Motion, Location, Camera Type). Only the
   shell, the video stage, and the read-only Description tab ship in this plan.

This plan is display-and-navigate plus structural scaffold. It does **not**
implement shot-parameter editing, blocking diagrams, framing pickers, or any
write-back path. Those belong to `0036`.

## References

- `docs/product/design-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/reference/studio-server-hono.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `docs/decisions/0024-keep-media-slicing-out-of-app-state.md`
- `plans/active/0029-location-surfaces-ui-redesign.md`
- `plans/active/0031-story-arc-analysis-visualization-ui.md`
- `plans/active/0032-scene-shot-list-cli-skill-and-data-model.md`
- `plans/active/0036-shot-design-tabs.md`
- `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`
- `packages/studio/src/features/movie-studio/sequences/sequence-panel.tsx`
- `packages/studio/src/features/movie-studio/screenplay-media/screenplay-image-card.tsx`
- `packages/studio/src/features/movie-studio/locations/location-visual-content-tab.tsx`
- `packages/studio/src/features/movie-studio/locations/location-assets.ts`
- `packages/core/src/server/resources/screenplay-ui.ts`
- `packages/core/src/server/database/access/scene-shot-lists.ts`
- `packages/core/src/client/scene-shot-list.ts`

## Dependency

This UI builds directly on the data, CLI, and skill work delivered in `0032`
(status: implemented). The following are already in place and must be reused, not
re-created:

- `scene_shot_list` / `scene_shot_list_state` tables and active-state access
  (`packages/core/src/server/database/access/scene-shot-lists.ts`);
- `scene_shot_storyboard_sheet` / `scene_shot_storyboard_image` tables and their
  list/read access functions;
- the compound storyboard sheet Asset attached to the Scene target
  (`{ kind: 'scene', sceneId }`) with `asset_file.role = 'sheet'` (original) and
  `asset_file.role = 'shot'` (sliced per-shot files);
- the `SceneShotListDocument` / `SceneShot` browser-safe contracts
  (`packages/core/src/client/scene-shot-list.ts`).

The UI must not read SQLite directly, must not infer storyboard placement from
filenames, and must not duplicate slicing or crop logic (ADR 0024).

### Data-backing confirmation

The data layer fully backs this UI. Per-shot images are recoverable through:

```text
scene_shot_storyboard_sheet  (shot_list_id -> compound asset_id, sheet_file_id)
scene_shot_storyboard_image  (storyboard_sheet_id, shot_id, asset_file_id, position)
```

`listSceneShotStoryboardSheetRecords(session, shotListId)` and
`listSceneShotStoryboardImageRecords(session, storyboardSheetId)` already return
these in order. The active shot list per scene comes from
`readActiveSceneShotListRecord(session, sceneId)`. The only missing pieces are
the browser-safe **read resources**, the **HTTP routes** to serve them, the
**scene asset-file route** to serve storyboard image bytes, and the **Studio
selection** additions for Act selection and shot deep-linking — all added here.

## Naming

- **Act Storyboard Overview** — the Act detail surface.
- **Sequence Storyboard Cards** — scene cards on the Sequence detail surface.
- **Scene Shots Tab** — the second tab on a Scene page.
- **Shot Design Surface** — the right pane that hosts a single shot's video stage
  and design tabs.
- **Shot Rail** — the left selector rail of storyboard thumbnails.

Keep "Shot" as the canonical unit, consistent with `0032`. Do not introduce
"clip", "panel", or "frame" as the durable noun for a planned shot.

## Surface 1 — Act Storyboard Overview

### Behavior

Today, clicking an Act in the sidebar only expands its sequences; there is no Act
detail page. This plan adds one.

- Selecting an Act (sidebar click on the Act title) both expands the Act in the
  sidebar tree **and** opens the Act Storyboard Overview in the main panel.
- The overview presents the whole act as storyboard coverage, grouped by
  sequence in screenplay order. Each sequence is a labeled section; within it,
  each scene contributes its shots.
- Coverage rendering per scene:
  - if the scene has an active shot list with imported storyboard images, render
    one thumbnail per shot in shot order (a grid of shots for that scene);
  - if the scene has no active shot list or no storyboard images yet, render a
    single quiet **placeholder slot for the whole scene** (not one placeholder
    per hypothetical shot);
- Each shot thumbnail is a button. Clicking it navigates to that scene and
  selects that shot in the Scene Shots tab (deep link; see Selection Model). A
  placeholder scene slot navigates to that scene's Shots tab with no shot
  pre-selected.
- The goal is scannability: a director should read the whole act's visual rhythm
  top to bottom. Keep it dense and quiet, not a marketing grid.

### Layout

- Group header per sequence: the section-header pattern
  (`text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground`)
  with the sequence title and a scene/shot count badge.
- Within a sequence, render scenes in order. A small scene label precedes each
  scene's shot cluster so the act reads as sequence → scene → shots.
- Shots use a compact auto-fill grid. The shot thumbnail aspect ratio follows the
  project aspect ratio when known, falling back to the storyboard sheet's natural
  panel ratio. Default to `4 / 3` panels if no better signal exists.
- Use `bg-panel-bg` for the scrollable surface and the standard panel content
  padding, matching `location-visual-content-tab.tsx`.

### Levers

Expose a single layout config object so card density is tunable without hunting
through JSX:

```text
packages/studio/src/features/movie-studio/acts/act-storyboard-layout.ts
```

```ts
export const ACT_STORYBOARD_LAYOUT = {
  shotMinWidthPx: 168,   // auto-fill min track for each shot thumbnail
  shotGapClass: 'gap-3',
  sceneSlotMinWidthPx: 240, // placeholder slot width for storyboard-less scenes
} as const;
```

## Surface 2 — Sequence Storyboard Cards

### Behavior

The Sequence detail page continues to list scenes as cards, one card per scene,
and continues to navigate to the scene on click. The change is the card visual:

- when the scene has an active storyboard sheet, the card image shows the **full
  storyboard sheet** (4:3) so the individual shot panels are legible inside it;
- when there is no storyboard sheet yet, the card shows the existing quiet
  placeholder;
- the card keeps the shared text treatment beneath the image: scene title
  (`text-sm font-semibold`) and a muted metadata line
  (`int/ext / time-of-day`), exactly as `ScreenplayImageCard` renders today.

### Reuse and the card component

Use the existing shared card primitive
`packages/studio/src/features/movie-studio/screenplay-media/screenplay-image-card.tsx`
and its grid
`screenplay-image-card-grid.tsx`. Pay attention to the text treatment under the
card — it is already the intended shared style; do not reinvent it.

The card currently hard-codes `aspect-[4/3]` and `object-cover`. The storyboard
sheet is 4:3 and must be shown **whole** (panels legible), so:

- add an optional `imageFit?: 'cover' | 'contain'` prop to `ScreenplayImageCard`
  (default `cover` to preserve existing callers); the sequence cards pass
  `contain`;
- add an optional `aspectClassName` / numeric aspect lever so the 4:3 default can
  be overridden later without touching every caller (keep `4 / 3` as default).

These are additive, domain-neutral props; they keep `ScreenplayImageCard` the one
shared owner per the front-end guidelines, rather than forking a storyboard-only
card.

### Levers

```text
packages/studio/src/features/movie-studio/sequences/sequence-storyboard-layout.ts
```

```ts
export const SEQUENCE_STORYBOARD_LAYOUT = {
  // Grid auto-fills columns at this minimum card width. Larger = fewer, bigger
  // cards (shots in the sheet are easier to read); smaller = denser overview.
  cardMinWidthPx: 360,
  gridGapClass: 'gap-5',
  sheetAspectRatio: 4 / 3,
} as const;
```

The current grid uses fixed Tailwind breakpoints
(`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Switch the sequence grid to an
auto-fill track driven by `cardMinWidthPx` (mirroring the
`grid-cols-[repeat(auto-fill,minmax(...,1fr))]` pattern already used in
`location-visual-content-tab.tsx`) so card size is the single tunable knob.

## Surface 3 — Scene Shots Tab

### Behavior

Replace the placeholder Shots tab in `scene-panel.tsx`
(`Scene shots will appear here when a shot model is added.`) with a two-pane
master/detail surface. The Narrative tab is unchanged.

- **Left rail (master):** vertical list, one shot per row, each row a storyboard
  thumbnail plus the app-derived shot label (`Shot 1`, `Shot 2`, …) and the shot
  title. The rail is the selector. Selecting a row sets the active shot.
- **Right pane (detail):** the Shot Design Surface for the selected shot (Surface
  4). It takes the majority of the width.
- The rail must not be too wide. Use the master/detail proportions from the
  design guidelines but narrower than the 288px Models/Outputs master, because a
  shot row is mostly a thumbnail.
- Default selection: the first shot, unless a `shotId` deep link arrives from the
  Act overview (see Selection Model), in which case select that shot and scroll
  it into view in the rail.

### Layout and surface coloring

Follow the master/detail pattern from the design guidelines:

```text
<div className='flex-1 min-h-0 flex gap-4'>
  <aside className='shrink-0 bg-muted/40 rounded-xl border border-border/40'>…rail…</aside>
  <section className='min-w-0 flex-1 bg-muted/40 rounded-xl border border-border/40'>…detail…</section>
</div>
```

- Rail rows use the BuildCard interaction states: default
  `bg-transparent border-transparent`, hover `bg-item-hover-bg border-border/50`,
  selected `bg-item-active-bg border-item-active-border`.
- Rail thumbnails use the project/panel aspect ratio and `object-cover`.
- Detail pane uses `bg-panel-bg` content per the panel anatomy.

### Empty and partial states

- **No active shot list:** the whole Shots tab shows one quiet empty state
  ("No shot list yet.") using the centered empty-state pattern. No CLI hints.
- **Active shot list, no storyboard images yet:** the rail still lists every shot
  (label + title), with a quiet image placeholder in each row. The right pane
  still works (Description tab has content; the video stage shows its empty
  placeholder).

### Levers

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-layout.ts
```

```ts
export const SCENE_SHOT_LAYOUT = {
  // Width of the left shot rail. Keep it narrow: a row is a thumbnail + label.
  railWidthPx: 232,
  railThumbAspectRatio: 4 / 3,
  railRowGapClass: 'gap-1',
} as const;
```

## Surface 4 — Shot Design Surface Scaffold

The right pane of the Scene Shots tab. This plan ships only the shell, the video
stage, and the Description tab. The other four tabs render a quiet scaffold
placeholder and are designed in `0036`.

### Top — Video Stage

- A 16:9 (or project-aspect) stage area at the top of the right pane.
- Empty placeholder content: a centered muted "No shot video yet" state using the
  empty-state pattern (icon circle + title), since no shoot video exists.
- A transport row beneath the stage: a play/pause icon `Button` and a scrub
  `Slider` (`@/ui/slider`) with a time label. In the scaffold these are present
  but disabled (no media source), establishing the layout and the eventual
  contract. Do not fake playback.
- Component: `scenes/scene-shot-video-stage.tsx`. Keep the transport markup in a
  small child so it can later bind to a real media element without reshaping the
  layout.

### Bottom — Design Tabs

- A `LineTabBar` + `Tabs` shell with values:
  `description`, `camera-framing`, `camera-motion`, `location`, `camera-type`.
- **Description** (shipped, read-only): render the selected shot's narrative
  fields from `SceneShot` — title, story beat, narrative purpose, description,
  subject, action, dialogue coverage summary, and cast/location labels as quiet
  chips. No editing.
- **Camera Framing / Camera Motion / Location / Camera Type** (scaffold): each
  renders a quiet placeholder ("Designed in the shot-design surface.") so the
  shell is navigable and visually complete. `0036` fills these in.
- Component: `scenes/scene-shot-detail.tsx` owns the tab shell;
  `scenes/scene-shot-description-tab.tsx` owns the Description content.

## Selection Model

Two additions to `StudioSelection` are required and span client and server.

1. **Act selection.** Add `{ type: 'act'; id: string }`.
   - Route path: `/projects/:projectName/acts/:actId`.
   - Sidebar: clicking the Act title selects the act (opens the overview) and
     still toggles its sequence subtree. Keep the existing chevron toggle
     behavior; the title click now also calls `onSelect({ type: 'act', id })`.
2. **Shot deep link.** Extend scene selection to carry an optional shot:
   `{ type: 'scene'; id: string; shotId?: string }`.
   - Route path: `/projects/:projectName/scenes/:sceneId` with `?shot=<shotId>`
     when present (query param keeps the existing path stable).
   - The Scene Shots tab reads `shotId` to pre-select and scroll the rail.

Files to update for both additions:

```text
packages/studio/src/features/movie-studio/movie-studio-selection.ts
packages/core/src/server/  (StudioSelection type + selection-context resolver)
packages/studio/server/http/movie-studio-selection-request.ts
packages/studio/src/app/use-project-session.ts  (route <-> selection mapping)
packages/studio/src/features/movie-studio/studio-sidebar/studio-sidebar.tsx
packages/studio/src/features/movie-studio/movie-studio-screen.tsx  (render Act panel)
```

Keep the additions minimal and follow the existing `sequence`/`scene` precedent
exactly (validation requires `id` for `act`; `shotId` is optional and never
required).

## Resource Contracts

Add browser-safe contracts in `packages/core/src/client/resources.ts`. Reuse the
existing `ScreenplayImageReference` shape for every image so the browser keeps
using one URL-resolution path.

### Scene Shots resource (Scene Shots tab)

```ts
export interface SceneShotListResource {
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  act: ActNavigationRow;
  projectAspectRatio: string | null;
  activeShotList: SceneShotListDocument | null;
  storyboardSheet: SceneStoryboardSheetReference | null;
  storyboardImagesByShotId: Record<string, ScreenplayImageReference>;
}

export interface SceneStoryboardSheetReference {
  shotListId: string;
  sheet: ScreenplayImageReference; // original sheet file (role 'sheet')
}
```

Notes:
- `activeShotList` is `null` when the scene has no active shot list.
- `storyboardImagesByShotId` maps each `shotId` to its sliced image
  (`asset_file.role = 'shot'`), grouped explicitly by the relationship table —
  never by filename.
- Validate stored shot-list JSON via `readSceneShotListDocument` before returning.
- Do not include inactive shot lists, crop boxes, grid cells, or absolute paths.

### Sequence storyboard (Sequence cards)

Extend the existing `SequenceResource` scene rows with an optional storyboard
sheet reference rather than adding a parallel resource:

```ts
// each scene row in SequenceResource.scenes.items gains:
storyboardSheet?: ScreenplayImageReference; // active sheet 'sheet' file, if any
```

### Act storyboard (Act overview)

```ts
export interface ActStoryboardResource {
  act: ActNavigationRow;
  sequences: ActStoryboardSequence[];
}

export interface ActStoryboardSequence {
  sequence: SequenceNavigationRow;
  scenes: ActStoryboardScene[];
}

export interface ActStoryboardScene {
  scene: SceneNavigationRow;
  shots: ActStoryboardShot[]; // empty -> render one scene placeholder slot
}

export interface ActStoryboardShot {
  shotId: string;
  label: string;       // app-derived ('Shot 1'); see note below
  title: string;
  image: ScreenplayImageReference | null;
}
```

Label derivation: the app derives `Shot N` from shot array order, consistent with
`0032`. Compute it in the resource layer so the Act overview and Scene rail agree
without duplicating logic in the browser.

## Core Resource Readers

Add a dedicated module:

```text
packages/core/src/server/resources/scene-storyboard-ui.ts
```

with:

```ts
readSceneShotListResource(input)       // scene shots tab
readActStoryboardResource(input)       // act overview
```

and extend `readSequenceResource` in `screenplay-ui.ts` to attach
`storyboardSheet` per scene.

Implementation notes:
- compose existing access functions: `readActiveSceneShotListRecord`,
  `readSceneShotListDocument`, `listSceneShotStoryboardSheetRecords` (use the
  most recent sheet for the active shot list),
  `listSceneShotStoryboardImageRecords`, and the asset access used by
  `toScreenplayImageReference` to resolve `asset_file` rows into image refs;
- resolve the sliced shot image by joining `scene_shot_storyboard_image.shot_id`
  to the shot list's `shotId`;
- for the Act overview, walk acts → sequences → scenes using the existing
  navigation access (`listSequenceNavigationPage`, `listSceneNavigationPage`) and
  attach shots per scene;
- keep each reader within one `openProjectSession` and `session.close()` in
  `finally`, matching the existing resource modules.

Wire through `project-data-service-contracts.ts`,
`project-data-service-wiring/`, and the service so the routes can call them.

## Routes And Asset Serving

Add to `packages/studio/server/routes/screenplay.ts`:

```text
GET /screenplay/scenes/:sceneId/shot-list           -> SceneShotListResource
GET /screenplay/acts/:actId/storyboard              -> ActStoryboardResource
```

The Sequence cards reuse the existing `GET /screenplay/sequences/:sequenceId`
(now returning `storyboardSheet` per scene).

Add a **scene asset-file route** to `packages/studio/server/routes/assets.ts`,
mirroring the cast/location file routes, so storyboard bytes can be served from
the Scene target:

```text
GET /scenes/:sceneId/assets/:assetId/files/:assetFileId
   -> readAssetFileResponse(projectData, { projectName,
        target: { kind: 'scene', sceneId }, assetId, assetFileId })
```

Browser services:

```text
packages/studio/src/services/studio-screenplay-api.ts
  readSceneShotListResource(projectName, sceneId)
  readActStoryboardResource(projectName, actId)

packages/studio/src/services/studio-project-assets-api.ts
  sceneAssetFileUrl(projectName, sceneId, assetId, assetFileId)
```

Add a storyboard image adapter alongside the location pattern:

```text
packages/studio/src/features/movie-studio/scenes/scene-storyboard-assets.ts
  storyboardImageUrl(projectName, sceneId, image: ScreenplayImageReference): string
```

This builds the URL from `sceneAssetFileUrl` using the ref's `assetId` and
`assetFileId`, exactly as `location-assets.ts` does. No browser mutation APIs are
added in this plan.

## UI Architecture

New feature folder for the Act surface:

```text
packages/studio/src/features/movie-studio/acts/
  act-storyboard-panel.tsx
  act-storyboard-layout.ts
  act-storyboard-panel.test.tsx
```

Sequence updates:

```text
packages/studio/src/features/movie-studio/sequences/
  sequence-panel.tsx                  (use shared card + storyboard sheet + auto-fill grid)
  sequence-storyboard-layout.ts
```

Scene Shots tab + Shot Design Surface scaffold:

```text
packages/studio/src/features/movie-studio/scenes/
  scene-panel.tsx                     (wire Shots tab to SceneShotsTab)
  scene-shots-tab.tsx                 (loads resource, owns selected shotId, master/detail)
  scene-shot-rail.tsx                 (left selector rail)
  scene-shot-rail-row.tsx             (one shot row: thumbnail + label + title)
  scene-shot-detail.tsx              (right pane shell: video stage + tab bar)
  scene-shot-video-stage.tsx         (empty stage + disabled transport)
  scene-shot-description-tab.tsx      (read-only narrative fields)
  scene-shot-detail-tab-placeholder.tsx (quiet scaffold for the four design tabs)
  scene-shot-list-empty.tsx           (no active shot list)
  scene-shot-layout.ts
  scene-storyboard-assets.ts
  scene-shots-tab.test.tsx
```

Shared UI primitive additions:

```text
packages/studio/src/ui/   (extend ScreenplayImageCard props: imageFit, aspect lever)
```

Composition responsibilities follow the front-end guidelines: containers wire
data and layout; child components own one area each; all interactive controls use
local `@/ui` primitives (`Button`, `Tabs`, `LineTabBar`, `Slider`); no raw
controls in feature code.

## Resource Refresh

Each surface refreshes on the scoped resource keys appended by `0032` writes and
imports. Listen with the existing
`window 'renku:studio-resource-changed'` event used in `movie-studio-screen.tsx`,
scoped to the owning container:

```text
Scene Shots tab:  surface:scene:<scene-id>:shots
                  scene-shot-list:<shot-list-id>:shot:<shot-id>
                  scene:<scene-id>
Act overview:     scene:<scene-id> for any scene in the act, and
                  scene-shot-list:<shot-list-id>:storyboard-sheet:<sheet-id>
Sequence cards:   scene:<scene-id> for any scene in the sequence
```

Keep refresh local to the owning container; do not widen the project shell (ADR
0017). If a surface cannot yet match a key precisely, reload its resource when its
selection id changes and note the gap in the PR. Do not poll.

## Visual Design Notes

- Production-planning feel, not marketing. Quiet borders (`border-border/40`),
  the section-header pattern for group labels, no decorative gradients, no hero
  typography.
- Never render raw filenames, asset ids, or kebab labels as primary copy
  (front-end guidelines). Shot labels are app-derived; titles come from the
  document.
- Image fitting: storyboard **sheets** use `object-contain` (panels must stay
  legible); per-shot **thumbnails** use `object-cover`. Numeric aspect ratio and
  the Tailwind aspect class must agree (front-end guidelines).
- Use `ImagePreviewDialog` for any full-size sheet/shot preview, matching the
  cast/location pattern, with meaningful titles (shot label + title), never the
  asset id.

## Accessibility

- Act/sequence/shot navigation controls are `Button`-based with accessible
  labels; icon-only transport controls have `aria-label`s.
- Rail rows expose the shot label and title to assistive tech; the selected row
  uses `aria-current`.
- The video stage placeholder is not a control; the disabled transport conveys
  disabled state, not just visual muting.
- Dialog titles remain accessible per the `Dialog` primitive.

## Tests

Frontend (focused, desktop only):

- Act overview groups scenes by sequence and renders shots in order;
- scenes without storyboards render exactly one placeholder slot;
- clicking a shot in the Act overview navigates to the scene with the shotId;
- Sequence cards render the storyboard sheet when present and the placeholder
  when absent, with the shared under-card text treatment;
- Scene Shots tab renders the empty state when `activeShotList` is null;
- the rail lists shots in order and selecting a row updates the right pane;
- a `shotId` deep link pre-selects the matching rail row;
- the Description tab renders narrative fields and does not render raw ids;
- the four design tabs render their scaffold placeholder;
- the video stage shows the empty placeholder and disabled transport.

Core resource tests:

- `readSceneShotListResource` returns `activeShotList: null` for a scene with no
  active shot list;
- it returns images grouped by `shotId` from the active shot list only;
- inactive shot-list images are not mixed in;
- `readActStoryboardResource` walks act → sequence → scene → shots and derives
  `Shot N` labels in order;
- `readSequenceResource` attaches `storyboardSheet` only when an active sheet
  exists;
- stored shot-list JSON is validated before projection;
- the scene asset-file route serves a `role='shot'` file for a scene target.

Run focused verification with the commands that exist at implementation time, for
example:

```bash
pnpm test -- --run packages/studio/src/features/movie-studio/scenes/scene-shots-tab.test.tsx
pnpm test -- --run packages/studio/src/features/movie-studio/acts/act-storyboard-panel.test.tsx
pnpm test:core
pnpm lint
pnpm check
```

Do not report mobile viewport behavior.

## Implementation Checklist

- [x] Add `SceneShotListResource`, `ActStoryboardResource`, and
      `SequenceResource.storyboardSheet` browser-safe contracts.
- [x] Add `readSceneShotListResource` and `readActStoryboardResource` core
      readers; extend `readSequenceResource`.
- [x] Wire service contracts and project-data-service wiring.
- [x] Add scene shot-list and act storyboard HTTP routes.
- [x] Add the scene asset-file route for the Scene target.
- [x] Add browser services `readSceneShotListResource`,
      `readActStoryboardResource`, `sceneAssetFileUrl`, and the storyboard image
      adapter.
- [x] Add `act` selection and optional scene `shotId` across client + server
      selection, routing, request validation, sidebar, and screen wiring.
- [x] Build the Act Storyboard Overview panel with the layout lever.
- [x] Upgrade Sequence cards to the shared card with storyboard sheet, auto-fill
      grid, and the size lever; add `imageFit`/aspect props to
      `ScreenplayImageCard`.
- [x] Replace the placeholder Shots tab with the master/detail Scene Shots tab
      and the rail width lever.
- [x] Build the Shot Design Surface shell: video stage + disabled transport +
      `LineTabBar` tab shell.
- [x] Ship the read-only Description tab; scaffold the other four tabs.
- [x] Wire scoped resource refresh per surface.
- [x] Add focused frontend and core resource tests.
- [ ] Verify desktop layout manually in the local app.
- [x] Run focused tests, lint, and type checks.

## Resolved Decisions

- The storyboard overview is a first-class Act surface, not only a Scene tab.
- Act selection is added to `StudioSelection`; clicking an Act both opens the
  overview and toggles its subtree.
- Scenes without storyboards show one placeholder per scene in the Act overview.
- Sequence scene cards reuse `ScreenplayImageCard` with additive fit/aspect
  props; the sheet is shown whole (`object-contain`).
- The Scene Shots tab is a narrow-rail master / wide-detail layout.
- The Shot Design Surface shell, video stage, and read-only Description tab ship
  here; the four design tabs are scaffolded and designed in `0036`.
- Size tuning is centralized in per-surface layout config objects.
- No shot-parameter editing or write-back path in this plan.
- Shot deep-link transport uses a `?shot=<shotId>` query param on the scene
  route, keeping the scene path stable (confirmed 2026-05-30).

## Open Decisions

- Act overview density at large act sizes: whether to lazily paginate sequences
  within a very long act. Default to eager rendering with the existing 200-row
  navigation limits; revisit only if a real act exceeds comfortable scroll.
