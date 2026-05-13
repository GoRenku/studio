# Renku Studio Layers Of Responsibility

Date: 2026-05-10

Status: current

Role: topic overview

## Purpose

This document defines which package owns which responsibilities in Renku Studio.

The goal is one shared domain implementation used by the UI, local server, CLI,
agents, and future background workers.

Decision history:

- `../decisions/0001-create-renku-studio-monorepo.md`
- `../decisions/0002-use-engines-for-ai-integrations.md`
- `../decisions/0003-use-better-sqlite3-with-async-storage-boundary.md`
- `../decisions/0009-use-structured-diagnostics-at-package-boundaries.md`
- `../decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`

## Architecture Center

`studio-core` is the architectural center.

It owns the domain model, storage rules, validation, metadata mutation commands,
and projections.

Other packages are adapters around core.

## `studio-core`

`studio-core` owns the Renku Studio domain.

It should contain:

- public browser-safe contracts;
- Drizzle schema definitions;
- SQLite migrations;
- repository/query helpers;
- domain command handlers;
- validation rules;
- projection builders;
- asset registration;
- filesystem path allocation for assets;
- project-relative path validation and resolution;
- import/export helpers;
- shared DTOs for UI and CLI.

Future generation/task responsibilities also belong in core once accepted and
implemented. Those include queue and task state logic, generation records,
provider or engine run records, stale-state calculation, and cost approval
state. They are architectural direction, not current implemented tables or
services.

`studio-core` should be the only package that knows how to apply a metadata
mutation correctly.

Examples of core-owned mutations:

- add a cast member;
- rename a cast member;
- import a cast portrait;
- register a Markdown asset;
- mark an asset as a select;
- export a select into production assets;
- create a named cast reference set;
- bind a clip to a cast reference set;
- add or update a supported language;
- register a subtitle track or timed transcript;
- register generated media files as assets.

Future generation examples, after that model is accepted, include queueing a
generation task, marking a task completed, and computing whether a clip is
stale.

## Async Core Boundary

`studio-core` command, query, projection, and storage APIs should be async from
the beginning.

This is true even if the first implementation uses `better-sqlite3`, whose
driver calls are synchronous internally.

Recommended shape:

```text
UI/server/CLI
  await studio-core command/query/projection

studio-core
  await storage adapter

better-sqlite3 adapter
  synchronous driver calls internally
  async API at the adapter boundary

future storage adapter
  libSQL, Turso Sync, remote worker, or hosted-agent storage
  async internally and async at the adapter boundary
```

Rules:

- Do not expose `better-sqlite3` types in command, query, projection, or public
  contract signatures.
- Do not expose sync driver behavior outside the storage adapter.
- Keep transactions short and deterministic.
- Do not perform provider calls, long filesystem work, or network sync inside an
  open SQLite transaction.

Command handlers should generally follow this shape:

```text
validate inputs
prepare filesystem or provider-independent work
open a short database transaction
write metadata
close transaction
perform slow provider/runtime work outside the transaction
record completion metadata in another short transaction
```

## Browser-Safe Core Contracts

The browser should be able to import shared types without pulling in Node-only
dependencies.

Core should expose separate entry points:

```text
@gorenku/studio-core
  browser-safe contracts, DTOs, constants, pure validation helpers

@gorenku/studio-core/server
  filesystem access, SQLite driver setup, Drizzle database, migrations,
  command handlers that touch disk
```

The root entry point should stay browser-safe.

The Node entry point may expose programmatic project operations.

Neither entry point should own terminal argument parsing, command help text,
process exit behavior, HTTP routing, or CLI-specific formatting.

## `renku-studio/server`

The local server is an adapter.

It should:

- read requested projects and serve route/API data;
- call `studio-core/node`;
- expose HTTP endpoints;
- stream events or projection updates to the UI;
- translate structured errors into API responses;
- avoid duplicating business rules.

The server should not own:

- schema definitions;
- project mutation logic;
- validation rules;
- asset selection rules;
- cast pinning or clip binding behavior;
- queue transition rules.

## `packages/studio/src`

The frontend is a projection consumer.

It should:

- fetch project projections;
- render workspace state;
- send user actions to the server;
- subscribe to updates;
- keep only local ephemeral UI state in React.

The UI should not:

- write SQLite directly;
- infer relationships from folder paths;
- encode domain mutation rules;
- own long-running task state;
- import `@gorenku/studio-core/server`;
- import `better-sqlite3`, Drizzle's SQLite driver, or Node filesystem modules.

## `studio-cli`

`studio-cli` is a command adapter over core.

It owns:

- argument parsing;
- command help text;
- terminal output;
- JSON output formatting;
- process exit codes.

It should not own business logic.

The key rule:

> CLI behavior is separate. CLI business logic is not.

For example:

```text
studio-cli parses:
  renku movie cast add --name "Mehmed II"

studio-cli calls studio-core:
  createCastMember(project, input)

studio-core validates and mutates:
  cast_member rows
  folder allocation
  projection events
```

If the UI can perform a metadata mutation, the CLI should be able to perform the
same mutation through the same core command handler.

## Agents

Agents may inspect project folders and artifact files.

Agents may directly edit content files when the user asks them to edit content,
for example:

- a research note;
- a narration draft;
- a subtitle file;
- a timed transcript file;
- a localization glossary;
- a freeform Markdown brief;
- an image or audio file produced outside Renku.

Agents must call Renku commands when they need to mutate metadata.

Examples:

- registering a new file as an asset;
- changing which cast assets a clip uses;
- marking an asset as a select;
- adding a cast member;
- changing a cast member's role;
- adding or enabling a supported language;
- registering a subtitle track or timed transcript;
- setting a budget;
- approving an estimated cost;
- queueing a generation task.

If an agent creates a new file directly, that file is not project metadata until
it is registered through a Renku command.

## Distribution Notes

Packaging and distribution details can evolve, but all distributions should use
the same underlying Studio implementation:

- Vite browser UI build;
- local Node server build;
- `studio-core` domain/storage code;
- provider/runtime dependencies needed by generation;
- native SQLite support on the Node side only.

The browser bundle must never include native SQLite dependencies or Node-only
core code.
