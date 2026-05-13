# 0011 Scalable Studio Resource Loading

Date: 2026-05-13

Status: draft

## Goal

Replace the project-wide eager loading model with a scalable local-desktop
resource loading architecture.

Studio should stay snappy for normal browsing and editing, but opening a project
must not load every cast asset, sequence asset, scene asset, clip asset, rich
text file, image, narration take, and generated variation into one project JSON
payload.

The target usage model is:

- one human user working in a local desktop-style Studio app;
- many local AI agents and CLI commands mutating the same project over time;
- typical standalone movie projects in the 5-30 minute range;
- high-end movie projects around 2 hours, roughly 480 selected clips, 5x takes,
  thousands of images, and hundreds of narration/audio assets;
- series projects where each episode has its own sequence list while cast,
  visual language, continuity, and shared project assets remain project-level;
- possible season-scale projects around 10x larger than a 2-hour movie.

This plan supersedes the eager surface data part of
`docs/decisions/0016-use-active-project-sessions-and-eager-surface-data-for-studio-performance.md`.
It keeps the active SQLite session performance direction from that decision.

## Problem

The current project route is moving toward a large denormalized snapshot:

```text
GET /studio-api/projects/:projectName
  -> project identity
  -> full movie hierarchy
  -> rich-text-backed content
  -> cast asset metadata grouped by cast member
  -> future sequence/scene/clip/visual-language surface data if ADR 0016 is followed
```

That made a small project feel faster, but it does not scale.

The expensive parts are different and should not be tied together:

- project shell data needed to render the app frame;
- navigation data needed for the sidebar;
- selected surface data needed for the current panel;
- rich text content needed by an active editor;
- asset metadata needed by one target and role;
- binary files loaded by the browser through file endpoints;
- freshness signals needed when CLI commands or agents mutate project SQLite.

Before active project SQLite sessions existed, the app felt sluggish because
runtime reads repeatedly opened and validated SQLite. That root problem is now
mostly addressed by `lifetime: 'project'` sessions. The replacement
architecture should not solve performance by eagerly loading the whole project.
It should solve performance with small fast local queries, bounded caches, and
scoped invalidation.

## Deliverable

Studio should use a hybrid shell and resource cache architecture:

- project open loads a small `ProjectShell`;
- story structure navigation is episode-aware for series and sequence-first for
  standalone movies;
- surface panels load only the resources they need;
- large collections use keyset pagination;
- recently opened sidebar items stay available through bounded caching;
- V1 performs no speculative data prefetching;
- visible stale data remains on screen while revalidation happens in the
  background;
- CLI and agent mutations emit scoped refresh events.

Add a new architecture decision record that explicitly supersedes the eager
surface data direction from ADR 0016 with:

- project shell loading;
- episode-aware story structure navigation;
- lazy resource loading;
- keyset pagination;
- scoped invalidation.

The ADR should be clear that active project SQLite sessions remain accepted
architecture, while project-wide eager surface data is no longer accepted
architecture.

Do not introduce a separate resource revision table or a second Merkle-style
freshness system for Studio UI caching in the first implementation. Renku Studio
already has asset file content hashes and production export tree hashes. If UI
freshness later needs hash verification beyond scoped events and refetching, it
should reuse the same hashing vocabulary and helpers where appropriate instead
of creating a competing mechanism.

The review bug around missing eager cast asset keys should disappear because the
project payload no longer owns cast asset lists.

## Scope

This is a V1 framework plan, not a requirement to build every Studio surface in
one implementation slice.

V1 should establish contracts that will not need redesign when continuity,
visual language, sequence, scene, and clip surfaces become richer:

- episode-aware story structure navigation for series;
- standalone movie sequence navigation without synthetic episodes;
- bounded project shell loading;
- selected surface resources named after product surfaces;
- paginated navigation and asset pages;
- bounded selection context for deep links, focus requests, and
  `renku studio current --json`;
- scoped resource-change events and visible-resource refresh.

The first implementation slice can be narrower:

