# 0014 Screenplay-Backed Project Creation And Updates

Date: 2026-05-18

Status: active draft

## Goal

Replace the current movie project creation input with an empty-project-first
workflow and a screenplay-backed narrative model.

Project creation should create an empty Studio project folder with the expected
project folders. The AI agent then works inside that project folder and calls
screenplay commands after writing or editing the screenplay YAML files.

The command split is still:

- `renku create` creates the empty project folder structure;
- the screenplay-drafter skill creates or updates the screenplay source
  hierarchy inside the project;
- `renku screenplay create` registers the screenplay source hierarchy already
  inside the project;
- `renku screenplay update` reconciles later screenplay edits.

After the skill writes or revises those files, the agent should run
`renku validate` and read the resulting errors and warnings. The exact
validation command contract is a later design step, not part of this pass.

The project-local `screenplay/` folder becomes the durable authored source for
script content. `.renku/project.sqlite` stores the metadata and relationships
Studio needs for navigation, project opening, resource loading, validation, and
later production work.

This plan is proposal-only. It does not call for code changes yet.

## Background

The current project creation path uses `ProjectSetup` YAML:

- it is read by `renku create --file`;
- it creates the initial project scaffold;
- after creation, SQLite and project files own durable project state;
- the setup YAML has no lifecycle after project creation.

That was a good first shape for a scaffold, but it is the wrong shape for a
screenplay-centered workflow. The new workflow needs an authored screenplay that
agents can keep editing directly without issuing a large number of metadata
commands for every dialogue line, action line, scene heading, or revision note.

The external screenplay draft at:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/drafts/urban_basilica
```

uses the screenplay-drafter source shape:

```text
screenplay/
  screenplay.yaml
  acts/
    act-1.yaml
    act-2.yaml
    act-3.yaml
cast/
  urban/
    description.md
locations/
  theodosian-walls/
    description.md
```

The schema reference is:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/references/screenplay-yaml-schema.md
```

Important properties of that format:

- `screenplay/screenplay.yaml` is the entrypoint;
- the entrypoint starts at the YAML document root; it is not wrapped in a
  `screenplay` object;
- `schema_version` is currently `0.1`;
- `cast_ref` points to the cast folder, usually `../cast`;
- `locations_ref` points to the locations folder, usually `../locations`;
- `act_refs` points to act YAML files relative to
  `screenplay/screenplay.yaml`;
- cast and location definitions live as `description.md` files with Markdown
  frontmatter under those referenced folders;
- acts contain sequences, scenes, and screenplay blocks;
- list order defines ordering;
- stable IDs such as cast folder IDs, location folder IDs, `act-1`,
  `seq-001`, `scene-001`, `beat-001`, and `block-001` support navigation and
  rendering;
- `project` combines the former document/concept material and owns
  `story_arc`;
- `scene_setting.location_ids` links scenes to location folder IDs;
- dialogue blocks use `cast_id` to link to cast folder IDs;
- non-dialogue text may contain `@id` mentions for cast or locations;
- screenplay prose stays renderer-friendly inside YAML blocks.

The sample and schema are now close enough to treat this as the current source
shape for the next data-model pass. Do not build compatibility branches around
the older wrapped `screenplay:` entrypoint shape.

## Current Studio Constraints

This plan must follow the accepted Studio architecture:

- SQLite owns durable metadata and relationships.
- The filesystem owns authored content and generated media.
- Project-owned file references stored in SQLite are project-relative paths.
- Paragraph-length, formatted, or frequently edited prose belongs in files, not
  SQLite columns.
- Metadata mutations go through `studio-core` services and Renku commands.
- Agents may directly edit content files when the user is editing content.
- Unknown fields in import-style YAML are warnings and ignored.
- Required missing or invalid fields are structured errors.
- No obsolete format should be kept as a compatibility path.
- Drizzle TypeScript schema remains the database source of truth, with
  migrations generated through Drizzle Kit when implementation begins.

The current code already has:

- `project`, `episode`, `sequence`, `scene`, and `clip` tables;
- top-level sequences for standalone movies;
- episode-owned sequences for series;
- project, sequence, scene, and clip Markdown asset relationships;
- cast member records;
- existing place/continuity records, which should be revisited against the new
  `Locations` product language;
- paginated resource loading for navigation;
- `ProjectSetup` reader/writer code that creates initial records from YAML.

The current code does not yet have:

- an `act` table;
- empty project creation that creates the project folder structure;
- screenplay create/update services;
- screenplay navigation/resource contracts;
- screenplay UI panels;
- `shot` records or shot-owned asset relationships.

## Recommendation

