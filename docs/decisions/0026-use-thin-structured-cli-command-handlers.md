# 0026 Use Thin Structured CLI Command Handlers

Date: 2026-06-05

Status: accepted

## Context

The Renku CLI is both a human-facing tool and an agent-facing automation
contract. Studio Skills use it to mutate project metadata without writing
SQLite directly.

The first media-generation CLI implementation grew around large exported
command functions. `runMediaCommand` mixed command routing, purpose dispatch,
target parsing, import-document parsing, service calls, Studio refresh events,
JSON output, and diagnostics. `runGenerationCommand` had the same shape for
generation lifecycle commands and shot-video-only actions.

That structure made every new media purpose or command action encourage another
branch in one large function.

## Decision

Renku Studio CLI command entry points must stay thin.

An exported command entry point should:

- build a command runtime from parsed CLI options;
- dispatch to one command handler by command path;
- write the handler result or return the handler exit code.

Command families must use focused handlers, dispatch tables, and typed purpose
registries instead of giant nested command functions.

The CLI owns:

- command parsing;
- help text;
- required flag checks;
- CLI-specific target parsing;
- JSON and human output formatting;
- process exit behavior;
- structured command-boundary diagnostics.

The CLI does not own:

- project mutation business rules;
- media-generation lifecycle behavior;
- provider behavior;
- dependency graph behavior;
- asset-selection rules.

Media generation lifecycle commands must call the shared core
`ProjectDataService` methods. CLI handlers must not map every purpose to
purpose-specific create, update, read, estimate, or run service methods.

Structured diagnostics and JSON output shapes are part of the automation
contract. CLI package-boundary failures must use stable structured errors.

## Consequences

- `runMediaCommand` and `runGenerationCommand` remain small command adapters.
- Media import purpose routing lives in a focused CLI purpose handler registry,
  or in a deliberate core service contract if dispatch moves fully into core.
- Final shot-video take authoring uses focused `take authoring` handlers over
  core-owned authoring document services; the old `generation plan` adapter is
  not a supported command path.
- Shared target parsing, shot-id parsing, required-flag checks, JSON file
  reading, and output helpers live in named CLI modules.
- Scoped lint or static tests should prevent nested ternary dispatch,
  excessive command complexity, and deep imports of core internals.
- New CLI command paths must have one obvious handler.

## Implementation References

- `packages/cli/src/commands/structured-command.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/cli/src/commands/generation-purpose-command-registry.ts`
- `packages/cli/src/commands/command-architecture.test.ts`