- project shell and story structure navigation contracts;
- selection context for current route/focus targets;
- cast design resource and cast asset pagination;
- mutation responses that no longer return full `ProjectWithHttp`;
- resource invalidation for the resources that exist.

Do not build full continuity, visual-language, sequence, scene, and clip design
panels before those surfaces are specified. Do reserve their contract shape so
they can plug into the same shell, navigation, asset page, selection-context,
and invalidation framework.

Do not add prefetching in the first implementation. Measure cold selected
surface loads, tab take-page loads, and sidebar switching first. Add prefetch
only after a measured interaction is too slow with active SQLite sessions,
bounded queries, browser file caching, and recently opened resource caching.

## Design Principles

- Keep app open and navigation local-feeling.
- Do not make lazy loading mean "every click blocks on a cold server request."
- Load the user's current working set eagerly, not the entire project.
- Prefer many bounded local SQLite reads over one unbounded project snapshot.
- Keep resource contracts explicit: unknown, loaded page, empty loaded page,
  stale, refreshing, appending page, and failed are different states.
- Keep binary files out of JSON. File endpoints and browser caching should own
  image/audio/video bytes.
- Treat the Studio coordination event store as UI coordination only, not a
  durable project history log.
- Require Studio, CLI, and agents to mutate through `studio-core` operations so
  scoped refresh events are consistently produced.
- Do not represent standalone movies as synthetic one-episode series. Episodes
  are valid only for `series` projects.

## Project Shell

`GET /studio-api/projects/:projectName` should return a `ProjectShellWithHttp`,
not the full surface-ready project.

The shell should include:

- project identity;
- cover URL;
- project counts;
- languages;
- visual language category/list navigation rows, bounded to the first page;
- cast navigation rows, bounded to the first page;
- continuity reference navigation rows, bounded to the first page;
- story structure navigation rows:
  - for `standaloneMovie`, top-level sequence rows bounded to the first page;
  - for `series`, episode rows bounded to the first page, plus the selected
    episode's first sequence page when the current route is inside an episode;
- enough route shell data for the current route, with a dedicated selection
  context endpoint for route targets outside loaded pages.

The shell should not include:

- all cast assets;
- all sequence, scene, or clip assets;
- all scenes and clips for all sequences;
- all Markdown-backed rich text contents;
- all generated takes for any target;
- future visual-language, continuity, sequence, scene, or clip asset maps.

Replace browser-facing `ProjectWithHttp` usage in the Studio app with smaller
resource contracts:

- `ProjectShellWithHttp`: identity, cover URL, counts, languages, first-page
  cast navigation, first-page visual-language navigation, first-page continuity
  reference navigation, and episode-aware story structure navigation;
- `ProjectInformationResource`: editable project information plus lazily loaded
  summary content;
- `AssetPage`: paginated assets for any `AssetTarget`;
- `NavigationPage`: paginated navigation rows for cast, visual language,
  continuity references, episodes, movie sequences, episode sequences, sequence
  scenes, and scene clips;
- selected surface resources such as `CastDesignResource` and
  `ClipDesignResource`.

Shell navigation rows should include concise display fields only:

```ts
interface CastNavigationRow {
  id: string;
  name: string;
  kind?: string;
  role?: string;
}

interface ContinuityReferenceNavigationRow {
  id: string;
  kind: string;
  name: string;
  oneLineSummary?: string;
}

interface EpisodeNavigationRow {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  sequenceCount: number;
  sceneCount: number;
  clipCount: number;
}

interface SequenceNavigationRow {
  id: string;
  episodeId?: string;
  number: number;
  title: string;
  shortTitle?: string;
  sceneCount: number;
  clipCount: number;
}

interface SceneNavigationRow {
  id: string;
  sequenceId: string;
  title: string;
  clipCount: number;
}

interface ClipNavigationRow {
  id: string;
  sceneId: string;
  title: string;
  oneLineSummary?: string;
}
```

The exact TypeScript names may change to match repo naming guidance, but the
contract must remain navigation-focused and must not grow into a surface data
snapshot.

