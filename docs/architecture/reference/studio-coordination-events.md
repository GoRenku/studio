# Renku Studio Coordination Events

Date: 2026-05-06

Status: current

Role: reference

## Purpose

Renku Studio needs local coordination between three interfaces:

- the browser Studio UI;
- the `renku` CLI used by people and AI agents;
- the shared project data services in `@gorenku/studio-core`.

Decision history:

- `../../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `../../decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
- `../../decisions/0008-use-url-owned-studio-routes.md`

The main v1 workflow is agent-assisted editing. An agent should be able to run
CLI commands that mutate project data, and a running Studio UI should react by
refreshing its data and moving focus to the relevant screen.

Example:

```bash
renku info set --title "The Siege" --logline "A young sultan gambles his empire on an impossible city."
```

After that command succeeds, a running Studio UI should:

1. read the changed project data;
2. switch to the Project Information screen;
3. show the new title and logline.

The reverse direction is also required. An agent needs a reliable command for
asking what the user is currently looking at:

```bash
renku studio current --json
```

That command should return the current Studio focus and enough domain context
for the agent to act on the same subject as the user.

## Current Contract

Use a local append-only Studio coordination event store as the source of truth
for Studio focus, Studio navigation requests, and UI-facing coordination.

The event store is the only durable source for meaningful Studio coordination
state. Do not add separate focus files, current-screen files, selected-project
files, or other duplicated state that must later be reconciled with the event
store.

Project SQLite databases remain the source of truth for durable project data.
The coordination event store does not replace project databases and must not
become a shadow project-data store.

The accepted decision is recorded in
`docs/decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`.

The boundary is:

```text
project SQLite
  -> durable project metadata and relationships

Studio coordination event store
  -> current Studio focus, focus requests, project refresh requests,
     UI-applied focus observations, and agent-readable session context
```

The coordination projection must not collapse distinct concepts into one
ambiguous "current" value. It must be able to distinguish:

- the latest focus observed from a live running Studio browser session;
- the latest non-stale pending focus request;
- focus requests that failed or were rejected.

The event store may contain historical focus observations, but
`renku studio current --json` must not treat old observations as actionable
current UI state when Studio is not running. If no live Studio session can report
what the user is looking at, the command should return `selection: null` and
`context: null` so agents ask the user for the missing target instead of
guessing.

## UI Coordination Boundary Rules

This event store is for local Studio UI coordination only. It is not a project
event log.

To keep that boundary from regressing:

- event types in this store should use the `studio.` namespace;
- event names should describe UI coordination facts or requests, such as
  `studio.focusRequested`, `studio.focusChanged`, and
  `studio.projectRefreshRequested`;
- do not add `project.*`, `cast.*`, `clip.*`, or other domain-event namespaces to
  this store;
- do not use this event store to rebuild project metadata, generation history,
  pins, bindings, costs, assets, or relationships;
- do not store before/after project values in coordination events;
- project data services must not consume this event store as an input to domain
  reads or writes;
- adding a new event type must include a short explanation of why it is UI
  coordination state rather than durable project state.

Tests should reinforce this boundary:

- coordination projections should be computable without treating event payloads
  as project records;
- project data reads should still come from project SQLite;
- malformed coordination events should not corrupt or modify project data;
- CLI commands that mutate SQLite and append coordination events should have
  tests for partial event-append failure so the durable mutation and UI refresh
  request are not confused.

## Why An Event Store

The coordination system must support both directions:

- CLI and agents can request UI changes after data mutations.
- Studio can record the focus the user actually reached.

An append-only event store keeps those facts honest.

All events in this store are UI coordination events. They may mention that
project data should be refreshed because a command already changed SQLite, but
they are not project-history events and must not be used as the durable record of
what changed. Durable project metadata, relationships, generation records, pins,
and other project facts belong in project SQLite or project-owned files.

For example, a CLI command can request focus:

```json
{
  "type": "studio.focusRequested",
  "projectRef": {
    "name": "constantinople",
    "id": "project_01HT...",
    "storageRoot": "/Users/me/Movies/renku"
  },
  "focus": {
    "screen": "movieStudio",
    "selection": { "type": "projectInformation" }
  }
}
```