Use in-project source folders and add **Screenplay**, **Cast**, **Locations**,
**Shot List**, and **Shot** as explicit domain areas in Studio.

The important split:

- `renku create` owns project folder creation and creates the expected empty
  project folder structure;
- `screenplay/` owns authored narrative/script content;
- `cast/` owns cast definitions and cast-owned reference/generated assets;
- `locations/` owns location definitions and location-owned reference/generated
  assets;
- `shotlist/` owns the production plan for realizing that screenplay as shots;
- SQLite owns project metadata, cast names, location names, acts, sequences,
  scenes, shots, file references, and asset relationships;
- Studio rendering reads screenplay content through core-owned project-relative
  paths and parser contracts, not by asking agents to copy dialogue into
  database columns.

This keeps the source comfortable for agents and keeps Studio fast, queryable,
and explicit.

## Product Model

### `Screenplay`

`Screenplay` is the authored narrative/script source for a project.

It includes:

- project material, such as title, intended audience, target length, genre,
  tone, content notes, logline, summary, premise overview, central conflict,
  dramatic question, themes, historical basis, and dramatized elements;
- story arc material under `project.story_arc`, including acts and key beats;
- `cast_ref` and `locations_ref` links to sibling cast and location folders;
- act files containing sequences, scenes, scene headings, and screenplay blocks;
- revision state for agent iteration.

`Screenplay` is a durable project concept, not a temporary setup shape. Do not
name the parser or command types `ProjectSetup`.

### `Act`

`Act` becomes a first-class Studio narrative structure for standalone movies.

The proposed standalone movie hierarchy becomes:

```text
Standalone movie project
  -> Screenplay
    -> Screenplay narrative
    -> Acts
      -> Act 1
        -> YAML for Act 1
      -> Act 2...
  -> Cast
    -> Cast Member 1
      -> cast definition Markdown file
         SQLite: cast member name and ordering
         frontmatter: age and other structured cast fields
         body: cast description
      -> character sheets, portraits, voice references, and other cast assets
    -> Cast Member 2
  -> Locations
    -> Location 1
      -> location definition Markdown file
         frontmatter: structured location fields
         body: description and visual notes
      -> location images, boards, and other location assets
    -> Location 2
  -> Props (TBD)
  -> Visual Language (TBD)
  -> Potential other feature folders
  -> Shot List
    -> Act
      -> Sequence
        -> Scene
          -> Shot 1
          -> Shot 2 ...
```

Series-specific hierarchy and commands are deferred. Keep the existing
`Episode` concept in mind, but do not design series ownership in this pass.

Why this change is justified:

- earlier domain vocabulary treated `Act` as future screenplay-style planning;
- the screenplay source now makes acts an immediate product need;
- `Act` should not replace `Sequence`; it sits above sequences;
- `Episode` still matters for series and should not be synthesized for movies.

### `Cast`

`Cast` is the project section for cast members: people, narrators, groups, and
other recurring story subjects that need production continuity.

The screenplay entrypoint should not inline cast definitions. Cast definitions
live in folders referenced by `cast_ref`. The folder name is the durable cast
ID, and the same ID is repeated in the Markdown frontmatter.

```text
cast/
  urban/
    description.md
```

`cast_member` should remove `kind` and `role`. Those are not stable enough to be
core columns now. Age, role-like story notes, voice notes, wants, needs, and arc
can live in Markdown frontmatter/body and evolve with the cast definition
schema.

### `Locations`

`Locations` is the project section for places that need visual and production
continuity.

The current place/continuity storage should be revisited against this product
language. The plan should not introduce screenplay-owned location mapping
tables. Location definitions live in folders referenced by `locations_ref`. The
folder name is the durable location ID, and the same ID is repeated in the
Markdown frontmatter.

```text
locations/
  theodosian-walls/
    description.md
```

Location images and other assets should be stored under the location folder and
registered through the asset graph.

### `Sequence`

`Sequence` remains the production-facing grouping of scenes. It is still the
right level for later production planning and generation workflows.

In screenplay-backed projects, sequences are derived from act files:

```yaml
id: act-1
title: The Offer
purpose: Open on the siege, then rewind to Urban's failed attempt to sell his work to Byzantium.
sequences:
  - id: seq-001
    title: The Sound That Opens Stone
    scenes: []
```

### `Scene`

`Scene` remains the story unit inside a sequence.

SQLite should store enough scene metadata to support navigation, selection,
future scene-to-shot-list conversion, and project validation. The full scene
body stays in YAML.

### `Shot List`

`Shot List` is the production plan for realizing screenplay scenes.

It is a product section and source folder, not a database table. In SQLite, the
shot list for a scene is represented by the ordered `shot` rows whose parent is
that scene.

