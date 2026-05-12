# Renku Studio Core Design Principles

Date: 2026-05-10

Status: current

Role: reference

## Purpose

This document records the core engineering principles that should guide Renku
Studio implementation.

These rules apply across core, CLI, server, and UI work.

Decision history:

- `../decisions/0003-use-better-sqlite3-with-async-storage-boundary.md`
- `../decisions/0009-use-structured-diagnostics-at-package-boundaries.md`
- `../decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`

## Source Of Truth

- Keep all durable metadata in one source of truth.
- Use SQLite for metadata, relationships, selects, pins, bindings, task state,
  provider run records, generation records, budget records, and cost records.
- Store content files and generated media on the filesystem.
- Treat Markdown files, subtitle files, transcripts, media files, and compound
  folders as assets when they are part of the project graph.
- Keep short single-line display text in SQLite when that is clearer than
  creating tiny files.
- Store paragraph-length, formatted, or multi-line text as Markdown asset files.
- Allow Markdown frontmatter only when it is useful for the file itself. Do not
  duplicate SQLite metadata in frontmatter, and do not put relationships,
  statuses, owner links, ordering, or speculative "maybe useful later" fields
  there.

## Metadata Mutations

- Mutate metadata only through Renku commands or Renku services.
- Do not ask agents or users to hand-edit system-owned metadata.
- Use explicit IDs and declared relationships.
- Treat IDs as opaque values.
- Do not infer relationships from names, slugs, paths, folder positions, or
  partial matches.
- Store project-owned file references as first-class project-relative paths.
- Resolve project-relative paths only through core-owned path APIs.

## Package Boundaries

- Keep domain logic in `studio-core`.
- Keep `studio-cli` thin.
- Keep `renku-studio/server` thin.
- Keep the frontend as a projection consumer.
- UI, server, CLI, and agents should all reach metadata mutations through the
  same core command handlers.

## Generation

- Generation definitions are code-owned system behavior in the current
  direction, not project-authored source folders.
- Project files provide context and outputs for generation.
- Generated candidates are assets and may be treated as takes.
- Durable chosen takes/assets should be modeled as selects.
- Production-ready selects can be exported into `production-assets/`.

## Fail Fast

- Fail when required configuration, mappings, files, schema data, or inputs are
  missing or invalid.
- Use structured diagnostics at package boundaries.
- Report stable error codes, actionable locations, and suggestions when useful.
- Avoid silent defaults that hide broken setup or incomplete data.
- Do not add fallback behavior unless it is deliberately designed, documented,
  and tested as current behavior.

## No Compatibility Layers

Renku Studio is pre-customer software.

When a schema, folder structure, command shape, setup format, or public contract
changes:

- update callers directly;
- remove obsolete names and loaders;
- do not keep aliases;
- do not add shims;
- do not add fallback branches for old structures;
- do not keep tests whose only purpose is to preserve obsolete behavior.

## SQLite Tradeoffs

SQLite gives Renku Studio:

- transactional updates;
- one canonical metadata graph;
- deterministic command handlers;
- strong validation before mutation;
- fast projections for UI and CLI;
- a natural home for Drizzle schema definitions;
- clear boundaries for agent interaction.

The tradeoffs are real:

- SQLite is binary, so Git diffs are not naturally reviewable.
- Git branch merges can conflict at the database-file level.
- Schema migrations need care.
- SQLite journal files need clear Git rules.
- External manual database edits can break invariants.

Mitigations:

- provide CLI inspection commands for humans and agents;
- provide machine-readable JSON output;
- provide diagnostic/export commands such as project dumps for review;
- treat dumps as generated review artifacts, not source of truth;
- use Drizzle migrations owned by core;
- keep writes inside explicit transactions;
- keep generated SQLite journal files out of Git;
- avoid long-running write transactions;
- validate before every mutation.
