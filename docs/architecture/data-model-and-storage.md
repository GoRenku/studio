# Renku Studio Data Model And Storage

Date: 2026-08-06

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
- Each Project database owns one `project_settings` singleton row containing
  one complete versioned JSON document. Core owns its sole defaults, AJV
  validation, reads, and full-document replacement. Studio, CLI, and skills do
  not merge fields or calculate settings policy. Future document versions use
  one-way Drizzle data migrations rather than runtime compatibility readers or
  per-setting columns.
- Inspiration folder images are filesystem-owned content and are not registered
  as per-image assets. The persisted Inspiration Analysis JSON is SQLite-owned
  project data.
- Project owns story and development metadata directly: title, logline,
  synopsis, premise, audience, format/runtime, genres, tones, boundaries,
  conflict, dramatic question, themes, historical/dramatized notes, draft
  status, research, assumptions, open questions, and next steps. Screenplay
  storage does not mirror those fields.
- Each Project has one Scene-first Screenplay aggregate. Scenes are canonical
  ordered units. Optional Act and Sequence Sections provide non-owning
  organization through explicit structure entries; a flat ordered Scene list
  is valid. Deleting a Section splices its direct children into the parent.
- Screenplay text uses stable IDs for every Opening Element, Block, Dialogue
  Turn, and Dialogue Part. Separate references bind Cast Members, Locations,
  and Props to Scenes, headings, Blocks, dialogue cues/parts, and exact text
  ranges without mutating prose or requiring `@handle` tokens.
- A Project may deterministically import one supported Final Draft `.fdx` into
  an empty Screenplay and continuously refresh that FDX-backed aggregate. Core
  stores a flat source-ordered Scene projection in SQLite and points the
  singleton import record at the latest exact Project-owned `screenplay_source`
  Asset. Final Draft planning markers never become Act or Sequence Sections.
  Runtime Screenplay reads never parse that source.
- Screenplay Analysis is SQLite-owned project data. It stores validated,
  agent-authored critique history as hierarchy-independent JSON in
  `screenplay_analysis`, with one active analysis tracked in
  `screenplay_analysis_state`. Its three Act segments and optional Scene groups
  partition the canonical Scenes current when it is authored and do not
  reference screenplay Sections. Stored Analysis reads preserve obsolete Scene
  ids and never revalidate history against the current Screenplay.
- Scene Beats are SQLite-owned project data. They store validated,
  agent-authored narrative breakdown history as tagged JSON in
  `scene_beats_revision`, with one active revision per Scene tracked in
  `scene_beats_state`. Runtime create, reset, and focused operations append
  immutable revisions; active selection never deletes history. Scene and Block
  ids are weak historical context, so revising Screenplay content does not
  invalidate or delete Scene Beats history.
- Every Scene has a production number in the shared
  `[1-9][0-9]*[A-Za-z]*` grammar. FDX-backed Projects preserve exact external
  numbers, while agent-authored Projects use durable Core-owned reservations.
  These numbers are human-facing references, not identity or canonical order.
- A Beat is a non-camera narrative unit with a Core-authored durable `id` and
  stable `number` plus the eight opaque authored fields `title`, `description`,
  `narrativeDevelopment`, `narrativePurpose`, `castMemberIds`, `locationIds`,
  `propIds`, and `screenplayBlockIds`. Beat order is the JSON array order, and
  Block relationships use stable IDs rather than array indexes. Missing current
  context produces authoring warnings and does not invalidate stored history.
  Beat descriptions and the other authored fields must not encode framing,
  lenses, camera movement, composition, coverage, or production instructions.
- Shot Plans are Scene-owned mutable authoring aggregates with ordered Shots.
  Every Plan has a Scene-local monotonically increasing integer number. Every
  Shot has a stable production number allocated and reserved by Core; movement
  changes only position, and deletion never releases the number.
  A plan remains editable regardless of generation, Run, or Asset history.
  Core stores no Shot Plan authoring history, revision, status, output table,
  owned video output, owned references, or dependency graph.