The shot list should live in its own project folder, separate from the authored
screenplay:

```text
screenplay/   authored narrative and script YAML
shotlist/     production shot planning folder
```

This separation matters because the screenplay answers "what happens in the
story?" while the shot list answers "what needs to be shot to realize it?"

### `Shot`

Rename the current structural `Clip` concept to `Shot`.

`Shot` is the industry term for the production unit Studio should plan,
generate, review, and refine. A generated **clip** is an artifact produced from
one shot or from a selected list of shots. It should not be the canonical
narrative/production structure term.

The screenplay format does not currently define shots. Therefore
`renku screenplay create` should create acts, sequences, and scenes, but should
not invent shots from screenplay blocks. A future explicit command should
convert a scene, scene beat, or selected block range into a shot list.

This matters because a screenplay block is not always a shot:

- one action paragraph may need several shots;
- several dialogue blocks may belong to one generated shot;
- a montage marker may become a sequence of shots;
- a scene heading is navigational text, not a production unit.

## Project Folder Structure

`renku create` should create an empty project. It should not require a
screenplay file.

The command should create the project folder, `.renku/project.sqlite`, and the
folders an AI agent needs before screenplay work begins.

Recommended empty project layout:

```text
<project>/
  .renku/
    project.sqlite
    tmp/

  screenplay/
    acts/

  cast/

  locations/

  props/

  visual-language/

  shotlist/

  production-assets/
    master/
      shotlist/
      shared/

```

Folder responsibilities:

- `screenplay/` contains the authored narrative screenplay YAML. It is the
  source of truth for the narrative screenplay.
- `cast/`, `locations/`, `props/`, and `visual-language/` contain their own
  definitions, reference material, and feature-owned files.
- `shotlist/` is the project area for shot planning. It is a folder, not a
  promise of a separate shot-list YAML schema. It contains the assets related to
  shots, organized by act, sequence, scene, and shot; it is not a flat shot-list
  folder.
- `production-assets/` contains assets intended for post-production tools such
  as DaVinci Resolve. It should stay clean and contain only post-production
  relevant outputs.

There is no `working-assets/` folder and no separate `Exports/` folder in this
model. Project assets live under the feature folder that owns them. Multilingual
outputs, dubbing, subtitles, and other language-specific deliverables are
post-production concerns and should be exported into `production-assets/` when
needed.

Do not place screenplay source under `.renku/`; that directory is for Studio
metadata and implementation-owned state.

## Screenplay Source Folder Format

Use the screenplay-drafter source shape as the starting point. Keep the
screenplay as a small set of YAML files in the project-local `screenplay/`
folder, not one monolithic file.

Recommended source layout:

```text
<project>/
  screenplay/
    screenplay.yaml         required entrypoint
    acts/
      act-1.yaml
      act-2.yaml
      act-3.yaml
  cast/
    urban/
      description.md
  locations/
    theodosian-walls/
      description.md
```

The screenplay entrypoint starts at the YAML root and should focus on narrative
structure plus references to sibling cast and location folders:

```yaml
schema_version: 0.1
cast_ref: ../cast
locations_ref: ../locations
act_refs:
  - ./acts/act-1.yaml
  - ./acts/act-2.yaml
  - ./acts/act-3.yaml
project:
  title: Basilica
  story_arc:
    structure_model: three_act
    acts: []
revision_state: {}
```

Cast and location definitions should live in their own top-level folders. The
screenplay may reference cast and location source IDs, but it should not own
their definitions.

Cast and location definition files use Markdown frontmatter plus body content:

```text
cast/<cast-id>/description.md
locations/<location-id>/description.md
```

The folder ID and frontmatter `id` must match. Frontmatter `name` is the
canonical display name that Studio can store for navigation. Longer descriptive
text, visual notes, role-like notes, voice notes, wants, needs, and arc remain
in Markdown/frontmatter and should not be copied into SQLite by default.

Keep the screenplay source snake_case for now because it is already authored by
the screenplay skill and reads like a content schema. Use camelCase in
TypeScript public contracts and lower_snake_case in SQLite columns, following
the existing Studio conventions at each boundary.

## SQLite Representation

SQLite should store enough screenplay representation to make Studio navigable,
validated, and updateable without duplicating the full screenplay text.

Do not replace the existing `project`, `episode`, `sequence`, `scene`, or
`cast_member` model. The first schema change should be deliberately small:
screenplay registration state, act hierarchy, source IDs for reconciliation,
and the `Clip` to `Shot` naming correction when the production model is
implemented.

Hard rules for this schema pass:

- do not add foreign-key columns back to the project row; each project database
  lives inside exactly one project folder and represents exactly one project;
- do not copy screenplay title, logline, draft label, language, story arc,
  act purpose, estimated pages, scene heading prose, beats, or block details
  into SQLite;
- do not add `screenplay_source_file`; the screenplay source follows a fixed
  project-folder convention, so it does not need a table of arbitrary source
  files;
- do not add `screenplay_scene`; `scene` is the domain table for scenes;
- do not add screenplay-owned cast or location mapping tables;
- do not add a `shot_list` table;
- every new column must have a clear navigation, relationship, or update
  reconciliation job.

### Proposed Minimum Schema

```text
screenplay
  id text primary key
  content_hash text
  created_at text not null
  updated_at text not null

act
  id text primary key
  screenplay_id text not null references screenplay(id)
  source_id text not null
  position integer not null
  created_at text not null
  updated_at text not null

shot
  id text primary key
  scene_id text not null references scene(id)
  position integer not null
  created_at text not null
  updated_at text not null
```

Column explanations:

| Table | Column | Why it exists |
| --- | --- | --- |
| `screenplay` | `id` | Gives the single registered screenplay an internal stable identity so acts can reference it. This is not a project identifier. |
| `screenplay` | `content_hash` | Lets `renku screenplay update` know whether the registered screenplay source hierarchy changed since the last registration/update. If implementation does not need this optimization, omit it. |
| `screenplay` | `created_at` | Existing Studio audit convention for when the screenplay was first registered. |
| `screenplay` | `updated_at` | Existing Studio audit convention for when the screenplay registration metadata was last reconciled. |
| `act` | `id` | Internal stable database identity for the act row. |
| `act` | `screenplay_id` | Connects each act to the one registered screenplay row. |
| `act` | `source_id` | Stores the YAML act ID, such as `act-1`, so updates can match the same act after the file changes. |
| `act` | `position` | Preserves act order for navigation without parsing the full screenplay on every sidebar query. |
| `act` | `created_at` | Existing Studio audit convention for when the act row was created. |
| `act` | `updated_at` | Existing Studio audit convention for when the act row was last reconciled from YAML. |
| `shot` | `id` | Internal stable database identity for a planned shot. |
| `shot` | `scene_id` | Attaches the shot to the scene it realizes. |
| `shot` | `position` | Defines the shot order inside the scene; this ordered set is the shot list. |
| `shot` | `created_at` | Existing Studio audit convention for when the shot was created. |
| `shot` | `updated_at` | Existing Studio audit convention for when the shot was last changed. |

Existing table changes:

```text
cast_member
  remove kind
  remove role
  keep name as the durable SQLite label

sequence
  add act_id text references act(id)
  add source_id text

scene
  add source_id text
```

Existing-column explanations:

| Table | Column/change | Why it exists |
| --- | --- | --- |
| `cast_member` | remove `kind` | Cast member type labels are authoring details and should live in the cast Markdown frontmatter/body until a specific product need justifies a column. |
| `cast_member` | remove `role` | Story role is authored content. Keeping it in Markdown avoids duplicating and normalizing prose that the agent will revise. |
| `cast_member` | keep `name` | The Cast list needs a durable, queryable display name without reading every cast Markdown file. |
| `sequence` | `act_id` | Places existing sequences under acts for navigation and screenplay update reconciliation. |
| `sequence` | `source_id` | Stores the YAML sequence ID so updates can preserve the same sequence record. |
| `scene` | `source_id` | Stores the YAML scene ID so updates can preserve the same scene record. No separate screenplay-scene table is needed. |

The current place/continuity storage should be reviewed separately before
proposing location columns. This plan should not invent a new location schema in
the screenplay pass.

The current `clip` table should be renamed or replaced by `shot` during the
implementation slice. Do not keep `Clip` as a compatibility name in public
contracts once the shot model is accepted.

Generated clips should be represented as assets attached to shots or to an
explicit multi-shot generation record, not as the structural child of a scene.
The existing `clip_asset` relationship should become a `shot_asset` relationship
as part of the same naming correction.

Do not add a `shot_list` table. A shot list is the ordered list of `shot` rows
for a scene. It is not a separate database entity.

Do not add a `screenplay_beat` table. Beats, key beats, story arc details,
scene functions, and other narrative details stay in screenplay YAML.

Recommended constraints:

- one `screenplay` row in the project database for the first implementation;
- unique `(screenplay_id, source_id)` in `act`;
- unique screenplay-derived `sequence.source_id` and `scene.source_id` within
  the screenplay being updated;
- unique `(scene_id, position)` in `shot`.

