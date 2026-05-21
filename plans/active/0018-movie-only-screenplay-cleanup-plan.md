# 0018 Movie-Only Screenplay Cleanup Plan

Date: 2026-05-21

Status: active

## Summary

This plan replaces the incomplete setup-YAML, clip, continuity-reference, and
episode-era implementation with a movie-first screenplay workflow.

The intended workflow is:

```text
renku create <project-name> --title <title>
renku project open <project-name>
renku screenplay create --file <screenplay-create-json> --json
renku screenplay show --json
renku screenplay apply --file <screenplay-operations-json> --json
```

The project create command only creates a clean empty movie project. It no
longer imports story structure, clips, continuity references, or setup YAML.
Screenplay content is authored afterward through screenplay-specific commands.

The screenplay model is deliberately movie-only for now. Series and episodes are
not partially supported. They should be redesigned later as their own product
and data-model effort because series arcs, season arcs, episode arcs, character
arcs, and multi-story structures are materially different from a single movie.

## Decisions

- `renku create --file` is removed from the current flow.
- Setup YAML reader, setup writer, setup contracts, setup Markdown materializers,
  and setup tests are removed instead of updated.
- Clips are removed from the public contract, database model, navigation,
  Studio resources, asset targets, production export paths, and tests.
- Continuity references are removed from the public contract, database model,
  navigation, asset targets, and tests.
- Episodes and series support are removed from the active implementation for
  now. No hidden placeholder API should remain.
- Scene blocks are scene-owned structured JSON, not first-class durable rows.
- Blocks do not have durable IDs and do not have temporary keys.
- Canonical screenplay reads use durable IDs.
- Create and mutation inputs may use temporary keys only for newly created
  durable entities.
- Cast and locations have stored human-readable handles for `@handle` mentions.
- Move operations must fully specify source parent, destination parent, and
  exact placement. There are no default fallbacks.

## Project Creation

### CLI Contract

Replace:

```bash
renku create --file project.yaml
```

with:

```bash
renku create <project-name> --title <title>
```

Supported initial flags:

- `--title <title>`: required.
- `--aspect-ratio <ratio>`: optional, same meaning as project information.
- `--logline <text>`: optional.
- `--summary <text>`: optional.
- `--storage-root <path>`: optional, existing behavior.
- `--json`: optional, existing behavior.

The command must fail fast when:

- the project name is missing;
- `--title` is missing;
- positional input has more than one project name;
- `--file` is provided;
- the target project folder already exists;
- the configured storage root is missing or invalid.

`--file` should fail with a structured CLI error. The message should explain
that project creation no longer imports setup YAML and that screenplay content
must be created with `renku screenplay create --file`.

### Core Contract

Replace `createFromSetup` with a movie-project creation command such as
`createMovieProject`. The exact function name can follow the surrounding
service style, but it should describe the domain action and should not mention
setup.

The service input should contain:

```ts
interface CreateMovieProjectInput extends RenkuConfigPathOptions {
  projectName: string;
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
  idGenerator?: ProjectIdGenerator;
}
```

The result can continue to use `ProjectCreateReport`, but `created` counts must
match the new model. They should not include clips, continuity references, or
episodes.

### Created State

A newly created movie project contains:

- one project row;
- optional project information fields from the create flags;
- no screenplay row;
- no cast members;
- no locations;
- no acts;
- no sequences;
- no scenes;
- no registered assets.

Project information, including the project summary, is SQLite data. The project
row is the source of truth for summaries; Markdown files and text assets must
not be used for project information storage. Files outside SQLite are reserved
for true assets such as images, audio, video, subtitle files, and similar media.

## Movie-Only Project Contract

Remove project type branching from the current public contract unless another
active plan requires it immediately.

The project contract should not expose:

- `ProjectType = 'standaloneMovie' | 'series'`;
- `episodes`;
- `Episode`;
- `EpisodeNavigationRow`;
- episode sequence navigation;
- `episodeId` on sequence navigation;
- episode counts;
- Studio routes under `/episodes/...`.

The movie navigation hierarchy is:

```text
project
  -> acts
    -> sequences
      -> scenes
```

If the current Studio UI does not yet display acts explicitly, it may still
consume sequence navigation through a movie-only resource, but the underlying
screenplay data model should not rely on fake episode rows or hidden series
branches.

