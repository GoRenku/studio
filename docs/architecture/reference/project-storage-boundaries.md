# Project Storage Boundaries

Date: 2026-05-10

Status: current

Role: reference

## Purpose

This document defines the boundary between SQLite and the filesystem for Renku
Studio projects.

Decision history:

- `../../decisions/0003-use-better-sqlite3-with-async-storage-boundary.md`
- `../../decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `../../decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md`
- `../../decisions/0012-store-project-file-references-as-project-relative-paths.md`
- `../../decisions/0013-use-core-owned-project-assets-and-production-exports.md`
- `../../decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `../../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`

## Core Rule

SQLite owns durable project metadata and relationships.

The filesystem owns content.

This means SQLite stores facts such as:

- project identity;
- supported languages;
- sequence, scene, and clip records;
- cast member records;
- continuity reference records;
- visual language category records;
- visual language records;
- asset records;
- asset file records;
- focused Cast Profile and Location Hero display choices;
- request-scoped generation reference choices;
- bindings between domain objects;
- Inspiration folder metadata and persisted Inspiration Analysis JSON;
- Lookbooks, source Inspiration relationships, and Lookbook image placement;
- task, generation, provider run, budget, and cost records;
- media generation specs and media generation runs;
- validation state and structured diagnostics.

The filesystem stores content such as:

- Markdown briefs, notes, descriptions, summaries, scripts, and narration;
- subtitle files;
- timed transcript and word timing files;
- images;
- audio;
- video;
- generated media;
- Inspiration folder image files;
- staged generation outputs;
- compound asset folders.

## Text Storage

Use SQLite for short display text where a file would create unnecessary noise.

Good SQLite candidates:

- project name;
- project title;
- sequence title;
- scene title;
- clip title;
- cast member name;
- cast member role;
- short one-line descriptions;
- one-line summaries when they are intentionally compact.

Use Markdown assets for text that is:

- paragraph-length;
- multi-line;
- formatted;
- expected to be edited as prose;
- likely to have versions or generated takes;
- useful to inspect directly in an editor.

Examples of Markdown-backed content:

- project treatment;
- sequence brief;
- scene brief;
- clip brief;
- visual intent;
- visual language guidance;
- visual language prompt templates;
- continuity reference descriptions;
- cast description;
- narration script;
- localization glossary;
- voice guide;
- research note.

The UI should support both storage modes:

- single-line SQLite fields through input controls;
- Markdown-backed text assets through textarea or editor surfaces.

This is a design guideline, not a mechanical rule. Each schema field should be
decided case by case.

Visual Language prompt and guidance prose belongs in Markdown assets, not in
SQLite text columns. SQLite owns the entry identity, category, priority,
ordering, and asset relationships.

The system Visual Language Catalog is outside project SQLite. Catalog entries
live under the Renku config visual-language catalog folder and are copied into a
project only when a user chooses to create an editable project Visual Language
entry from them.

## Markdown Frontmatter

Markdown frontmatter is allowed, but it should be rare.

Frontmatter may contain file-local authoring context only when that context is
useful inside the Markdown file itself.

Frontmatter must not contain:

- Renku IDs;
- owner relationships;
- asset relationships;
- status;
- ordering;
- selected/picked state;
- database metadata duplicated from SQLite;
- speculative fields that might be useful later.

Most Markdown files should have no frontmatter.

## Project Database

The canonical database path is:

```text
<project-folder>/.renku/project.sqlite
```

The database is project-owned and moves with the project folder.

Generated SQLite journal files should not be treated as durable project content.

## No Compatibility Layer

Renku Studio is pre-customer software.

When this model changes, update the schema, callers, tests, and sample project
directly. Do not add fallback loaders, aliases, old schema readers, or tests
whose only purpose is to preserve obsolete behavior.