Series and standalone movies must stay distinct in the contract. A series has
episodes, and each episode owns a sequence list. A standalone movie has
top-level sequences and no episode container. Do not add an implicit "default
episode" or "episode 0" compatibility shape for movies.

## Selected Surface Resources

Opening a specific surface should load one bounded resource for that surface.
Use the product surface name in concrete contracts, not a generic "workspace"
name.

For cast design:

```text
GET /studio-api/projects/:projectName/cast/:castMemberId/design
```

The cast design resource should include:

- cast member display fields;
- selected assets for Description, Character Sheet, and Voice Design tabs;
- the first page of takes for the active/default tab;
- counts by tab/role where cheap to compute;
- page cursors for loading more takes.

The cast design resource should not include every take for every role when the
cast member has a large history.

For clip design:

```text
GET /studio-api/projects/:projectName/clips/:clipId/design
```

The clip design resource should include:

- clip display fields and parent scene/sequence display fields;
- rich text asset links for summary and visual intent;
- selected assets needed to draw the first panel;
- first page metadata for the active clip asset section;
- asset and rich-text links needed by the active panel.

Rich text file content should still be loaded by the editor endpoint when the
editor is active. A selected surface resource may include short direct SQLite
fields, but it should not read hundreds of Markdown files at project open.

Future sequence, scene, visual-language, and continuity panels should follow
the same pattern: one bounded selected surface resource for the selected entity,
plus paginated child resources. Those resources do not need to be implemented in
the first cast-focused slice, but the shell, navigation, context, and cache
framework should leave room for them without redesign.

Cast design should become asset-page based:

- no `initialAssets` from the project payload;
- load the selected cast member's cast design resource when the cast panel opens;
- selected assets appear first;
- large take collections page incrementally;
- all further cast asset reads go through resource/page APIs, not through the
  project shell.

Storyboard and clip surfaces should not assume all clips and assets are already
in memory:

- Storyboard loads clip pages and selected preview assets progressively.
- Clip design loads its text and asset collections by resource.
- Large storyboard views should support incremental loading and later
  virtualization where many rows/cards are visible.

## Movie Studio Selection Context

Deep links, focus requests, and agent context must not force the server back to
the full `Project` projection.

Add a focused selection-context query that can validate and explain one Studio
selection:

```text
POST /studio-api/projects/:projectName/movie-studio-selection/context
```

Request body:

```ts
interface MovieStudioSelectionContextRequest {
  selection: MovieStudioSelection;
}
```

Response shape:

```ts
type MovieStudioSelectionContextResponse =
  | {
      valid: true;
      selection: MovieStudioSelection;
      context: MovieStudioSelectionContext;
      resourceKeys: string[];
    }
  | {
      valid: false;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };
```

The context should include just enough information to render the route shell,
validate the target, and fetch the selected surface resource:

- for a cast member, cast display fields and `surface:cast-design:<castMemberId>`;
- for a standalone movie sequence, sequence display fields and its first scene
  navigation page if that route is active;
- for a series episode, episode display fields and the first page of that
  episode's sequences;
- for a sequence inside a series episode, the episode display fields plus the
  sequence display fields;
- for a scene or clip, the parent chain through sequence and, for series,
  episode;
- for project-wide surfaces such as casting, visual language, and continuity,
  the first navigation/resource page needed by that surface.

`validateStudioFocusRequestForProject` and `renku studio current --json` should
move toward this bounded selection-context path instead of resolving context
from a full `Project`. Agent-readable context for broad surfaces such as
storyboard, casting, visual language, and continuity should be bounded to the
currently visible or first page of rows. It must not serialize every sequence,
scene, clip, cast member, or continuity reference for a large project.

## Snappy Interaction Model

The app should preserve the current good behavior where already-loaded tabs and
recently opened cast members feel immediate.

The V1 mechanism should be bounded caching and small foreground reads, not
project-wide eager loading or speculative prefetching.

### First Project Open

On project open:

1. Load the shell.
2. Render the Studio frame, cover, counts, first navigation pages, and selected
   route shell immediately.
3. Load the selected surface resource.
4. Show a local panel skeleton only for the selected panel if its resource is
   not yet ready.
