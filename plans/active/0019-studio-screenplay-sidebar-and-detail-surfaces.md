# 0019 Studio Screenplay Sidebar And Detail Surfaces

Date: 2026-05-21

Status: draft

## Goal

Replace the current Studio sidebar and main-detail surfaces with a
screenplay-oriented Studio experience based on the movie-only screenplay model.

The new Studio UI should make the screenplay structure the primary way a user
or agent understands a project:

- project information remains available as the project details surface;
- Visual Language remains available in the sidebar;
- Cast and Locations become first-class sidebar sections;
- Acts become the story-structure section below Locations;
- sequences and scenes are navigable from the Acts tree;
- cast members, locations, sequences, and scenes have focused read-only detail
  surfaces;
- scene narrative renders as readable screenplay blocks with navigable cast and
  location references.

This plan is production code direction. It must not add compatibility shims,
fallback routes, stale aliases, or dead placeholder surfaces. Old UI and API
concepts that conflict with the screenplay model should be removed directly.

## References

- `docs/architecture/reference/front-end-guidelines.md`
- `docs/product/design-guidelines.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/studio-server-hono.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/decisions/0008-use-url-owned-studio-routes.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`
- `plans/active/0015-screenplay-cast-location-database-schema.md`
- `plans/active/0016-screenplay-json-cli-commands.md`
- `plans/active/0018-movie-only-screenplay-cleanup-plan.md`

## Product Decisions

The following choices are locked for this implementation pass.

- Cast, Locations, and Acts are shown in the sidebar as separate sections.
- Cast, Locations, and Acts default collapsed.
- The top-level Cast and Locations detail surfaces show image cards in the main
  panel, not inside the sidebar.
- The sidebar expansion for Cast and Locations shows compact row navigation.
- Visual Language stays in the sidebar for this pass. It is above the Cast below the area with the cover image of the project.
- Acts are structural group headers only. Selecting the top-level Acts section
  shows Story Arc. Clicking an individual act expands/collapses it rather than
  opening an act detail page.
- Story Arc gets a minimal read-only first-pass surface. The final visual story
  arc design is deferred.
- Visual Content, Voice Design, storyboard images, scene shots, and generation
  flows are intentionally placeholder tabs or placeholder media areas in this
  pass. They should not keep old mock generation workflows alive.
- The current first image behavior is temporary: show the first ready image
  associated with the cast member or location by current asset relationship
  ordering. Pinning is a future feature and must not be modeled here.

## Current State To Replace

The current implementation still has a mixed model:

- Studio selection has `casting` and `storyboard` surfaces.
- The sidebar has Visual Language, Cast, and Sequences, but not Locations or
  Acts.
- Project shell navigation exposes cast and top-level sequences, while the new
  screenplay model stores acts above sequences.
- Rich screenplay data exists in core screenplay contracts and database reads,
  but the Studio UI mainly consumes older lean navigation rows.
- `CastDesignPanel` is partly real and partly future-facing generation UI. The
  new Cast Member surface should be a read-only details tab plus future Visual
  Content and Voice Design tabs.
- Location assets exist in the database schema as `location_asset`, but the
  public `AssetTarget`, Hono asset routes, and browser asset helpers do not yet
  support `location`.

The implementation should remove the old Studio concepts rather than support
both names:

- remove `casting` selection and route handling;
- remove `storyboard` selection and route handling;
- remove old sequence-only story navigation assumptions;
- remove obsolete old cast overview cards;
- remove old cast mock content and character-sheet generation UI from the
  active Studio surface;
- remove or rewrite tests whose only purpose is to preserve those old names.

## Naming And Folder Rules

Use the current frontend structure from
`docs/architecture/reference/front-end-guidelines.md`.

Keep app composition in:

```text
packages/studio/src/app/
```

Keep the selected-project product surface in:

```text
packages/studio/src/features/movie-studio/
```

Keep Studio HTTP clients in:

```text
packages/studio/src/services/
```

Keep reusable Shadcn-style primitives in:

```text
packages/studio/src/ui/
```

Do not add broad folders such as `data`, `manager`, `helper`, `detail`,
`navigation`, or `workspace`. Use the domain concept whenever one exists:
`cast`, `locations`, `story-arc`, `sequences`, `scenes`, and
`studio-sidebar`.