### Why Not Store Blocks In SQLite?

Do not store every screenplay block as a database row in the first model.

Example from Urban Basilica:

```yaml
- id: block-005
  type: action
  text:
    - A low wind moves through the basilica shell.
```

That content is exactly what agents need to revise directly. If every line is a
row, ordinary script iteration becomes a high-volume metadata mutation workflow.
That fights the intended AI-agent editing model and bloats the database with
content that is more readable and reviewable in YAML.

SQLite should not store block-level anchors in the first model. The `scene`
row's `source_id` is enough to locate the scene in YAML when Studio needs to
render it or when a later shot-planning feature converts it into shots.

### Why Keep Cast And Locations Outside Screenplay Tables?

Cast and locations are project feature areas, not screenplay child records.

The screenplay may reference cast members and locations, but their definitions,
Markdown frontmatter, descriptions, visual notes, images, boards, character
sheets, and other assets should live under `cast/` and `locations/`.

Do not add screenplay-owned cast or location mapping tables. When screenplay
YAML references cast or location IDs, validation should check against the
current cast and location records directly.

## Mapping To Existing Studio Records

This section needs a separate design pass after the basic storage model is
accepted.

Current rule for this draft: do not map screenplay prose or overview fields into
other Studio records. The screenplay YAML remains the source of truth for title,
logline, premise, story arc, act notes, scene text, and blocks.

Screenplay registration should only create or update the structural records
needed for Studio navigation and later production work:

- one `screenplay` registration row;
- one `act` row per YAML act;
- one `sequence` row per YAML sequence, linked to its act;
- one `scene` row per YAML scene, linked to its sequence.

For this pass, sequence and scene rows should receive only the fields required
by the existing schema plus the explicit source ID fields described above. Any
proposal to copy titles, summaries, scene headings, beats, or other narrative
content into SQLite must be justified column by column in a later revision.

Create no shots during screenplay registration. Shots should be created later
by an explicit screenplay-to-shot-list workflow or shot-list UI. Generated clips
should then be created from one shot or from a selected list of shots.

## Empty Project Create Flow

`renku create` should create an empty project and the project folder
structure.

Recommended behavior:

1. Validate project command input.
2. Resolve the configured storage root.
3. Create the project folder and `.renku/project.sqlite`.
4. Insert empty project metadata.
5. Create the empty `screenplay/`, `screenplay/acts/`, `cast/`, `locations/`,
   `props/`, `visual-language/`, and `shotlist/` folders.
6. Create the `production-assets/` root for post-production exports.
7. Return a structured creation report.

The creation report should include:

```json
{
  "projectName": "basilica",
  "projectPath": "/storage/basilica",
  "databasePath": "/storage/basilica/.renku/project.sqlite",
  "screenplayPath": "screenplay/",
  "castPath": "cast/",
  "locationsPath": "locations/",
  "propsPath": "props/",
  "visualLanguagePath": "visual-language/",
  "shotlistPath": "shotlist/",
  "productionAssetsPath": "production-assets/",
  "created": {
    "screenplays": 0,
    "acts": 0,
    "sequences": 0,
    "scenes": 0,
    "shots": 0
  }
}
```

`ProjectCounts` should add `screenplays`, `acts`, and `shots`. It should not add
a shot-list count because a shot list is a scene-owned ordering of shots, not a
database entity. The generated artifact count should not be called `clips` in
the narrative structure counts.

## Screenplay Create Flow

`renku screenplay create` should register the screenplay source that already
exists inside the project folder.

Recommended behavior:

1. Resolve the target project from the current project folder.
2. Read `screenplay/screenplay.yaml`.
3. Validate root-level `schema_version`.
4. Resolve `cast_ref`, `locations_ref`, and `act_refs` relative to
   `screenplay/screenplay.yaml`.
5. Validate all referenced files and folders exist and stay inside the project.
6. Validate stable source IDs, cast frontmatter IDs, location frontmatter IDs,
   scene `location_ids`, dialogue `cast_id` values, and non-dialogue `@id`
   mentions.
7. Insert the screenplay registration row and content hash.
8. Insert act records.
9. Create sequence and scene records from acts.
10. Return a structured registration report with counts and warnings.

The command should fail if a screenplay is already registered. Use
`renku screenplay update` for later revisions.

## Screenplay Update Flow

`renku screenplay update` should update the existing project metadata from the
in-place screenplay source hierarchy.

The update should be a structured metadata mutation, not a loose file copy.

Recommended behavior:

1. Resolve the target project from the current project folder.
2. Parse and validate `screenplay/screenplay.yaml`, referenced act files, and
   referenced cast/location description files.