But that does not mean the UI actually moved. The running Studio UI records the
applied result separately:

```json
{
  "type": "studio.focusChanged",
  "projectRef": {
    "name": "constantinople",
    "id": "project_01HT...",
    "storageRoot": "/Users/me/Movies/renku"
  },
  "focus": {
    "screen": "movieStudio",
    "selection": { "type": "projectInformation" }
  },
  "appliedRequestId": "studio_event_01HU..."
}
```

This distinction matters because `renku studio current --json` should report the
latest applied focus from a live active Studio session, not only the latest
requested focus.

When a focus change was caused by a focus request, the `studio.focusChanged`
event must reference the request it applied. A focus observation caused by direct
user navigation may omit that reference.

## Non-Goals

This architecture does not introduce:

- a compatibility layer for old command names;
- a remote collaboration protocol;
- multi-user conflict resolution;
- browser access to local files;
- long-term project history;
- a replacement for project SQLite;
- a full event-sourced project data model.

Renku Studio is local pre-customer software. If command names or event contracts
need to change while the product is still being shaped, update callers directly.
Do not keep aliases or shims for obsolete event names.

## Location

The event store lives under the Renku config directory:

```text
~/.config/renku/studio-events.jsonl
```

Each line is one JSON event.

The event store path should be owned by `@gorenku/studio-core/server` so the CLI,
Studio server, and tests use one implementation.

The global config remains:

```text
~/.config/renku/config.yaml
```

Do not put Studio focus or current UI selection inside `config.yaml`.

## Runtime Locking

Renku Studio should allow one and only one local Studio server at a time.

This singleton rule is operational, not a source of coordination truth. A lock
or runtime descriptor may exist to prevent duplicate servers, but it must not
store current project, current selection, or current focus.

Allowed operational state:

- process id;
- host;
- port;
- server URL;
- started timestamp;
- heartbeat timestamp.

Forbidden semantic state in runtime files:

- selected project;
- selected screen;
- selected cast member, sequence, scene, or clip;
- pending focus request;
- current project information.

The meaningful state is derived from `studio-events.jsonl`.

The singleton server rule does not imply one visible Studio UI. Multiple browser
tabs or windows may connect to the same local server. Any browser instance that
can report applied focus must have a browser session identity so the projection
can distinguish "the server is running" from "this specific UI session is the
current one."

For v1, each browser Studio instance should generate a `browserSessionId` for
the lifetime of that tab or window and include it when reporting focus
observations. The local server may also expose a `serverInstanceId` from its
operational runtime descriptor. These identifiers are local coordination
identifiers only; they are not durable project IDs.

`renku studio current --json` should use the most recently active live browser
session. Studio can make that reliable enough for local coordination by emitting
activity observations when a tab receives focus, becomes visible, or receives
direct user input such as pointer or keyboard activity. The server-side
projection should ignore browser sessions whose heartbeat has expired.

This is not a hard guarantee that the OS user is visually looking at that exact
pixel at the moment the command runs. It is a local product rule: the best
available current Studio target is the live browser session with the newest
trusted activity observation. If there is no non-stale live browser session,
`renku studio current --json` returns no actionable selection.

## Layering

The first implementation should use this layering:

```text
renku CLI
  -> @gorenku/studio-core/server project services
    -> project SQLite
  -> @gorenku/studio-core/server coordination services
    -> studio-events.jsonl

browser Studio UI
  -> Studio server HTTP adapter
    -> @gorenku/studio-core/server project services
      -> project SQLite
    -> @gorenku/studio-core/server coordination services
      -> studio-events.jsonl
```

The CLI should mutate project data through core services directly. It should not
call Studio server endpoints for domain mutations.

The Studio server remains a thin adapter:

- validate and parse HTTP requests;
- call core services;
- serialize project responses and structured errors;
- expose coordination events to the browser;
- append UI observation events when the browser reports applied focus.

The Studio server must not own project mutation rules or duplicate data-layer
logic.

## Coordination Service

The node-only coordination service in `@gorenku/studio-core/server` exposes this
current public shape:

```ts
export interface StudioCoordinationService {
  appendStudioEvent(input: AppendStudioEventInput): Promise<StudioEvent>;
  readStudioEvents(input?: ReadStudioEventsInput): Promise<StudioEventReadResult>;
  readStudioCurrent(): Promise<StudioCurrent>;
}
```

Callers should not write JSONL lines by hand.

The service owns:

- event id generation;
- event timestamps;
- append-order cursor generation or cursor calculation;
- schema validation;
- atomic append behavior;
- event reading;
- projection of current focus;
- projection of pending focus requests;
- request/application correlation;
- failed or rejected focus request projection;
- live browser-session activity projection;
- enrichment of current context from project data where appropriate.

Use structured diagnostics for invalid event records, unreadable stores, and
unsupported selection values at package boundaries.

Suggested code prefixes:

- `STUDIO_COORDINATION001...` for event store, projection, and runtime
  coordination failures;
- existing `CLI001...` for CLI argument failures;
- existing `STUDIO_SERVER001...` for HTTP adapter failures.

## Event Envelope

Every event uses a common envelope.

```ts
export interface StudioEventBase {
  id: string;
  version: '0.1.0';
  createdAt: string;
  type: StudioEventType;
  source: StudioEventSource;
  operationId?: string;
}

export type StudioEventSource =
  | { kind: 'cli'; command: string }
  | {
      kind: 'studio';
      serverInstanceId?: string;
      browserSessionId?: string;
    }
  | { kind: 'agent'; name?: string };
```

The event id should be stable and unique enough for local processing. It does
not need to be meaningful to users.

`createdAt` is an ISO timestamp.

`operationId` groups events produced by the same user, CLI, or agent operation.
For example, a successful `renku info set` should use one operation id for the
SQLite mutation result event and the related Studio focus request. It is for
diagnostics and projection clarity; it is not a transaction guarantee.

The event store is append-only. Do not update old events to acknowledge,
consume, or correct them. Append a new event for any new fact.

### Event Ordering And Cursors

Event ids are identities, not ordering guarantees.

The coordination service must expose an append-order cursor for event reads and
browser polling. V1 uses a byte-offset cursor owned by the JSONL reader.

Do not sort by `createdAt` or by random event id. Wall clocks can move backward,
and event ids may not be lexicographically meaningful.

Whichever cursor strategy is chosen must be used consistently by:

- `readStudioEvents`;
- the browser polling route;
- `readStudioCurrent`;
- tests that simulate concurrent appends.

### Project References

Events that target a project must carry a project reference, not only a project
name.

```ts
export interface StudioProjectRef {
  name: string;
  id: string;
  storageRoot: string;
}
```

`name` is the human-facing project folder name used by CLI flags.
`id` is the durable project id from project SQLite.
`storageRoot` identifies which configured project library the event was written
for.

This avoids ambiguous global events when a project is deleted and recreated with
the same name, or when a user changes their configured storage root. Projection
must verify that a project reference still resolves to the same project before
enriching current context from project data. If the reference cannot be
resolved, report a structured diagnostic and do not pretend the focus was
successfully applied to the new or wrong project.

## Initial Event Types

The first event set should stay small and focused.

### `studio.projectRefreshRequested`

ADR 0017 adds scoped resource invalidation for Studio UI resource caches. New
resource-aware project mutations should prefer
`studio.projectResourcesChanged` with deterministic resource keys. Keep
`studio.projectRefreshRequested` for the narrower project information and
project library refresh behavior that already exists.

Written after a successful project mutation when Studio should refresh its
project-facing UI data.

This event is a UI refresh request. It is not a durable project history event.
The authoritative mutation already happened in project SQLite before this event
is appended.

```ts
export interface StudioProjectRefreshRequestedEvent extends StudioEventBase {
  type: 'studio.projectRefreshRequested';
  projectRef: StudioProjectRef;
  surface: StudioProjectRefreshSurface;
  changedFields?: ProjectInformationRefreshField[];
}

export type StudioProjectRefreshSurface =
  | 'projectInformation'
  | 'projectLibrary';

export type ProjectInformationRefreshField =
  | 'title'
  | 'aspectRatio'
  | 'logline'
  | 'summary'
  | 'languages';
```

Example:

