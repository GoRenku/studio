# 0058 Studio Server-Owned Coordination Delivery

Status: implemented
Date: 2026-06-11

## Summary

Renku Studio currently treats the local Studio coordination event store as both:

1. the Studio server's internal event persistence mechanism; and
2. a write target for CLI commands after successful durable project mutations.

That second responsibility is the architectural bug.

`studio.projectResourcesChanged` events are live UI refresh hints. They are not
durable domain history. If no Studio server and browser are running, there is no
viewer to notify. On the next Studio launch, the app must hydrate from project
SQLite, not replay old refresh hints from a stale event backlog.

Therefore the CLI should not append resource-refresh coordination events
directly to `~/.config/renku/studio-events.jsonl`.

Instead, live Studio notifications should be server-owned:

```text
CLI / agent command
  -> mutates durable project SQLite through core
  -> if a fresh Studio runtime is running, POSTs a typed notification to Studio
     server
  -> Studio server validates and appends the coordination event
  -> browser receives the event through the existing Studio polling path
```

If Studio is not running, resource-refresh notification is a no-op. The durable
project mutation remains successful, and the next Studio session reads the latest
state from SQLite.

This plan complements plan `0055` and ADR `0030`. Plan `0055` makes resource
keys and browser refresh uniform. This plan fixes the delivery boundary so the
resource-change signal reaches the browser through the running Studio server
instead of relying on every CLI process being able to write the server's event
file.

## Direct Answer To The Design Question

The user concern is correct:

> If Studio is not running, what is the point of filling up an event log?

For `studio.projectResourcesChanged`, there is no point.

Those events only mean:

```text
Some resource currently visible in Studio may be stale; reload it from SQLite.
```

They do not mean:

```text
This Lookbook sheet was imported.
This asset was selected.
This screenplay was revised.
This is an audit trail.
```

The durable facts live in project SQLite and project files. When Studio starts,
it should load the latest project shell and visible resources from SQLite/API
contracts. It should not need old resource-change events to reconstruct that
state.

Keeping direct CLI writes as an offline fallback has bad consequences:

- it grows an event log with refresh hints nobody observed;
- it makes a future Studio session process stale refresh hints for state it
  already loaded from SQLite;
- it keeps the event file as a public cross-process write API;
- it preserves the exact failure mode that caused this bug: project mutation can
  succeed while live notification silently fails;
- it contradicts ADR `0006`, which says the coordination store is not durable
  project history.

The correct fallback for “Studio is not running” is no notification, not a file
append.

The only time a CLI mutation should warn is when Studio appears to be running
from a fresh runtime descriptor, but the CLI cannot deliver the live
notification to that running server. That is an actionable live-update failure.

## User-Visible Problem

Observed failure:

1. `renku media import --purpose lookbook.sheet ...` successfully imported a
   Lookbook sheet into project SQLite.
2. The CLI attempted to append a `studio.projectResourcesChanged` event directly
   to:

   ```text
   /Users/keremk/.config/renku/studio-events.jsonl
   ```

3. The CLI process could mutate the project but could not write that global
   Studio event file from the current execution sandbox.
4. Renku printed `CLI026`:

   ```text
   Project mutation succeeded, but Studio refresh coordination failed.
   ```

5. The open Studio browser did not update until manual refresh.

The durable data path worked. The live UI notification path was too tightly
coupled to direct event-file write permission.

This is a Pri 1 bug because it violates the agent/Studio collaboration contract:
when an agent mutates project state through the CLI while Studio is open, the
open Studio UI must hear about it without forcing the user to refresh.

## Current Architecture

### Durable State

Project data is stored in project-local SQLite and project files:

```text
<project>/.renku/project.sqlite
<project>/visual-language/lookbook/*.png
<project>/generated/media/*.png
...
```

This state is authoritative.

### Coordination State

Studio coordination events are stored in:

```text
~/.config/renku/studio-events.jsonl
```

The browser does not read that file. It polls the Studio server:

```text
browser
  -> GET /studio-events?after=<cursor>
  -> Studio server reads studio-events.jsonl
  -> browser dispatches local refresh/focus behavior
```

### Runtime Descriptor

The running Studio server writes:

```text
~/.config/renku/studio-runtime.json
```

It currently contains:

- server instance id;
- PID;
- host;
- port;
- server URL;
- start timestamp;
- heartbeat timestamp.

That descriptor is how local tools can discover whether Studio appears to be
running.

### Current CLI Write Path