3. Compare source IDs from SQLite with source IDs in the current screenplay
   source hierarchy.
4. Update the screenplay content hash.
5. Upsert acts by `act.source_id`.
6. Upsert sequences by `sequence.source_id` within the screenplay.
7. Upsert scenes by `scene.source_id` within the screenplay.
8. Mark removed source objects according to the accepted deletion policy.
9. Emit scoped `studio.projectResourcesChanged` events.

### Deletion Policy

This needs a product decision before implementation.

Recommended first behavior:

- if an act, sequence, or scene source ID disappears from the screenplay, delete
  the derived metadata object only if it has no shots, generated assets,
  selects, or production relationships below it;
- otherwise fail with structured diagnostics explaining the blocking records.

Why this conservative rule:

- screenplay edits should not silently destroy production work;
- Studio should fail fast instead of guessing how to move generated work;
- a later explicit archive/rehome workflow can be designed when needed.

Alternative:

- keep removed items as detached or archived records.

Reject for the first implementation because it adds lifecycle states before the
product semantics are clear.

### Shots During Update

Do not delete or recreate shots just because a screenplay scene changed.

Shots are production planning units created after screenplay registration. A
scene update may make shots stale later, but that should be tracked by a future
generation/stale state model, not by destructive screenplay synchronization.

If a scene is removed and has shots or generated clip artifacts, the update
should fail with a diagnostic until the user explicitly handles those production
records.

## Sidebar And Studio Resources

Add a `Screenplay` section in the Studio sidebar directly under the project
information panel.

Recommended order:

```text
Project information panel
Screenplay
Cast
Locations
Visual Language
Shot List
Sequences
```

The Screenplay section should eventually show:

- screenplay overview;
- acts;
- sequences inside each act;
- scenes inside each sequence;
- optional rendered screenplay pages.

Do not build the full UI in this plan. The data contract should anticipate it.

### Resource Contracts

Follow ADR 0017 resource loading. Do not add the whole screenplay body to the
project shell.

Recommended resources:

```text
ProjectShell
  counts
  first screenplay navigation page or screenplay summary row only

ScreenplayResource
  project
  revisionState

ActResource
  act source ID and order
  sequence navigation rows

SceneResource
  scene source ID
  screenplay blocks for that one scene
```

These resources may parse screenplay YAML on demand. They should not imply that
the same screenplay content is duplicated into SQLite columns.

Navigation rows should stay compact:

```ts
interface ActNavigationRow {
  id: string;
  sourceId: string;
  number: number;
  sequenceCount: number;
  sceneCount: number;
}
```

Full block content should load only when the user opens a screenplay scene or a
rendered screenplay view.

### Frontend Naming

When implementation starts, use feature folders such as:

```text
packages/studio/src/features/movie-studio/screenplay/
  screenplay-panel.tsx
  screenplay-overview-resource.ts
  screenplay-renderer.tsx
```

Use local shadcn-style controls from `packages/studio/src/ui` for all controls.
Do not introduce raw HTML interactive controls in feature code.

## Validation Rules

The screenplay-drafter workflow should always be followed by `renku validate`
so the agent receives structured errors and warnings before it continues. This
plan only records that expectation. The exact `renku validate` command shape,
output format, and whether `renku screenplay create/update` automatically
shares the same validators should be designed in the next pass.

Use structured diagnostics with a new code family:

```text
SCREENPLAY001 invalid YAML
SCREENPLAY002 unsupported root
SCREENPLAY003 unsupported schema version
SCREENPLAY010 missing required field
SCREENPLAY011 invalid field value
SCREENPLAY012 unknown field warning
SCREENPLAY020 invalid file reference
SCREENPLAY021 missing referenced file
SCREENPLAY022 duplicate source ID
SCREENPLAY023 unresolved source reference
SCREENPLAY024 invalid screenplay hierarchy
SCREENPLAY030 screenplay already registered
SCREENPLAY031 screenplay source missing from project
SCREENPLAY040 update would remove production-backed records
```

Validation should collect all actionable issues before failing when practical.

Required validation:

- the entrypoint root object must contain `schema_version`, `cast_ref`,
  `locations_ref`, `act_refs`, `project`, and `revision_state`;
- root-level `schema_version` must match the accepted schema value;
- `renku screenplay create` and `renku screenplay update` must run against an
  existing Renku Studio project;
- `screenplay/screenplay.yaml` must exist;
- `cast_ref`, `locations_ref`, and `act_refs` must resolve relative to
  `screenplay/screenplay.yaml`;