```json
{
  "id": "studio_event_01HT...",
  "version": "0.1.0",
  "createdAt": "2026-05-06T10:31:02.000Z",
  "type": "studio.projectRefreshRequested",
  "projectRef": {
    "name": "constantinople",
    "id": "project_01HT...",
    "storageRoot": "/Users/me/Movies/renku"
  },
  "surface": "projectInformation",
  "changedFields": ["title", "logline"],
  "source": {
    "kind": "cli",
    "command": "renku info set"
  }
}
```

`changedFields` is an optimization hint for UI refresh and display decisions. It
must not be treated as the durable audit record of the mutation.

### `studio.projectResourcesChanged`

Written after a successful project SQLite mutation when Studio should invalidate
specific browser-side UI resources and refresh visible matching resources.

This event is a UI coordination signal only. It is not a durable domain event
and must not store before/after project data. If the same operation should also
move the UI, append a separate `studio.focusRequested` event with the same
`operationId`.

```ts
export interface StudioProjectResourcesChangedEvent extends StudioEventBase {
  type: 'studio.projectResourcesChanged';
  projectRef: StudioProjectRef;
  resourceKeys: string[];
}
```

Resource keys are owned by the Studio coordination boundary, not assembled ad
hoc in feature components. Current examples include:

- `project-shell`;
- `project-information`;
- `navigation:cast`;
- `surface:cast-design:<castMemberId>`;
- `surface:clip-design:<clipId>`;
- `assets:castMember:<castMemberId>`;
- `assets:clip:<clipId>`;
- `markdown:<assetId>:<assetFileId>`.

Use ADR 0017 for the authoritative project shell, lazy resource loading,
pagination, and scoped invalidation rules.

### `studio.focusRequested`

Written when a CLI command, agent, or other integration asks Studio to show a
specific screen or selected subject.

```ts
export interface StudioFocusRequestedEvent extends StudioEventBase {
  type: 'studio.focusRequested';
  projectRef?: StudioProjectRef;
  focus: StudioFocusRequest;
  refresh?: StudioRefreshRequest;
}

export type StudioFocusRequest =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: StudioSelection };

export interface StudioRefreshRequest {
  project?: boolean;
  library?: boolean;
}
```

Example:

```json
{
  "id": "studio_event_01HU...",
  "version": "0.1.0",
  "createdAt": "2026-05-06T10:31:02.050Z",
  "type": "studio.focusRequested",
  "projectRef": {
    "name": "constantinople",
    "id": "project_01HT...",
    "storageRoot": "/Users/me/Movies/renku"
  },
  "focus": {
    "screen": "movieStudio",
    "selection": { "type": "projectInformation" }
  },
  "refresh": {
    "project": true
  },
  "source": {
    "kind": "cli",
    "command": "renku info set"
  }
}
```

### `studio.focusChanged`

Written after Studio applies focus.

This is the source event for the current Studio focus projection.

```ts
export interface StudioFocusChangedEvent extends StudioEventBase {
  type: 'studio.focusChanged';
  projectRef?: StudioProjectRef;
  focus: StudioFocus;
  appliedRequestId?: string;
}

export type StudioFocus =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: StudioSelection };
```

Example:

```json
{
  "id": "studio_event_01HV...",
  "version": "0.1.0",
  "createdAt": "2026-05-06T10:31:03.000Z",
  "type": "studio.focusChanged",
  "projectRef": {
    "name": "constantinople",
    "id": "project_01HT...",
    "storageRoot": "/Users/me/Movies/renku"
  },
  "focus": {
    "screen": "movieStudio",
    "selection": { "type": "projectInformation" }
  },
  "appliedRequestId": "studio_event_01HU...",
  "source": {
    "kind": "studio",
    "serverInstanceId": "studio_server_01HW...",
    "browserSessionId": "studio_browser_01HX..."
  }
}
```

### `studio.focusRequestFailed`

Written when Studio receives a focus request but cannot apply it.

This keeps unresolved requests from sitting as ambiguous pending work until the
TTL expires, and it gives agents a direct explanation.

```ts
export interface StudioFocusRequestFailedEvent extends StudioEventBase {
  type: 'studio.focusRequestFailed';
  requestEventId: string;
  reason:
    | 'projectNotFound'
    | 'projectRefMismatch'
    | 'selectionNotFound'
    | 'unsupportedSelection';
  diagnostics: DiagnosticIssue[];
}
```

