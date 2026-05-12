# 0003 Studio Coordination Events

Date: 2026-05-07

Status: ready

## Goal

Implement the local Studio coordination event system described in
`docs/architecture/studio-coordination-events.md`.

The architecture document is the long-lived reference. This plan tracks the
first implementation slice, sequencing, and lower-level choices that can change
as implementation teaches us more.

## References

- `docs/architecture/studio-coordination-events.md`
- `docs/decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/studio-server-hono.md`

## Resolved Decisions

- Durable project data remains in project SQLite.
- The Studio coordination event store is UI coordination only.
- Coordination events should use the `studio.` namespace.
- `renku studio current --json` uses the most recently active live browser
  session.
- When Studio is not running, actionable current project, selection, and context
  are `null`.
- Browser sessions report activity with `studio.browserSessionActive`.
- Focus request application is correlated with `appliedRequestId`.
- Focus application failure is recorded with `studio.focusRequestFailed`.
- Context enrichment may grow by feature as the product learns what agents need.

## Implementation Order

1. Move package metadata from `renku info` to `renku about`.
2. Add partial project information update support in core.
3. Add project information CLI parity:
   - `renku info show`;
   - `renku info set`;
   - `renku info clear`;
   - `renku info language add`;
   - `renku info language update`;
   - `renku info language remove`;
   - `renku info language set-base`.
4. Add the Studio coordination event service in core.
5. Append `studio.projectRefreshRequested` and `studio.focusRequested` after
   successful project information mutations.
6. Add event polling routes to the Studio server, using the coordination
   service's append-order cursor.
7. Teach the browser UI to apply `studio.focusRequested` and report
   `studio.focusChanged` with `appliedRequestId`.
8. Add:
   - `renku project current`;
   - `renku project select`;
   - `renku studio current --json`.
9. Report `studio.focusRequestFailed` when Studio cannot apply a request.
10. Add browser-session identifiers and `studio.browserSessionActive`
    observations for focus/current projections.
11. Protect mutating local Studio API routes with a per-server trust token.
12. Enforce one running Studio server with an operational lock that does not
    store semantic focus state.

## Implementation Decisions

These decisions make the first implementation ready to start. They can be
revised later with a focused follow-up plan if implementation proves one of them
wrong.

## Project Structure

Use the naming rules in `docs/architecture/naming-guidelines.md`,
`docs/architecture/reference/front-end-guidelines.md`, and
`docs/architecture/reference/studio-server-hono.md`.

Do not introduce generic files such as `event-manager.ts`, `event-helper.ts`,
`studio-state.ts`, `current.ts`, `session.ts`, `route-focus.ts`, or
`coordination-controller.ts`. File names should describe the durable
responsibility they own.

### Core Node Coordination Service

```text
packages/core/src/node/studio-coordination/
  studio-coordination-service.ts
  studio-coordination-events.ts
  studio-current-projection.ts
  studio-event-store.ts
  studio-event-cursors.ts
  studio-event-validation.ts
  studio-runtime-descriptor.ts
  studio-coordination-errors.ts
  studio-coordination-service.test.ts
  studio-event-store.test.ts
  studio-current-projection.test.ts
  studio-runtime-descriptor.test.ts
```

Responsibilities:

- `studio-coordination-service.ts`: exports `createStudioCoordinationService`
  and the service interface used by CLI and Studio server.
- `studio-coordination-events.ts`: owns public coordination event contract
  types, including `StudioEvent`, `StudioProjectRef`, `StudioFocusRequest`,
  `StudioFocus`, and browser-session events.
- `studio-current-projection.ts`: projects `StudioCurrent` from validated
  events, runtime state, and project data enrichment.
- `studio-event-store.ts`: owns JSONL path resolution, append, read, and
  malformed-line diagnostics.
- `studio-event-cursors.ts`: owns byte-offset cursor parsing, formatting, and
  validation.
- `studio-event-validation.ts`: validates event envelopes and discriminated
  event payloads before append or projection.