Feature code must not use raw browser controls. This includes raw `button`,
`input`, `select`, `textarea`, and `dialog`. Use the local primitives from
`packages/studio/src/ui`, especially `Button`, `Tabs`, `LineTabBar`, `Card`,
`Dialog`, `Input`, `Select`, `Textarea`, `Tooltip`, and `Alert`.

Interactive cards should be implemented with the local `Button` primitive or
another local Shadcn-style primitive, not raw clickable HTML.

## Core Data And Resource Layer

### Ownership

All data rules belong in `@gorenku/studio-core`.

The Studio browser should consume JSON-safe core contracts through Hono. The
Studio server should not:

- open SQLite directly outside core;
- assemble screenplay hierarchy by itself;
- infer asset relationships from project-relative paths;
- decide fallback content for missing screenplay data;
- parse cast or location references out of text;
- choose old selection names when a new selection is missing.

### Browser-Safe Contracts

Update browser-safe contracts under:

```text
packages/core/src/client/
  assets.ts
  cast-members.ts
  locations.ts
  resources.ts
  screenplay.ts
  index.ts
```

Contract changes:

- Replace the older lean `CastMember` browser shape with the current screenplay
  cast member shape: durable `id`, `handle`, `name`, optional `role`, `age`,
  `want`, `need`, `arc`, `voiceNotes`, and `description`.
- Add a browser-safe `Location` contract with durable `id`, `handle`, `name`,
  optional `timePeriod`, `description`, and `visualNotes`.
- Keep `Act`, `Sequence`, `Scene`, `SceneSetting`, and `Block` aligned with
  the canonical screenplay contract. Canonical output uses durable IDs.
- Remove the old lean `screenplay-projection.ts` contract if it is no longer
  the current public shape. Do not keep it as an alias.
- Update `ProjectCounts` to include screenplay counts used by the sidebar:
  cast members, locations, acts, sequences, and scenes.
- Update `ProjectShellNavigation` so Studio opens with bounded first pages for
  screenplay navigation. It should not expose a full eager project-wide cast,
  location, sequence, scene, or asset map.

Add resource contracts for the Studio UI:

- Cast Member navigation row:
  durable ID, name, optional role, optional first image reference.
- Location navigation row:
  durable ID, name, optional time period, optional first image reference.
- Act navigation row:
  durable ID, title, optional purpose, sequence count, scene count.
- Sequence navigation row:
  durable ID, parent act ID, title, optional purpose, scene count.
- Scene navigation row:
  durable ID, parent sequence ID, title.
- Cast overview resource:
  paginated cast member image cards.
- Location overview resource:
  paginated location image cards.
- Cast member resource:
  cast member fields, first image reference, and future visual-content asset
  page metadata if useful for the placeholder tab.
- Location resource:
  location fields, first image reference, and future visual-content asset page
  metadata if useful for the placeholder tab.
- Story Arc resource:
  screenplay title, screenplay-level arc fields, and ordered acts with nested
  sequence summaries sufficient for a first-pass visual outline.
- Sequence resource:
  sequence, parent act, and paginated scene cards.
- Scene narrative resource:
  scene, parent sequence, parent act, blocks, resolved cast member labels, and
  resolved location labels.

The image reference in core should stay transport-neutral. Core may return the
asset ID, relationship ID, asset file ID, asset title, media metadata, and
project-relative file metadata. The Studio server response adapter adds HTTP
URLs.

### Asset Target Support

Extend the public `AssetTarget` union to include location assets:

```text
location target
  locationId
```

Update the core asset relationship data layer so `location` targets use the
existing `location_asset` table. This is not a new database schema feature and
does not require a migration unless implementation discovers a missing index or
schema mismatch.

Update all asset target utilities:

- target-to-table configuration;
- target existence validation;
- relationship insert/read/list/update;
- owner target discovery;
- resource key calculation;
- structured diagnostics for missing location targets.

First image selection should use existing asset relationship ordering:

1. target is the cast member or location;
2. media kind is image;
3. asset availability is ready;
4. existing relationship ordering decides the first result, which currently
   gives selected assets before takes because the asset relationship page
   already orders selects first.

Do not add a pin column, pin table, pin command, or pin UI in this pass.

### Core Resource Files

Use resource names that describe the domain projection, not generic verbs.

Recommended core structure:

```text
packages/core/src/server/database/access/
  screenplay-navigation.ts
  cast-and-location-images.ts
  screenplay-resource.ts

packages/core/src/server/resources/
  screenplay-cast.ts
  screenplay-locations.ts
  screenplay-story-arc.ts
  screenplay-sequences.ts
  screenplay-scenes.ts
```

Responsibilities:

- `screenplay-navigation.ts` reads paginated act, sequence, scene, cast member,
  and location rows for Studio navigation.
- `cast-and-location-images.ts` finds first image references for cast members
  and locations using the asset relationship tables.
- `screenplay-resource.ts` can keep canonical screenplay document reads used by
  the CLI. If it becomes too broad, split only by real domain responsibility.
- `screenplay-cast.ts` assembles cast overview and cast member resources.
- `screenplay-locations.ts` assembles location overview and location resources.
- `screenplay-story-arc.ts` assembles the Story Arc resource from screenplay,
  act, and sequence data.
- `screenplay-sequences.ts` assembles sequence resources and sequence-owned
  scene pages.
- `screenplay-scenes.ts` assembles scene narrative resources, including
  resolved cast and location labels for referenced IDs.

Do not create files named only `read.ts`, `create.ts`, `helpers.ts`,
`data.ts`, `details.ts`, or `navigation.ts`.

### ProjectDataService

Extend `ProjectDataService` with explicit screenplay UI reads:

- read cast member overview page;
- read cast member resource;
- read location overview page;
- read location resource;
- read story arc resource;
- read act navigation page;
- read sequences for an act;
- read sequence resource;
- read scenes for a sequence;
- read scene narrative resource.

Keep existing screenplay CLI reads and writes separate from UI resources. The
CLI reads canonical screenplay documents. The Studio UI reads bounded resources
for visible surfaces.

Studio UI resources should accept `projectName`, because Studio API requests
are URL-owned. CLI screenplay commands may keep using current-project lifecycle
where that is already accepted.

### Structured Errors

Core should fail fast with structured errors when:

- no screenplay exists for a requested screenplay surface;
- a cast member ID is unknown;
- a location ID is unknown;
- an act ID is unknown;
- a sequence ID is unknown;
- a scene ID is unknown;
- stored screenplay JSON fragments are malformed;
- a referenced cast or location ID in a scene block no longer exists.

Use stable `PROJECT_DATA` codes. Collect all actionable issues for malformed
stored JSON where practical. Do not return empty resources to hide missing
screenplay data.

## Studio Server API

### Route Modules

Follow `docs/architecture/reference/studio-server-hono.md` and Hono's current
larger-application guidance: one Hono app per resource module, mounted with
`app.route()`, with handlers kept inline next to route definitions.

Add a screenplay route module:

```text
packages/studio/server/routes/
  screenplay.ts
```

Mount it below each project from:

```text
packages/studio/server/routes/projects.ts
```

The resource path should be project-relative:

```text
/studio-api/projects/:projectName/screenplay/...
```

Recommended route set:

```text
GET /screenplay/cast
GET /screenplay/cast/:castMemberId
GET /screenplay/locations
GET /screenplay/locations/:locationId
GET /screenplay/story-arc
GET /screenplay/acts
GET /screenplay/acts/:actId/sequences
GET /screenplay/sequences/:sequenceId
GET /screenplay/sequences/:sequenceId/scenes
GET /screenplay/scenes/:sceneId
```

The existing `routes/navigation.ts` should be removed or reduced only if it
still has a current resource responsibility after this migration. Do not keep
old `/sequences` routes as compatibility endpoints if the browser no longer
uses them.

### Response Adapters

Add response adapters under:

```text
packages/studio/server/http/
  screenplay-responses.ts
```

Responsibilities:

- add HTTP image URLs to core image references;
- build cast asset file URLs;
- build location asset file URLs;
- keep all response shaping mechanical;
- avoid querying SQLite or inferring domain state.

Do not add a broad `project-screenplay-response.ts` if the file is mounted
under the project route and `screenplay-responses.ts` is already clear.

### Asset Routes

Extend existing asset routes to support location-owned assets:

```text
GET    /studio-api/projects/:projectName/locations/:locationId/assets
GET    /studio-api/projects/:projectName/locations/:locationId/assets/:assetId/files/:assetFileId
POST   /studio-api/projects/:projectName/locations/:locationId/assets/:assetId/select
DELETE /studio-api/projects/:projectName/locations/:locationId/assets/:assetId/select
```

Also update the general asset page query parser so `targetKind=location`
requires `targetId`.