5. Do not show a full-app loading state while a selected surface resource loads.

### Cast Panel Tabs

When a cast design resource loads:

- Description, Character Sheet, and Voice Design tabs should share one
  cast design resource cache entry.
- Selected assets for all three tabs should be present in the resource so
  switching tabs is immediate.
- The active/default tab should also include the first page of takes.
- Other tabs' first take pages should load only when the user opens those tabs.
- If a tab's take page is not loaded yet, the tab should render selected assets
  and a local loading affordance for takes only.

This keeps common tab switching fast without loading every take for every cast
member in the project.

### Sidebar Cast Switching

When the user opens a cast member:

- load that cast member's cast design resource with normal priority;
- keep the previous cast design resource in memory;
- cache recently opened cast design resources in an LRU cache.

Do not prefetch next/previous visible rows, hover rows, or keyboard-focus rows in
V1. Add those triggers only if measured cold-switch latency justifies them.

### No Prefetching In V1

Vite's built-in preloading is for JavaScript and CSS chunks, not for Studio API
data. Vite can generate `modulepreload` links for entry chunks and optimize
dynamic imports so dependent chunks are fetched in parallel. That helps if
future Studio panels are code-split with `React.lazy` or dynamic `import()`, but
it does not prefetch cast design resources, asset pages, Markdown content, or sidebar
navigation data.

V1 should not implement application-layer prefetch functions or use
`<link rel="prefetch">` for local Studio API JSON. The resource cache should
dedupe visible foreground reads and retain recently opened resources, but it
should not initiate a request unless the user opens a resource, requests another
page, saves/mutates data, or a visible stale resource needs refresh.

Future prefetching, if needed, should be added as a separate measured follow-up
with clear triggers, cancellation, concurrency limits, and tests. Good candidate
triggers are inactive cast-tab take pages, next/previous visible cast rows,
debounced sidebar hover/focus, and nearby clips in the current visible scene.

### Storyboard And Clip Navigation

For sequence/scene/clip browsing:

- standalone movie top-level sequence rows come from the shell first page;
- series episode rows come from the shell first page;
- expanding a series episode loads that episode's sequence page;
- expanding a sequence loads its scene page;
- expanding a scene loads its clip page;
- large lists expose "load more" and should later use virtualization where many
  rows are visible;
- opening a clip loads that clip's clip design resource;
- a follow-up optimization may prefetch nearby clips in the current scene after
  the active clip design resource is ready;
- do not assume all 480 selected clips and all their takes are already in
  memory.

### Stale-While-Revalidate

When cached data exists:

- render cached data immediately;
- mark it stale when a matching event is detected;
- revalidate in the background;
- keep the old content visible until fresh data arrives;
- show small local refresh indicators only where useful;
- never replace the whole Studio shell with a loading screen for background
  resource refreshes.

## Pagination

Large collections should use keyset pagination.

Do not use offset pagination for asset collections. Offset pagination becomes
unstable when agents add or remove assets while the user is paging.

Default limits:

- navigation pages: 100 rows;
- asset pages: 60 rows;
- maximum accepted page size: 200 rows.

Asset ordering should remain stable and user-oriented:

```text
selected assets first
selection_order ascending
sort_order ascending
title ascending
asset_id ascending
```

Navigation ordering should use:

```text
position ascending
id ascending
```

Page responses should include:

```ts
interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}
```

Cursors should be opaque to the browser. They may encode the final ordering
tuple and query shape, but callers should not inspect them.

When a paged collection is invalidated, discard loaded pages for that query and
reload from page one. Do not append with an old cursor after a mutation that may
change ordering. This matters especially for selected-first asset ordering: if
an agent selects an asset that used to be on page three, it may move ahead of
the old cursor and would otherwise disappear from the visible paged collection.

For selected-first asset views, prefer returning selected assets as a small
bounded section in the selected surface resource and paginating non-selected
takes separately when that keeps cursors simpler. The user-facing order can
still display selected assets first without making take pagination fragile.

## Freshness And Resource Keys

