# 0008 Use URL-Owned Studio Routes

Date: 2026-05-12

Status: accepted

## Context

Renku Studio has browser navigation, local project data, and local Studio
coordination events. Those three concerns are easy to blur.

The bug that motivated this decision was a route ownership bug:

- opening Studio at `/` could immediately end up at a project screen;
- returning home could briefly work, then a coordination poll or current-project
  read could route back to the project;
- changing one side of the behavior caused the opposite failure, where Studio
  stayed on the library and could no longer navigate to a project.

The root problem was not a missing condition. It was that multiple mechanisms
were allowed to decide which screen the browser owned:

- the browser URL;
- a server-side "current project" read;
- a project selection API;
- coordination focus requests.

That made `/` ambiguous. It could mean "show the project library", or it could
mean "ask the server which project is current and show that project". The user
could not reliably navigate because navigation was being reinterpreted by hidden
state.

This also conflicted with the existing coordination boundary:

- project SQLite owns durable project data;
- Studio coordination events own local UI coordination;
- neither should replace browser navigation state.

## Decision

The browser URL is the source of truth for routable Studio screens.

The current route contract is:

```text
/                         -> project library
/projects/:projectName    -> Movie Studio Project Information
/projects/:projectName/visual-language
                          -> Movie Studio Visual Language
/projects/:projectName/storyboard
                          -> Movie Studio Storyboard
/projects/:projectName/sequences/:sequenceId
                          -> Movie Studio Sequence
/projects/:projectName/scenes/:sceneId
                          -> Movie Studio Scene
/projects/:projectName/clips/:clipId
                          -> Movie Studio Clip
/projects/:projectName/cast
                          -> Movie Studio Cast overview
/projects/:projectName/cast/:castMemberId
                          -> Movie Studio Cast Member
```

When the browser is at `/`, Studio must show the project library. There must
not be a `/studio-api/projects/current` route loader that can reinterpret `/`
as a project screen.

When the browser is at any `/projects/:projectName...` route, Studio must read
that project directly from the project API:

```text
GET /studio-api/projects/:projectName
```

Opening a project from the library is route navigation:

1. push `/projects/:projectName` into browser history;
2. read `GET /studio-api/projects/:projectName`;
3. render Project Information when the route load succeeds.

Returning home is route navigation:

1. push `/` into browser history;
2. clear the active browser project;
3. render and refresh the project library.

The browser Studio app must not use a hidden "selected project" endpoint to
choose its screen. The previous browser flow based on
`POST /studio-api/projects/:projectName/select` is removed.

The browser Studio app must not use `/studio-api/projects/current` as a route
loader, and the projects API should not expose that endpoint. Agent and CLI
current-context reads belong under `/studio-api/studio/events/current`.

## Coordination Boundary

Studio coordination events are allowed to drive the app. That is a core product
feature: the CLI and agents should be able to ask Studio to show the same
project surfaces that a user can open manually.

The boundary is that coordination drives the app by requesting canonical browser
navigation, not by mutating hidden "current project" state.

Rules:

- A `studio.focusRequested` event for `projectLibrary` may route the browser to
  `/`.
- A fresh, non-stale `studio.focusRequested` event for `movieStudio` may route
  the browser to `/projects/:projectName` when it includes a valid `projectRef`.
- After route navigation, Studio must load the project through
  `GET /studio-api/projects/:projectName`, validate the requested focus against
  the loaded project, and then apply the selection.
- If the loaded project does not match `projectRef`, the request must fail with
  a coordination failure such as `projectRefMismatch`.
- Coordination polling must not replay historical applied focus or stale focus
  requests as route navigation when Studio boots.
- Coordination events may request project or library refreshes, but refresh is
  data reloading, not navigation.

This keeps coordination useful for agents without bringing back the hidden
current-project router.

## Pattern For Other Routes

Use the same URL-owned pattern for any Studio screen that is user-navigable,
bookmarkable, reloadable, or externally addressable.

Movie Studio selection is route-owned. Do not keep a browser-local fallback
selection that can reinterpret a project URL after Back, Forward, reload, or a
coordination request.

Future browser routes should follow these rules:

- the route path identifies the durable resource needed to load the screen;
- loading the route reads the resource directly from the API by route identity;
- browser history changes are made only by explicit user navigation or explicit
  route-level navigation commands, including fresh CLI or agent focus requests;
- no route may be inferred from "current" server state, historical coordination
  events, polling, or ambient selection;
- API endpoints provide data and mutations, not browser route ownership.

Do not add those paths just because a React panel exists. Local panel state,
temporary tabs, expanded sidebar groups, open dialogs, hover state, and draft
form state can remain browser-local unless there is a product need for direct
navigation, reload recovery, sharing, or agent-addressable focus.

If a future screen has no durable project identity, choose a route that names
the screen directly and load only the data required by that route. Do not use
the current project as a hidden default.

## Consequences

- `/` is stable and always returns to the project library.
- `/projects/:projectName` is stable and can be loaded directly.
- Back and forward navigation follow browser history instead of server-side
  current-project state.
- The project library can show all projects without accidentally opening the
  last focused project.
- Coordination events can still focus surfaces, and fresh explicit focus
  requests may navigate to their canonical route. Historical events, hidden
  current-project state, and polling replay cannot surprise-navigate the browser
  to another project.
- Tests can assert route behavior by checking `window.location.pathname` and the
  exact project API URLs used during route loading.

## Regression Checks

Keep these checks in tests and code review:

- rendering `/` must not call `/studio-api/projects/current`;
- clicking a project card must navigate to `/projects/:projectName`;
- clicking Home from a project must navigate to `/` and remain on the project
  library;
- direct `/projects/:projectName` loads that project by name;
- direct Movie Studio selection routes load that project by name and render the
  route-selected surface;
- Back and Forward restore the route-selected Movie Studio surface without
  browser-local selection fallback;
- missing sequence, scene, clip, or cast route ids fail clearly instead of
  falling back to another panel;
- project opening must not call a `/select` endpoint;
- first coordination poll must not replay stale or already-applied focus
  requests as navigation;
- a non-stale pending `movieStudio` focus request may open a project through
  `/projects/:projectName`;
- a new `movieStudio` focus request while the browser is on `/` must open the
  canonical selection route for that project, validate the focus, and never call
  `/select`;
- route parsing should be small, explicit, and located at the app/session
  boundary rather than scattered through feature components.

## Non-Goals

This decision does not introduce:

- a full frontend router dependency;
- URL routes for every panel, tab, modal, or accordion;
- compatibility support for the old `/project` route;
- compatibility support for browser project selection through `/select`;
- event-sourced browser navigation;
- a replacement for project SQLite or project API reads.