CLI commands currently do this after successful durable mutations:

```text
CLI command
  -> core mutation writes SQLite
  -> packages/cli/src/commands/studio-resource-event-command.ts
  -> createStudioCoordinationService({ homeDir })
  -> appendStudioEvent(...)
  -> direct append to ~/.config/renku/studio-events.jsonl
```

That makes the CLI a direct writer to the server's coordination store.

## Architectural Decision Required

Create a new ADR before implementation.

Suggested next decision:

```text
docs/decisions/0031-use-studio-server-owned-coordination-delivery.md
```

Suggested title:

```text
Use Studio Server-Owned Coordination Delivery
```

The ADR should state:

- project SQLite remains the source of truth for durable state;
- `studio.projectResourcesChanged` events are live UI invalidation hints, not
  durable project history;
- the running Studio server owns appending live coordination events;
- the CLI must not directly append resource-refresh events to the event store;
- when Studio is not running, resource-refresh notification is skipped;
- when Studio appears to be running and notification fails, CLI reports a
  structured warning;
- direct event-store appending from CLI code is deprecated and should be removed
  for Studio notification events;
- focus/project-refresh requests must be evaluated under the same live-server
  delivery model, because they are also UI coordination rather than durable
  state;
- the server notification endpoint must be local and authenticated, but
  resource notification credentials must not grant durable project mutation
  power.

This ADR should explicitly update the older wording in ADR `0006`, ADR `0017`,
and ADR `0030` that says “CLI appends coordination events.” The corrected
language should be “CLI notifies the running Studio server, and the server
appends coordination events.”

## Target Architecture

### Resource Refresh Delivery

The desired resource-refresh path is:

```text
CLI durable mutation
  -> core returns project identity and resourceKeys
  -> CLI reads fresh Studio runtime descriptor
  -> CLI sends resource-change request to Studio server
  -> Studio server validates request
  -> Studio server appends studio.projectResourcesChanged
  -> browser receives event through existing polling
  -> browser reloads affected resources from Studio APIs backed by SQLite
```

No project data is placed in the event. The event remains a resource
invalidation hint.

### No Offline Resource-Change Backlog

If there is no fresh Studio runtime descriptor, or the descriptor is stale:

```text
CLI durable mutation
  -> core writes SQLite
  -> no Studio notification is attempted
  -> no warning is emitted for normal mutation commands
```

Reason:

- no running Studio browser can observe the event;
- next Studio launch reads SQLite;
- no durable data would be gained by writing the event.

### Running Studio Notification Failure

If the descriptor is fresh but notification fails:

```text
CLI durable mutation
  -> core writes SQLite
  -> CLI attempts HTTP notification
  -> request fails or server rejects it
  -> CLI emits structured warning
```

This should be the new threshold for `CLI026`.

The warning now means:

```text
Studio appeared to be running, but live refresh notification failed.
```

That is more precise than today’s warning, which means:

```text
The CLI could not write the event file.
```

### Studio Server Ownership

The Studio server should be the only process that appends live coordination
events for a running Studio instance.

The JSONL file becomes implementation detail:

```text
Studio server internal persistence
```

not:

```text
general-purpose interprocess write API
```

## Local Trust And Authentication

The existing browser mutation token is not enough for this design because it
lives in server memory and is exposed only to the served browser through
bootstrap data.

CLI notification needs its own local trust path.

### Proposed Token Model

Add a CLI notification token to the Studio runtime descriptor:

```json
{
  "version": "0.1.0",
  "serverInstanceId": "studio_server_...",
  "pid": 12345,
  "host": "127.0.0.1",
  "port": 5173,
  "serverUrl": "http://127.0.0.1:5173",
  "startedAt": "...",
  "heartbeatAt": "...",
  "cliNotificationToken": "..."
}
```

Use a separate token from the browser token.

The CLI notification token should authorize only Studio coordination
notification endpoints. It must not authorize durable project mutations, media
imports, project edits, or browser-origin mutation routes.

The runtime descriptor should be written with user-only permissions when it
contains a token:

```text
0600
```

This is local-first software, and a same-user local process already has broad
power over the user’s project files. Still, this is materially better than:

- unauthenticated loopback mutation routes; or
- putting the browser API token into a broadly readable file; or
- continuing to treat the event JSONL file as a write API.

### Endpoint Origin Rules

CLI requests usually do not send an `Origin` header. The endpoint should reject
unexpected browser origins, as current mutating routes do.

For CLI notification endpoints:

- accept requests with no `Origin`;
- reject requests with untrusted `Origin`;
- require `X-Renku-Studio-Notification-Token` or equivalent;
- require descriptor freshness on the client before sending;
- optionally verify the token against the running server instance.

## Server API Shape

Add typed server endpoints rather than a raw “append arbitrary event” endpoint.

Recommended first endpoint:

```text
POST /studio-events/project-resources-changed
```

Request:

```json
{
  "projectRef": {
    "name": "urban-basilica",
    "id": "project_x2htekrs",
    "storageRoot": "/Users/keremk/renku-movies"
  },
  "resourceKeys": [
    "surface:visual-language:lookbook:lookbook_c7g2k6w8"
  ],
  "source": {
    "kind": "cli",
    "command": "renku media import"
  },
  "operationId": "studio_operation_..."
}
```

Response:

```json
{
  "event": {
    "type": "studio.projectResourcesChanged",
    "id": "studio_event_...",
    "version": "0.1.0",
    "createdAt": "...",
    "projectRef": "...",
    "resourceKeys": "...",
    "source": "...",
    "operationId": "..."
  }
}
```

The server route should construct and validate the event through
`createStudioCoordinationService().appendStudioEvent(...)`.

Do not accept raw event JSON from the CLI. Typed endpoints keep the server
contract reviewable and avoid turning the HTTP route into a generic event-store
append API.

## Scope

### In Scope

- Add an ADR for server-owned coordination delivery.
- Add a CLI notification token to the Studio runtime descriptor.
- Add a token-protected server endpoint for `studio.projectResourcesChanged`.
- Change `appendStudioResourceChangedEvent` so it notifies the running Studio
  server instead of directly writing `studio-events.jsonl`.
- Treat “no fresh Studio runtime” as successful no-op for resource refresh.
- Emit `CLI026` only when a fresh running Studio appears to exist and live
  notification fails.
- Update tests that currently assert direct file appends from CLI resource
  mutations.
- Reproduce the exact failure mode: CLI cannot write `~/.config/renku`, but can
  notify the running server, and the browser receives the update.
- Audit other direct CLI coordination event writers and create follow-up tasks
  or convert them under this plan where feasible.

### Out Of Scope

- Changing durable project SQLite schemas.
- Moving project data into coordination events.
- Making browser panels poll SQLite directly.
- Full-window browser refresh after CLI changes.
- Server-Sent Events or WebSockets. Polling can remain.
- Keeping compatibility aliases for old resource keys.
- Treating event-store append failure as project mutation failure.
- Adding an offline notification queue for resource refresh.

## Direct CLI Event Writers To Audit

Current CLI code has direct event-store write paths in these areas:

| Area | Event type | Desired future |
| --- | --- | --- |
| `studio-resource-event-command.ts` | `studio.projectResourcesChanged` | Convert first. No direct file append. No offline backlog. |
| `create-project-command.ts` | `studio.projectRefreshRequested` for project library | Convert to live server notification. If Studio not running, no library exists to refresh. |
| `project-information-command.ts` | `studio.projectRefreshRequested`, `studio.focusRequested` | Convert to live server notification. Project data remains durable; focus is live UI only. |
| `project-selection-command.ts` | `studio.focusRequested` | Convert to live server request. If Studio not running, command should report that no running Studio was available to receive the request. |

Read-only commands such as `studio current` and director context may still read
coordination state for now. That is a separate read-path question. This plan is
about eliminating direct CLI writes to the Studio coordination store.

## Implementation Plan

### 1. Write ADR 0031

Create:

```text
docs/decisions/0031-use-studio-server-owned-coordination-delivery.md
```

The ADR must:

- explain why offline resource-refresh events are not useful;
- state that the event store is server-owned implementation detail for live
  coordination;
- update the meaning of “CLI emits refresh events” to “CLI notifies Studio
  server”;
- preserve SQLite as source of truth;
- define no-op semantics when Studio is not running;
- define warning semantics when Studio appears running but notification fails;
- document the local CLI notification token and its limited scope.

Update related ADR references:

- `0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`;
- `0017-use-scalable-studio-resource-loading.md`;
- `0030-use-unified-studio-resource-refresh-components.md`.

Do not rewrite history in those ADRs. Add “Updated by ADR 0031” notes where
needed.

### 2. Extend Runtime Descriptor Safely

Files:

- `packages/core/src/server/studio-coordination/runtime-descriptor.ts`;
- `packages/studio/server/runtime.ts`;
- `packages/studio/vite.config.ts` if dev server runtime descriptor creation
  has a parallel path.

