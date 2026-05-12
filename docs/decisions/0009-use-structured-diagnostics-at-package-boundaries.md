# 0009 Use Structured Diagnostics At Package Boundaries

Date: 2026-05-12

Status: accepted

## Context

Renku Studio is used by people, the browser Studio app, local CLI commands, and
AI agents. These callers need errors that are readable by humans and stable
enough for tools to inspect.

Plain thrown errors are useful inside implementation code, but they are not a
good package-boundary contract. They make it hard to distinguish validation
failures from system failures, warnings from errors, and actionable user input
problems from unexpected bugs.

The current implementation already has a workspace package for this contract:
`@gorenku/studio-diagnostics` in `packages/diagnostics`.

## Decision

Package-boundary validation, command, and HTTP failures must use structured
diagnostics.

The shared diagnostic contract contains:

- stable diagnostic codes;
- severity, either `error` or `warning`;
- a path-like location;
- a human-readable message;
- an optional suggestion;
- optional issue lists attached to structured errors.

Core, CLI, Studio server, and other package boundaries should collect all
actionable validation issues before failing when practical. CLI and HTTP
surfaces should serialize those diagnostics consistently instead of inventing
local payload shapes.

Unknown fields in import-style YAML inputs are warnings and must be ignored.
Required missing or invalid fields are errors.

## Consequences

- Humans get concrete messages and suggestions.
- Agents can inspect stable codes and locations.
- CLI and HTTP behavior remains consistent across features.
- New package-boundary code must avoid loose `throw new Error(...)` failures for
  expected validation or user input problems.
- Implementation-internal code can still throw ordinary errors for unreachable
  states or low-level failures, but callers should not depend on those as public
  contracts.
