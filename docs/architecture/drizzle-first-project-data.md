# Drizzle-First Project Data Access

Date: 2026-05-13

Status: current

Role: architecture policy

## Purpose

Renku Studio project runtime code uses Drizzle as the application query layer.
The Drizzle schema in `packages/core/src/server/schema/index.ts` is the source of truth
for table and column names, and runtime project reads and writes should use
Drizzle table objects instead of handwritten SQL strings.

This policy keeps project data access modular as Studio adds more lazy resources
and prevents large projection modules from becoming parallel schemas.

## Runtime Rules

- Repository, command, and projection code should query through `session.db`.
- Use Drizzle operators such as `eq`, `and`, `or`, `asc`, `desc`, `count`, and
  typed joins for normal reads and writes.
- Use Drizzle transactions for metadata mutations.
- Keep `better-sqlite3` details inside the project store adapter.
- Do not call `session.sqlite.prepare(...)` from project commands,
  projections, server routes, CLI commands, or UI-facing resource code.

## Raw SQL Escape Hatch

Raw SQL is allowed only in narrow infrastructure cases:

- SQLite connection pragmas;
- project-store schema-generation checks;
- Drizzle Kit migration execution;
- test-only database introspection;
- rare repository-local Drizzle `sql` fragments when Drizzle has no clearer
  typed primitive, such as tuple-like keyset cursor comparisons.

When a repository uses Drizzle `sql`, keep it local to the repository function,
return a typed record shape, and cover the behavior with tests.

## Module Boundaries

Core project data code is organized into:

- **records/repositories** for Drizzle-backed table and relationship access;
- **commands** for mutations and filesystem side effects;
- **projections/resources** for browser-safe read models.

`project-data-service.ts` is a façade over those modules. It should not own SQL,
projection assembly, or table-specific branching.