- Shot `description` is an intentional SQLite `TEXT` exception for opaque
  Markdown-capable authored text. Agents may author relevant headings, strong
  cinematography terms, and canonical screenplay `@handle` references. Studio
  may enrich exact known handles for read-only presentation, but runtime code
  does not validate, interpret, rewrite, or derive facts from the creative
  text. Each Shot also stores a non-empty title.
  Shot `brief` contains optional Framing, Camera, Motion, Optics, Lighting, and
  approximate duration facts. `optics.focalLengthMm` is a positive number and
  `optics.depthOfField` is optional `shallow | deep`; Optics intent, focus
  target, and Lighting intent remain exact opaque strings. Shot Plan Beat
  `coverage` stores soft Beat context. Both are strict AJV-validated JSON text.
  Missing or stale coverage references produce warnings rather than invalid
  state.
- Cast Design, Location Design, and Prop Design are SQLite-owned project data. They store
  validated, agent-authored department design history as tagged JSON in
  `cast_design`, `location_design`, and `prop_design`, with one active document
  per owner tracked in their corresponding state table.
- Cast Members, Locations, and Props have one canonical authoring path each:
  `renku cast`, `renku location`, and `renku prop`. Screenplay JSON references
  all three existing Project subject types by durable ids without embedding or
  duplicating their facts.
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
- A Shot Plan stores authoring state only: Scene ownership, title, optional Beat
  coverage, ordered Shots, selected/candidate Shot images, timestamps, and
  Trash lifecycle. It stores no GenerationSpec id or generation lifecycle
  state. Copy and Trash operations never read, copy, or mutate generation
  records.
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
- A Storyboard continuity sheet is an ordinary Character, Location, or Prop
  Sheet whose Asset tags include exact `storyboard`. The tag is agent-owned
  intended-use metadata, not a new Asset type, owner, selection, or runtime
  classifier. Production and Storyboard variants remain exact request-scoped
  candidates.
- Location Hero Images are Location-owned Assets with canonical type
  `location_hero`. Common selection chooses zero or one Hero for
  overview/detail imagery and does not create a generation reference.
- Props are ordered durable continuity subjects in `prop`. Prop Design history
  lives in `prop_design` with active state in `prop_design_state`.
- Prop Sheets are Prop-owned `prop_sheet` Assets chosen only by consuming
  GenerationSpecs. Prop Heroes are Prop-owned `prop_hero` Assets with optional
  canonical owner-scoped selection.
- Scene dialogue audio takes are durable scene dialogue media assets. They may
  be selected as exact GenerationSpec references; Shot Plans do not own or
  retain them.
- GenerationSpecs may retain optional
  `authoredFrom: { kind: 'shotPlan', id }` context. The stored value is nullable,
  indexed, one-way, and has no foreign key. Missing or discarded source plans
  never invalidate generation history or independently owned Assets.
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
  title, one-line summary, reference name, ordered intended-use `tags`, locale,
  origin, type, and media kind. Tags are non-null JSON text, structurally
  normalized without semantic interpretation, and default to `[]`. Focused
  attachment may persist summary, reference name, and tags atomically with the
  Asset, membership, file, and provenance. Internal owner keys are shared with
  `selected_asset` but never enter public contracts.
- Canonical selection exists only for Cast Profile, Location Hero, Prop Hero, Lookbook
  card, Shot image, and Scene Beat Storyboard targets. Character Sheets,
  Location Sheets, Prop Sheets, Lookbook Sheets, and Dialogue Audio Takes are selected only
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
- `docs/decisions/0067-use-structured-shot-depth-and-presentational-mentions.md`
- `docs/decisions/0071-use-scene-first-screenplay-and-direct-project-story-metadata.md`
- `docs/decisions/0072-use-hierarchy-independent-screenplay-analysis.md`
- `docs/decisions/0074-use-core-owned-project-workflow-settings.md`

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

## Weak Shot Plan generation source

`media_generation_spec.authored_from_shot_plan_id` is a nullable one-way source
id with no foreign key. `shot_plan_video_input_mode` is nullable storage that
is required only by the Shot Plan video purpose. Generated videos and
auxiliary images use ordinary Project Asset membership; Shot Plans do not
store request, video, dependency, selection, or completion pointers.