Use core resource keys for location asset changes, for example:

```text
assets:location:<locationId>
surface:location:<locationId>
navigation:locations
```

Exact key names should be implemented in core resource-key helpers and used
consistently by server responses and event invalidation. Do not hand-type these
strings in many places.

### Selection Context Route

Update the existing Movie Studio selection context route to support the new
selection model:

- `projectInformation`
- `visualLanguage`
- `cast`
- `castMember`
- `locations`
- `location`
- `storyArc`
- `sequence`
- `scene`

Remove support for:

- `casting`
- `storyboard`

The selection context response should hydrate off-page navigation rows for
deep links. For example:

- a cast member deep link can return the cast member navigation row;
- a location deep link can return the location navigation row;
- a sequence deep link can return its parent act and sequence row;
- a scene deep link can return its parent act, parent sequence, and scene row.

The browser should use this context only to validate and display the current
route. It must not treat the context endpoint as a hidden router.

## Browser Services

Keep fetch code out of components.

Recommended service structure:

```text
packages/studio/src/services/
  studio-projects-api.ts
  studio-project-assets-api.ts
  studio-screenplay-api.ts
  studio-project-contracts.ts
  studio-api-errors.ts
```

Responsibilities:

- `studio-projects-api.ts` keeps project library, project shell, project
  information, and production export calls.
- `studio-screenplay-api.ts` owns screenplay resource endpoint paths and read
  functions.
- `studio-project-assets-api.ts` owns asset endpoints, including cast member
  and location asset file URL builders.
- `studio-project-contracts.ts` imports public core contracts and defines
  HTTP-decorated response shapes where image/file URLs are transport-only.
- `studio-api-errors.ts` remains the single frontend parser for structured API
  errors.

Service function names should use resource verbs:

- `readCastOverviewResource`
- `readCastMemberResource`
- `readLocationOverviewResource`
- `readLocationResource`
- `readStoryArcResource`
- `readActNavigation`
- `readSequencesForAct`
- `readSequenceResource`
- `readScenesForSequence`
- `readSceneNarrativeResource`

Avoid `fetchData`, `load`, `getDetails`, or `movieStudioClient`.

## Browser Routes And Selection

The browser URL remains the owner of Studio navigation.

Update route parsing in:

```text
packages/studio/src/app/use-project-session.ts
```

Browser route contract:

```text
/projects/:projectName
/projects/:projectName/visual-language
/projects/:projectName/cast
/projects/:projectName/cast/:castMemberId
/projects/:projectName/locations
/projects/:projectName/locations/:locationId
/projects/:projectName/acts
/projects/:projectName/sequences/:sequenceId
/projects/:projectName/scenes/:sceneId
```

Selection names:

- `/projects/:projectName` -> `projectInformation`
- `/visual-language` -> `visualLanguage`
- `/cast` -> `cast`
- `/cast/:castMemberId` -> `castMember`
- `/locations` -> `locations`
- `/locations/:locationId` -> `location`
- `/acts` -> `storyArc`
- `/sequences/:sequenceId` -> `sequence`
- `/scenes/:sceneId` -> `scene`

Remove the old route mappings:

- `/storyboard`
- selection `storyboard`
- selection `casting`

Route validation should:

- accept project information and visual language directly;
- validate top-level Cast, Locations, and Story Arc directly;
- validate ID-bearing selections through the selection context endpoint when
  the item is not present in the shell's first navigation page;
- fail with a structured, user-readable route error when the selected item does
  not exist.

Do not mutate `ProjectShell` with ad hoc arrays just to make old lookup code
work. Keep route hydration in a screenplay navigation hook or route context
state.

## Frontend Feature Structure

Recommended feature structure:

```text
packages/studio/src/features/movie-studio/
  movie-studio-screen.tsx
  movie-studio-selection.ts
  use-movie-studio-selection-resolution.ts
  use-screenplay-navigation.ts

  studio-sidebar/
    studio-sidebar.tsx
    studio-sidebar-actions.tsx
    studio-sidebar-project-card.tsx
    studio-sidebar-section.tsx
    studio-sidebar-row.tsx
    studio-sidebar-tree-row.tsx

  project-information/
    project-information-panel.tsx

  visual-language/
    visual-language-panel.tsx

  cast/
    cast-overview-panel.tsx
    cast-member-panel.tsx
    cast-member-profile-tab.tsx
    cast-member-visual-content-tab.tsx
    cast-member-voice-design-tab.tsx

  locations/
    location-overview-panel.tsx
    location-panel.tsx
    location-profile-tab.tsx
    location-visual-content-tab.tsx

  story-arc/
    story-arc-panel.tsx
    story-arc-outline.tsx

  sequences/
    sequence-panel.tsx
    sequence-scene-card-grid.tsx
    sequence-scene-card.tsx

  scenes/
    scene-panel.tsx
    scene-narrative-tab.tsx
    scene-narrative-blocks.tsx
    scene-reference-chip.tsx
    scene-shots-tab.tsx

  screenplay-media/
    screenplay-image-card-grid.tsx
    screenplay-image-card.tsx
    screenplay-primary-image.tsx
    screenplay-image-placeholder.tsx
```

Folder notes:

- `studio-sidebar` stays broad because it is the selected-project sidebar for
  Movie Studio.
- `cast` owns the Cast overview and Cast Member surfaces.
- `locations` owns Location overview and Location surfaces.
- `story-arc` owns the top-level Acts/Story Arc surface.
- `sequences` owns sequence-specific scene-card display.
- `scenes` owns scene narrative and future shots display.
- `screenplay-media` owns domain-specific media card components shared by
  Cast, Locations, and Sequence scenes. Do not promote these to `src/ui` unless
  they become domain-neutral.

Remove the old folders or files that no longer have current ownership after
the migration, especially obsolete `storyboard` and conflicting old
`cast-design` surfaces. If a future Visual Content tab needs pieces of the old
cast asset tile display, move the implementation into the new `cast` surface
with current names instead of preserving the old folder as a compatibility
layer.

## Sidebar Behavior

`StudioSidebar` should remain the sidebar container and own only layout,
section expansion state, and high-level composition.

Sidebar sections:

1. Project details card at the top.
2. Visual Language row.
3. Cast section.
4. Locations section.
5. Acts section.

Default expansion:

- Cast collapsed.
- Locations collapsed.
- Acts collapsed.
- Project details and Visual Language are not collapsible sections.

Cast section:

- top-level click selects Cast overview;
- disclosure button expands/collapses cast member rows;
- expanded rows show cast member name and role;
- row click navigates to `castMember`;
- if the active cast member is not in the first page, selection context should
  provide enough row data to show it.

Locations section:

- top-level click selects Locations overview;
- disclosure button expands/collapses location rows;
- expanded rows show location name and time period when present;
- row click navigates to `location`;
- if the active location is not in the first page, selection context should
  provide enough row data to show it.

Acts section:

- top-level click selects Story Arc;
- disclosure button expands/collapses the act tree;
- when expanded, show acts as tree rows;
- act click toggles that act, not a route;
- expanding an act loads its sequences;
- sequence click navigates to `sequence`;
- sequence disclosure expands/collapses its scenes;
- expanding a sequence loads its scenes;
- scene click navigates to `scene`.

Use separate callbacks for selecting a row and toggling disclosure. Do not make
one click both navigate and expand unless it is the explicitly defined act row
behavior.

## Main Panel Behavior

### Shared Panel Anatomy

Every major panel should use the established panel anatomy:

- rounded panel container;
- soft border;
- fixed `h-[45px]` header;
- uppercase micro-heading style;
- `LineTabBar` for tabs where tabs exist;
- scrollable content area;
- no nested UI cards around entire page sections.

Use design tokens and visual patterns from `docs/product/design-guidelines.md`:

- soft `border-border/40` style;
- `bg-panel-bg`, `bg-panel-header-bg`, `bg-card`, and `bg-muted` families;
- media-card lift treatment for clickable image cards;
- compact `text-sm` body copy and `text-[11px]` uppercase section labels;
- lucide icons only where an icon helps the control.

### Project Information

Keep the existing Project Information panel and autosave behavior.

It remains the default route:

```text
/projects/:projectName
```

Any changes needed for new `ProjectShell` contracts should update callers
directly. Do not add a compatibility adapter that pretends old shell fields are
still present.

### Cast Overview

The top-level Cast surface shows a responsive grid of cast member image cards.

Each card:

- uses first cast member image when present;
- uses a clear placeholder when no image exists;
- shows the cast member name in a footer;
- may show role as small metadata when space allows;
- is clickable anywhere on the card through the local `Button` primitive;
- navigates to the Cast Member route.

