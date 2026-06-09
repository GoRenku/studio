# 0055 Uniform Studio Resource Refresh

Status: proposed
Date: 2026-06-09

## Summary

Renku Studio already has the right high-level coordination mechanism for local
CLI-to-browser updates:

1. a CLI or agent mutates durable project data through `@gorenku/studio-core`;
2. the CLI appends a `studio.projectResourcesChanged` event with scoped
   `resourceKeys`;
3. the running Studio browser polls coordination events;
4. the browser dispatches `renku:studio-resource-changed`;
5. the visible Studio surface reloads the affected resource from SQLite through
   the Studio API.

The problem is that this contract is not implemented uniformly.

Some CLI commands mutate project data and return `resourceKeys`, but never append
the Studio resource-change event. Some Studio panels listen for the event, while
others rely on incidental parent refreshes or never subscribe. Some server routes
discard `resourceKeys` returned by core mutations before browser code can use
them. Some resource key strings exist only as informal literals spread across
core, CLI, server, and browser code.

The fix should make resource refresh a first-class system component, not a
collection of one-off event listeners. Different product areas should contribute
resource ownership and reload callbacks, but they should not invent their own
event detail types, append helpers, resource-key literals, local revision
systems, or browser event listeners.

Architecture decision:

- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`

## User-Visible Problem

When a user or agent runs Renku CLI commands while Studio is open, the browser
can show stale values until the user manually refreshes the page.

Concrete example from the current codebase:

- `renku cast voice attach` writes a Cast Voice and returns resource keys from
  core, including `assets:castMember:<cast-member-id>` and
  `surface:castMember:<cast-member-id>`.
- `packages/cli/src/commands/cast-command.ts` writes that report to stdout but
  does not append a `studio.projectResourcesChanged` event.
- `CastMemberPanel` already listens for those keys and would reload the Cast
  Member resource if it heard them.
- Because the event is never appended, the open Cast Member page keeps showing
  the old voice list until the browser refreshes.

The same pattern affects newer character sheet, voice, cast, location,
production design, AI Production, and some visual-language workflows.

## Current Architecture To Preserve

This plan keeps the existing architecture:

- project SQLite remains the source of truth for durable project data;
- Studio coordination events remain local UI coordination only;
- resource-change events contain scoped resource keys, not project data;
- browser surfaces reload their resources from Studio HTTP APIs;
- CLI commands report structured warnings if a durable mutation succeeds but
  coordination append fails;
- focus requests remain separate from resource refresh requests.

This plan does not turn the Studio coordination store into a domain event log.
It does not add polling of project SQLite by browser panels. It does not reload
the full browser page as a shortcut.

This plan refines ADR 0017 with ADR 0030. ADR 0017 defines scoped resource
invalidation as the correct model. ADR 0030 makes the implementation shape
explicit: core owns the resource-key catalog, the CLI uses one post-mutation
appender, Studio server routes preserve mutation resource keys, and browser
surfaces subscribe through one shared refresh hook and matcher module.

## Non-Goals

- No full-window browser refresh after CLI changes.
- No broad "reload everything" event except where a project-shell resource
  change is deliberately required.
- No compatibility aliases for old resource key names.
- No fallback branches that guess old resource keys.
- No project-data reads from the coordination event store.
- No mobile-specific verification.
- No new domain-event namespace such as `cast.*` or `project.*` in the Studio
  coordination event store.
- No feature-owned browser event listener systems for
  `renku:studio-resource-changed`.
- No local feature copies of the resource-change event detail type.
- No new manual revision counters as a substitute for resource-key refresh.

## Audit Findings

### Confirmed Good Paths

These paths already mostly follow the intended pattern and should be preserved
while being moved onto the shared contract:

- `packages/cli/src/commands/project-information-command.ts`
  appends `studio.projectRefreshRequested` and a focus request after project
  information changes.
- `packages/cli/src/commands/screenplay-command.ts` appends
  `studio.projectResourcesChanged` for screenplay analysis, scene shot-list,
  screenplay create/apply/revise, and active shot-list changes.
- `packages/cli/src/commands/lookbook-command.ts` appends
  `studio.projectResourcesChanged` for Lookbook mutations.
- `packages/cli/src/commands/asset-command.ts` appends
  `studio.projectResourcesChanged` for asset register/select/update/remove.
- `packages/cli/src/commands/media-import-command-handlers.ts` appends
  `studio.projectResourcesChanged` after media imports.
- `packages/studio/src/app/use-studio-coordination.ts` polls Studio events and
  dispatches the browser-local `renku:studio-resource-changed` event.
- Some panels already subscribe to scoped resource keys, including:
  `CastMemberPanel`, `LocationPanel`, `StoryArcPanel`, `SceneShotsTab`,
  `InspirationPanel`, `LookbookPanel`, `LookbooksPanel`, `SequencePanel`, and
  `ActStoryboardPanel`.

These working paths are evidence that the architecture is sound. The problem is
coverage and contract drift.

### CLI Event Emission Gaps

The following CLI command files have confirmed mutation paths that do not append
resource-change events after successful writes.

| File | Mutation paths | Current impact |
| --- | --- | --- |
| `packages/cli/src/commands/cast-command.ts` | `cast apply`, `cast design write`, `cast design set-active`, `cast voice attach`, `cast voice remove` | Cast overview, Cast Member details, Cast Member assets, and Cast Voice lists can remain stale. This directly matches the reported voice/character-sheet style failure. |
| `packages/cli/src/commands/location-command.ts` | `location apply` | Location overview, Location detail, and sidebar location navigation can remain stale after CLI location edits. |
| `packages/cli/src/commands/production-design-command.ts` | `production-design location write`, `production-design location set-active` | Location design/readiness surfaces and generation context can change without Studio refresh notification. |
| `packages/cli/src/commands/generation-command-handlers.ts` | `generation production update`, `generation input select`, `generation input clear` | AI Production state can remain stale after CLI changes to production setup or selected inputs. |
| `packages/cli/src/commands/inspiration-command.ts` | `inspiration create`, `inspiration rename`, `inspiration reorder`, `inspiration delete` | Inspiration folder lists in the sidebar and Inspiration panel can remain stale after CLI folder changes. |
| `packages/cli/src/commands/create-project-command.ts` | `create` | Project Library does not receive a coordination refresh after a project is created while Studio is open. |

Some generation spec commands also mutate records:

- `generation spec create`
- `generation spec update`

Those records are not currently displayed as a first-class Studio resource in
the same way as Cast Members, Lookbooks, or Scene Shot Lists. The implementation
must make an explicit decision:

- either define and emit resource keys for visible generation-spec resources;
- or document that spec records are currently CLI-only and should not pretend to
  refresh a UI surface.

Do not silently append vague keys for generation specs until a visible resource
owner exists.

### Duplicate CLI Append Helpers

Several command files carry their own local resource-event append helper:

- `appendScreenplayResourceChangedEvent` in `screenplay-command.ts`;
- `appendLookbookResourceChangedEvent` in `lookbook-command.ts`;
- `appendInspirationResourceChangedEvent` in `inspiration-command.ts`;
- `appendAssetResourceChangedEvent` in `asset-command.ts`;
- shared `appendStudioResourceChangedEvent` in
  `studio-resource-event-command.ts`.

The duplicate helpers differ in warning codes, wording, project-ref resolution,
and call placement. This is a drift source.

The implementation should keep one CLI-owned resource-change append helper with
clear responsibility:

- input: command name, runtime, project ref, resource keys;
- behavior: append `studio.projectResourcesChanged`;
- failure: warn to stderr without undoing the durable mutation.

This helper is not a compatibility wrapper. It is the CLI boundary for local
Studio coordination after successful project-data mutations.

### Core Resource-Key Contract Gaps

Core already has `packages/core/src/server/studio-coordination/resource-keys.ts`,
but many keys are still written as raw string literals elsewhere.

Examples:

- `surface:visual-language:lookbooks` is local to Lookbook command code.
- `surface:visual-language:inspiration` is local to Inspiration command code.
- `screenplay`, `screenplay:acts`, and `scene:<scene-id>` are emitted by
  screenplay resources and commands without a central key builder.
- `surface:story-arc`, `navigation:cast`, `navigation:locations`,
  `surface:act:<id>`, `surface:sequence:<id>`, and
  `navigation:sequence-scenes:<id>` are used by selection context without a
  shared catalog.
- `surface:castDesign:<id>` and `surface:locationDesign:<id>` are emitted by
  department design commands, but no browser matcher currently owns those keys
  as first-class design-resource invalidation keys.

Some core mutation functions also do not return resource keys even though their
results are visible in Studio:

- `createInspirationFolder`;
- `renameInspirationFolder`;
- `reorderInspirationFolders`;
- `deleteInspirationFolder`;
- `writeInspirationImage`;
- `deleteInspirationImage`.

Those functions should return project-aware mutation reports with resource keys,
or otherwise route through a core command function that does. Browser and CLI
callers should not have to invent these keys themselves.

### Studio Server Response Gaps

Some Studio server routes return `resourceKeys` today:

- project information updates;
- cast/location asset selection and deletion;
- Scene Shot List and AI Production mutations.

Other server routes call core mutation functions that return resource keys, but
discard them before returning to the browser:

- Lookbook create/update/delete/set-active/clear-active;
- Lookbook image and sheet mutations;
- Lookbook card image/default sheet mutations.

Some routes call core functions that currently do not expose resource keys:

- Inspiration folder create/rename/reorder/delete;
- Inspiration image upload/delete.

The browser services then compensate with manual revision counters, such as
`lookbooksRevision` and `inspirationFoldersRevision`, instead of consuming a
shared resource-change response shape.

### Browser Resource Consumption Gaps

The browser currently has many local event listeners that each define their own
`StudioResourceChangedDetail` type and their own key-matching logic. This works
for the panels that have been updated, but it is easy for new surfaces to miss a
key.

Confirmed panel and app gaps:

| Surface | Gap | Impact |
| --- | --- | --- |
| Project Information | `ProjectInformationPanel` does not subscribe to `project-information` or `project-shell` resource keys directly. It relies on parent project prop changes. | Project information may stay stale if a resource-key event is emitted without a shell refresh, or if future callers use `project-information` consistently. |
| Project Library | The app does not refresh the library for resource-key project-library changes. | Newly created projects or library-level changes may need manual refresh. |
| Movie Studio sidebar | Cast, location, act, sequence, scene, Inspiration, and Lookbook sidebar data uses project shell or local revision counters. It does not consistently react to resource keys. | Sidebar labels, counts, and lists can lag behind detail panels. |
| `useScreenplayNavigation` | It does not subscribe to `screenplay`, `screenplay:acts`, `navigation:cast`, `navigation:locations`, `navigation:sequence-scenes:<id>`, or related keys. It also keeps cached sequence/scene pages after those pages are invalidated. | Navigation rows and route selection context can stay stale after CLI screenplay/cast/location changes. |
| `StoryArcPanel` | It listens to story-arc and analysis keys, but not `screenplay` / screenplay structure keys. | Story Arc can stay stale after screenplay create/apply/revise commands. |
| `ScenePanel` | The narrative tab loads once per scene id and does not listen to `screenplay`, `scene:<id>`, or sequence-scene navigation keys. | Scene narrative can stay stale after CLI scene revisions. |
| `SequencePanel` | It listens for scene/storyboard-related keys, but not sequence-level or screenplay-level invalidation. | Sequence title, purpose, scene list, and storyboard previews can drift. |
| `ActStoryboardPanel` | It listens for shot/storyboard changes, but not act-level or screenplay-level invalidation. | Act title/purpose/sequence composition can drift. |
| `SceneDesignPanel` | It loads once and has no resource listener. It is not currently a primary visible route, but the code is still present. | If reused, design resources would be stale after design writes. |
| Cast/Location design cache | `invalidateCastDesignResource` exists but is a no-op. There is no equivalent location design invalidation. | Any future design-resource cache would silently fail to invalidate. |
| Generic project/sequence/scene assets | Keys such as `assets:project`, `assets:sequence:<id>`, and `assets:scene:<id>` can be emitted by asset commands, but there is no clear browser owner. | Either these keys need visible owners or they should be treated as currently non-visible resource keys. |

### Resource Key Naming Drift

Some current keys are clear:

- `surface:castMember:<id>`;
- `assets:castMember:<id>`;
- `surface:location:<id>`;
- `assets:location:<id>`;
- `surface:visual-language:lookbook:<id>`.

Other keys are vague or inconsistent:

- `screenplay`;
- `screenplay:acts`;
- `scene:<id>`;
- `project-information`.

The implementation should choose deliberate current names and update emitters
and listeners directly. Because Studio is pre-customer software, do not keep old
keys as aliases. Tests should describe only the accepted key vocabulary.

## Proposed Architecture

### Unified System Components

Resource refresh should be implemented as one cross-package system with
package-owned components:

- core resource-key catalog:
  `packages/core/src/server/studio-coordination/resource-keys.ts`;
- core mutation reports for visible durable mutations, carrying project identity
  and resource keys;
- CLI resource-change appender:
  `packages/cli/src/commands/studio-resource-event-command.ts`;
- Studio server mutation responses that preserve `resourceKeys`;
- browser resource-refresh hook and matcher module under
  `packages/studio/src/hooks`.

This is not a global browser data store. The shared browser module owns
subscription, project filtering, event detail typing, and key matching. Feature
surfaces still own their resource reads, dirty-draft protection, and rendering.

Architecture rule:

> Feature code may declare which accepted resources it owns and how to reload
> them. Feature code must not define its own resource-change event type, attach
> raw `renku:studio-resource-changed` listeners, or assemble resource keys that
> should come from the core catalog.

### Resource Keys Are Invalidation Contracts

A Studio resource key means:

> The project data that backs this UI resource may have changed. Reload the
> resource from the owning Studio API before showing it as current.

Resource keys are not domain events. They should not describe what happened.

Good:

```text
surface:castMember:cast_urban
assets:castMember:cast_urban
surface:scene:scene_gate:shots
navigation:sequence-scenes:seq_opening
```

Avoid:

```text
cast.voice.attached
asset.selected
scene.shot.updated
```

### Core Owns The Key Vocabulary

Move resource-key construction into
`packages/core/src/server/studio-coordination/resource-keys.ts` and use that
catalog from core command/resource code.

The catalog should expose deliberate builders such as:

- `studioProjectShellResourceKey()`;
- `studioProjectInformationResourceKey()`;
- `studioCastNavigationResourceKey()`;
- `studioCastMemberSurfaceResourceKey(castMemberId)`;
- `studioCastMemberAssetsResourceKey(castMemberId)`;
- `studioLocationNavigationResourceKey()`;
- `studioLocationSurfaceResourceKey(locationId)`;
- `studioLocationAssetsResourceKey(locationId)`;
- `studioVisualLanguageInspirationResourceKey()`;
- `studioVisualLanguageInspirationFolderResourceKey(folderId)`;
- `studioVisualLanguageLookbooksResourceKey()`;
- `studioVisualLanguageLookbookResourceKey(lookbookId)`;
- `studioStoryArcSurfaceResourceKey()`;
- `studioScreenplayResourceKey()` or its accepted replacement;
- `studioScreenplayActsResourceKey()` or its accepted replacement;
- `studioSceneNarrativeResourceKey(sceneId)`;
- `studioSceneShotsResourceKey(sceneId)`;
- `studioSceneShotListResourceKeys(...)`;
- `studioShotVideoTakeResourceKeys(...)`.

If current names such as `screenplay` and `scene:<id>` are replaced, update all
callers and tests directly in the same implementation slice. Do not add aliases.

### CLI Has One Post-Mutation Refresh Path

Every CLI command that receives a successful core mutation report with
`project` and `resourceKeys` should append `studio.projectResourcesChanged`
through the same CLI helper.

Rules:

- append only after the durable mutation succeeds;
- do not append after dry runs or validation-only commands;
- do not append for read-only commands;
- do not fabricate keys in CLI when core should own them;
- warn if the append fails, but do not roll back the mutation;
- include the concrete command name as the event source.

Structured command handlers may declare whether their result should emit a
resource-change event. That keeps `generation-command-handlers.ts` and
`media-import-command-handlers.ts` aligned without another large conditional
chain.

### Browser Has One Resource Event Subscription Shape

Add one browser-side resource event module or hook, planned as
`packages/studio/src/hooks/use-studio-resource-refresh.ts`, that owns:

- the `renku:studio-resource-changed` event detail type;
- project-name filtering;
- resource-key matching;
- cleanup of event listeners;
- small matcher helpers for common resource groups.

Feature panels can still own the actual reload function because resources belong
to the feature surface. The shared hook should remove duplicated event boilerplate
without becoming a global data store.

Feature panels should not use raw
`window.addEventListener('renku:studio-resource-changed', ...)`. They should
call the shared hook and pass a resource matcher plus a reload callback.

Example responsibility split:

- `useStudioResourceRefresh(...)` listens and decides whether keys match;
- `CastMemberPanel` owns `readCastMemberResource` and `readCastAssets`;
- `SceneShotsTab` owns `readSceneShotListResource`;
- `useScreenplayNavigation` owns navigation page invalidation and reload.

### Project Shell And Navigation Are First-Class Resources

The app-wide coordination hook should keep the project shell fresh when keys
affect shell-owned data:

- `project-shell`;
- project information keys that change shell title/logline/aspect ratio;
- cast navigation keys;
- location navigation keys;
- screenplay structure keys that affect counts or navigation;
- project cover/image keys if a future asset key affects shell cover.

`useScreenplayNavigation` should also respond to navigation keys by clearing or
reloading only the affected cached page:

- cast navigation;
- location navigation;
- act list;
- sequences for one act;
- scenes for one sequence;
- current selection context.

Do not force a full project reload for every scene shot-list or asset change.
Keep refresh scoped to the key owner.

### Server Routes Preserve Resource Keys

Studio server mutation routes should return resource keys whenever the core
mutation report has them.

Browser service functions should return those keys as part of a mutation result
when the caller needs to notify sibling surfaces.

This does not require the browser to wait for the coordination event it caused.
The initiating component may still apply the returned resource immediately.
The key point is that all mutation responses expose the same invalidation
contract for sibling panels and future browser sessions.

## Implementation Plan

### Phase 1: Resource-Key Catalog And Contract Cleanup

Create a complete key catalog in core.

Implementation details:

- expand `packages/core/src/server/studio-coordination/resource-keys.ts`;
- add a `StudioResourceKey` type if TypeScript can express the current template
  literal vocabulary clearly;
- add builders for every resource key currently emitted by core;
- update command/resource files to call the builders instead of writing raw
  string literals;
- update selection context and director context to use the same builders;
- decide whether vague current keys are kept as accepted names or renamed;
- if renamed, update emitters/listeners/tests directly with no aliases.

Acceptance criteria:

- a reviewer can find every accepted key name in one core file;
- all core resource-key tests use builders or accepted string constants;
- no feature code invents a resource key that core should own;
- no obsolete resource key names remain in new tests.

### Phase 2: Core Mutation Reports For Visible Resources

Make visible mutations return project-aware resource-change reports.

Implementation details:

- add resource keys to Inspiration folder create/rename/reorder/delete results;
- add resource keys to Inspiration image write/delete results;
- keep validation-only and read-only results unchanged unless they already
  expose resource keys for agent context;
- review generation spec create/update and decide whether visible resource keys
  exist today;
- if generation specs are not visible, document that decision in the command
  architecture tests instead of appending vague refresh keys.

Acceptance criteria:

- every visible durable mutation can report `{ project, resourceKeys }`;
- CLI callers do not derive resource keys that should have come from core;
- browser routes do not need to guess which resources changed.

### Phase 3: CLI Event Emission Coverage

Wire every mutating CLI command through the shared post-mutation event helper.

Implementation details:

- replace local append helpers in `screenplay-command.ts`, `lookbook-command.ts`,
  `inspiration-command.ts`, and `asset-command.ts` with the shared helper where
  practical;
- add append calls for `cast apply`;
- add append calls for `cast design write`;
- add append calls for `cast design set-active`;
- add append calls for `cast voice attach`;
- add append calls for `cast voice remove`;
- add append calls for `location apply`;
- add append calls for `production-design location write`;
- add append calls for `production-design location set-active`;
- add append calls for `inspiration create`;
- add append calls for `inspiration rename`;
- add append calls for `inspiration reorder`;
- add append calls for `inspiration delete`;
- add append calls for `generation production update`;
- add append calls for `generation input select`;
- add append calls for `generation input clear`;
- add project-library refresh coordination for `create` when a project is created;
- do not append for dry-run, validate, list, show, context, estimate, preflight,
  or read-only commands.

Acceptance criteria:

- every CLI mutation that returns non-empty resource keys appends exactly one
  `studio.projectResourcesChanged` event for that mutation;
- multiple events are used only when the command intentionally also requests
  focus;
- command tests prove dry runs do not append refresh events;
- command tests prove coordination append failure writes a warning and leaves the
  mutation result successful.

### Phase 4: Studio Server Mutation Response Coverage

Return resource keys from Studio server mutation routes consistently.

Implementation details:

- update visual-language routes to include `resourceKeys` in mutation responses;
- update inspiration routes once core returns resource-key reports;
- keep project-information, assets, and screenplay routes aligned with the same
  response shape;
- update browser service response types to include `resourceKeys` when returned;
- keep response types explicit and route-specific. Do not hide every route
  behind a generic response facade.

Acceptance criteria:

- every server mutation route that changes a visible Studio resource returns
  resource keys;
- browser services can pass resource keys to sibling invalidation code;
- tests assert returned keys for representative visual-language, inspiration,
  cast/location asset, project information, and scene-shot mutations.

### Phase 5: Browser Resource Refresh Infrastructure

Centralize event subscription and key matching without centralizing resource
state.

Implementation details:

- add one browser-side event detail type;
- add one hook or module for subscribing to
  `renku:studio-resource-changed`, planned as
  `packages/studio/src/hooks/use-studio-resource-refresh.ts`;
- add matcher helpers for resource groups used by panels;
- remove duplicated local `StudioResourceChangedDetail` declarations;
- remove raw `window.addEventListener('renku:studio-resource-changed', ...)`
  calls from feature code;
- remove feature-local resource-key matching that duplicates the shared matcher
  module;
- keep data reloads inside the owning feature component or hook;
- preserve dirty-draft protection in autosave surfaces.

Acceptance criteria:

- feature panels no longer duplicate event-detail types;
- feature panels subscribe through the shared refresh hook or module;
- direct browser event listeners exist only in the shared module and tests;
- matchers are named after domain resources, not generic helpers;
- dirty local forms are not overwritten by background refreshes;
- no full-page refresh or polling fallback is introduced.

### Phase 6: App Shell And Navigation Refresh

Make project shell and navigation caches react to their keys.

Implementation details:

- update `use-studio-coordination.ts` to refresh the project shell for
  shell-owned keys;
- update `useProjectSession` only where app-wide project/library state is truly
  owned there;
- update `useScreenplayNavigation` to invalidate or reload:
  - cast navigation;
  - location navigation;
  - act navigation;
  - sequences for an act;
  - scenes for a sequence;
  - current selection context;
- update `StudioSidebar` so visual-language lists respond to resource keys
  instead of only parent revision counters;
- preserve scoped panel reload behavior for heavy resources like Scene Shot
  Lists.

Acceptance criteria:

- sidebar cast/location rows update after CLI cast/location changes;
- sidebar Inspiration folders update after CLI folder changes;
- sidebar Lookbooks update after CLI Lookbook changes;
- scene/sequence/act navigation updates after screenplay structure changes;
- project library updates after project creation or explicit library refresh
  events.

### Phase 7: Panel-Specific Coverage

Wire every visible detail panel to its owning resource keys.

Implementation details:

- `ProjectInformationPanel` listens for project information and project shell
  keys, while preserving unsaved local drafts;
- `CastOverviewPanel` keeps current cast/asset coverage through shared matchers;
- `CastMemberPanel` keeps current cast/asset/voice coverage through shared
  matchers;
- `LocationOverviewPanel` keeps current location/asset coverage through shared
  matchers;
- `LocationPanel` keeps current location/asset coverage through shared matchers;
- `StoryArcPanel` refreshes on screenplay structure and analysis keys;
- `ScenePanel` refreshes narrative on screenplay/scene narrative keys;
- `SceneShotsTab` keeps current Scene Shot List and shot-video coverage through
  shared matchers;
- `SequencePanel` refreshes on sequence, screenplay, sequence-scene, and
  storyboard keys;
- `ActStoryboardPanel` refreshes on act, screenplay, sequence-scene, and
  storyboard keys;
- `InspirationPanel`, `LookbooksPanel`, and `LookbookPanel` move to shared
  matchers and keep their current scoped reload behavior;
- decide whether `SceneDesignPanel` remains in the codebase. If it remains,
  give it a resource listener; if it is obsolete, remove it directly.

Acceptance criteria:

- every visible `read*Resource` panel has a matching resource-key refresh path;
- refresh stays scoped to the owning resource;
- tests cover one representative CLI-like event for each major surface.

### Phase 8: Tests And Static Coverage

Add tests that make refresh coverage hard to regress.

Implementation details:

- CLI tests for every newly wired mutation command;
- focused browser tests that dispatch `renku:studio-resource-changed` and assert
  the relevant resource read function runs again;
- app tests for project-shell, project-library, and navigation refresh;
- server route tests for returned resource keys;
- core tests for resource-key builders and mutation reports;
- a focused static test or command-architecture test that lists CLI mutation
  handlers expected to append refresh events.
- a focused browser architecture test that rejects direct
  `renku:studio-resource-changed` listeners outside the shared refresh module
  and tests;
- a focused key-catalog architecture test that rejects raw resource-key literals
  outside the accepted core catalog, focused matcher code, and tests.

Acceptance criteria:

- adding a new mutation command with resource keys but no CLI append path fails
  a focused test;
- adding a new visible resource key without a browser owner fails a focused test
  or requires an explicit non-visible-resource note;
- adding a new feature-local resource refresh listener fails a focused test;
- existing dirty-draft refresh tests remain passing.

### Phase 9: Documentation

Document the final resource-refresh contract.

Implementation details:

- keep `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`
  as the governing ADR for this work;
- update `docs/architecture/reference/studio-coordination-events.md`;
- add or update a resource-key reference section;
- update CLI command documentation where commands append resource refresh events;
- update `docs/architecture/reference/front-end-guidelines.md` with the rule
  that resource panels must subscribe through the shared resource refresh hook;
- update any active plan that still describes obsolete resource key behavior
  only if it is current implementation direction.

Acceptance criteria:

- ADR 0030 explains the unified system component and forbids feature-local
  refresh systems;
- docs explain when to emit `studio.projectResourcesChanged`;
- docs explain when a panel should listen for resource keys;
- docs make clear that coordination events are not project history.

## Completion Checklist

Use this checklist to track the implementation. It is intentionally detailed so
reviewers can verify coverage without rediscovering the whole audit.

### Review And Scope

- [ ] Confirm ADR 0030 is accepted as the governing architecture decision for
      unified Studio resource refresh.
- [ ] Confirm the implementation scope is resource refresh after durable project
      mutations.
- [ ] Confirm this work does not introduce a domain event log.
- [ ] Confirm this work does not introduce full-browser refresh as a fallback.
- [ ] Confirm mobile behavior is not part of verification.
- [ ] Confirm no compatibility aliases for old resource keys are planned.
- [ ] Confirm feature areas will use the shared refresh components instead of
      local notification systems.
- [ ] Confirm generation spec create/update visibility is decided before wiring
      refresh events for those commands.

### Architecture Decision And Documentation Baseline

- [ ] Keep
      `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`
      aligned with the implementation.
- [ ] Confirm ADR 0030 references ADR 0006, ADR 0015, ADR 0017, and ADR 0026.
- [ ] Confirm ADR 0030 states that core owns the resource-key vocabulary.
- [ ] Confirm ADR 0030 states that the CLI has one post-mutation resource-change
      appender.
- [ ] Confirm ADR 0030 states that Studio server mutation routes preserve
      resource keys.
- [ ] Confirm ADR 0030 states that browser surfaces subscribe through one shared
      refresh hook or module.
- [ ] Confirm ADR 0030 forbids feature-local resource-change event detail types,
      direct feature event listeners, local refresh systems, and resource-key
      literals outside the accepted catalog.

### Core Resource-Key Contract

- [ ] Expand `packages/core/src/server/studio-coordination/resource-keys.ts`
      into the accepted resource-key catalog.
- [ ] Add builders for project shell and project information keys.
- [ ] Add builders for cast navigation, Cast Member surface, Cast Member assets,
      and Cast Design keys.
- [ ] Add builders for location navigation, Location surface, Location assets,
      and Location Design keys.
- [ ] Add builders for visual-language Inspiration and Lookbook keys.
- [ ] Add builders for screenplay/story-arc/act/sequence/scene keys.
- [ ] Add builders for Scene Shot List, storyboard, and shot-video keys.
- [ ] Replace raw resource-key literals in core command/resource code.
- [ ] Replace raw resource-key literals in selection context.
- [ ] Replace raw resource-key literals in director context.
- [ ] Decide whether vague keys such as `screenplay`, `screenplay:acts`, and
      `scene:<id>` remain accepted names.
- [ ] If key names change, update all callers directly and delete old names.
- [ ] Add core tests for resource-key builder output.

### Core Mutation Reports

- [ ] Add project-aware resource keys to Inspiration folder create results.
- [ ] Add project-aware resource keys to Inspiration folder rename results.
- [ ] Add project-aware resource keys to Inspiration folder reorder results.
- [ ] Add project-aware resource keys to Inspiration folder delete results.
- [ ] Add project-aware resource keys to Inspiration image write results.
- [ ] Add project-aware resource keys to Inspiration image delete results.
- [ ] Review generation spec create/update reports for visible resource ownership.
- [ ] Document any mutation that remains intentionally CLI-only or non-visible.
- [ ] Add tests proving visible mutations return non-empty resource keys.

### CLI Emission

- [ ] Consolidate CLI resource-event append behavior into one command support
      helper.
- [ ] Preserve structured warning behavior when append fails after a successful
      mutation.
- [ ] Wire `cast apply`.
- [ ] Wire `cast design write`.
- [ ] Wire `cast design set-active`.
- [ ] Wire `cast voice attach`.
- [ ] Wire `cast voice remove`.
- [ ] Wire `location apply`.
- [ ] Wire `production-design location write`.
- [ ] Wire `production-design location set-active`.
- [ ] Wire `inspiration create`.
- [ ] Wire `inspiration rename`.
- [ ] Wire `inspiration reorder`.
- [ ] Wire `inspiration delete`.
- [ ] Wire `generation production update`.
- [ ] Wire `generation input select`.
- [ ] Wire `generation input clear`.
- [ ] Add project-library refresh coordination after project creation.
- [ ] Keep read-only, validate-only, estimate, preflight, and dry-run commands
      from appending resource events.
- [ ] Replace duplicate append helpers in existing command files where practical.
- [ ] Add focused CLI tests for each newly wired mutation path.
- [ ] Add CLI tests proving dry-run commands do not append refresh events.
- [ ] Add CLI tests proving append failure reports warnings without failing the
      durable mutation.

### Studio Server Responses

- [ ] Return resource keys from Lookbook create/update/rename/delete routes.
- [ ] Return resource keys from Lookbook active-selection routes.
- [ ] Return resource keys from Lookbook image/sheet mutation routes.
- [ ] Return resource keys from Inspiration folder mutation routes.
- [ ] Return resource keys from Inspiration image upload/delete routes.
- [ ] Keep project-information route resource keys aligned with the core catalog.
- [ ] Keep asset route resource keys aligned with the core catalog.
- [ ] Keep screenplay route resource keys aligned with the core catalog.
- [ ] Update browser service response types for mutation resource keys.
- [ ] Add server route tests for returned resource keys.

### Browser Refresh Infrastructure

- [ ] Add one browser-side resource-change detail type.
- [ ] Add one shared resource refresh subscription hook or module, planned as
      `packages/studio/src/hooks/use-studio-resource-refresh.ts`.
- [ ] Add cast resource matchers.
- [ ] Add location resource matchers.
- [ ] Add visual-language resource matchers.
- [ ] Add screenplay/navigation resource matchers.
- [ ] Add project shell/library resource matchers.
- [ ] Remove duplicate local `StudioResourceChangedDetail` interfaces.
- [ ] Remove raw `window.addEventListener('renku:studio-resource-changed', ...)`
      from feature code.
- [ ] Remove feature-local resource-key matching where the shared matcher module
      owns that match.
- [ ] Keep data-fetching ownership inside feature panels/hooks.
- [ ] Confirm the shared hook does not become a global project-data store.

### App Shell And Navigation

- [ ] Refresh project shell on `project-shell`.
- [ ] Refresh project shell when project-information keys affect shell fields.
- [ ] Refresh project library for project-library resource events.
- [ ] Refresh or invalidate cast navigation after cast navigation keys.
- [ ] Refresh or invalidate location navigation after location navigation keys.
- [ ] Refresh or invalidate act navigation after screenplay act keys.
- [ ] Refresh or invalidate sequence pages after act sequence keys.
- [ ] Refresh or invalidate scene pages after sequence scene keys.
- [ ] Refresh current selection context when the selected resource's navigation
      context may have changed.
- [ ] Update StudioSidebar Inspiration folder refresh to use resource keys.
- [ ] Update StudioSidebar Lookbook refresh to use resource keys.
- [ ] Add app/navigation tests for each navigation refresh family.

### Visible Panels

- [ ] Wire Project Information direct resource refresh with dirty-draft
      protection.
- [ ] Move Cast Overview resource refresh to shared matchers.
- [ ] Move Cast Member resource refresh to shared matchers.
- [ ] Confirm Cast Voice attach/remove events refresh Cast Member Details and
      Assets tabs.
- [ ] Move Location Overview resource refresh to shared matchers.
- [ ] Move Location resource refresh to shared matchers.
- [ ] Confirm location asset selection/deletion events refresh Details and Visual
      Content tabs.
- [ ] Expand Story Arc refresh to screenplay structure keys.
- [ ] Add Scene narrative refresh for screenplay/scene narrative keys.
- [ ] Keep Scene Shots refresh scoped to shot-list/storyboard/AI Production
      keys.
- [ ] Expand Sequence refresh for sequence/screenplay/navigation keys.
- [ ] Expand Act Storyboard refresh for act/screenplay/navigation keys.
- [ ] Move Inspiration panel refresh to shared matchers.
- [ ] Move Lookbooks panel refresh to shared matchers.
- [ ] Move Lookbook panel refresh to shared matchers.
- [ ] Decide whether `SceneDesignPanel` remains. If it remains, add refresh; if
      not, delete it directly.

### Tests

- [ ] Add browser tests for Cast Voice CLI-like events.
- [ ] Add browser tests for Cast Member character sheet/asset events.
- [ ] Add browser tests for Location asset events.
- [ ] Add browser tests for Inspiration folder events.
- [ ] Add browser tests for Lookbook events.
- [ ] Add browser tests for Project Information resource events.
- [ ] Add browser tests for Story Arc after screenplay events.
- [ ] Add browser tests for Scene narrative after scene events.
- [ ] Add browser tests for Sequence/Act navigation events.
- [ ] Preserve existing Scene Shot List dirty-draft background refresh tests.
- [ ] Add static or architecture tests for CLI mutation refresh coverage.
- [ ] Add static or architecture tests for visible resource-key ownership.
- [ ] Add a browser architecture test that allows direct
      `renku:studio-resource-changed` listeners only in the shared refresh
      module and focused tests.
- [ ] Add a browser architecture test that rejects feature-local
      `StudioResourceChangedDetail` declarations.
- [ ] Add a key-catalog architecture test that rejects raw resource-key literals
      outside the core catalog, focused matcher code, and tests.

### Documentation

- [ ] Add or keep ADR 0030 for unified Studio resource refresh components.
- [ ] Update `docs/architecture/reference/studio-coordination-events.md`.
- [ ] Document the accepted resource key vocabulary.
- [ ] Document CLI mutation refresh requirements.
- [ ] Document browser resource panel subscription requirements.
- [ ] Update `docs/cli/commands.md` for newly wired commands.
- [ ] Update active implementation plans only where they represent current
      direction.

### Final Verification

- [ ] Run focused core resource-key and mutation-report tests.
- [ ] Run focused CLI refresh-emission tests.
- [ ] Run focused Studio browser resource-refresh tests.
- [ ] Run focused Studio server route tests.
- [ ] Run `pnpm test:cli`.
- [ ] Run `pnpm --filter @gorenku/studio test`.
- [ ] Run `pnpm build:core`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm check`.
- [ ] Open Studio on desktop with the sample project.
- [ ] Run a CLI Cast Voice attach and confirm the open Cast Member page updates
      without browser refresh.
- [ ] Run a CLI Cast Voice remove and confirm the open Cast Member page updates
      without browser refresh.
- [ ] Run a CLI Cast Member update and confirm Cast Overview, Cast Member detail,
      and sidebar cast rows update.
- [ ] Run a CLI Location update and confirm Location Overview, Location detail,
      and sidebar location rows update.
- [ ] Run a CLI Inspiration folder create/rename/delete and confirm the sidebar
      and Inspiration panel update.
- [ ] Run a CLI Lookbook update and confirm Lookbooks, active Lookbook, and
      sidebar update.
- [ ] Run a CLI scene narrative revision and confirm Story Arc, Scene narrative,
      and navigation update.
- [ ] Run a CLI AI Production input selection and confirm the open AI Production
      tab updates.
- [ ] Confirm feature code uses the shared resource refresh hook or module
      instead of direct resource-change event listeners.
- [ ] Confirm no raw HTML interactive controls were added in `packages/studio`
      feature code.
- [ ] Confirm no compatibility aliases, re-export stubs, or fallback resource
      key branches were added.