- `studio-runtime-descriptor.ts`: owns
  `~/.config/renku/studio-runtime.json`, heartbeat, stale detection, and
  singleton server checks.
- `studio-coordination-errors.ts`: owns structured coordination errors and
  diagnostic construction functions.

Do not put these files under `project/`; coordination is Studio UI state, not
project data. Do not name the JSONL layer `event-log.ts`; this is not a durable
domain event log.

Update `packages/core/src/node/index.ts` to export only the intended node-only
service functions and public coordination contracts. Do not re-export project
data APIs from the coordination folder. Do not export the node-only coordination
service from `packages/core/src/index.ts`.

### CLI Commands

```text
packages/cli/src/commands/
  about-command.ts
  project-information-command.ts
  project-selection-command.ts
  studio-current-command.ts
```

Responsibilities:

- `about-command.ts`: replaces the current package metadata use of `renku info`.
- `project-information-command.ts`: owns `renku info show`, `renku info set`,
  `renku info clear`, and `renku info language ...`.
- `project-selection-command.ts`: owns `renku project current` and
  `renku project select`.
- `studio-current-command.ts`: owns `renku studio current --json`.

Avoid one file per subcommand such as `info-set.ts` or `language-add.ts` for the
first slice. Keep related command parsing together until the command surface is
large enough to justify a product-named split.

### Studio Server

```text
packages/studio/server/
  app.ts
  runtime.ts
  errors.ts
  studio-runtime-token.ts

  routes/
    health.ts
    projects.ts
    studio-events.ts

  http/
    project-responses.ts
    project-cover-url.ts
    studio-event-responses.ts
    studio-api-token.ts
```

Responsibilities:

- `routes/studio-events.ts`: Hono resource module for
  `/studio-api/studio/events` and related Studio coordination reporting routes.
- `http/studio-event-responses.ts`: mechanical serialization for coordination
  event polling and current-state HTTP responses.
- `http/studio-api-token.ts`: validates `X-Renku-Studio-Token` and request
  origin for mutating Studio API routes.
- `studio-runtime-token.ts`: generates and holds the per-server in-memory token
  and exposes bootstrap data to `runtime.ts`.

Keep route handlers inline in `routes/studio-events.ts`, following the Hono
resource-module convention. Do not add controller or handler files.

Mount the route in `server/app.ts`:

```ts
.route('/studio-api/studio/events', studioEvents)
```

### Browser Studio Services And Hooks

```text
packages/studio/src/services/
  studio-events-api.ts
  studio-current-contracts.ts

packages/studio/src/app/
  use-project-session.ts
  use-studio-coordination.ts

packages/studio/src/features/movie-studio/
  use-movie-studio-selection.ts
  movie-studio-selection.ts
```

Responsibilities:

- `services/studio-events-api.ts`: owns fetch calls for event polling, reporting
  focus changes, reporting browser activity, and reading current Studio
  projection from the local Studio API.
- `services/studio-current-contracts.ts`: owns browser-side JSON contracts for
  coordination HTTP responses when they need HTTP-only fields or UI-facing
  narrowing.
- `app/use-studio-coordination.ts`: app-wide hook that polls coordination events,
  applies focus requests, reports browser-session activity, and reports applied
  focus.
- `app/use-project-session.ts`: continues to own loaded project/library state,
  but no longer owns semantic current focus outside the coordination projection.
- `features/movie-studio/movie-studio-selection.ts`: remains the canonical
  browser selection type and strict selection resolver for the Movie Studio UI.

Do not put browser coordination code inside `features/movie-studio/` unless it
is strictly Movie Studio selection resolution. Event polling and browser-session
activity are app-wide concerns.

The browser must not import from `@gorenku/studio-core/node`. Keep browser-side
coordination HTTP contracts in `services/studio-current-contracts.ts`, and keep
the core node coordination contracts on the server/CLI side.

### Paths Not To Add

Do not add these:

```text
packages/core/src/node/project/studio-events.ts
packages/core/src/node/events/event-log.ts
packages/core/src/node/studio-coordination/event-manager.ts
packages/core/src/node/studio-coordination/helpers.ts
packages/studio/server/routes/studio-event-routes.ts
packages/studio/server/coordination-controller.ts
packages/studio/src/features/movie-studio/use-studio-events.ts
packages/studio/src/services/fetch-studio-events.ts
```

Reasons:

- `project/` would imply durable project ownership.
- `event-log` implies a domain event log rather than UI coordination.
- `manager` and `helpers` hide the real responsibility.
- `*-routes.ts` repeats the `routes/` folder.
- coordination polling is app-wide, not a Movie Studio child feature.
- service filenames should name the resource, not a one-off verb.

### IDs

Use built-in Node crypto APIs. Do not add an ID dependency.

- event id: `studio_event_${crypto.randomUUID()}`;
- operation id: `studio_operation_${crypto.randomUUID()}`;
- server instance id: `studio_server_${crypto.randomUUID()}`;
- browser session id: `studio_browser_${crypto.randomUUID()}`.

IDs are identities only. They are not sortable and must not be used as cursors.

### JSONL Append

Implement append in `@gorenku/studio-core/node`.

Rules:

- create the Renku config directory before appending;
- validate the event before writing;
- open `studio-events.jsonl` in append mode;
- write exactly one complete JSON line per event with one `write` call;
- close the file handle in `finally`;
- keep a process-local promise queue so appends from one process preserve call
  order;
- rely on append-mode filesystem behavior for cross-process append safety;
- on append failure, throw a structured `STUDIO_COORDINATION...` error.

Callers must never write JSONL by hand.

### Event Cursor

Use byte-offset cursors for v1.

`readStudioEvents` accepts an optional decimal byte-offset cursor. The browser
polling route is:

```text
GET /studio-api/studio/events?after=<byte-offset>
```

Response shape:

```json
{
  "events": [],
  "nextCursor": "0",
  "warnings": []
}
```

Rules:

- missing event file returns no events and `nextCursor: "0"`;
- omitted `after` means `0`;
- invalid or negative cursor values fail with a structured HTTP/CLI diagnostic;
- the service reads complete lines beginning at the cursor;
- malformed lines are skipped with structured warnings;
- `nextCursor` is the byte offset immediately after the last complete line the
  service inspected;
- clients must only pass cursors returned by the service.

### Runtime Lock

Use one operational runtime descriptor:

```text
~/.config/renku/studio-runtime.json
```

Shape:

```json
{
  "version": "0.1.0",
  "serverInstanceId": "studio_server_...",
  "pid": 12345,
  "host": "127.0.0.1",
  "port": 49152,
  "serverUrl": "http://127.0.0.1:49152",
  "startedAt": "2026-05-07T10:00:00.000Z",
  "heartbeatAt": "2026-05-07T10:00:15.000Z"
}
```

Rules:

- this file stores operational state only;
- it must not store selected project, screen, selection, pending request, or
  project information;
- server startup checks the descriptor and heartbeat;
- a stale descriptor may be replaced;
- an active descriptor blocks startup with a structured error;
- shutdown removes the descriptor when it still belongs to the same
  `serverInstanceId`.

Use a 30 second server heartbeat interval and treat the descriptor as stale after
90 seconds without heartbeat.

### Local HTTP Trust Token

Generate a per-server token with:

```ts
crypto.randomBytes(32).toString('base64url')
```

Keep the token in server memory. Do not write it to the runtime descriptor.

Transport:

- inject the token into the served Studio HTML as bootstrap data;
- the browser sends it on mutating Studio API requests in
  `X-Renku-Studio-Token`;
- mutating routes reject missing or invalid tokens;
- mutating routes reject unexpected `Origin` headers;
- non-mutating `GET` routes remain token-free unless a future threat model says
  otherwise.

### Browser Session Lifecycle