Resource keys should be deterministic strings owned by the Studio coordination
boundary, not constructed ad hoc in feature components. They identify which
cached UI resources should be invalidated when a mutation happens.

Do not put UI resource key literals deep inside low-level project mutation code.
Core project mutations should return or expose affected domain facts, such as
the changed `AssetTarget`, changed relationship role, changed rich-text asset,
or changed story-structure parent. The Studio coordination adapter maps those
facts to UI resource keys before appending `studio.projectResourcesChanged`.

Recommended key shapes:

```text
project-shell
project-information
navigation:cast
navigation:visual-language
navigation:continuity
navigation:episodes
navigation:movie-sequences
navigation:episode-sequences:<episodeId>
navigation:sequence-scenes:<sequenceId>
navigation:scene-clips:<sceneId>
surface:cast-design:<castMemberId>
surface:clip-design:<clipId>
assets:castMember:<castMemberId>
assets:continuityReference:<continuityReferenceId>
assets:clip:<clipId>
assets:scene:<sceneId>
assets:sequence:<sequenceId>
assets:visualLanguage:<visualLanguageId>
assets:project
markdown:<assetId>:<assetFileId>
```

Exact names can be centralized in the shared Studio coordination code, but the
implementation must avoid broad catch-all invalidation for every mutation.

The resource-key mapper should be centralized and tested so Studio server routes
and CLI commands append the same scoped refresh events after the durable mutation
succeeds.

Examples:

- registering a cast character-sheet asset invalidates:
  - `assets:castMember:<castMemberId>`;
  - `surface:cast-design:<castMemberId>`;
- selecting a cast asset invalidates the same keys;
- editing a clip summary Markdown asset invalidates:
  - `markdown:<assetId>:<assetFileId>`;
  - `surface:clip-design:<clipId>`;
  - any navigation resource that displays the changed one-line text, if
    applicable;
- adding an episode invalidates:
  - `navigation:episodes`;
  - `project-shell`;
- adding a sequence to a standalone movie invalidates:
  - `navigation:movie-sequences`;
  - `project-shell`;
- adding a sequence to a series episode invalidates:
  - `navigation:episode-sequences:<episodeId>`;
  - `navigation:episodes`;
  - `project-shell`;
- adding a scene invalidates:
  - `navigation:sequence-scenes:<sequenceId>`;
  - the owning sequence navigation page, either `navigation:movie-sequences` or
    `navigation:episode-sequences:<episodeId>`;
  - `project-shell`;
- adding a clip invalidates:
  - `navigation:scene-clips:<sceneId>`;
  - `navigation:sequence-scenes:<sequenceId>`;
  - the owning sequence navigation page, either `navigation:movie-sequences` or
    `navigation:episode-sequences:<episodeId>`;
  - `project-shell`.

If a future operation changes many resources, it may invalidate a broader parent
key, but that should be explicit and tested.

The first implementation should not add a project-local revision table. If
events prove insufficient, add a later follow-up that evaluates derived
hash/fingerprint checks using existing asset `contentHash` and production export
hashing helpers where they fit. That follow-up should explain why simple scoped
events plus visible-resource refetching are not enough before adding new
persistence.

## Coordination Events

Add a Studio coordination event type:

```ts
interface StudioProjectResourcesChangedEvent extends StudioEventBase {
  type: 'studio.projectResourcesChanged';
  projectRef: StudioProjectRef;
  resourceKeys: string[];
}
```

The event means:

> Project SQLite has already changed. Studio should invalidate these UI
> resources and refresh visible matching resources.

It is not a durable domain event and must not store before/after project data.
If the same operation should also move the UI, append a separate
`studio.focusRequested` event with the same `operationId`. Do not overload the
resource-change event with focus behavior.

This event extends the existing coordination model from
`docs/decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`.

CLI and agent-facing commands that mutate project data should append this event
after successful SQLite mutation. If the SQLite mutation succeeds but event
append fails, the command should report the coordination failure clearly without
claiming that the durable mutation failed. The default CLI behavior should be
partial success: return success for the durable mutation, include a structured
coordination warning in JSON/text output, and do not retry the durable mutation
automatically.

