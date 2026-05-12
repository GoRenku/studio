# 0011 Use Drizzle Kit For Project SQLite Migrations

Date: 2026-05-12

Status: accepted

## Context

Renku Studio stores project metadata in project-local SQLite databases. The
schema lives in TypeScript under `packages/core/src/schema`.

Migration code can drift when hand-written SQL, generated SQL, and custom
TypeScript registries are all treated as sources of truth. The project needs a
single migration workflow that keeps schema changes reviewable and repeatable.

## Decision

The Drizzle TypeScript schema is the source of truth for project database table
structure.

Project SQLite migrations must be generated and applied with Drizzle Kit. The
generated migration files live in the package-owned migrations folder:

```text
packages/core/drizzle/
```

Do not hand-write TypeScript migration registries. Do not copy generated SQL
into TypeScript files. Do not manually edit generated SQL unless the current
architecture explicitly calls for a documented custom migration.

Before changing database schema or migrations, use the documented Drizzle Kit
workflow recorded in the architecture overview.

## Consequences

- Schema review starts from TypeScript and generated SQL.
- Migration files remain package-owned and easy to locate.
- Future schema changes avoid parallel migration systems.
- Intentional custom migrations require explicit documentation before they are
  added.