Example:

```json
{
  "id": "studio_event_01HY...",
  "version": "0.1.0",
  "createdAt": "2026-05-06T10:31:04.000Z",
  "type": "studio.focusRequestFailed",
  "requestEventId": "studio_event_01HU...",
  "reason": "selectionNotFound",
  "diagnostics": [
    {
      "code": "STUDIO_COORDINATION010",
      "severity": "error",
      "message": "Clip clip_missing was not found in project constantinople.",
      "location": {
        "path": ["focus", "selection", "id"],
        "context": "studio focus request"
      },
      "suggestion": "Refresh current Studio context before targeting a clip."
    }
  ],
  "source": {
    "kind": "studio",
    "serverInstanceId": "studio_server_01HW...",
    "browserSessionId": "studio_browser_01HX..."
  }
}
```

### `studio.browserSessionActive`

Written by Studio when a browser tab becomes the most recently active Studio UI
session.

This event supports the "most recently active tab" rule for
`renku studio current --json`. Studio should emit it when a tab becomes visible,
receives focus, or receives direct user input. The browser should debounce these
events so ordinary pointer movement or typing does not flood the coordination
store.

```ts
export interface StudioBrowserSessionActiveEvent extends StudioEventBase {
  type: 'studio.browserSessionActive';
  browserSessionId: string;
}
```

Example:

```json
{
  "id": "studio_event_01HZ...",
  "version": "0.1.0",
  "createdAt": "2026-05-06T10:31:05.000Z",
  "type": "studio.browserSessionActive",
  "browserSessionId": "studio_browser_01HX...",
  "source": {
    "kind": "studio",
    "serverInstanceId": "studio_server_01HW...",
    "browserSessionId": "studio_browser_01HX..."
  }
}
```

## Movie Studio Selection

The v1 selection contract should match the current browser selection model.

```ts
export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };
```

Scene selections open the current scene design surface. Clip selections are not
part of the active movie-only Studio contract.

Selection is ephemeral UI state. Do not store it in the project database unless
a future product decision deliberately turns a particular selection into a
durable project relationship.

Use the data-model vocabulary:

- use **Cast Member** for a durable project subject;
- use **selection** for the current UI target;
- use **focus** for the full screen/selection location Studio should show.

## Project Information CLI Flow

`renku info` becomes the project information command namespace.

The existing package metadata command should move to:

```bash
renku about
```

No compatibility alias is required.

### Show

```bash
renku info show [--project <project-name>] [--json]
```

Reads project information from project SQLite through
`@gorenku/studio-core/server`.

It may append a focus request if the command is intended to navigate the UI.
For v1, read-only `show` should not move focus unless a future flag explicitly
asks for that.

### Set Scalar Fields

```bash
renku info set [--project <project-name>] \
  [--title <title>] \
  [--aspect-ratio <ratio>] \
  [--logline <text>] \
  [--summary <text>] \
  [--json]
```

This command supports partial updates. It must not require callers to provide
the full project information object.

After success, append:

1. `studio.projectRefreshRequested` for Project Information;
2. `studio.focusRequested` for Project Information with `refresh.project = true`.

The command should print a clear human success message to stdout by default and
machine-readable JSON to stdout when `--json` is passed.

### Clear Optional Fields

```bash
renku info clear [--project <project-name>] \
  [--aspect-ratio] \
  [--logline] \
  [--summary] \
  [--json]
```

Clearing optional fields is explicit. Empty strings in `renku info set` should
not be the primary clearing mechanism because shell quoting and agent behavior
can make that ambiguous.

After success, append the same events as `set`.

### Language Commands

Project information CLI must have parity with the Studio UI, including language
editing.

```bash
renku info language add <locale-tag> \
  [--project <project-name>] \
  [--display-name <name>] \
  [--base] \
  [--audio] \
  [--subtitles] \
  [--json]

renku info language update <locale-tag> \
  [--project <project-name>] \
  [--display-name <name>] \
  [--base] \
  [--audio | --no-audio] \
  [--subtitles | --no-subtitles] \
  [--json]

renku info language remove <locale-tag> \
  [--project <project-name>] \
  [--json]

renku info language set-base <locale-tag> \
  [--project <project-name>] \
  [--json]
```