Initial commands to update:

- `renku asset register`;
- `renku asset select`;
- `renku asset select-update`;
- `renku asset select-remove`;
- Markdown/text update paths in Studio server routes;
- future asset delete/remove commands when they exist;
- future generation commands that register outputs.

`studio.projectRefreshRequested` can remain for project information while this
plan is implemented, but new resource-aware mutations should use
`studio.projectResourcesChanged`.

## Browser Resource Cache

Add a browser-side resource cache layer under `packages/studio/src/services` or
`packages/studio/src/app`, following the frontend layering guidelines.

The cache should store resource entries by:

```text
projectName
resourceKey
query parameters
```

Resource entries should use a small state model:

```ts
interface ResourceEntry<T> {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  data?: T;
  error?: string;
  isStale: boolean;
  isRefreshing: boolean;
  isAppendingPage?: boolean;
}
```

An empty page is `status: 'ready'` with `items: []`, not a separate top-level
state. A stale empty page is the same ready entry with `isStale: true`.

Required cache behavior:

- render ready cached data immediately;
- dedupe concurrent requests for the same resource/query;
- abort or ignore obsolete requests when the selected entity changes;
- mark matching entries stale on `studio.projectResourcesChanged`;
- refresh visible stale resources in the background;
- keep non-visible stale resources stale until they are viewed again;
- evict old selected surface resources with an LRU policy.

Focus/resume behavior:

- On browser focus, visibility change, event polling recovery, or suspicious
  stale state, Studio should refetch visible resources in the background.
- This is intentionally a simple correctness backstop for v1. It avoids adding a
  second cache-invalidation data model while still repairing missed refresh
  events for the resources the user is actually looking at.

Recommended initial LRU sizes:

- cast design resources: 12;
- clip design resources: 24;
- asset pages per target: 5 pages;
- navigation pages: keep while the project shell is active.

These limits are intentionally small. The UI can tune them later from measured
usage.

## API Shape

The exact route file organization can follow the existing Hono route module, but
the external behavior should be:

```text
GET /studio-api/projects/:projectName
GET /studio-api/projects/:projectName/cast?limit&cursor
GET /studio-api/projects/:projectName/cast/:castMemberId/design
GET /studio-api/projects/:projectName/visual-language?limit&cursor
GET /studio-api/projects/:projectName/continuity-references?limit&cursor
GET /studio-api/projects/:projectName/episodes?limit&cursor
GET /studio-api/projects/:projectName/sequences?limit&cursor
GET /studio-api/projects/:projectName/episodes/:episodeId/sequences?limit&cursor
GET /studio-api/projects/:projectName/sequences/:sequenceId/scenes?limit&cursor
GET /studio-api/projects/:projectName/scenes/:sceneId/clips?limit&cursor
GET /studio-api/projects/:projectName/clips/:clipId/design
GET /studio-api/projects/:projectName/assets?targetKind&targetId&role&mediaKind&selection&localeId&limit&cursor
POST /studio-api/projects/:projectName/movie-studio-selection/context
```

`GET /sequences` is for standalone movie top-level sequences. Series sequence
navigation must go through `GET /episodes/:episodeId/sequences`. The server
should reject the wrong story-structure route for the project type with a
structured diagnostic instead of returning a misleading empty list or inventing
a synthetic episode.

The generic asset page endpoint should support every `AssetTarget`:

- project;
- visual language;
- cast member;
- continuity reference;
- sequence;
- scene;
- clip.

Server adapters should parse and validate query parameters with structured
errors. Invalid cursors, unsupported target kinds, malformed limits, or missing
target ids should not silently fall back to broad queries.

## Mutation Response Shape

Mutation routes should not return `ProjectWithHttp` as a convenience refresh
payload. That would reintroduce the unbounded project projection through update
paths even after project open becomes shell-based.

Mutation routes should return one of these bounded shapes:

- the changed resource, such as updated Markdown content or the changed asset;
- affected domain facts and/or `resourceKeys`;
- a no-content success response when the caller can rely entirely on resource
  invalidation;
