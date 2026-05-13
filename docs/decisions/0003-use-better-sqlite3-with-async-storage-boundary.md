# 0003 Use Better SQLite3 With Async Storage Boundary

Date: 2026-05-05

Status: accepted

## Context

Renku Studio stores durable project metadata in a project-local SQLite database.
The first implementation runs through a local Node.js server, the Studio CLI,
and an Electron distribution path.

The future cloud direction is local-first:

- users and agents edit a local project folder;
- SQLite stores project metadata locally;
- files store local working-copy content;
- cloud services may later provide sync, backup, versioning, review,
  collaboration, and hosted-agent workflows.

That future does not require the UI or CLI to edit a live remote SQL database as
the source of truth.

At the same time, future storage adapters may need async behavior. Possible
future adapters include libSQL, Turso Sync, remote workers, hosted-agent storage,
or another explicit sync layer.

## Decision

Use `better-sqlite3` as the first Node.js SQLite driver for Renku Studio.

Keep `better-sqlite3` behind the Node-side `@gorenku/studio-core/server` storage
adapter. It must not leak into browser imports, domain command signatures, query
signatures, or projection signatures.

Make the `studio-core` storage, command, query, and projection APIs async from
the beginning.

The intended shape is:

```text
studio-core storage interface
  async command/query/transaction API

better-sqlite3 storage adapter
  v1 implementation
  synchronous driver internally
  async API at the adapter boundary

future storage adapter
  libSQL, Turso Sync, remote worker, or hosted-agent storage
  async driver internally
```

## Consequences

- The first implementation gets a simple, reliable local SQLite driver with
  strong Node/Electron/CLI fit.
- The browser bundle remains free of native SQLite dependencies.
- The public Studio core API is future-proofed for async storage without a later
  cross-cutting rewrite.
- Command handlers, server routes, CLI commands, projections, and tests can
  consistently use `await` from the beginning.
- `better-sqlite3` remains an implementation detail that can be replaced by a
  future storage adapter.
- Transactions should stay short and deterministic. Provider calls, long
  filesystem work, network sync, or hosted-agent communication should not happen
  inside an open SQLite transaction.

This decision does not rule out libSQL or Turso later. It records that the v1
local database driver is `better-sqlite3`, while the architectural boundary is
async and driver-independent.