Language updates are partial at the command level, but core validates the final
project information state.

For example:

- removing the only base language fails;
- setting a language as base clears the previous base language in the same
  operation;
- adding a duplicate locale tag fails;
- unsupported locale tags fail with structured diagnostics;
- final state must contain exactly one base language.

Default behavior for `language add`:

- `isBase` defaults to `false` unless `--base` is passed;
- `supportsAudio` defaults to `true`;
- `supportsSubtitles` defaults to `true`;
- `displayName` is optional.

These defaults should be described in command help.

## Partial Update Contract

The core project data service should support partial project information
updates directly.

Do not force CLI or server callers to construct a full editable information
object before calling core.

Suggested shape:

```ts
export interface ProjectInformationPatch {
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  summary?: string | null;
  languages?: ProjectLanguagePatchOperation[];
}
```

Core owns the merge:

1. read current project information;
2. apply the patch;
3. validate the final complete state;
4. write the final complete state transactionally;
5. return the updated project.

This keeps behavior consistent across CLI and Studio HTTP routes.

Studio UI may continue sending full form values. The server adapter can convert
the full form request into a patch, or core can accept both a full replacement
and patch shape if the distinction is explicit in names.

Do not add fallback branches for obsolete request shapes.

## Default Project Resolution

Most v1 use will involve one active project at a time. Commands should work
well in that common case while still failing clearly when state is ambiguous.

Project-mutating commands should accept:

```bash
--project <project-name>
```

When omitted, the CLI resolves the current project from the Studio coordination
event projection.

Resolution order:

1. explicit `--project`;
2. latest applied `studio.focusChanged` with a valid `projectRef` from the most
   recently active live browser session;
3. fail with a structured CLI error.

Do not silently choose a project by scanning the storage root or by using a
historical focus observation from a stopped Studio session. If no live current
project is known, say what the caller should do.

Example failure:

```text
[CLI###] No current project is selected.
Suggestion: Run `renku project select <project-name>` or pass `--project <project-name>`.
```

## Project Selection Commands

Add project session commands:

```bash
renku project current [--json]
renku project select <project-name> [--json]
```

`renku project select <project-name>` should:

1. validate that the project exists through core project data services;
2. append a `studio.focusRequested` event for Movie Studio;
3. use the default selection `{ type: 'storyboard' }`;
4. request project and library refreshes.

If Studio is running, it should switch to that project.

If Studio is not running, the event remains in the store but is only a request.
`renku studio current --json` should return no actionable current selection, but
may show the non-stale pending request separately.

## Current Studio Command

Add:

```bash
renku studio current --json
```

This command reads the event store projection and enriches the result with
project data where appropriate.

It should be useful for an agent that needs to understand what the user is
currently looking at.

The actionable current focus is the latest focus from the most recently active
live browser session. Studio can approximate this reliably enough for local
coordination by recording trusted browser activity observations, but it should
still treat expired sessions as not current.

When Studio is not running, the user is not actively using Studio and Renku
cannot know what the user is looking at. In that state,
`renku studio current --json` must return `project: null`, `selection: null`,
and `context: null`, even if the event log contains an older focus observation.
This keeps agent commands from guessing a target such as a cast member, clip, or
character sheet.

The projection should therefore expose these concepts separately:

- live focus from the most recently active browser session;
- latest non-stale pending request;
- latest request failure when it is useful for agents.

The coordination service may keep last-known focus as an internal projection or
debug field, but it must not use that historical value as actionable current
context after Studio stops.

Context enrichment is intentionally product-evolutionary. Different agent
features may need different context depth. The stable contract is the selection
discriminant and nullable top-level fields; each selection-specific `context`
shape may grow as the product learns what agents need.

Example for Project Information:

```json
{
  "studio": {
    "running": true
  },
  "project": {
    "name": "constantinople",
    "id": "project_01HT...",
    "title": "Fall of Constantinople"
  },
  "selection": {
    "type": "projectInformation"
  },
  "context": {
    "kind": "projectInformation",
    "title": "Fall of Constantinople",
    "aspectRatio": "16:9",
    "logline": "A young sultan gambles his empire on an impossible city.",
    "summary": "..."
  },
  "pendingRequest": null
}
```