- structured warnings when the durable mutation succeeded but Studio
  coordination event append failed.

Examples:

- selecting or unselecting a cast asset returns the changed asset and affected
  resource keys;
- updating Markdown content returns the updated Markdown content and affected
  resource keys;
- updating project information returns `ProjectInformationResource` or affected
  resource keys, not the full project hierarchy.

## Core Query Shape

Add core query functions rather than implementing SQL rules directly in Studio
server routes.

Recommended service methods:

```ts
readProjectShell(input): Promise<ProjectShell>
listCastNavigation(input): Promise<Page<CastNavigationRow>>
listContinuityReferenceNavigation(input): Promise<Page<ContinuityReferenceNavigationRow>>
listEpisodeNavigation(input): Promise<Page<EpisodeNavigationRow>>
listStandaloneMovieSequenceNavigation(input): Promise<Page<SequenceNavigationRow>>
listEpisodeSequenceNavigation(input): Promise<Page<SequenceNavigationRow>>
listSceneNavigation(input): Promise<Page<SceneNavigationRow>>
listClipNavigation(input): Promise<Page<ClipNavigationRow>>
readCastDesignResource(input): Promise<CastDesignResource>
readClipDesignResource(input): Promise<ClipDesignResource>
readMovieStudioSelectionContext(input): Promise<MovieStudioSelectionContextResult>
listAssetPage(input): Promise<Page<Asset>>
```

Existing `readProject` can remain for core workflows that genuinely need a full
projection, but Studio runtime project open should move to `readProjectShell`.

Do not re-export another package's API as a convenience layer. Browser contracts
should import owned shared types directly or define HTTP-decorated Studio
contracts in `packages/studio/src/services/studio-project-contracts.ts`.

## SQLite And Indexing

Add indexes for the new hot query paths.

Recommended indexes:

- cast members by `position, id`;
- episodes by `position, id`;
- standalone movie sequences by `episode_id, position, id` where
  `episode_id` is null;
- episode sequences by `episode_id, position, id`;
- scenes by `sequence_id, position, id`;
- clips by `scene_id, position, id`;
- asset relationship tables by target id, selection, selection order, sort
  order, and asset id;
- asset files by `asset_id`.

The exact Drizzle index syntax should be added in
`packages/core/src/schema/index.ts` and generated through Drizzle Kit.

Adding indexes is a schema migration, but it should not require a new project
store schema generation unless current runtime code also starts requiring a new
table or column. Follow `docs/architecture/reference/drizzle-migrations.md`.

## Frontend Migration Steps

1. Introduce new shell/resource contracts and services.
2. Change `useProjectSession` to load `ProjectShellWithHttp`.
3. Add selection-context loading for deep links, focus requests, and route
   targets outside loaded pages.
4. Update `StudioSidebar` to consume shell navigation pages and lazy child
   pages, including episode sequence pages for series.
5. Replace cast `initialAssets` with `useCastDesignResource`.
6. Update cast tabs to read selected assets and paged takes from the resource
   cache.
7. Load inactive tab take pages only when the user opens those tabs.
8. Add LRU retention for recently opened cast design resources.
9. Update clip panel to use `readClipDesignResource` and lazy rich-text editor loads.
10. Wire coordination events into resource cache invalidation.
11. Remove `castAssetsByCastMemberId` from HTTP contracts and tests.

Tab prefetch, sidebar hover/focus prefetch, next/previous row prefetch, and
nearby clip prefetch are follow-up optimizations, not part of the first
implementation slice.

All feature components must keep using local shadcn-style UI controls from
`packages/studio/src/ui`. Do not introduce raw interactive controls.

## Backend Migration Steps

1. Add shared Studio coordination resource-key helpers.
2. Return affected domain facts from asset registration and selection
   mutations, and centralize the domain-fact-to-resource-key mapping in the
   Studio coordination layer.
3. Add paginated navigation and asset query methods in core.
4. Add shell, selected surface resource, and selection-context query methods in
   core.
5. Update Studio server routes to call core query methods.
6. Add `studio.projectResourcesChanged` to core coordination event contracts and
   validation.
