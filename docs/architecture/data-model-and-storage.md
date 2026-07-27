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

- SQLite is the source of truth for durable metadata, exclusive Asset
  membership, domain ordering, canonical selection, status, task records, cost
  records, and Asset registration.
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
- Scene Beat Sheets are SQLite-owned project data. They store validated,
  agent-authored narrative breakdown history as tagged JSON in
  `scene_beat_sheet`, with one active Beat Sheet per scene tracked in
  `scene_beat_sheet_state`.
- Production Scene Numbers are stable human-facing references stored in the
  separate `scene_production_number` registry. Scene ids remain the durable
  identity used by screenplay JSON, relationships, URLs, and existing command
  inputs. Registry rows remain after a Scene is removed, so omitted status is
  derived from current Scene existence and reserved numbers are never reused.
  The registry intentionally has no Scene foreign key; Core commands enforce
  that every current Scene has exactly one canonical reservation.
- A Beat is a non-camera narrative unit with exactly eight authored fields:
  `id`, `title`, `description`, `narrativeDevelopment`, `narrativePurpose`,
  `castMemberIds`, `locationIds`, and `screenplayBlockIndexes`. Beat order is
  the JSON array order.
  Beat descriptions and the other authored fields must not encode framing,
  lenses, camera movement, composition, coverage, or production instructions.
- Shot Plans are Scene-owned mutable authoring aggregates with ordered Shots.
  A plan remains editable regardless of generation, Run, or Asset history.
  Core stores no Shot Plan authoring history, revision, status, output table,
  owned video output, owned references, or dependency graph.
- Shot `description` is an intentional SQLite `TEXT` exception for opaque
  Markdown-capable authored text. Each Shot also stores a non-empty title.
  Shot `brief` contains optional Framing, Camera, Motion, Optics, Lighting, and
  approximate duration facts; Shot Plan Beat `coverage` stores soft Beat
  context. Both are strict AJV-validated JSON text. Missing or stale coverage
  references produce warnings rather than invalid state.
- Cast Design and Location Design are SQLite-owned project data. They store
  validated, agent-authored department design history as tagged JSON in
  `cast_design` and `location_design`, with one active document per owner
  tracked in `cast_design_state` and `location_design_state`.
- Cast Members and Locations have one canonical authoring path each:
  `renku cast` and `renku location`. Screenplay JSON references existing Cast
  Members and Locations by durable ids; it does not create or update those fact
  records.
- Lookbooks are durable SQLite-owned project direction. Each project has at
  most one Production Lookbook and at most one Storyboard Lookbook. Lookbook
  owner rows are permanent and cannot enter Trash. The two roles share one
  internal Lookbook asset model while keeping typed definitions. Source
  Inspiration folders and Lookbook image placement are focused domain facts,
  not embedded section JSON. A Lookbook may select one `lookbook_image` for
  canonical card imagery; there is no Storyboard-to-Production source
  relationship.
- Media generation specs and runs are SQLite-owned records. Generated output
  files remain filesystem content until an explicit media import registers and
  attaches them as assets. A saved spec is mutable while `frozen_at` is null and
  permanently frozen when live execution begins.
- A Shot Plan identifies zero or one `lastGenerationSpec`: the most recently
  associated request configuration to continue from, regardless of Run success
  or failure. Run and Asset lifecycle events never move or clear it. A mutable
  last Spec is edited directly; a changed attempt after freezing copies it into
  a new mutable Spec. Copying a plan may likewise copy its last Spec. Neither
  flow copies Runs, Assets, Asset Files, provenance, or referenced media.
- Durable generated and imported asset files live under the folder for the
  domain object that owns them. Current asset paths must not start with
  `generated/`; temporary agent/debug files belong under top-level `tmp/`;
  user scratch references under `research/` must not be registered as asset
  files. Generation specs may still name a `research/` file as a one-off
  reference input when the file is not reusable project state.
- Location Sheets are durable image Assets owned by Locations with canonical
  type `location_sheet`. Each sheet has one `primary` image file and a concise
  persisted description. A Location can have many Location Sheets. Video
  requests may select exact Location Sheet files through GenerationSpec
  references without adding Shot Plan relationships.
- Location Hero Images are Location-owned Assets with canonical type
  `location_hero`. Common selection chooses zero or one Hero for
  overview/detail imagery and does not create a generation reference.
- Scene dialogue audio takes are durable scene dialogue media assets. They may
  be selected as exact GenerationSpec references; Shot Plans do not own or
  retain them.
- `video.create` outputs are ordinary Project Assets under `videos/`. Their
  Asset Files retain exact managed-Run or frozen agent-external-Spec
  provenance. Optional `authoredFrom` context is information-only and never
  creates Shot Plan ownership. Shot Plan and Asset Trash lifecycles are
  independent.
- `shot.image` outputs are exclusively Shot-owned planning image candidates
  with canonical type `shot_image`. Common selection chooses zero or one
  candidate. Import may atomically select when that is the accepted intent.
  Plan copy creates independent Asset and AssetFile identities for only the
  selected images.
- Scene Storyboard Images are ordinary Assets exclusively owned by logical
  Scene Beats. The
  `scene.storyboard-sheet` generation purpose may create a temporary composite
  sheet for batch prompting, but import stores only the cropped images as
  `scene_storyboard_image` Assets with direct Beat membership. Common selection
  chooses each Beat's current image. Core does not store crop boxes, grid
  cells, or extraction metadata for storyboard slicing.
- Cast Voices are durable Cast Member-owned records in `cast_voice`. A Cast
  Voice stores the Renku reference name, editorial purpose, playable sample
  asset, and `sampleSource` provenance. Provider-specific handles live in
  `cast_voice_provider_registration`, so the same Cast Voice can carry an
  ElevenLabs dialogue-audio TTS registration and a Kling video voice-control
  registration without treating either provider id as the Cast Voice itself.
  The playable sample is still a normal Cast Member-owned audio Asset with type
  `cast_voice_sample`; generic Asset deletion must reject that sample while the
  Cast Voice points at it.
- Every Asset has exactly one row in `asset_membership`. The Asset row owns
  title, one-line summary, reference name, purpose, locale, origin, type, and
  media kind. Internal owner keys are shared with `selected_asset` but never
  enter public contracts.
- Canonical selection exists only for Cast Profile, Location Hero, Lookbook
  card, Shot image, and Scene Beat Storyboard targets. Character Sheets,
  Location Sheets, Lookbook Sheets, and Dialogue Audio Takes are selected only
  inside the consuming GenerationSpec references.
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
- `docs/decisions/0028-use-durable-department-design-documents.md`
- `docs/decisions/0029-use-cast-voice-as-durable-project-data.md`
- `docs/decisions/0036-use-unsliced-location-sheets.md`
- `docs/decisions/0061-use-mutable-copy-and-freeze-shot-plans.md`
- `docs/decisions/0064-use-exclusive-asset-membership-and-scoped-selection.md`

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

- `docs/architecture/project-asset-storage-conventions.md`
  Defines the current owner-folder placement rules for durable assets,
  `tmp/`, `research/`, Storyboards, and image edit version suffixes.

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
- `plans/active/0125-project-asset-storage-conventions-and-urban-basilica-migration.md`

## Exploration

Design material that is useful but not yet accepted as implementation direction
belongs under `plans/exploration/`.

Current related exploration:

- `plans/exploration/data-model-and-storage-long-draft.md`
- `plans/exploration/generation-definitions-and-catalog.md`
- `plans/exploration/project-generation-definitions.md`
