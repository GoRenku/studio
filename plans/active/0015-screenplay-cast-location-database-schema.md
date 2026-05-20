# 0015 Screenplay, Cast, And Location Database Schema

Date: 2026-05-20

Status: active draft

## Scope

Design the first database schema for screenplay, cast, and locations as if the
project is being designed from scratch.

This plan intentionally does not cover:

- commands;
- migrations;
- UI;
- shot lists;
- generation assets;
- import/export workflows;
- validation command behavior.

The old screenplay file-backed plan remains in
`plans/active/0014-screenplay-backed-projects.md` for reference only.

## Principle

SQLite is the canonical store for structured screenplay, cast, and location
state.

YAML and Markdown frontmatter are useful draft/import/export shapes, but they
are not live project state in this plan.

The schema below only uses fields present in the current screenplay YAML,
act YAML, cast description frontmatter/body, and location description
frontmatter/body:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/drafts/urban_basilica
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/references/screenplay-yaml-schema.md
```

## Package Fields Not Stored

The current YAML package has file-layout fields:

- `schema_version`
- `cast_ref`
- `locations_ref`
- `act_refs`

These are not stored in the canonical project database. They describe an import
package layout, not the screenplay itself. Once applied, the database stores the
screenplay, cast, locations, acts, sequences, scenes, blocks, and relationships
directly.

## Storage Style

Use relational tables for objects with identity or relationships:

- cast members;
- locations;
- acts;
- sequences;
- scenes;
- scene-location links;
- blocks.
- block-cast links;
- block-location links.

Use JSON text columns for ordered scalar lists that are not independent objects:

- secondary genres;
- tone;
- content boundaries;
- themes;
- historical basis;
- dramatized elements;
- key beats;
- story functions;
- dialogue lines;
- research sources.

SQLite does not have a dedicated JSON column type in the same sense as
PostgreSQL. For this schema, JSON values should be stored in `text` columns as
canonical serialized JSON. SQLite's JSON functions can still query and validate
that text when needed.

This keeps the schema small while still preserving every content field from the
current source shape.

## Tables

### `screenplay`

Singleton table for screenplay-level project material and revision state.
There is one row in the project database.

```text
screenplay
  title text not null
  intended_audience text
  target_length_label text
  estimated_minutes integer
  genre_primary text
  genre_secondary text
  tone text
  rating_intent text
  boundaries text
  logline text
  summary text
  premise_overview text
  central_conflict text
  dramatic_question text
  themes text
  historical_basis text
  dramatized_elements text
  structure_model text
  status text
  research_sources text
  assumptions_made text
```

Column notes:

- `title` through `dramatized_elements` come from `project`.
- `estimated_pages` is not stored. It is a planning estimate, not durable
  screenplay structure.
- `structure_model` comes from `project.story_arc.structure_model`.
- `status`, `research_sources`, and `assumptions_made` come from
  `revision_state`.
- `open_questions` and `next_iteration_options` are not stored. They are
  interaction guidance for AI iteration, not screenplay state.
- JSON text columns preserve ordered arrays or object arrays exactly enough for
  rendering and later editing.
- No `id` is proposed here because the current model has one screenplay per
  project database.

### `cast_member`

Replaces the existing cast-member shape.

```text
cast_member
  id text primary key
  name text not null
  role text
  age integer
  want text
  need text
  arc text
  voice_notes text
  description text
  position integer not null
```

Changes from the existing table:

- keep `id`, `name`, and `position`;
- remove `kind`;
- remove `short_description`;
- keep/restore `role` because it exists in current cast frontmatter;
- add `age`, `want`, `need`, `arc`, and `voice_notes` from cast frontmatter;
- add `description` from the Markdown body.

### `location`

Replaces the location use case currently represented by generic continuity
references.

```text
location
  id text primary key
  name text not null
  time_period text
  description text
  visual_notes text
  position integer not null
```

Column notes:

- `id`, `name`, and `time_period` come from location frontmatter.
- `description` comes from the Markdown `Description` section.
- `visual_notes` comes from the Markdown `Visual Notes` section.
- `position` preserves location list order where the UI needs one.

### `act`

Stores the screenplay act structure.

```text
act
  id text primary key
  title text not null
  purpose text
  key_beats text
  position integer not null
