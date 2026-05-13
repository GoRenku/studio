# 0016 Use Active Project Sessions And Eager Surface Data For Studio Performance

Date: 2026-05-12

Status: accepted

## Supersession Notice

ADR 0017 supersedes this ADR's **Eager Surface Data** direction.

Keep using the **Active Project SQLite Sessions** and runtime database access
guidance below. Do not use this ADR as authority for project-wide eager browser
payloads, `ProjectWithHttp`-style full surface snapshots, or eager
`castAssetsByCastMemberId` loading.

The current Studio loading architecture is:

- open a project with a bounded `ProjectShell`;
- load selected surface resources lazily;
- page large navigation and asset collections with opaque cursors;
- invalidate cached UI resources through scoped
  `studio.projectResourcesChanged` events.

Read `0017-use-scalable-studio-resource-loading.md` before changing Studio
project-open, surface-resource, asset-page, navigation, or refresh behavior.

## Context

Renku Studio is a local application. Opening a project and moving between Studio
surfaces should feel immediate.

The first implementation treated many local interactions like cold web page
loads. For example, switching between cast members could:

- update route state;
- reload project-level data;
- open and close SQLite for each operation;
- run database migration checks from runtime project reads;
- render a loading state while asking for cast assets that could have been
  included in the already-loaded project data;
- trigger coordination polling and activity writes during ordinary pointer and
  keyboard interactions.

This made the app feel remote and sluggish even when everything was running on
the user's machine.

The same problem would repeat as Studio adds richer sequence, scene, clip,
visual-language, and generation surfaces unless the performance model is made
explicit.

## Decision

Studio uses active project sessions for normal project browsing.

This ADR originally also accepted eager surface data. That part is no longer
current architecture. ADR 0017 replaces it with bounded project shell loading,
lazy selected surface resources, paginated asset/navigation resources, and
scoped resource invalidation.

### Runtime Database Access

Runtime project reads must not run schema migrations.

Migrations are a development-time setup operation. They may be invoked
explicitly by project creation or developer migration commands, but request
handlers and user navigation must not spawn Drizzle Kit, run `pnpm`, or perform
schema migration work.

When runtime code opens a project database, it should:

- open the SQLite database;
- enable required pragmas such as foreign keys;
- validate that the expected Studio schema exists;
- fail fast with a structured project data error when the database is invalid.

### Active Project SQLite Sessions

The selected project keeps a project-lifetime SQLite session open for the
duration of the active Studio process.

Project-scoped operations should reuse that session, including:

- project reads;
- project information updates;
- asset registration and asset listing;
- asset select and unselect operations;
- Markdown asset reads and writes;
- production export reads.

Project library scans are different. The library can touch many project
databases, so library reads should use short-lived operation sessions and should
not keep every discovered project open.

If Studio later needs to release an active project handle, it should do so
through an explicit project-session owner operation. Call-site cleanup blocks
inside ordinary project operations should not close the active project database.

### Eager Surface Data

This section is superseded by ADR 0017. It is retained only as historical
context for the performance problem ADR 0016 was trying to solve.

Project reads should include the lightweight metadata needed to render normal
first-level Studio surfaces immediately.

For cast, the project response includes cast asset metadata grouped by cast
member. A cast panel receives those assets as initial state, so selecting a cast
member can render immediately:

- assets render immediately when assets exist;
- the empty state renders immediately when the cast member has no assets;
- a loading spinner is reserved for genuinely unknown data, not for known empty
  arrays.

This pattern should be reused for sequences, scenes, clips, visual language, and
other project surfaces. If the user can navigate to the surface from the project
shell, the project payload should include enough lightweight data to draw that
surface without a blocking fetch.

Large binary files are not included in the project JSON. Project JSON may include
asset and file metadata plus stable file URLs. Image, audio, and video bytes stay
behind file-serving endpoints and browser caching.

### Background Refresh

This section's `project.castAssetsByCastMemberId` example is historical. Current
code should render from resource cache entries and refresh visible stale
resources after `studio.projectResourcesChanged`, as described in ADR 0017.

Surface-specific refreshes may still happen after render, but they must be
silent when the project payload already supplied a known initial state.

For example:

1. Render the cast panel from `project.castAssetsByCastMemberId`.
2. Refresh that cast member's assets in the background.
3. Update the panel only if fresh data differs.

Do not replace already-rendered local data with a loading message during a
background refresh.

### Routing And Navigation

Changing selection inside the same project must not reload the whole project
shell.

URL-owned routes are still the source of shareable Studio location, but
same-project navigation should update selection state and preserve the mounted
Studio frame. Full project loading UI is only appropriate when the selected
project itself is unknown or changing.

### Coordination Events

Studio coordination is supporting infrastructure. It must not compete with the
main local interaction path.

Coordination polling and activity reporting should be throttled enough that
normal clicking, typing, and panel switching are not coupled to coordination I/O.
Pointer and keyboard events should not trigger coordination writes as part of
ordinary surface navigation.

## Consequences

- Local navigation should feel like moving through an already-open project, not
  like loading independent web pages.
- New surfaces should distinguish "unknown" from "known empty" data. Known empty
  data renders an empty state, not a spinner.
- This ADR's earlier claim that backend APIs may return broad denormalized,
  surface-ready project metadata is superseded. Current backend APIs should use
  bounded shell/resources and pagination per ADR 0017.
- Core remains responsible for validating project data and asset relationships,
  but routine reads reuse the active project database handle.
- Runtime code must not hide invalid schema state by running migrations.
  Invalid databases fail fast and are repaired through explicit migration or
  development setup flows.
- Coordination event features must be designed as low-priority background work,
  not as part of the critical render path.