## Screenplay JSON Contracts

The API distinguishes between canonical stored output and authoring input.

### Canonical `screenplay`

`renku screenplay show --json` returns:

```json
{
  "kind": "screenplay",
  "screenplay": {
    "title": "Urban Basilica"
  },
  "cast": [
    {
      "id": "cast_abcd2345",
      "handle": "urban",
      "name": "Urban"
    }
  ],
  "locations": [
    {
      "id": "location_jkmp6789",
      "handle": "foundry",
      "name": "Foundry"
    }
  ],
  "acts": [
    {
      "id": "act_qrst4567",
      "title": "Act I",
      "sequences": [
        {
          "id": "sequence_wxyz7892",
          "title": "The Commission",
          "scenes": [
            {
              "id": "scene_cdef3456",
              "title": "Urban Enters The Foundry",
              "setting": {
                "locationIds": ["location_jkmp6789"]
              },
              "blocks": [
                {
                  "type": "action",
                  "text": "@urban studies the cracked bronze."
                },
                {
                  "type": "dialogue",
                  "castMemberId": "cast_abcd2345",
                  "extension": "V.O.",
                  "lines": ["No furnace is innocent."]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Canonical output must round-trip:

```bash
renku screenplay show --json > screenplay.json
renku screenplay validate --file screenplay.json --json
```

Canonical output must not include:

- `key`;
- `localKey`;
- `locationRefs`;
- `castMemberRefs`;
- `castMemberRef`;
- `locationReferences`;
- `castMemberReferences`;
- `castMemberReference`.

### Create Input `screenplayCreate`

`renku screenplay create --file` accepts `kind: "screenplayCreate"`.

New durable objects require temporary `key` and must not provide durable `id`:

- cast members;
- locations;
- acts;
- sequences;
- scenes.

Blocks do not have `key` or `id`.

References in create input use full reference field names:

- `locationReferences`;
- `castMemberReferences`;
- `castMemberReference`.

Each reference object must contain exactly one of:

- `id`, for an existing target;
- `key`, for a target created in the same command.

For initial create, most references will use keys because all cast, locations,
acts, sequences, and scenes are new. The same rule also supports future create
flows that add screenplay content into a project with existing reusable
catalogs, if that becomes a supported command.

Example:

```json
{
  "kind": "screenplayCreate",
  "screenplay": {
    "title": "Urban Basilica"
  },
  "cast": [
    {
      "key": "urban",
      "handle": "urban",
      "name": "Urban"
    }
  ],
  "locations": [
    {
      "key": "foundry",
      "handle": "foundry",
      "name": "Foundry"
    }
  ],
  "acts": [
    {
      "key": "act-one",
      "title": "Act I",
      "sequences": [
        {
          "key": "commission",
          "title": "The Commission",
          "scenes": [
            {
              "key": "urban-enters",
              "title": "Urban Enters The Foundry",
              "setting": {
                "locationReferences": [{ "key": "foundry" }]
              },
              "blocks": [
                {
                  "type": "action",
                  "text": "@urban studies the cracked bronze before touching the latch.",
                  "castMemberReferences": [{ "key": "urban" }],
                  "locationReferences": [{ "key": "foundry" }]
                },
                {
                  "type": "dialogue",
                  "castMemberReference": { "key": "urban" },
                  "extension": "V.O.",
                  "lines": ["No furnace is innocent."]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

The command returns `generatedIds`:

```json
{
  "generatedIds": [
    {
      "kind": "castMember",
      "path": ["cast", "0", "key"],
      "key": "urban",
      "id": "cast_abcd2345"
    }
  ]
}
```

Use `key`, not `localKey`, in all new create and mutation contracts.

### Operations Input `screenplayOperations`

Existing objects are addressed by durable IDs. New objects inside add operations
use keys.

Examples:

```json
{
  "kind": "screenplayOperations",
  "operations": [
    {
      "operation": "castMember.add",
      "castMember": {
        "key": "apprentice",
        "handle": "apprentice",
        "name": "Young Apprentice"
      }
    },
    {
      "operation": "scene.add",
      "sequenceId": "sequence_wxyz7892",
      "placement": { "afterId": "scene_cdef3456" },
      "scene": {
        "key": "apprentice-warning",
        "title": "The Warning",
        "setting": {
          "locationReferences": [{ "id": "location_jkmp6789" }]
        },
        "blocks": [
          {
            "type": "dialogue",
            "castMemberReference": { "key": "apprentice" },
            "lines": ["The mold is splitting."]
          }
        ]
      }
    }
  ]
}
```

Update/delete/move operations must use durable IDs only:

```json
{
  "kind": "screenplayOperations",
  "operations": [
    {
      "operation": "scene.move",
      "sceneId": "scene_cdef3456",
      "fromSequenceId": "sequence_wxyz7892",
      "toSequenceId": "sequence_mnpq4567",
      "placement": {
        "afterId": "scene_before",
        "beforeId": "scene_after"
      }
    }
  ]
}
```

`scene.update` remains a full scene update, including setting and blocks. There
are no block-level add/update/delete/move operations.

### JSON Validation Policy

Every JSON document accepted by a command and every JSON blob stored in SQLite
must have an explicit schema and must be validated before it is trusted.

This applies to:

- `screenplayCreate` command input;
- canonical `screenplay` command input and read validation;
- `screenplayOperations` command input;
- scene block arrays stored in the scene table;
- screenplay metadata arrays such as genre, tone, themes, research sources, and
  assumptions;
- act-level structured arrays such as key beats;
- scene-level structured arrays such as story function;
- any future JSON column or JSON file introduced by this work.

Implementation requirements:

- define JSON schemas for all public JSON command documents;
- define JSON schemas for nested JSON fragments that are stored independently
  in SQLite text columns;
- register schemas with AJV 2020 rather than relying only on TypeScript types;
- validate JSON command input immediately after parsing and before semantic
  normalization;
- validate JSON fragments before writing them to SQLite;
- validate stored JSON fragments when reading or validating the current
  database state;
- fail with structured diagnostics when stored JSON is malformed or no longer
  matches the current schema;
- avoid `unknown[]` in public contracts unless the schema intentionally accepts
  arbitrary JSON and the reason is documented in this plan or accepted docs.

`JSON.parse` by itself is not enough. It proves syntax, not contract shape.

## Entity Keys, IDs, Handles, And References

The implementation must keep these concepts distinct.

### Durable ID

The database owns durable IDs. They are generated by core and persisted in
SQLite.

Durable IDs are used for:

- canonical screenplay output;
- update/delete/move operation targets;
- asset targets;
- Studio resource identifiers;
- canonical relationship fields such as `locationIds`.

### Temporary Key

Temporary keys exist only inside create and mutation input documents.

Temporary keys are used for:

- identifying newly created cast, locations, acts, sequences, and scenes inside
  the same command;
- resolving references from one new object to another new object in the same
  command;
- reporting generated durable IDs back to the caller.

Temporary keys are not persisted and are not returned by `show`.

Validation rules:

- new durable objects require `key`;
- new durable objects must not provide `id`;
- existing objects require `id`;
- existing objects must not provide `key`;
- duplicate keys in the same command fail;
- a `{ "key": "..." }` reference must resolve to a new object in the same
  command;
- a `{ "id": "..." }` reference must resolve to an existing object or a durable
  object already in the current draft after earlier operations in the same
  batch.

### Handle

Handles are persisted, human-readable identifiers for screenplay mentions.

Handles are used for:

- `@handle` mentions in non-dialogue block text;
- readable script authoring;
- stable references in rendered/script-adjacent text.

Handles should be required for cast and locations. They must be unique across
all mentionable records in a project so `@mara` cannot ambiguously refer to both
a cast member and a location.

Handle validation:

- non-empty string;
- lower-case slug style;
- starts with a letter;
- contains only letters, digits, and hyphens;
- no duplicate handle across cast and locations;
- no unknown `@handle` mention in non-dialogue block text.

If the existing naming guidelines already define an ID or slug format that is
more specific, use that existing rule instead of inventing a second one.

### Duplicate Entity Warnings

Likely duplicate reusable records should warn but not fail.

Warnings apply to:

- exact or near duplicate cast member names;
- exact or near duplicate location names.

Warnings do not apply globally to scene or sequence titles because repeated
scene names can be valid during drafting.

The warning suggestion should tell the agent to reuse the existing durable ID
when it meant the same cast member or location.

## Scene Blocks

### Storage Model

Store blocks as one JSON column on the `scene` table, for example
`scene.blocks_json`.

Do not keep:

- `block` table;
- `block_cast_member` table;
- `block_location` table;
- block durable IDs;
- block temporary keys;
- block-level asset targets;
- block-level operations.

Scene updates replace the scene-owned block JSON after validation.

### Block JSON Schema And AJV Validation

Scene blocks must have an explicit JSON schema owned by the screenplay contract.
The schema is not an informal TypeScript-only shape.

Implementation requirements:

- define a reusable block JSON schema alongside the screenplay JSON schemas;
- register that schema with the same AJV 2020 validator infrastructure used for
  screenplay JSON validation;
- validate every scene `blocks` array with AJV before persistence;
- validate block JSON during `screenplayCreate`, `screenplayOperations`, and
  canonical `screenplay` validation;
- map AJV block validation errors into structured diagnostics with field paths
  that point to the invalid block;
- keep semantic validation, such as unknown cast IDs, unknown location IDs,
  unresolved keys, and unknown `@handle` mentions, as a second validation pass
  after AJV structural validation.

The block schema should be shared by:

- canonical scene blocks, which use durable ID fields;
- create/update scene blocks, which may use mutation reference fields.

Do not let the database accept arbitrary block JSON and rely on readers to
discover malformed content later.

### Supported Initial Block Types

Supported block types:

- `action`;
- `dialogue`;
- `parenthetical`;
- `transition`;
- `special_heading`;
- `title_card`;
- `super`;
- `shot`;
- `note`.

### Block Shapes

`action`, `transition`, `special_heading`, `title_card`, `super`, `shot`, and
`note` use:

```json
{
  "type": "action",
  "text": "@mara studies the tunnel door before touching the rusted latch."
}
```

`note` may include:

```json
{
  "type": "note",
  "text": "Consider replacing this exposition with a visual clue.",
  "render": false
}
```

`dialogue` uses:

```json
{
  "type": "dialogue",
  "castMemberId": "cast_abcd2345",
  "extension": "V.O.",
  "parenthetical": "(low)",
  "lines": ["There were once passageways to the old world."]
}
```

In create and add/update input, dialogue may use:

```json
{
  "type": "dialogue",
  "castMemberReference": { "key": "narrator" },
  "extension": "V.O.",
  "lines": ["There were once passageways to the old world."]
}
```

Canonical output uses `castMemberId`.

### Mention Processing

Non-dialogue text blocks may use `@handle` mentions for cast and location
records.

Mention processing applies to:

- `action.text`;
- `special_heading.text`, if it contains mentions;
- `title_card.text`, if it contains mentions;
- `super.text`, if it contains mentions;
- `shot.text`;
- `note.text`, if it contains mentions.

Mention processing does not apply to:

- dialogue `lines`;
- dialogue `parenthetical`;
- dialogue `extension`.

The write path should validate mentions and may derive relationship indexes in
memory for generation context. It should not recreate block relationship tables
unless a later accepted plan introduces derived indexes.

## Move Operations

Move operations must not infer a parent.

### Sequence Move

Required shape:

```json
{
  "operation": "sequence.move",
  "sequenceId": "sequence_to_move",
  "fromActId": "act_source",
  "toActId": "act_target",
  "placement": {
    "afterId": "sequence_before",
    "beforeId": "sequence_after"
  }
}
```

Rules:

- `sequenceId` must exist.
- `fromActId` must exist.
- `toActId` must exist.
- `sequenceId` must currently be a child of `fromActId`.
- placement siblings must be children of `toActId`.
- if both `afterId` and `beforeId` are supplied, they must be adjacent in
  `toActId` after removing the moved sequence from its source position.
- moving to the beginning uses only `beforeId`;
- moving to the end uses only `afterId`;
- a move into an empty target act should require an explicit empty-placement
  form if that case is supported. Do not silently append.

If the empty-target case is needed, use:

```json
{
  "placement": { "position": "only" }
}
```

Do not accept an omitted placement for moves.

### Scene Move

Required shape:

```json
{
  "operation": "scene.move",
  "sceneId": "scene_to_move",
  "fromSequenceId": "sequence_source",
  "toSequenceId": "sequence_target",
  "placement": {
    "afterId": "scene_before",
    "beforeId": "scene_after"
  }
}
```

Rules mirror sequence moves:

- `sceneId` must exist.
- `fromSequenceId` must exist.
- `toSequenceId` must exist.
- `sceneId` must currently be a child of `fromSequenceId`.
- placement siblings must be children of `toSequenceId`.
- neighbor pairs must be adjacent after removing the moved scene.
- no missing-parent or first-sequence fallback is allowed.

### Add Placement

Add operations may support omitted placement as append. That is acceptable for
creation because the new object has no current location.

Move operations are different: they must require explicit placement because
moving is always order-sensitive.

## Removing Clips

Remove public and internal clip concepts from the current model.

Areas to clean:

- client contracts:
  - `Clip`;
  - `ClipNavigationRow`;
  - `ClipDesignResource`;
  - `clipCount`;
  - `clips` arrays on scenes;
  - `StudioSelection` entries for clips;
  - asset targets with `kind: 'clip'`.
- core resources:
  - clip navigation;
  - clip design;
  - clip parent chain helpers;
  - fake scene-as-clip projections;
  - clip rich text roles.
- asset handling:
  - `clip:` CLI target parsing;
  - `assets:clip:*` resource keys;
  - `surface:clip-design:*` resource keys;
  - any remaining `clip_asset` access helpers;
  - clip-specific production export paths.
- Studio:
  - `/clips/:clipId/design` routes;
  - `/scenes/:sceneId/clips` routes;
  - clip-loading hooks;
  - clip design panels;
  - tests and fixtures that contain clips.
- docs and active plans:
  - update only documents that represent current accepted direction or active
    implementation work;
  - do not churn historical plans just for naming cleanup.

Scene-level assets should remain. If a previous clip asset actually maps to a
scene asset, call it a scene asset directly.

## Removing Continuity References

Remove continuity references from the current model because locations are now
explicit records and props or other reusable production entities should be added
as first-class tables later.

Areas to clean:

- client contracts:
  - `ContinuityReference`;
  - `ContinuityReferenceNavigationRow`;
  - `continuityReferences` arrays;
  - continuity counts;
  - asset targets with `kind: 'continuityReference'`.
- database:
  - TypeScript schema file for continuity references;
  - continuity reference access helpers;
  - continuity reference asset helpers;
  - references from generic asset relationship code.
- Studio/API:
  - navigation routes;
  - project shell fields;
  - fixtures and tests.
- docs:
  - update current architecture docs to say locations are explicit and continuity
    reference buckets are removed.

Do not replace continuity references with a generic `misc` or `detail` bucket.
When props are needed, add a prop model deliberately.

## Database And Migration Plan

Follow the Drizzle Kit workflow documented in
`docs/architecture/drizzle-migrations.md`.

Implementation order:

1. Update the Drizzle TypeScript schema.
2. Generate SQL from `packages/core`:

   ```bash
   pnpm drizzle-kit generate --config drizzle.config.ts --name movie_screenplay_cleanup
   ```

3. Review the generated SQL.
4. If Drizzle cannot express the destructive cleanup cleanly, document the
   reason in the migration file comments and keep the custom SQL in the Drizzle
   migration folder.
5. Bump the runtime project store schema generation.
6. Add `PRAGMA user_version = <generation>;` to the migration because runtime reads and
   writes require the new schema.
7. Apply migrations to development projects through the existing project
   migration path, not runtime readers.

Expected schema direction:

- remove `block`, `block_cast_member`, and `block_location`;
- add scene block JSON storage;
- remove continuity reference schema exports;
- ensure old clip and continuity tables remain dropped in generated snapshots;
- add `handle` to cast and location tables;
- add uniqueness/indexing for handles;
- keep scene locations as structured scene-setting relationships;
- keep sequence and scene asset tables;
- remove any remaining clip asset table/access type from current schema.

If existing development data cannot be safely migrated, use an intentional
destructive migration. This repo is pre-customer and the project rules forbid
compatibility layers for obsolete data shapes.

## Validation And Diagnostics

Use structured diagnostics at command/package boundaries.

Recommended existing codes:

- `PROJECT_DATA200`: screenplay JSON failed validation.
- `PROJECT_DATA206`: required field missing.
- `PROJECT_DATA207`: unsupported kind, operation, block type, or value.
- `PROJECT_DATA208`: invalid type or malformed scalar value.
- `PROJECT_DATA209`: duplicate key, duplicate durable ID, or duplicate handle.
- `PROJECT_DATA210`: unknown durable ID, unknown key reference, or unknown
  `@handle` mention.
- `PROJECT_DATA211`: malformed reference object.
- `PROJECT_DATA212`: invalid placement target or invalid neighbor pair.
- `PROJECT_DATA213`: protected delete would orphan assets or relationships.
- `PROJECT_DATA214`: unknown field warning.
- `PROJECT_DATA215`: likely duplicate reusable entity warning.
- `PROJECT_DATA219`: validated write failed unexpectedly.

If a new code is needed, add it deliberately and update tests that document the
current command contract.

Important validation rules:

- Unknown fields in screenplay JSON remain warnings unless the current command
  shape requires strict rejection.
- Unknown fields from removed setup YAML no longer matter because setup YAML is
  not accepted.
- All validation for create/apply must run before any database write.
- All JSON command inputs and SQLite-stored JSON fragments must be validated
  with AJV-backed schemas, not only parsed.
- Validate duplicate keys and handles across the whole command.
- Validate references after applying earlier operations in the same batch to an
  in-memory draft.
- Validate scene block JSON with AJV before persistence.
- Run semantic block validation after AJV, including cast/location references
  and `@handle` mentions.
- Validate `@handle` mentions against the post-operation cast/location catalog.
- Warn on likely duplicate cast/location names.
- Fail on duplicate handles.
- Fail on unresolved temporary keys.
- Fail on any fallback-prone move input.

## Service And Module Cleanup

High-level implementation shape:

- Replace setup-specific command modules with a movie project creation command.
- Replace screenplay persistence modules that still know about `localKey` and
  old ref fields.
- Split screenplay handling into clear responsibilities:
  - schema constants and TypeScript contracts;
  - JSON structural validation;
  - create/operation normalization;
  - key-to-ID allocation;
  - reference resolution;
  - semantic validation;
  - database write plans;
  - database read projections.
- Keep client-safe types in `packages/core/src/client`.
- Keep database access and Drizzle schema in `packages/core/src/server`.
- Do not add non-index re-export facades.
- Update callers directly when removing clip, continuity, setup, or episode
  APIs.

Suggested names should use domain terms, for example:

- `create-movie-project.ts`;
- `screenplay-create-normalization.ts`;
- `screenplay-reference-resolution.ts`;
- `screenplay-scene-blocks.ts`;
- `screenplay-write-plan.ts`.

Avoid vague names such as `helper`, `manager`, `data`, or `detail`.

## Studio And HTTP Surface

Studio should consume the cleaned movie hierarchy:

```text
project
  -> acts
    -> sequences
      -> scenes
```

Remove or replace:

- clip design surface;
- clip navigation loading;
- continuity reference navigation;
- episode navigation;
- fake route fixtures that still model clips;
- server route tests that assert clip pages.

If a scene design surface is needed immediately, introduce it as scene design
using `SceneDesignResource`. Do not keep a clip design resource that points at a
scene.

When touching `packages/studio`, use only the local shadcn-style UI components
from `packages/studio/src/ui` for controls.

## Tests

### Core Tests

Add or update tests for:

- clean movie project creation;
- rejecting `create --file` at the CLI/service boundary;
- empty movie project read;
- screenplay create from `screenplayCreate`;
- generated ID report from keys;
- canonical `screenplay show` output;
- `show` output validating successfully;
- no `key` fields in canonical output;
- no old `localKey` or `*Refs` fields in canonical output;
- create references to new keys;
- create references to existing IDs where supported;
- unresolved key reference failure;
- unknown durable ID failure;
- duplicate temporary key failure;
- duplicate handle failure;
- duplicate or likely duplicate cast/location name warning;
- supported block types;
- invalid block type failure;
- dialogue block required fields;
- note `render: false`;
- non-dialogue `@handle` validation;
- dialogue lines not mention-processed;
- scene update replacing full structured blocks;
- sequence move source-parent validation;
- scene move source-parent validation;
- move placement at beginning/end/between;
- invalid neighbor pair failure;
- empty target parent placement behavior, if supported.

### CLI Tests

Add or update tests for:

- `renku create movie-name --title "Movie Name"`;
- `renku create --file project.yaml` failure;
- CLI help showing the new create command;
- screenplay create with `screenplayCreate`;
- screenplay show/validate round-trip;
- screenplay apply with newly added keyed objects;
- screenplay apply with existing IDs;
- JSON diagnostics for invalid references and invalid placement.

### Studio Tests

Add or update tests for:

- project shell without continuity references;
- movie navigation without episodes;
- scene navigation without clips;
- selection context without clip selection;
- asset routes without clip targets;
- fixtures that use scene assets instead of clip assets.

### Architecture Tests

Add or update tests that prevent:

- setup YAML modules from remaining in active server command paths;
- public clip contracts from being exported;
- public continuity reference contracts from being exported;
- CLI code importing database/Drizzle modules directly;
- non-index re-export facades.

## Acceptance Criteria

- `rg "localKey|locationRefs|castMemberRefs|castMemberRef"` finds only obsolete
  historical plans/docs or intentionally documented migration notes, not active
  code paths.
- `rg "Clip|clipId|clips|clip:" packages/core/src packages/cli/src packages/studio/src`
  finds no current public clip model, command, route, or resource surface.
- `rg "ContinuityReference|continuityReferences|continuity_reference"` finds no
  current public model, command, route, schema, or resource surface.
- `rg "ProjectSetup|createFromSetup|setup YAML|create --file"` finds no active
  create implementation or CLI help references.
- `renku create <project-name> --title <title>` creates a clean project.
- `renku screenplay create --file` creates screenplay data from temporary keys.
- `renku screenplay show --json` emits canonical ID-based JSON.
- `renku screenplay validate --file <show-output>` succeeds.
- sequence and scene moves fail without full source, target, and placement.
- every public JSON document and every SQLite-stored JSON fragment touched by
  screenplay code has an explicit AJV-backed schema.
- blocks are persisted as scene-owned JSON with no block IDs.
- block JSON has an explicit JSON schema and all screenplay write/validate paths
  enforce it with AJV.
- `pnpm test:core`, `pnpm test:cli`, relevant Studio tests, and `pnpm check`
  pass.

## Implementation Checklist

- [x] Update this plan if implementation discovers an unavoidable product or
      migration constraint not covered here.

### Project Creation

- [x] Replace `renku create --file` CLI behavior with
      `renku create <project-name> --title <title>`.
- [x] Remove setup YAML wording from CLI help and examples.
- [x] Add a structured error for file-based project creation.
- [x] Replace `createFromSetup` in the project data service with a movie create
      command.
- [x] Remove setup reader, shape reader, contracts, referenced-file loading,
      Markdown setup materialization, setup writer, and setup fixtures.
- [x] Update project create reports and counts to remove clips, continuity
      references, and episodes.

### Movie-Only Contract

- [x] Remove project type branching from current client contracts.
- [x] Remove episode client types, counts, navigation rows, service methods, and
      Studio routes.
- [x] Update movie navigation to use acts, sequences, and scenes only.
- [x] Remove tests and fixtures that create or expect episode rows.

### Screenplay JSON

- [x] Add `screenplayCreate` contract and schema.
- [x] Add a documented JSON validation policy to the implementation docs or
      accepted architecture docs if this plan becomes accepted direction.
- [x] Ensure every public screenplay JSON document has an AJV-backed schema.
- [x] Ensure every SQLite-stored screenplay JSON fragment has an AJV-backed
      schema.
- [x] Replace unbounded `unknown[]` public fields with explicit schemas or a
      documented intentional arbitrary-JSON contract.
- [x] Validate stored JSON fragments during current-database validation.
- [x] Convert malformed stored JSON failures into structured diagnostics.
- [x] Change temporary object labels from `localKey` to `key`.
- [x] Add mutation-only `locationReferences`, `castMemberReferences`, and
      `castMemberReference`.
- [x] Ensure canonical `screenplay` accepts and emits only durable ID
      relationship fields.
- [x] Remove canonical schema support for `locationRefs`, `castMemberRefs`, and
      `castMemberRef`.
- [x] Update unknown-field walker for the new canonical and mutation-only
      shapes.
- [x] Update generated ID reports to use `key`.
- [x] Add validation for key/id usage by operation type.
- [x] Add validation for unresolved keys and unknown IDs.

### Handles And Mentions

- [x] Add cast member handles.
- [x] Add location handles.
- [x] Enforce handle format.
- [x] Enforce handle uniqueness across mentionable records.
- [x] Add `@handle` mention extraction for non-dialogue block text.
- [x] Validate unknown mentions.
- [x] Ensure dialogue lines are not mention-processed.
- [x] Add duplicate-name warnings for likely duplicate cast/location records.

### Scene Blocks

- [x] Add scene block JSON storage to the Drizzle schema.
- [x] Remove block tables from the active schema.
- [x] Remove block IDs from client contracts and command reports.
- [x] Add an explicit block JSON schema.
- [x] Register the block JSON schema with the AJV 2020 validator.
- [x] Validate scene block arrays with AJV in `screenplayCreate`,
      `screenplayOperations`, and canonical `screenplay` validation paths.
- [x] Map AJV block validation errors to structured diagnostics with precise
      block paths.
- [x] Implement semantic block validation for all initial block types after AJV
      structural validation.
- [x] Persist and read scene blocks through the scene JSON column.
- [x] Keep `scene.update` as full scene replacement.
- [x] Remove any block-level operation assumptions from tests and docs.

### Moves

- [x] Require `fromActId`, `toActId`, and `placement` for `sequence.move`.
- [x] Require `fromSequenceId`, `toSequenceId`, and `placement` for
      `scene.move`.
- [x] Validate source parent assertions.
- [x] Validate target parent existence.
- [x] Validate placement siblings are inside the target parent.
- [x] Validate neighbor-pair adjacency when both `afterId` and `beforeId` are
      supplied.
- [x] Remove first-act and first-sequence fallback behavior.
- [x] Add tests for beginning, end, between, wrong parent, and invalid neighbor
      moves.

### Clip Removal

- [x] Remove clip client contracts and exports.
- [x] Remove clip navigation and clip design resources.
- [x] Remove clip asset target parsing and formatting.
- [x] Remove clip resource keys.
- [x] Remove clip production export paths or rename them to scene paths.
- [x] Remove Studio clip routes, hooks, panels, and tests.
- [x] Update fixtures to attach assets to scenes instead of clips.

### Continuity Reference Removal

- [x] Remove continuity reference client contracts and exports.
- [x] Remove continuity reference schema/access modules.
- [x] Remove continuity reference asset relationship modules.
- [x] Remove continuity reference navigation and project shell fields.
- [x] Remove continuity reference asset target parsing and formatting.
- [x] Update docs to point to explicit locations and future explicit props.

### Database And Migration

- [x] Update Drizzle TypeScript schema.
- [x] Generate a Drizzle migration from `packages/core`.
- [x] Review generated SQL and document any required custom destructive SQL.
- [x] Bump project store schema generation to `4`.
- [x] Add `PRAGMA user_version = 4;` to the migration.
- [x] Update migration tests for schema generation `4`.
- [x] Validate migration on a fresh test project.

### Resources, Studio, And API

- [x] Update full project reads to the movie-only contract.
- [x] Update project shell reads to the movie-only contract.
- [x] Update selection context to remove clip and continuity surfaces.
- [x] Update Studio fake project data service and route fixtures.
- [x] Add scene-focused resource if the UI still needs the old clip design
      surface behavior.
- [x] Verify `packages/studio` changes use local shadcn UI controls for any
      interactive controls.

### Tests And Verification

- [x] Update core tests for create, screenplay create, canonical validation,
      blocks, handles, mentions, moves, and cleanup.
- [x] Update CLI tests for the new create command and screenplay workflow.
- [x] Update Studio tests for movie-only navigation and no clips.
- [x] Update architecture tests for removed APIs and forbidden imports.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm test:cli`.
- [x] Run relevant `pnpm test:studio` tests.
- [x] Run `pnpm check`.
- [x] Run final `rg` cleanup searches from the acceptance criteria.