```

Column notes:

- `id`, `title`, and `purpose` exist in act YAML.
- `key_beats` is JSON text copied from `project.story_arc.acts[].key_beats`.
  It remains part of the act's narrative outline, not its own table.
- `position` comes from act order.
- The current source shape duplicates act title/purpose between
  `project.story_arc.acts` and act files. The database stores one copy.

### `sequence`

Replaces the existing sequence shape for screenplay-backed projects.

```text
sequence
  id text primary key
  act_id text not null references act(id)
  title text not null
  purpose text
  position integer not null
```

Changes from the existing table:

- add `act_id`;
- remove `episode_id` from this first movie-focused schema;
- replace `one_line_summary` with `purpose`, because the current act YAML uses
  `purpose`;
- keep `title` and `position`.

### `scene`

Replaces the existing scene shape for screenplay-backed projects.

```text
scene
  id text primary key
  sequence_id text not null references sequence(id)
  title text not null
  interior_exterior text
  time_of_day text
  story_function text
  position integer not null
```

Changes from the existing table:

- keep `sequence_id`, `title`, and `position`;
- remove `one_line_summary`;
- add `interior_exterior` and `time_of_day` from `scene_setting`;
- add `story_function` as JSON text for the ordered string list.

Locations are not stored as columns on `scene` because scenes can reference more
than one location.

### `scene_location`

Stores `scene_setting.location_ids`.

```text
scene_location
  scene_id text not null references scene(id)
  location_id text not null references location(id)
  position integer not null
  primary key (scene_id, location_id)
```

Column notes:

- `scene_id` and `location_id` store the relationship;
- `position` preserves location order for slugline rendering.

### `block`

Stores screenplay blocks inside scenes.

```text
block
  id text primary key
  scene_id text not null references scene(id)
  type text not null
  text text
  cast_id text references cast_member(id)
  extension text
  parenthetical text
  lines text
  render integer
  position integer not null
```

Column notes:

- `type` stores the block type, such as `action`, `dialogue`, `transition`,
  `title_card`, `super`, `shot`, or `note`;
- `text` stores block text for non-dialogue block types;
- `cast_id`, `extension`, `parenthetical`, and `lines` store dialogue fields;
- `cast_id` is the dialogue speaker relationship for dialogue blocks;
- `lines` is JSON text for the ordered dialogue-line array;
- `render` stores the optional note rendering flag;
- `position` preserves block order inside the scene.

### `block_cast_member`

Stores cast references mentioned inside block text, such as `@urban` in an
action block.

```text
block_cast_member
  block_id text not null references block(id)
  cast_member_id text not null references cast_member(id)
  position integer not null
  primary key (block_id, cast_member_id)
```

Column notes:

- `block_id` and `cast_member_id` store the relationship;
- `position` stores the first mention order inside that block;
- dialogue speakers remain in `block.cast_id`; scene-level cast queries should
  combine `block.cast_id` and `block_cast_member`.

### `block_location`

Stores location references mentioned inside block text, such as
`@theodosian-walls` in an action or shot block.

```text
block_location
  block_id text not null references block(id)
  location_id text not null references location(id)
  position integer not null
  primary key (block_id, location_id)
```

Column notes:

- `block_id` and `location_id` store the relationship;
- `position` stores the first mention order inside that block;
- scene setting locations remain in `scene_location`; scene-level location
  queries should combine `scene_location` and `block_location`.

Untyped `@id` mentions must resolve to exactly one supported target. If the same
ID exists in both cast and locations, validation should fail until the mention
syntax is made explicit or the IDs are changed.

## Proposed Schema Removals

Remove or replace these existing concepts in the screenplay/cast/location slice:

- `cast_member.kind`
- `cast_member.short_description`
- `sequence.episode_id` for this first movie-focused schema
- `sequence.one_line_summary`
- `scene.one_line_summary`
- `continuity_reference` for locations
- `clip` from this schema discussion; shots/clip generation are out of scope

## Deliberately Not Added

Do not add these columns or tables in this schema:

- `project_id`
- `source_id`
- `screenplay_id` on every child table
- `screenplay_scene`
- `screenplay_source_file`
- screenplay-owned cast/location mapping tables
- shot-list tables
- file path columns for screenplay package files

The project database already scopes the project. The table name and foreign keys
scope the object type and containment.