The grid should use the established media-grid treatment:

```text
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5
```

### Cast Member

The Cast Member panel header shows only the cast member name.

Tabs:

1. Details
2. Visual Content
3. Voice Design

Details tab:

- first image or placeholder appears as the visual anchor;
- structured fields appear near the top: role, age, want, need;
- arc is shown prominently as a character-development section;
- description follows as readable prose;
- voice notes follow below description, because they are important but not the
  main visual identity;
- empty optional fields should be omitted rather than rendered as noisy blanks.

Visual Content tab:

- placeholder empty state for this pass;
- no generation form or mock data;
- no old character-sheet side panel;
- copy should be concise and not explain the app's internals.

Voice Design tab:

- placeholder empty state for this pass;
- no mock voice assets unless real assets exist in the project;
- no fake generation controls.

### Locations Overview

The top-level Locations surface mirrors Cast overview.

Each card:

- uses first location image when present;
- uses a location-oriented placeholder when no image exists;
- shows the location name in a footer;
- may show time period as small metadata when present;
- is clickable anywhere on the card;
- navigates to the Location route.

### Location

The Location panel header shows only the location name.

Tabs:

1. Details
2. Visual Content

Details tab:

- first image or placeholder appears as the visual anchor;
- structured fields appear near the top: time period and any future concise
  location metadata;
- description follows as readable prose;
- visual notes are shown as a distinct visually formatted section because they
  are a core generation-facing input;
- empty optional fields are omitted.

Visual Content tab:

- placeholder empty state for this pass;
- no generation form or mock data.

### Story Arc

The top-level Acts route opens the Story Arc surface.

The header says:

```text
Story Arc
```

The first pass should show a readable visual outline of the screenplay:

- screenplay title;
- logline or dramatic question when present;
- acts in order;

The final Story Arc visualization is deferred, so avoid heavy bespoke
visualization code. Do not add placeholder SVG illustration systems or fake
analytics.

### Sequence

The Sequence panel header shows the sequence title.

The content area shows all scenes in a card grid.

Each scene card:

- shows a storyboard placeholder image area;
- shows the scene title in the footer;
- may show setting metadata when available;
- is clickable anywhere through the local `Button` primitive;
- navigates to the Scene route.

Do not invent storyboard image schema or asset roles in this pass. Use
placeholder visuals until storyboard image ownership is designed.

### Scene

The Scene panel header shows the scene title.

Tabs:

1. Narrative
2. Shots

Narrative tab:

- renders blocks in a screenplay-inspired reading layout;
- action blocks use readable prose blocks;
- dialogue blocks show cast member name, extension, parenthetical, and lines;
- transitions, title cards, supers, shots, notes, and special headings have
  distinct but restrained treatments;
- referenced cast members render as clickable chips or inline controls that
  navigate to that cast member;
- referenced locations render as clickable chips or inline controls that
  navigate to that location;
- scene setting locations at the top of the narrative also navigate to
  locations;
- only explicit `castMemberId`, `castMemberIds`, `locationIds`, and setting
  `locationIds` create navigation controls.

Do not parse `@handles` or names out of raw text in the UI. If a block has
plain text with a mention but no durable ID, render it as text only.

Shots tab:

- placeholder empty state for this pass;
- no shot model, shot schema, or shot editor.

## Resource Loading And State

Add a feature-local hook:

```text
packages/studio/src/features/movie-studio/use-screenplay-navigation.ts
```

Responsibilities:

- read first pages from `ProjectShell.navigation`;
- load cast member pages when the Cast section expands or paginates;
- load location pages when the Locations section expands or paginates;
- load act pages when the Acts section expands;
- load sequences for an act when an act expands;
- load scenes for a sequence when a sequence expands;
- merge route selection context rows into the visible navigation state;
- expose loading and error states by resource key;
- keep expansion state local to the sidebar.

Do not store loaded navigation rows inside `ProjectShell` as a workaround.
`ProjectShell` is the server-loaded shell. Browser-loaded navigation belongs in
the feature hook.

Resource invalidation:

- subscribe to existing Studio coordination resource changes;
- reload only affected visible resources;
- use scoped keys such as cast overview, location overview, story arc,
  sequence, scene narrative, and asset target keys;
- avoid broad project refreshes unless the project shell itself changes.

## Studio Coordination

Update Studio focus selection types and current-context projection to match the
new route-owned selection model.