Add optional field:

```ts
cliNotificationToken?: string;
```

Keep descriptor version compatible if possible. If the descriptor version must
change, update `readStudioRuntimeDescriptor` to handle both old and new
versions deliberately.

Descriptor write rules:

- create a cryptographically strong token per server instance;
- write descriptor with user-only permissions when token is present;
- heartbeat should preserve the token;
- release should remove the descriptor as it does today;
- stale descriptor rules should not change.

Tests:

- descriptor contains the token when claimed by Studio server;
- heartbeat preserves token;
- stale detection still works;
- older descriptors without token read as valid but cannot be used for CLI
  notification.

### 3. Add Server Notification Endpoint

File:

```text
packages/studio/server/routes/studio-events.ts
```

Add:

```text
POST /studio-events/project-resources-changed
```

Route behavior:

1. require the CLI notification token;
2. reject unexpected browser origins;
3. parse `projectRef`, `resourceKeys`, `source`, and optional `operationId`;
4. reject empty `resourceKeys`;
5. construct `studio.projectResourcesChanged` via coordination service;
6. return the appended event.

Do not accept arbitrary raw event payloads.

Tests:

- accepts valid token and appends event;
- rejects missing token;
- rejects invalid token;
- rejects unexpected `Origin`;
- rejects empty or malformed `resourceKeys`;
- returns structured diagnostics through existing error response helpers.

### 4. Add CLI Notification Client

Create or extend a focused CLI module, likely:

```text
packages/cli/src/commands/studio-notification-client.ts
```

Responsibilities:

- read `studio-runtime.json` through core runtime descriptor helpers;
- check descriptor freshness;
- no-op when descriptor is missing or stale;
- no-op when descriptor lacks `cliNotificationToken`;
- POST typed notifications to the running Studio server;
- distinguish:
  - `notRunning`;
  - `notConfigured`;
  - `delivered`;
  - `deliveryFailed`.

The client should not know feature-specific resource keys. It only transports
reports already produced by core/CLI mutation handlers.

Use built-in `fetch` from Node 24.

Tests:

- missing descriptor returns `notRunning`;
- stale descriptor returns `notRunning`;
- fresh descriptor without token returns `notConfigured`;
- fresh descriptor with token posts expected request;
- HTTP 403/500 returns `deliveryFailed`;
- network failure returns `deliveryFailed`;
- no filesystem write is attempted by the client.

### 5. Convert Resource-Change Appender

File:

```text
packages/cli/src/commands/studio-resource-event-command.ts
```

Change behavior from:

```text
direct append to studio-events.jsonl
```

to:

```text
notify running Studio server if present
```

Semantics:

- if `resourceKeys` is empty, return;
- if no running Studio is detected, return without warning;
- if Studio is running and notification succeeds, return;
- if Studio is running and notification fails, emit `CLI026`;
- never write `studio-events.jsonl` directly from this helper.

Update wording for `CLI026`:

Current:

```text
Project mutation succeeded, but Studio refresh coordination failed.
```

Recommended:

```text
Project mutation succeeded, but the running Studio app could not be notified.
```

Detail should include the server URL and failure cause when safe.

Tests:

- existing mutation tests should no longer read `studio-events.jsonl` to prove
  CLI resource-change emission;
- instead, tests should inject/mock the notification client or run a small route
  handler to assert the HTTP request was sent;
- no warning when no Studio runtime exists;
- warning when fresh runtime exists but server returns failure;
- durable mutation remains successful in all notification failure cases.

### 6. Convert Other Direct CLI Coordination Writers

Convert these under the same boundary, either in this implementation or as
explicit follow-up tasks in the plan checklist:

- `create-project-command.ts` project-library refresh;
- `project-information-command.ts` project refresh and focus request;
- `project-selection-command.ts` focus request.

The semantics differ:

- Resource changes after durable mutation are silent no-op when Studio is not
  running.
- Explicit UI commands like `renku project select` should probably report that
  no running Studio server is available, because the command’s primary purpose
  is to affect the UI.

This distinction must be documented in ADR 0031 and covered by tests.

### 7. Update Documentation

Update:

- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/studio-coordination-events.md`;
- `docs/cli/commands.md`;
- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`;
- any plan/architecture text that still says CLI appends resource events
  directly.

New wording should consistently say:

```text
CLI notifies the running Studio server after successful durable mutations.
The Studio server appends local coordination events for browser polling.
```