Example for a cast member:

```json
{
  "studio": {
    "running": true
  },
  "project": {
    "name": "constantinople",
    "id": "project_01HT...",
    "title": "Fall of Constantinople"
  },
  "selection": {
    "type": "cast",
    "id": "cast_mehmed"
  },
  "context": {
    "kind": "castMember",
    "id": "cast_mehmed",
    "name": "Mehmed II",
    "role": "Sultan",
    "shortDescription": "Young conqueror of Constantinople."
  },
  "pendingRequest": null
}
```

Example when Studio is not running but a focus request is pending:

```json
{
  "studio": {
    "running": false
  },
  "project": null,
  "selection": null,
  "context": null,
  "pendingRequest": {
    "projectRef": {
      "name": "constantinople",
      "id": "project_01HT...",
      "storageRoot": "/Users/me/Movies/renku"
    },
    "focus": {
      "screen": "movieStudio",
      "selection": { "type": "projectInformation" }
    }
  }
}
```

The JSON shape may grow as more Studio surfaces are added, but existing top-level
fields and selection discriminants should remain stable once implemented. Agents
should be able to rely on nullable fields being present even when their value is
`null`.

## Studio Event Delivery

The browser cannot read local files directly. The Studio server should expose
coordination events to the browser through a thin HTTP adapter.

The first implementation can use polling:

```text
browser
  -> GET /studio-api/studio/events?after=<cursor>
  -> server reads studio-events.jsonl through core coordination service
  -> browser applies new events
```

Polling is acceptable for v1 because focus changes do not require sub-second
delivery. The route contract should leave room for later Server-Sent Events
without changing CLI commands or event shapes.

Possible future route:

```text
GET /studio-api/studio/events/stream
```

Do not make the CLI depend on these HTTP routes for domain mutation.

### Local HTTP Trust Boundary

The Studio event routes are local, but they are still HTTP routes. A random web
page open in the user's browser must not be able to drive Studio coordination by
issuing requests to `127.0.0.1`.

The local trust mechanism is:

- generate a per-server runtime token and keep it in server memory;
- expose that token only to the served Studio app through same-origin bootstrap
  data;
- require the token on mutating Studio API routes, including routes that report
  `studio.focusChanged` or `studio.focusRequestFailed`;
- reject unexpected `Origin` headers on mutating routes;
- keep `GET` routes non-mutating.

## Applying Events In The Browser

The browser Studio app should process `studio.focusRequested` events.

When receiving a focus request:

1. If the focus request targets `projectLibrary`, route the browser to `/`.
2. If the focus request targets `movieStudio` and has a non-stale `projectRef`,
   route the browser to `/projects/:projectName` when that project is not
   already open.
3. Load the project through `GET /studio-api/projects/:projectName`; do not use
   a hidden current-project endpoint or project-selection endpoint.
4. If the loaded project does not match `projectRef`, report
   `studio.focusRequestFailed` with `projectRefMismatch`.
5. If `refresh.project` is true, read the latest project data for the already
   open project.
6. If `refresh.library` is true and the project library is visible or needed,
   refresh the library.
7. Apply the requested focus inside the already-open screen.
8. Append or report a `studio.focusChanged` event with `appliedRequestId`.
9. If the focus cannot be applied, append or report a
   `studio.focusRequestFailed` event.

Browser route ownership is recorded in
`docs/decisions/0008-use-url-owned-studio-routes.md`. Coordination events may
drive Studio navigation, but they must do it through canonical browser routes,
not through hidden current-project state.

For `renku info set`, this produces:

```text
CLI updates SQLite.
CLI appends studio.projectRefreshRequested.
CLI appends studio.focusRequested.
Browser receives focus request.
Browser refreshes the project.
Browser selects Project Information.
Browser records studio.focusChanged.
```

If a user manually changes Studio selection in the UI, Studio should also append
`studio.focusChanged`. This makes `renku studio current --json` useful even when
the latest focus was created by direct UI interaction rather than a CLI command.

## Pending Requests