7. Update browser event contracts and coordination polling to understand the new
   event.
8. Update CLI asset commands to append resource-change events after successful
   mutation.
9. Keep old full project APIs only where still needed by core or tests; do not
    preserve obsolete browser fields as compatibility shims.

## Performance Expectations

Opening a project should require:

- one shell request;
- one selected surface resource request;
- no unbounded asset relationship scan for every surface;
- no bulk Markdown content reads for every sequence, scene, and clip.

Switching between Description and Character Sheet after a cast design resource has
loaded should require:

- no blocking request for selected assets;
- no full project reload;
- at most one small foreground first-page request if that tab's takes are not
  already loaded.

Switching between cast members should render immediately if:

- the target was recently opened;
- otherwise, the target issues one cast design resource request without
  reloading the project.

If no cache exists, switching to a cold cast member should still avoid a full
project reload and should issue only that cast member's cast design resource request.

Before adding prefetching, measure the V1 interaction timings on a large sample
project:

- cold project open to shell rendered;
- selected surface resource request time;
- cold cast switch request time;
- cached cast switch render time;
- inactive cast tab first take-page request time;
- deep-linked sequence, scene, and clip selection-context request time.

If these stay comfortably local-feeling, keep prefetching out. If a specific
interaction is slow, add the narrowest prefetch trigger for that measured case.

## Testing

Core tests should cover:

- shell queries do not include full assets or rich text file contents;
- standalone movie sequence navigation and series episode/episode-sequence
  navigation stay distinct;
- selection-context queries resolve deep-linked sequence, scene, and clip targets
  without reading a full project projection;
- navigation pagination returns stable next cursors;
- asset pagination preserves selected-first ordering;
- invalid cursors fail with structured diagnostics;
- asset register/select/unselect report the correct affected domain facts and
  mapped resource keys;
- unrelated resources are not invalidated.

Server route tests should cover:

- project route no longer calls `listCastMemberAssets`;
- project route no longer includes `castAssetsByCastMemberId`;
- story-structure routes reject the wrong project type with structured
  diagnostics;
- selection-context route returns parent chains for series episode targets;
- cast design resource route returns selected assets and first-page active tab takes;
- asset page route supports target/role/media/selection filters;
- mutation routes do not return `ProjectWithHttp`;
- malformed resource queries return structured HTTP errors.

Frontend tests should cover:

- opening a project renders the shell without fetching all cast assets;
- deep-linking to a sequence, scene, or clip outside the first loaded page uses
  selection context rather than a full project reload;
- opening a cast member fetches one cast design resource;
- switching tabs after cast design resource load does not trigger a blocking refetch;
- switching back to a recently opened cast member renders from cache;
- stale resource events keep old content visible while refreshing;
- invalidating a paged asset collection discards old cursors and reloads from
  page one;
- browser focus or event polling recovery refetches visible stale resources
  without a full shell reload.

CLI tests should cover:

- `renku asset register` appends `studio.projectResourcesChanged`;
- `renku asset select` appends scoped resource-change events;
- event append failure after a successful mutation reports a coordination
  warning without rolling back, retrying, or misreporting the durable mutation
  as failed.

Manual/browser checks should cover:

- project open on a large sample project;
- opening a series project and expanding episode sequence pages;
- deep-linking to a clip inside a series episode;
- cast tab switching;
- rapid cast sidebar switching;
- CLI registering a new cast or clip asset while Studio is open;
- two agents registering assets for different targets while Studio is open;
- stale visible panel refresh without full shell reload.

## Non-Goals

- No SaaS backend architecture.
- No remote multi-user synchronization.
- No durable domain event log in the Studio coordination store.
- No raw SQLite mutation support for agents.
- No project-wide eager loading for future surface data.
- No synthetic episode wrapper for standalone movies.
- No compatibility shims for `castAssetsByCastMemberId`.
- No requirement to implement every future surface panel before its product
  behavior is specified.
- No separate resource revision table for Studio UI caching in v1.
- No second Merkle-style cache freshness system parallel to production export.