### 8. Verification Against The Reported Bug

Create an integration or high-level test that simulates:

1. project mutation succeeds;
2. CLI cannot write the config event file directly;
3. fresh Studio runtime descriptor points to a test server;
4. CLI posts the resource-change notification to the test server;
5. server appends event;
6. browser-facing event read sees the resource key.

Manual verification:

1. Start Studio.
2. Open a Lookbook panel in the browser.
3. From a CLI/agent environment that cannot append
   `~/.config/renku/studio-events.jsonl`, run:

   ```bash
   renku media import --purpose lookbook.sheet ...
   ```

4. Confirm:

   - no `CLI026` warning;
   - project mutation succeeds;
   - browser updates without manual refresh;
   - `studio-events.jsonl` append is performed by the server process, not the
     CLI process.

### 9. Build And Linked CLI Validation

Because the global `renku` command is linked through pnpm to:

```text
/Users/keremk/Projects/aitinkerbox/studio/packages/cli/dist/cli.js
```

implementation must rebuild the relevant packages after TypeScript changes.

Run focused tests first:

```bash
pnpm --dir packages/core test -- studio-coordination
pnpm --dir packages/studio test -- studio-events
pnpm --dir packages/cli test -- studio-resource
```

Then run package-level checks appropriate to the repo scripts.

Finally verify:

```bash
renku --version
renku project current --json
```

and a real or simulated Studio notification command.

## Open Questions

### Should The CLI Notification Token Live In The Runtime Descriptor?

Recommended answer: yes, but as a separate limited-scope token, not the browser
mutation token.

Rationale:

- the CLI needs a way to authenticate to the running local server;
- direct event-file append is worse;
- unauthenticated loopback POST routes are worse;
- same-user local processes already have access to the user’s local project
  files, but the token should still be user-readable only and narrowly scoped.

### Should `renku project select` Be Deferred When Studio Is Not Running?

Recommended answer: no.

`renku project select` is a UI command. If no Studio UI is running, there is no
UI to select. It should report that no running Studio server was available.

This is different from durable mutation commands, where the project change is
valuable even if Studio is closed.

### Should The Browser Polling Mechanism Change?

Recommended answer: no, not in this plan.

Polling is sufficient once the running server reliably receives the event. SSE
or WebSockets can be a later delivery optimization.

### Should The Event Store Be Compacted?

Not part of this plan.

This plan reduces future noise by removing offline CLI writes. Existing malformed
or stale historical lines can be handled separately if they materially affect
performance or diagnostics.

## Non-Regression Rules

After this plan is implemented:

- no CLI mutation helper should append `studio.projectResourcesChanged` directly
  to `studio-events.jsonl`;
- no CLI resource-refresh path should write an offline event when Studio is not
  running;
- no browser route should treat coordination events as durable project data;
- no project reads should require historical resource-change events;
- stale/missing Studio runtime should not make durable mutation commands warn;
- fresh runtime plus failed delivery should warn clearly;
- the running Studio server should remain the only writer for live refresh
  coordination events.

## Implementation Follow-Up

This implementation converts `studio.projectResourcesChanged` delivery to the
server-owned path described above.

The remaining direct CLI coordination writers are explicit follow-up work under
ADR 0031:

- convert `create-project-command.ts` project-library refresh to live-server
  notification;
- convert `project-information-command.ts` project refresh and focus request to
  live-server notification;
- convert `project-selection-command.ts` focus request to live-server
  notification, with a clear user-facing result when no Studio server is
  running.

Those follow-ups concern explicit UI coordination commands and project-library
refreshes, not durable resource-refresh notifications after mutation.

## Checklist

- [x] Write ADR 0031 for server-owned coordination delivery.
- [x] Add CLI notification token to Studio runtime descriptor.
- [x] Harden descriptor permissions when a token is present.
- [x] Add token-protected `project-resources-changed` Studio event route.
- [x] Add route tests for auth, origin, validation, and append behavior.
- [x] Add CLI notification client.
- [x] Convert `appendStudioResourceChangedEvent` to server notification.
- [x] Remove direct file append from CLI resource-refresh path.
- [x] Update CLI tests that currently assert direct event-store writes.
- [x] Convert or explicitly schedule direct focus/project-refresh CLI writers.
- [x] Update architecture and CLI docs.
- [x] Rebuild linked CLI/core/studio packages.
- [x] Reproduce the original Lookbook-sheet import scenario and confirm the
      browser updates without manual refresh.