- referenced files and folders must not escape the project folder;
- cast folders must contain `description.md`;
- location folders must contain `description.md`;
- cast folder IDs must match frontmatter `id`;
- location folder IDs must match frontmatter `id`;
- all `act_refs` must exist when declared;
- every act must have a stable source ID;
- every sequence must have a stable source ID;
- every scene must have a stable source ID;
- every screenplay block must have a stable source ID;
- duplicate source IDs within the same source ID family are errors;
- `scene_setting.location_ids` must resolve to current location IDs;
- dialogue `cast_id` values must resolve to current cast IDs;
- non-dialogue `@id` mentions should resolve to current cast or location IDs;
- top-level sequences are invalid in screenplay act files because sequences
  must be contained by acts.

Unknown fields should be warnings and ignored. They must not drive database
columns or public contract shape.

## Naming Guidance

Use these names:

| Concept | Public contract | Database table | Internal input/parser shape |
| --- | --- | --- | --- |
| Screenplay | `Screenplay` | `screenplay` | `ScreenplaySource` |
| Act | `Act` | `act` | `ActRecord` |
| Cast Member | `CastMember` | `cast_member` | `CastMemberDefinitionSource` |
| Location | `Location` | `location` after storage review, if accepted | `LocationDefinitionSource` |
| Shot List | `ShotList` | no table | no source schema in this pass |
| Shot | `Shot` | `shot` | `ShotRecord` |

Do not use:

- `ProjectSetup` for screenplay source types;
- screenplay-owned cast or location mapping tables;
- `shot_list` as a database table;
- `Clip` as the structural production planning unit;
- `sampleProject` for user-facing project creation;
- `Chapter` as the schema term for acts or sequences;
- `Beat` as a production unit until the screenplay-to-shotlist design is
  accepted;
- `data`, `item`, `manager`, `helper`, or `detail` as stand-ins for domain
  concepts.

## Relationship To Old ProjectSetup YAML

Because Renku Studio is pre-customer software, do not keep the old
sample/project setup format as a compatibility layer for movie creation.

Recommended direction:

- `renku create` creates an empty project and project folders;
- `renku screenplay create` registers the in-project `screenplay/` source;
- `renku screenplay update` reconciles later in-project screenplay edits;
- the previous `ProjectSetup` path is removed or renamed only if another
  accepted feature still needs it;
- tests should describe the current screenplay-backed behavior;
- docs should move accepted screenplay creation details into
  `docs/architecture/` after this plan is reviewed.

If a non-screenplay scaffold remains useful later, design it as a separate
current feature. Do not keep the old sample-project format as a hidden fallback.

## Open Questions

1. Should each project support only one screenplay source in the first
   implementation?

   Recommendation: yes. Add multiple screenplay drafts only after we decide
   how draft comparison, active draft selection, and production linkage should
   work.

2. Should screenplay source IDs be copied directly into `sequence.source_id`
   and `scene.source_id`?

   Recommendation: store `source_id` on `act`, `sequence`, and `scene` because
   it makes update reconciliation direct. Do not add a separate scene metadata
   table.

3. What should remain in the `cast_member` table?

   Recommendation: keep the cast member `name` as the durable SQLite label and
   remove `kind` and `role`. Additional cast columns need a separate explicit
   reason before they are added.

4. Should the existing place/continuity table be renamed to `location`, or
   should `Location` be introduced as a separate project concept?

   Recommendation: treat `Locations` as the product concept. During the schema
   slice, review the existing storage and either rename callers directly to the
   accepted `Location` model or introduce a minimal `location` table. Do not add
   screenplay-owned location mapping tables.

5. Should `story_arc.key_beats` become durable SQLite rows?

   Recommendation: defer unless the first Screenplay panel needs beat
   navigation. The immediate navigation hierarchy can use acts, sequences, and
   scenes.

6. Should `revision_state` be stored in SQLite?

   Recommendation: no for the first implementation. Keep it in YAML and expose
   it through the Screenplay overview resource.

7. Should `renku screenplay update` ever write or normalize the YAML files?

   Recommendation: no for the first implementation. The AI agent edits
   `screenplay/` directly; the command validates and updates SQLite metadata
   from those files. A future formatter command can be explicit if needed.

8. What should a generated multi-shot clip attach to?

   Recommendation: attach one-shot generated clips to `Shot`. For multi-shot
   generations, add an explicit generation record that references an ordered
   list of shots and registers the generated clip as an asset. Do not make
   `Clip` the structural parent.

## Implementation Slices

### Slice 1: Accepted Architecture

- Review this plan.
- Update domain vocabulary to include `Screenplay`, `Act`, `Cast`, `Locations`,
  `Shot List`, and `Shot`.
- Update the project creation architecture reference so `renku create` creates
  empty projects and project folders.