Current focus contexts should support:

- project information;
- visual language;
- cast overview;
- cast member;
- locations overview;
- location;
- story arc;
- sequence;
- scene.

Remove `casting` and `storyboard` from focus request validation.

When a CLI or agent asks Studio to focus an ID-bearing screenplay item, focus
validation should use current core screenplay resource lookups. It should not
depend on an old eager `Project.sequences` or `Project.cast` projection if that
projection is removed from the Studio shell.

## Cleanup Requirements

Remove obsolete code directly.

Expected cleanup areas:

```text
packages/studio/src/features/movie-studio/storyboard/
packages/studio/src/features/movie-studio/cast-design/
packages/studio/src/features/movie-studio/use-story-navigation.ts
packages/studio/src/features/movie-studio/movie-studio-selection.ts
packages/studio/src/app/use-project-session.ts
packages/studio/src/services/studio-projects-api.ts
packages/studio/server/routes/navigation.ts
packages/studio/server/http/movie-studio-selection-request.ts
packages/core/src/client/screenplay-projection.ts
packages/core/src/client/cast-members.ts
packages/core/src/server/resources/navigation.ts
packages/core/src/server/database/access/navigation.ts
```

Some files in this list may be rewritten rather than deleted if they keep a
current responsibility. If they remain, their names and contents must describe
the current screenplay model.

Do not keep:

- compatibility re-export files;
- old route aliases;
- old selection aliases;
- fake default sequence or episode branches;
- hidden fallback behavior for unknown IDs;
- tests that assert old route or selection names;
- mock generation panels as active UI.

## Testing Plan

### Core Tests

Add or update core tests for:

- `ProjectShell` includes bounded first navigation pages for cast members,
  locations, and acts.
- `ProjectCounts` includes locations and acts.
- cast overview returns first image references when image assets exist.
- cast overview returns no image reference when no image asset exists.
- location overview returns first image references when image assets exist.
- location overview returns no image reference when no image asset exists.
- cast member resource returns screenplay cast fields.
- location resource returns location fields.
- story arc resource preserves act order and sequence grouping.
- sequence resource returns parent act and scene cards.
- scene narrative resource returns blocks and resolved cast/location labels.
- scene narrative fails fast when stored block JSON is malformed.
- unknown cast/location/act/sequence/scene IDs return structured errors.
- `AssetTarget` supports location relationships through `location_asset`.

### Studio Server Tests

Add or update Hono route tests for:

- screenplay cast overview route;
- cast member route;
- locations overview route;
- location route;
- story arc route;
- act navigation route;
- act sequences route;
- sequence route;
- sequence scenes route;
- scene route;
- location asset page and location asset file routes;
- malformed pagination query errors;
- unsupported selection types reject old `casting` and `storyboard`;
- supported selection context returns route hydration for cast member,
  location, sequence, and scene.

Server tests should use fake `ProjectDataService` implementations and should
not reach into SQLite.

### Frontend Tests

Add or update frontend tests for:

- browser route parsing maps new paths to new selections;
- old `/storyboard` route no longer resolves as a valid Studio surface;
- old `casting` selection is not accepted;
- sidebar renders Project Details, Visual Language, Cast, Locations, and Acts;
- Cast, Locations, and Acts default collapsed;
- expanding Cast shows cast member rows;
- expanding Locations shows location rows;
- expanding Acts shows acts, sequences, and scenes as a tree;
- selecting Cast shows image-card grid;
- selecting Locations shows image-card grid;
- clicking cast/location cards navigates to the correct route;
- Cast Member tabs render Details, Visual Content, and Voice Design;
- Location tabs render Details and Visual Content;
- Sequence panel renders scene cards and scene-card navigation;
- Scene Narrative renders action and dialogue blocks;
- scene narrative cast and location controls navigate to the correct resources;
- no navigation controls are created from plain text mentions without IDs.

### Verification Commands

Run focused commands first while implementing:

```text
pnpm test:core
pnpm test:studio
pnpm test:cli
```

Then run root verification:

```text
pnpm test
pnpm lint
pnpm check
```

If frontend behavior changes are substantial, start the Studio dev server and
verify in the browser:

```text
pnpm dev:studio
```

Manual browser verification should cover:

- project open lands on Project Details;
- Cast, Locations, and Acts are collapsed on first render;
- Cast overview cards navigate to cast members;
- Locations overview cards navigate to locations;
- Acts tree expands through act -> sequence -> scene;
- Story Arc opens from top-level Acts;
- sequence scene cards navigate to scenes;
- scene narrative cast/location controls navigate correctly;
- browser Back/Forward preserves route-owned selection.

## Implementation Order

1. Update core browser-safe contracts and remove obsolete old projection names.
2. Add location asset target support in core and server asset routes.
3. Add core screenplay UI resource projections and structured error tests.
4. Add Hono screenplay routes and HTTP response adapters.
5. Add browser service functions and HTTP-decorated response contracts.
6. Update Studio route parsing, `StudioSelection`, and selection context.
7. Replace sidebar with the new Project Details, Visual Language, Cast,
   Locations, and Acts structure.
8. Build Cast overview and Cast Member panels.
9. Build Locations overview and Location panels.
10. Build Story Arc and Sequence panels.
11. Build Scene panel with Narrative and Shots tabs.
12. Remove obsolete UI folders, services, route modules, contracts, and tests.
13. Run focused tests, root checks, and browser verification.

## Acceptance Criteria

Use this checklist for implementation review and final signoff.

### Product Behavior

- [x] The Studio sidebar matches the new screenplay section structure:
  Project Details, Visual Language, Cast, Locations, and Acts.
- [x] Cast, Locations, and Acts default collapsed on first render.
- [x] Top-level Cast opens a main-panel image-card grid.
- [x] Top-level Locations opens a main-panel image-card grid.
- [x] Cast Member panels show read-only content with Details, Visual Content,
  and Voice Design tabs.
- [x] Location panels show read-only content with Details and Visual Content
  tabs.
- [x] Story Arc is reachable from the top-level Acts route.
- [x] Sequence panels show scene cards in a grid.
- [x] Scene panels render a screenplay-style narrative.
- [x] Scene narrative cast controls navigate to explicit cast member IDs.
- [x] Scene narrative location controls navigate to explicit location IDs.
- [x] Plain text mentions without durable IDs do not become navigation
  controls.

### Architecture

- [x] Hono routes are thin wrappers over core resource logic.
- [x] Studio server response adapters only add HTTP transport fields such as
  image/file URLs.
- [x] Core owns screenplay resource projection, ordering, validation, and
  structured errors.
- [x] Browser services own fetch calls and endpoint paths.
- [x] Feature components do not assemble Studio API URLs directly.
- [x] Loaded navigation rows are kept in feature state, not patched into
  `ProjectShell`.

### Cleanup

- [x] Old `casting` selection support is removed.
- [x] Old `storyboard` selection support is removed.
- [x] Old `/storyboard` route support is removed.
- [x] Old sequence-only story navigation assumptions are removed.
- [x] Obsolete cast mock generation UI is removed from active Studio surfaces.
- [x] No compatibility re-export files, aliases, fallback endpoints, or hidden
  old-name branches remain.

### Assets And Data

- [x] Location assets are first-class asset targets in core.
- [x] Location asset pages and file routes work through Studio server.
- [x] Cast first-image selection uses current asset relationship ordering.
- [x] Location first-image selection uses current asset relationship ordering.
- [x] No pin schema, pin command, or pin UI is added in this pass.

### UI Rules

- [x] Feature code uses local Shadcn-style primitives for interactive controls.
- [x] No raw form or interactive browser controls are introduced in feature
  code.
- [x] Main panels follow the shared panel anatomy and tab treatment.
- [x] Image cards use the established media-card visual treatment.
- [x] Empty placeholder tabs do not expose fake generation workflows or mock
  data.

### Tests And Verification

- [x] Core tests cover the new resource contracts and structured errors.
- [x] Studio server tests cover the new screenplay routes and location asset
  routes.
- [x] Frontend tests cover route parsing, sidebar state, top-level grids, tabs,
  sequence cards, and scene narrative navigation.
- [x] Tests reject or remove expectations for old `casting` and `storyboard`
  behavior.
- [x] `pnpm test` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm check` passes.

## Non-Goals

- No editable cast, location, sequence, or scene content in this pass.
- No pinning model for cast/location images.
- No final Story Arc visualization design.
- No storyboard image schema or generation workflow.
- No shot model or shot editor.
- No visual-content generation UI.
- No voice-design generation UI.
- No series, episode, or compatibility support.
- No fallback endpoints or aliases for obsolete Studio routes.
