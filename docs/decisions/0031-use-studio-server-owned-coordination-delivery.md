# 0031 Use Studio Server-Owned Coordination Delivery

Date: 2026-06-11

Status: accepted

## Context

ADR 0006 established the boundary between durable project data and local Studio
UI coordination. ADR 0017 and ADR 0030 established scoped resource refresh
through `studio.projectResourcesChanged` after durable mutations.

The implementation accidentally made the CLI a direct writer to the Studio
coordination event store at `~/.config/renku/studio-events.jsonl`. That made
resource-refresh hints behave like an offline backlog even though they are not
durable domain history.

This caused a real failure mode: a CLI command could successfully mutate
project SQLite, then fail to append the coordination event file from its
execution environment. The user saw a warning and the open Studio browser did
not refresh, even though the durable mutation was correct.

`studio.projectResourcesChanged` events mean only:

```text
Some visible Studio resource may be stale; reload it from SQLite-backed APIs.
```

They do not mean:

```text
This project fact happened and must be replayed later.
```

If Studio is not running, no browser can observe the hint. The next Studio
session must hydrate from project SQLite and project files, not from old refresh
events.

## Decision

The running Studio server owns live coordination event delivery.

After a CLI command successfully mutates durable project state, the CLI should:

1. read the Studio runtime descriptor;
2. confirm the descriptor is fresh and contains a CLI notification token;
3. POST a typed notification to the running Studio server;
4. let the Studio server validate the request and append the coordination event.

For resource refresh, the first endpoint is:

```text
POST /studio-api/studio/events/project-resources-changed
```

The endpoint accepts a typed request containing `projectRef`, non-empty
`resourceKeys`, a CLI `source`, and an optional `operationId`. It does not
accept arbitrary raw event JSON.

The CLI must not directly append `studio.projectResourcesChanged` events to the
event store. The JSONL event store is an implementation detail of the running
Studio server for live coordination.

## Runtime Token

The Studio runtime descriptor includes a separate
`cliNotificationToken`. This token is distinct from the browser mutation token.

The CLI notification token authorizes only local Studio notification endpoints.
It must not authorize durable project mutations, media imports, project edits,
or browser-origin mutation routes.

Runtime descriptors that contain a notification token are written with
user-only permissions (`0600`).

Notification endpoints:

- accept CLI requests with no `Origin` header;
- reject unexpected browser origins;
- require `X-Renku-Studio-Notification-Token`;
- validate the typed request before appending any event.

## No-Op And Warning Semantics

Missing, stale, or tokenless runtime descriptors are quiet no-ops for durable
mutation refresh notifications. The mutation already succeeded, no Studio
browser can observe an event, and the next Studio launch reads the latest state
from SQLite.

If the runtime descriptor is fresh and token-bearing but delivery fails, the CLI
reports a structured warning. For resource refresh this is `CLI026`, meaning:

```text
Project mutation succeeded, but the running Studio app could not be notified.
```

This warning describes a live-update failure, not a durable project failure.

Explicit UI commands, such as focus or project-selection commands, may report
that no running Studio server is available because their primary purpose is to
affect the live UI rather than mutate durable project data.

## Consequences

- Project SQLite and project files remain the source of truth for durable
  project state.
- `studio.projectResourcesChanged` remains a live invalidation hint, not a
  domain event or audit trail.
- The Studio server is the only writer for live resource-refresh coordination
  events.
- Closed Studio sessions no longer accumulate stale refresh hints.
- CLI resource-refresh delivery no longer depends on direct write permission to
  `~/.config/renku/studio-events.jsonl`.
- Other direct CLI coordination writers, such as focus and project-library
  refresh requests, should move to the same live-server notification boundary
  when they are updated.

## Updates

This decision updates the older wording in:

- `0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `0017-use-scalable-studio-resource-loading.md`
- `0030-use-unified-studio-resource-refresh-components.md`

Where those decisions say “CLI appends coordination events,” the current
contract is:

```text
CLI notifies the running Studio server, and the server appends coordination
events for browser polling.
```