The browser stores `browserSessionId` in `sessionStorage`.

Lifecycle:

- generate the id on first load in a tab;
- keep it across reloads in the same tab;
- let it disappear when the tab closes;
- report `studio.browserSessionActive` on initial load, `focus`,
  `visibilitychange` to visible, and direct pointer or keyboard input;
- debounce activity observations to at most one event every 2 seconds;
- emit a visible-tab heartbeat every 15 seconds;
- treat a browser session as stale after 45 seconds without activity or
  heartbeat.

The current browser session is the non-stale session with the newest trusted
activity observation.

### Browser Polling

Use a 1000ms polling interval for v1.

Also trigger an immediate poll when:

- the tab becomes visible;
- the window receives focus;
- the browser applies a focus request and needs to observe follow-up events.

### `renku studio current --json` Output

V1 uses a stable top-level shape:

```json
{
  "studio": {
    "running": true
  },
  "project": null,
  "selection": null,
  "context": null,
  "pendingRequest": null,
  "warnings": []
}
```

Rules:

- when Studio is not running, `project`, `selection`, and `context` are `null`;
- when no live browser session is active, `project`, `selection`, and `context`
  are `null`;
- `pendingRequest` contains only non-stale actionable requests;
- `context` has a `kind` discriminant when present;
- context payloads may grow additively by feature;
- removing or renaming existing context fields requires updating callers
  directly because Studio is pre-customer, but do not keep compatibility shims.

First slice context:

- `projectInformation`: title, aspect ratio, logline, summary, languages;
- `castMember`: id, name, kind, role, short description;
- `clip`: id, title, summary, visual intent, parent scene and sequence summary;
- `scene`: id, title, summary, parent sequence summary, child clips;
- `sequence`: id, number, title, short title, summary, child scenes;
- `storyboard`: project title and sequence/scene/clip outline;
- `visualLanguage`: current visual language entries;
- `casting`: cast member list.

## Stale Request Decision

Use conservative actionable output for stale requests:

- `pendingRequest` contains only actionable, non-stale requests;
- stale requests are omitted from `pendingRequest`;
- `renku studio current --json` may include a separate diagnostics or warnings
  field that mentions the latest stale request with reason `staleRequestIgnored`;
- stale-request diagnostics should be limited to the latest relevant stale
  request so agents are informed without being distracted by old UI noise.

The reason for this shape is that `pendingRequest` should mean "Studio can still
act on this." If a request is stale, putting it in `pendingRequest` would make it
too easy for an agent to treat old UI intent as current user intent.

Warnings solve a different problem. They help an agent explain why there is no
current target without making the stale target actionable.

Example output:

```json
{
  "studio": {
    "running": false
  },
  "project": null,
  "selection": null,
  "context": null,
  "pendingRequest": null,
  "warnings": [
    {
      "code": "STUDIO_COORDINATION020",
      "severity": "warning",
      "message": "A previous Studio focus request was ignored because it is stale.",
      "location": {
        "path": ["pendingRequest"],
        "context": "studio current projection"
      },
      "suggestion": "Ask the user which project or selection they want to target."
    }
  ]
}
```

If stale warnings confuse agents in practice, revise this with a follow-up plan.

## Validation

Run focused package checks as each slice lands:

```bash
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm build:core
pnpm build:cli
pnpm build:studio
```

Run root checks before calling the coordination slice complete:

```bash
pnpm test
pnpm build
pnpm lint
pnpm check
```

## Regression Tests To Add

- Coordination projections ignore malformed historical event lines with
  structured warnings and do not affect project SQLite.
- Project data reads work when the coordination event store is empty or
  malformed.
- CLI project mutations that successfully commit SQLite but fail to append
  coordination events report the partial coordination failure.
- Stopped Studio sessions return `project: null`, `selection: null`, and
  `context: null` from `renku studio current --json`.
- Multiple browser tabs resolve current focus to the most recently active live
  browser session.
- Stale focus requests are not returned as actionable `pendingRequest`.
