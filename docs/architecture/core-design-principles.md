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
- `../decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `../decisions/0019-use-durable-lookbooks-as-project-visual-direction.md`
- `../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../decisions/0025-use-shared-media-generation-purpose-architecture.md`

## Source Of Truth

- Keep all durable metadata in one source of truth.
- Use SQLite for durable metadata, relationships, selects, pins, bindings, and
  accepted task state. Temporary media-generation context and review documents
  are not durable domain records.
- Store content files and generated media on the filesystem.
- Treat Inspiration folder images as filesystem-owned content, not per-image
  assets.
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

## Global Provider Credentials

- Keep application-global provider secrets outside Project databases and
  Project Settings.
- Let Engines own the exact managed-provider catalog, Renku `.env` document
  mechanics, and fresh saved-credential resolution.
- Let Core own sanitized status projection, update validation, and the focused
  replacement mutation boundary.
- Never return existing secret values, fragments, hashes, or credential paths
  to browser or adapter contracts.
- Preserve unmanaged `.env` content and commit managed changes atomically with
  owner-only permissions.
- Keep Hono and React as thin consumers of the Core credential commands; they
  must not read files, enumerate providers independently, or validate provider
  accounts.

## Generation

- Generation definitions are code-owned system behavior in the current
  direction, not project-authored source folders.
- Project files provide context and outputs for generation.
- Core deterministically projects current Project facts, domain relationships,
  and relationship-derived AssetFile suggestions for the exact media purpose
  and target.
- **Context is evidence, not permission.** Missing creative context is
  informational, suggested references are non-exhaustive, their order is not
  priority, and the user or agent may ignore, supplement, or replace them.
- Validate only truthful target/scope identity and safe registered file facts;
  do not turn context into a creative allowlist, readiness gate, or execution
  authorization.
- Keep provider/model selection and exact provider-native request authoring in
  provider Skills.
- Validate and execute provider protocols only in standalone Engines.
- Keep temporary review documents Project-relative and store exact safe
  generation provenance only on attached Assets.
- Keep Core focused on envelope safety, Settings, attachment ownership,
  persistence, copy, and Inspection; it does not estimate or execute providers.
- Keep generation and media import separate. A generated file is not attached to
  project metadata until an import command succeeds.
- Generated candidates are assets and may be treated as takes.
- Durable chosen takes/assets should be modeled as selects.
- Production-ready selects can be exported into `production-assets/`.
- Use focused Core purpose builders for typed target context, output guidance,
  and advisory relationship-derived reference roles.
- Keep provider fields and request assembly in provider Skills; keep live
  provider validation and execution in Engines; keep focused attachment
  ownership in Core.
- Do not introduce provider capability YAML, schema overlays, plugin-style
  purpose frameworks, or generic prompt frameworks unless concrete current
  implementation work proves the additional abstraction is needed.

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