A pending focus request is a `studio.focusRequested` event that has not been
followed by either:

- a `studio.focusChanged` event with `appliedRequestId` equal to the request id;
- a `studio.focusRequestFailed` event with `requestEventId` equal to the request
  id.

The projection should expose the latest pending request separately from the
latest applied live focus.

Do not overwrite or delete pending requests. If a newer request supersedes an
older one, the projection can report only the newest relevant pending request.
Older unresolved focus requests are historical events, not still-actionable UI
intent. A later `studio.focusRequested` event supersedes earlier focus requests
even when those earlier requests were never acknowledged.

Stale focus requests should not force surprising UI jumps long after they were
created.

Recommended v1 behavior:

- treat only the newest `studio.focusRequested` event as eligible to become the
  current pending request;
- when the browser receives a polling batch with multiple focus requests, apply
  only the newest focus request in that batch;
- ignore pending focus requests older than five minutes when Studio starts or
  resumes polling;
- keep old events in the log;
- make the staleness rule part of the coordination service projection so the CLI,
  Studio server, and browser agree.

The TTL is a UI-application rule. It does not require deleting events.

Stale requests are never actionable current intent. Whether
`renku studio current --json` should also expose stale-request warnings for agent
explanation is tracked in the active implementation plan.

## Concurrency

Multiple agents or commands may update the same project close together.

V1 does not need complex conflict resolution. It does need to avoid corrupting
project data or coordination events.

Rules:

- project mutations must be short SQLite transactions;
- event appends must be atomic;
- multi-event CLI operations should use one `operationId`;
- final project validation happens after applying each patch;
- last writer wins for ordinary scalar field conflicts;
- the latest applied `studio.focusChanged` is actionable current focus only when
  it belongs to the most recently active live browser session;
- newer focus requests may supersede older pending requests in projections.

This is enough for local agent-assisted v1 workflows.

SQLite mutations and coordination event appends are not one database
transaction. The implementation must define partial failure behavior before
shipping CLI mutations that also append events.

Minimum v1 behavior:

- if project validation fails, append no coordination event;
- if the SQLite mutation fails, append no success event;
- if the SQLite mutation succeeds but event append fails, report a structured
  error or warning that says the SQLite mutation committed but Studio may not
  refresh automatically;
- if one event in a multi-event operation appends and the next append fails, the
  command reports the partial coordination failure with the shared `operationId`.

If a later product requirement needs stricter conflict detection, add explicit
version or compare-and-set behavior then. Do not add speculative locking around
every field now.

## File Growth And Retention

The event store is append-only, but local coordination events are not permanent
project history.

Retaining all events is acceptable while the event volume is tiny. Once needed,
add a documented compaction command or retention policy that preserves the latest
projection-relevant events.

Do not implement ad hoc truncation that can break `renku studio current`.

A future compaction event or snapshot should still be represented through the
coordination service, not by callers manually rewriting the log.

Any compaction design must preserve enough information to recompute:

- non-actionable last-known focus, if retained for diagnostics or debugging;
- the active browser-session focus records needed by the most-recently-active
  current policy;
- latest non-stale pending request;
- latest request failure relevant to agent feedback;
- delivery cursors or enough cursor state for browsers to recover cleanly.

## Validation And Failure Behavior

The coordination system should fail fast with structured errors.

Examples:

- invalid JSONL event line;
- unsupported event version;
- unsupported focus screen;
- missing project for a Movie Studio focus request that requires a project;
- selection id that cannot be resolved when enriching current context;
- event store path cannot be created or appended.

When reading projections, invalid historical events should be reported through a
structured diagnostic result.

Recommended v1 behavior:

- appending an invalid event fails fast;
- reading a malformed historical JSONL line records a structured warning and
  skips that line;
- unsupported current-version event shapes are structured warnings and skipped;
- unsupported future event versions are structured warnings and skipped unless a
  future compatibility decision says otherwise;
- projection should continue to later valid events whenever possible, because the
  coordination store is not the durable project data source.

This behavior must be tested. A single malformed historical line should not make
`renku studio current --json` permanently unusable.

For CLI JSON output:

- success writes result JSON to stdout;
- structured errors write diagnostic JSON to stderr;
- stdout remains empty on failure.
