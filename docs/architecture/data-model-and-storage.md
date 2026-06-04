# Renku Studio Data Model And Storage

Date: 2026-05-10

Status: current

Role: topic overview

## Purpose

This document is the short entry point for Renku Studio data and storage
architecture.

The previous long draft was useful for exploration, but it had become too broad
to review safely. It now lives at
`plans/exploration/data-model-and-storage-long-draft.md` as historical design
context, not as the primary implementation reference.

Use the focused documents below for current direction.

## Current Decisions

- SQLite is the source of truth for durable metadata, relationships, ordering,
  status, selects, task records, cost records, and asset registration.
- The filesystem owns content: Markdown, subtitles, transcripts, images, audio,
  video, generated media, and compound asset folders.
- Markdown files are assets when they are part of the project graph.
- SQLite stores project-owned file references as normalized
  `project_relative_path` values, never absolute local paths.
- Short single-line display text can remain in SQLite. Paragraph-length,
  formatted, or multi-line text should live in Markdown asset files.
- Markdown frontmatter is optional file-local authoring context only. It must
  not duplicate SQLite metadata, IDs, relationships, status, ordering, owner
  links, or file registration data.
- SQLite JSON text columns must be validated with AJV against explicit JSON
  Schemas before writes and after reads. TypeScript types, `JSON.parse`, and
  ad hoc guards are not enough for persisted JSON.
- Inspiration folder images are filesystem-owned content and are not registered
  as per-image assets. The persisted Inspiration Analysis JSON is SQLite-owned
  project data.
- Screenplay Analysis is SQLite-owned project data. It stores validated,
  agent-authored critique history as tagged JSON in `screenplay_analysis`, with
  one active analysis tracked in `screenplay_analysis_state`.
- Scene Shot Lists are SQLite-owned project data. They store validated,
  agent-authored scene coverage history as tagged JSON in `scene_shot_list`,
  with one active shot list per scene tracked in `scene_shot_list_state`.
- Lookbooks are durable SQLite-owned project direction. Source Inspiration
  folders and Lookbook image placement are relationships, not embedded section
  JSON.
- Media generation specs and runs are SQLite-owned records. Generated output
  files remain filesystem content until an explicit media import registers and
  attaches them as assets.
- Scene storyboard sheets are compound Assets. The original generated sheet and
  sliced per-shot storyboard images are Asset Files under one Asset, while
  `scene_shot_storyboard_sheet` and `scene_shot_storyboard_image` store the
  relationship to the Scene Shot List and its scoped `shotId` values. Core does
  not store crop boxes, grid cells, or extraction metadata for storyboard
  slicing.
- The canonical project database path is:

```text
<project-folder>/.renku/project.sqlite
```

- `studio-core` owns schema, migrations, validation, project-relative path
  handling, asset path allocation, mutation commands, and projections.
- Studio browser project-open uses bounded project shell and resource queries,
  not a full project-wide surface snapshot. Large navigation and asset
  collections are loaded through paginated resource contracts.
- CLI, Studio server, and UI must call shared core operations instead of
  implementing separate metadata rules.
- Renku Studio is pre-customer software. Do not preserve compatibility with old
  schemas, old setup formats, or old folder structures.

The durable decision history is recorded in:

- `docs/decisions/0003-use-better-sqlite3-with-async-storage-boundary.md`
- `docs/decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `docs/decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md`
- `docs/decisions/0012-store-project-file-references-as-project-relative-paths.md`
- `docs/decisions/0013-use-core-owned-project-assets-and-production-exports.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`
- `docs/decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `docs/decisions/0019-use-durable-lookbooks-as-project-visual-direction.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`

`docs/decisions/0016-use-active-project-sessions-and-eager-surface-data-for-studio-performance.md`
is still accepted for active project SQLite sessions, but its eager surface data
direction is superseded by ADR 0017.

## Focused References

- `docs/architecture/reference/domain-vocabulary.md`
  Defines canonical product/domain terms used across docs, schema, core APIs,
  CLI commands, and UI copy.

- `docs/architecture/core-design-principles.md`
  Defines the shared engineering rules for source of truth, mutation boundaries,
  fail-fast behavior, and compatibility.

- `docs/architecture/layers-of-responsibility.md`
  Defines what belongs in core, server, frontend, CLI, and agent workflows.

- `docs/architecture/reference/project-storage-boundaries.md`
  Explains what belongs in SQLite, what belongs on disk, and how rich text is
  stored.

- `docs/architecture/reference/project-files-and-assets.md`
  Defines assets, asset files, takes, selects, production assets, localization
  folders, and the production/working asset split.

- `docs/architecture/reference/project-relative-paths.md`
  Defines the `ProjectRelativePath` contract and how paths are validated and
  resolved.

- `docs/architecture/reference/visual-language.md`
  Defines Inspiration Analysis, Lookbooks, source Inspiration relationships,
  and Lookbook image placement.

- `docs/architecture/reference/media-generation.md`
  Defines persisted generation specs, generation runs, and separate media
  import for the current media purposes.

- `docs/architecture/json-storage-validation.md`
  Defines the AJV and JSON Schema validation rule for SQLite JSON columns.

- `docs/architecture/naming-guidelines.md`
  Defines public contract, setup, and record naming conventions.

- `docs/architecture/reference/drizzle-migrations.md`
  Defines the Drizzle Kit migration workflow.

- `docs/architecture/reference/structured-diagnostics.md`
  Defines package-boundary diagnostics and error reporting.

## Active Work

Implementation planning for this storage update is split across:

- `plans/active/0005-project-storage-foundation.md`
- `plans/active/0006-asset-commands-and-selects.md`
- `plans/active/0007-production-asset-materialization.md`
- `plans/active/0008-create-from-narrative-starter.md`
- `plans/active/0009-studio-text-asset-editing.md`
- `plans/active/0010-development-sample-project-skill.md`

## Exploration

Design material that is useful but not yet accepted as implementation direction
belongs under `plans/exploration/`.

Current related exploration:

- `plans/exploration/data-model-and-storage-long-draft.md`
- `plans/exploration/generation-definitions-and-catalog.md`
- `plans/exploration/project-generation-definitions.md`