- Add an ADR if the Screenplay/Act hierarchy is accepted.

### Slice 2: Core Parser And Validation

- Add screenplay source contracts under `studio-core`.
- Add parser and validation with `SCREENPLAY...` diagnostics.
- Resolve referenced YAML files safely.
- Parse root-level screenplay references, `project`, `project.story_arc`, acts,
  sequences, scenes, scene settings, blocks, cast definitions, location
  definitions, and explicit cast/location references.
- Add tests against the Urban Basilica sample shape.

### Slice 3: SQLite Schema

- Add Drizzle schema for the minimal `screenplay` and `act` tables.
- Rename or replace `Clip` structural tables/contracts with `Shot`.
- Add `shot` and shot-owned asset relationships. Do not add a `shot_list`
  table.
- Remove `kind` and `role` from `cast_member`.
- Decide the accepted `Location` storage shape after reviewing the existing
  place/continuity model.
- Add `act_id` and `source_id` fields where accepted.
- Explain every added column in the plan before implementing it.
- Generate migrations with Drizzle Kit.
- Update `ProjectCounts`.
- Update database access helpers and project validation.

### Slice 4: Empty Project Create

- Replace `renku create --file` project setup handling with empty project
  creation.
- Create `screenplay/`, `screenplay/acts/`, `cast/`, `locations/`, `props/`,
  `visual-language/`, `shotlist/`, and `production-assets/` folders.
- Do not create `working-assets/` or `Exports/`.
- Create project metadata and empty counts.
- Return a structured creation report.
- Remove obsolete setup YAML tests and docs.

### Slice 5: Screenplay Create And Update

- Add `renku screenplay create`.
- Add `renku screenplay update`.
- Keep detailed `renku validate` command design for the next pass, but make the
  screenplay parser/validator reusable by that command.
- Reconcile records by source ID.
- Preserve records where source IDs match.
- Fail with structured diagnostics when an update would remove production-backed
  records.
- Emit scoped resource invalidation events.

### Slice 6: Studio Resources And Sidebar

- Add compact screenplay navigation resources.
- Add a Screenplay section under project information in the sidebar.
- Add a placeholder Screenplay panel that loads overview data.
- Defer full screenplay rendering until the UI design is ready.

### Slice 7: Shot List Planning

- Add scene-owned shot navigation that renders as the shot list.
- Add a future command that creates or updates shot lists from screenplay
  scenes.
- Keep generated clip artifacts attached to shots or explicit multi-shot
  generation records.

## Verification Plan

When implementation begins, tests should cover:

- empty project create creates `.renku/project.sqlite`, `screenplay/`,
  `screenplay/acts/`, `cast/`, `locations/`, `props/`, `visual-language/`, and
  `shotlist/`;
- empty project create creates `production-assets/` and does not create
  `working-assets/` or `Exports/`;
- valid in-project screenplay source registers for a standalone movie project;
- screenplay entrypoint parsing uses root-level `schema_version`, `cast_ref`,
  `locations_ref`, `act_refs`, `project`, and `revision_state`;
- cast and location folder IDs match their `description.md` frontmatter IDs;
- Urban Basilica sample imports with 3 acts, project cast/location references,
  5 sequences, and 10 scenes after the sample is updated to the accepted schema;
- screenplay blocks are not inserted as individual SQLite rows;
- screenplay YAML files stay under `screenplay/`;
- `cast_ref` and `locations_ref` resolve to project-local folders;
- cast definitions live under `cast/` and keep the cast member name in SQLite;
- location definitions live under `locations/` and keep the location name in
  SQLite;
- acts contain sequences in navigation order;
- scenes use `scene.source_id` for YAML reconciliation and do not require a
  separate screenplay-scene table;
- unknown fields warn and are ignored;
- missing referenced files fail with structured diagnostics;
- duplicate source IDs fail with structured diagnostics;
- unresolved cast and location references fail with structured diagnostics;
- update preserves mapped records when source IDs are unchanged;
- update fails before deleting scene records that have shots or assets;
- project shell does not include full screenplay block content.

Run:

```bash
pnpm test:core
pnpm test:cli
pnpm test
pnpm check
```

Only run migration generation after the schema slice is approved, following
`docs/architecture/drizzle-migrations.md`.

## Non-Goals

- No full Screenplay UI in this plan.
- No traditional screenplay PDF/export renderer in this plan.
- No screenplay-to-shotlist conversion command in this plan.
- No generated media or generation tasks during screenplay registration.
- No project import/export manifest.
- No compatibility loader for the old sample-project YAML.
- No hand-written Drizzle migration SQL before the schema is accepted.
