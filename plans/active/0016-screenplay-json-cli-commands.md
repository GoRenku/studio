# 0016 Screenplay JSON CLI Commands

Date: 2026-05-20

Status: active draft

## Scope

Design the Renku current-project lifecycle, CLI command surface, and core
command/query contracts that let agents populate, inspect, validate, and revise
screenplay data stored in the active project's SQLite database.

This plan builds on:

- `plans/active/0015-screenplay-cast-location-database-schema.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/decisions/0016-use-active-project-sessions-and-eager-surface-data-for-studio-performance.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`

This plan intentionally does not cover:

- Studio UI rendering;
- shot lists;
- generation tasks;
- production asset export changes;
- screenplay skill prompt wording;
- series support.

## Architectural Position

SQLite is the canonical source of truth for screenplay, cast, location,
ordering, and relationship metadata.

The CLI is only an adapter:

- it parses arguments;
- it reads JSON input files or stdin;
- it calls `studio-core` command/query methods;
- it prints JSON command reports;
- it translates structured errors into CLI output.

All real work belongs in `studio-core`:

- public JSON contract types;
- JSON validation and normalization;
- ID allocation;
- relationship resolution;
- database reads;
- database writes;
- transaction boundaries;
- structured diagnostics;
- Studio refresh/resource key calculation.

Agents must not edit SQLite directly. Agents should use these commands whenever
they need to mutate screenplay, cast, location, ordering, or relationship data.

## Design Goals

The command surface should support three working modes.

1. Current authoring project.

   The agent records one current project for active work. Screenplay commands
   then operate on that current project without repeating `--project <name>` on
   every command. For CLI usage, each command invocation may open and close its
   own SQLite connection. The persisted current-project state is a target
   pointer, not a long-lived CLI session.

2. Whole-screenplay creation.

   This is optimized for initial screenplay generation. The agent asks for the
   current project status, produces one full JSON document, and asks Renku to
   validate and create the database screenplay state atomically.

3. Focused revision.

   This is optimized for iterative work. The agent reads a smaller aggregate,
   such as all scenes in one sequence, then applies a focused JSON operation:
   add a scene, update a scene, delete a scene, or move a scene.

The lowest mutation granularity is the scene. A scene includes its blocks.
Renku should not expose block-level mutation commands in this first design,
because changing a single block without nearby scene context is not a good agent
workflow.

## Current Authoring Project Lifecycle

Every screenplay command targets the persisted current authoring project. This
state answers "which project should screenplay authoring commands operate on?"
It does not imply that a SQLite connection is being kept alive between separate
CLI invocations.

The CLI should not pass project names to every screenplay command. Repeating the
project name is noisy for agents and makes it too easy to accidentally mutate
the wrong project in long editing sessions.

For CLI commands, opening and closing SQLite once per command invocation is
acceptable. The overhead is small enough for agent workflows, and the simpler
lifecycle is easier to reason about. If this later becomes a measurable
bottleneck, Renku can introduce a CLI session host deliberately.

Studio UI/runtime code is different: Studio must keep using the existing
project-lifetime database ownership path and must not reopen SQLite for every UI
request.

### Existing Commands Review

The current CLI already has these related commands:

- `renku project current`
- `renku project select <project-name>`
- `renku project migrate <project-name>`
- `renku studio current`

`renku project select` is a Studio focus command today. It validates the
project, appends a `studio.focusRequested` coordination event, and asks a
running Studio browser to navigate. It does not own a project authoring session
and it must not be treated as the hidden resolver for screenplay authoring
commands.

`renku project current` should report the persisted current authoring project.
That answers "which project will screenplay CLI commands target?"

`renku studio current` already owns the Studio-focus meaning more clearly. It
should remain the command for UI/browser context and current focus.

Core already has `openProjectStore({ lifetime: 'project' })` and
`openProjectSession(...)`. That mechanism remains useful inside Studio and other
long-lived processes because it caches the `better-sqlite3` connection by
database path. CLI screenplay commands do not need to share that connection
across invocations.

Required amendments:

- Add a current authoring project lifecycle separate from Studio focus.
- Change `renku project current` to report the current authoring project.
- Keep `renku studio current` as the UI/browser focus command.
- Keep `renku project select <project-name>` as a Studio focus request, or
  later rename that surface deliberately. It must not be used as the hidden
  project resolver for screenplay authoring commands.
- Add `renku project open <project-name>` to validate and persist the current
  authoring project.
- Add `renku project close` to clear the current authoring project.
- Keep `renku project migrate <project-name>` as an explicit administrative
  command that can open a database directly for migration work.

Because Renku Studio is pre-customer software, these command semantics can be
changed directly. Do not add compatibility aliases for an obsolete
`project current` meaning.

### Current Project Commands

```bash
renku project open <project-name> --json
renku project current --json
renku project close --json
```

`renku project open` resolves the configured storage root, opens the project's
SQLite database for that command invocation, validates the schema generation,
reads the project row, closes the command-owned connection, and records the
current authoring project.

The returned JSON should include:

- project name;
- project id;
- project folder;
- database path;
- schema generation;
- status such as `set` or `unchanged`;
- when the current-project state was updated.

`renku project current` reports the current authoring project. `renku project
close` clears it.

There should be one current authoring project per Renku workspace/runtime.
Opening a different project may replace the current-project pointer directly,
because there is no CLI-owned long-lived SQLite handle to release. Screenplay
authoring commands should never guess between multiple project databases.

### CLI Connection Lifecycle

Because separate CLI invocations are separate Node processes, a process-local
SQLite cache cannot provide shared CLI ownership. That is acceptable for the
screenplay CLI. The persisted current-project state is the cross-invocation
contract; the database connection is command-local.

The CLI owns only:

- argument parsing;
- JSON stdin/file loading;
- resolving the current authoring project;
- opening the project database for one command invocation;
- forwarding requests to `studio-core`;
- closing the command-owned database connection;
- printing reports and structured diagnostics.

Core should reuse the existing database lifecycle implementation:

- project resolution still uses `resolveRenkuStorageRoot` and
  `resolveProjectFolder`;
- CLI command ownership can use operation-lifetime `openProjectStore` and close
  the session in `finally`;
- Studio process ownership still uses `openProjectStore({ lifetime: 'project' })`
  and explicit `closeProjectStore`;
- schema-generation checks still happen in `openProjectStore`;
- runtime code still must not run Drizzle migrations implicitly.

The missing piece is a persisted current-project descriptor. It should not be
represented as Studio focus, and it should not use a heartbeat because there is
no live CLI session to monitor. An invalid descriptor, missing database, or
schema-generation mismatch should fail with `PROJECT_DATA203` and tell the
agent to reopen the current project.

If there is no current authoring project, screenplay commands fail with a
`PROJECT_DATA202` structured diagnostic and this suggestion:

```text
Run `renku project open <project-name>` before using screenplay commands.
```

Direct one-off database access may exist for administrative commands such as
`renku project migrate`, but screenplay authoring commands should go through
the current-project lifecycle rather than accepting `--project`.

## Command Surface

### Read Commands

```bash
renku screenplay status --json
```

Returns compact project screenplay state:

- whether a screenplay row exists;
- counts for cast members, locations, acts, sequences, scenes, and blocks;
- validation issues found in current database state;
- resource keys that describe the screenplay surfaces.

```bash
renku screenplay show --json
```

Returns the full screenplay JSON document:

- screenplay definition;
- cast;
- locations;
- acts;
- sequences;
- scenes;
- blocks;
- explicit relationship arrays.

```bash
renku screenplay cast list --json
renku screenplay cast show <cast-member-id> --json
```

Returns cast member records used by screenplay scenes and blocks.

```bash
renku screenplay location list --json
renku screenplay location show <location-id> --json
```

Returns location records used by scene settings and block references.

```bash
renku screenplay act list --json
renku screenplay act show <act-id> --json
```

`act show` returns one act aggregate, including sequences and scenes.

```bash
renku screenplay sequence list --act <act-id> --json
renku screenplay sequence show <sequence-id> --json
```

`sequence show` returns one sequence aggregate, including scenes and blocks.

```bash
renku screenplay scene list --sequence <sequence-id> --json
renku screenplay scene show <scene-id> --json
```

`scene list` returns complete scene documents, including blocks. This is
intentional: scene is the smallest useful authoring unit.

### Validation Commands

```bash
renku screenplay validate --json
```

Validates the current screenplay database state.

```bash
renku screenplay validate --file <screenplay-json> --json
renku screenplay validate --file - --json
```

Validates proposed JSON input without writing to the database.

The JSON file declares what it contains. The CLI should not infer the input kind
from the filename.

### Whole Creation

```bash
renku screenplay create --file <screenplay-json> --json
renku screenplay create --file - --json
renku screenplay create --file <screenplay-json> --dry-run --json
```

Creates the canonical screenplay, cast, location, act, sequence, scene, block,
and relationship data in one transaction.

This command is intended for initial screenplay generation. It is not a
compatibility import path for old YAML, and it is not an overwrite command.

If screenplay data already exists, `screenplay create` must fail with a
structured error and suggest `screenplay apply` for revisions. It must not
silently clear or overwrite existing data.

### Focused Operations

```bash
renku screenplay apply --file <operations-json> --json
renku screenplay apply --file - --json
renku screenplay apply --file <operations-json> --dry-run --json
```

Applies one or more focused operations atomically. If any operation is invalid,
none of the operations are written.

Supported first-pass operations:

- `castMember.add`
- `castMember.update`
- `castMember.delete`
- `castMember.move`
- `location.add`
- `location.update`
- `location.delete`
- `location.move`
- `act.add`
- `act.update`
- `act.delete`
- `act.move`
- `sequence.add`
- `sequence.update`
- `sequence.delete`
- `sequence.move`
- `scene.add`
- `scene.update`
- `scene.delete`
- `scene.move`

`scene.update` updates the full scene document, including every block. There
is no `block.add`, `block.update`, `block.delete`, or `block.move` command in
this first design.

`act.update` and `sequence.update` also use full aggregate documents. An act
update includes its ordered sequences, scenes, and blocks. A sequence update
includes its ordered scenes and blocks. This keeps update semantics explicit:
omitting a child array is a validation error, not an implicit request to delete
children.

Cast member and location operations are included here because they are part of
the screenplay relationship graph. If later product design wants dedicated
top-level `renku cast` or `renku location` commands, those commands should call
the same core handlers rather than creating separate mutation rules.

## JSON Contract Principles

### IDs And Request-Local Keys

Durable IDs are opaque and are created by core.

Agents should not construct semantic IDs from titles, order numbers, slugs, or
folder names. Agents may create request-local keys when a JSON document needs
to reference newly created objects before durable IDs exist.

There are two identity fields in write JSON:

- `id` is a durable Renku ID returned by read commands. Use it only for existing
  objects.
- `localKey` is a request-scoped label created by the agent. It is never stored
  in SQLite and never appears in read output.

Core allocates durable IDs for every new object, resolves all `localKey`
references to durable IDs, writes only durable IDs to SQLite, and returns the
mapping in `generatedIds`.

Rules:

- new objects may omit `id`;
- new objects may include `localKey` when other objects in the same request need
  to reference them;
- existing objects must include `id`;
- supplied IDs must be unique inside their table scope;
- supplied `localKey` values must be unique inside their object kind for that
  request;
- an object ID cannot change during `update`;
- references must point to existing durable IDs or request-local keys supplied
  in the same request;
- generated IDs are reported in the success payload as `generatedIds`.

ID allocation order:

1. Parse JSON and collect unknown-field warnings.
2. Read existing IDs from the current authoring project's database.
3. Collect all new objects and their optional `localKey` values.
4. Validate duplicate durable IDs and duplicate local keys.
5. Allocate durable IDs in core for all new objects.
6. Resolve all reference objects to durable IDs.
7. Validate relationships against the resolved graph.
8. Write records in one transaction.

This lets an initial screenplay document define cast, locations, scenes, and
blocks in one file without requiring the agent to manufacture durable IDs.

### Ordering

JSON arrays express order. The public JSON contract should not expose writable
`position` fields.

The database `position` columns are internal persistence details. Core computes
them from array order and placement operations.

Focused move/add operations use explicit placement:

```json
{
  "afterSceneId": "m8q4j2va"
}
```

or:

```json
{
  "beforeSceneId": "m8q4j2va"
}
```

If no placement is given for an add operation, append to the parent collection.

### Relationships

Relationships are explicit JSON fields, not inferred from names or paths.

Scene setting locations:

```json
{
  "locationRefs": [{ "id": "p7x9k2md" }, { "localKey": "foundry" }]
}
```

Block cast and location references:

```json
{
  "type": "action",
  "text": "The crowd parts around Urban.",
  "castMemberRefs": [{ "localKey": "urban" }],
  "locationRefs": [{ "localKey": "foundry" }]
}
```

Dialogue speaker:

```json
{
  "type": "dialogue",
  "castMemberRef": { "localKey": "urban" },
  "parenthetical": "quietly",
  "lines": ["The walls will answer before dawn."]
}
```

The explicit refs are the source of truth for relationship rows. Read commands
return durable ID arrays such as `castMemberIds` and `locationIds`; write
commands accept refs so new objects can be related in the same request. If block
text later includes `@id` mention syntax, validation may check it and warn about
mismatches, but Renku should not require agents to encode relationships only by
embedding tokens in prose.

### Unknown Fields

Unknown JSON fields are warnings and are ignored. They must not create schema
fields, public contract fields, or database columns.

This follows the structured diagnostics rule already used for import YAML.

## AJV JSON Schema Validation

Incoming screenplay JSON should be validated with AJV before semantic
relationship checks or database writes.

`@gorenku/studio-core` already depends on `ajv`, so this does not require a new
dependency. Use AJV v8 with JSON Schema draft 2020-12:

```ts
import Ajv2020 from 'ajv/dist/2020';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});
```

Important rules:

- `allErrors: true` is required so agents get all actionable structural issues
  in one response.
- `removeAdditional`, `useDefaults`, and `coerceTypes` stay disabled because
  validation must not mutate the agent's input or hide type mistakes.
- JSON schemas describe structural shape only.
- JSON schemas should allow additional properties during AJV validation. Unknown
  fields are warnings collected by a separate schema-aware traversal, not AJV
  blocking errors. This avoids `oneOf` branches turning harmless unknown fields
  into false validation failures.
- Semantic validation still happens in core after AJV: ID allocation,
  `localKey` resolution, relationship existence, protected delete checks,
  placement checks, and transaction planning.
- AJV validators should be compiled once per process and reused with
  `addSchema`/`getSchema`; do not compile schemas on every command request.

### Schema Ownership

Put browser-safe public contracts and schema constants under `packages/core/src/client`:

```text
packages/core/src/client/screenplay.ts
packages/core/src/client/screenplay-json-schemas.ts
```

`screenplay.ts` owns the TypeScript contract names:

- `ScreenplayDocument`
- `ScreenplayOperationDocument`
- `Screenplay`
- `CastMember`
- `Location`
- `Act`
- `Sequence`
- `Scene`
- `Block`
- `Reference`
- `GeneratedId`
- `ScreenplayCommandReport`

`screenplay-json-schemas.ts` owns plain JSON schema objects. It must not import
AJV, Drizzle, Node modules, or server-only code. The server-side validator
imports these schema constants.

Server-side validation code lives under:

```text
packages/core/src/server/screenplay-json/validator.ts
packages/core/src/server/screenplay-json/diagnostics.ts
packages/core/src/server/screenplay-json/normalization.ts
packages/core/src/server/screenplay-json/id-allocation.ts
```

This keeps public contracts separate from server execution, while avoiding a
second set of field definitions in the CLI.

### Schema IDs

Use stable package-owned `$id` values:

- `https://schemas.gorenku.com/studio/screenplay-reference.schema.json`
- `https://schemas.gorenku.com/studio/screenplay-block.schema.json`
- `https://schemas.gorenku.com/studio/screenplay-document.schema.json`
- `https://schemas.gorenku.com/studio/screenplay-operations.schema.json`

Do not add aliases for obsolete schema IDs.

### Reference Schema

Every write-time relationship reference uses exactly one of `id` or `localKey`.

```json
{
  "$id": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "oneOf": [
    {
      "type": "object",
      "required": ["id"],
      "properties": {
        "id": { "type": "string", "minLength": 1 }
      },
      "additionalProperties": true
    },
    {
      "type": "object",
      "required": ["localKey"],
      "properties": {
        "localKey": { "type": "string", "minLength": 1 }
      },
      "additionalProperties": true
    }
  ]
}
```

AJV `oneOf` failures on references map to `PROJECT_DATA211`.

### Block Schema

Blocks are validated as discriminated shapes. First-pass block types:

- `action`
- `dialogue`

```json
{
  "$id": "https://schemas.gorenku.com/studio/screenplay-block.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "required": ["type", "text"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "type": { "const": "action" },
        "text": { "type": "string" },
        "castMemberRefs": {
          "type": "array",
          "items": {
            "$ref": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json"
          }
        },
        "locationRefs": {
          "type": "array",
          "items": {
            "$ref": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json"
          }
        }
      },
      "additionalProperties": true
    },
    {
      "type": "object",
      "required": ["type", "castMemberRef", "lines"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "type": { "const": "dialogue" },
        "castMemberRef": {
          "$ref": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json"
        },
        "extension": { "type": "string" },
        "parenthetical": { "type": "string" },
        "lines": {
          "type": "array",
          "items": { "type": "string" }
        },
        "castMemberRefs": {
          "type": "array",
          "items": {
            "$ref": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json"
          }
        },
        "locationRefs": {
          "type": "array",
          "items": {
            "$ref": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json"
          }
        }
      },
      "additionalProperties": true
    }
  ]
}
```

### Whole Screenplay Schema

The whole-create schema validates the complete aggregate:

```json
{
  "$id": "https://schemas.gorenku.com/studio/screenplay-document.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["kind", "screenplay", "cast", "locations", "acts"],
  "properties": {
    "kind": { "const": "screenplay" },
    "screenplay": { "$ref": "#/$defs/screenplay" },
    "cast": {
      "type": "array",
      "items": { "$ref": "#/$defs/castMember" }
    },
    "locations": {
      "type": "array",
      "items": { "$ref": "#/$defs/location" }
    },
    "acts": {
      "type": "array",
      "items": { "$ref": "#/$defs/act" }
    }
  },
  "additionalProperties": true,
  "$defs": {
    "screenplay": {
      "type": "object",
      "required": ["title"],
      "properties": {
        "title": { "type": "string" },
        "intendedAudience": { "type": "string" },
        "targetLengthLabel": { "type": "string" },
        "estimatedMinutes": { "type": "integer", "minimum": 1 },
        "genrePrimary": { "type": "string" },
        "genreSecondary": { "type": "array", "items": { "type": "string" } },
        "tone": { "type": "array", "items": { "type": "string" } },
        "ratingIntent": { "type": "string" },
        "boundaries": { "type": "array", "items": { "type": "string" } },
        "logline": { "type": "string" },
        "summary": { "type": "string" },
        "premiseOverview": { "type": "string" },
        "centralConflict": { "type": "string" },
        "dramaticQuestion": { "type": "string" },
        "themes": { "type": "array", "items": { "type": "string" } },
        "historicalBasis": { "type": "array" },
        "dramatizedElements": { "type": "array" },
        "structureModel": { "type": "string" },
        "status": { "type": "string" },
        "researchSources": { "type": "array" },
        "assumptionsMade": { "type": "array" }
      },
      "additionalProperties": true
    },
    "castMember": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "name": { "type": "string" },
        "role": { "type": "string" },
        "age": { "type": "integer", "minimum": 0 },
        "want": { "type": "string" },
        "need": { "type": "string" },
        "arc": { "type": "string" },
        "voiceNotes": { "type": "string" },
        "description": { "type": "string" }
      },
      "additionalProperties": true
    },
    "location": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "name": { "type": "string" },
        "timePeriod": { "type": "string" },
        "description": { "type": "string" },
        "visualNotes": { "type": "string" }
      },
      "additionalProperties": true
    },
    "act": {
      "type": "object",
      "required": ["sequences"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "title": { "type": "string" },
        "purpose": { "type": "string" },
        "keyBeats": { "type": "array" },
        "sequences": { "type": "array", "items": { "$ref": "#/$defs/sequence" } }
      },
      "additionalProperties": true
    },
    "sequence": {
      "type": "object",
      "required": ["scenes"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "title": { "type": "string" },
        "purpose": { "type": "string" },
        "scenes": { "type": "array", "items": { "$ref": "#/$defs/scene" } }
      },
      "additionalProperties": true
    },
    "scene": {
      "type": "object",
      "required": ["title", "setting", "blocks"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "localKey": { "type": "string", "minLength": 1 },
        "title": { "type": "string" },
        "setting": { "$ref": "#/$defs/sceneSetting" },
        "storyFunction": { "type": "array", "items": { "type": "string" } },
        "blocks": {
          "type": "array",
          "items": {
            "$ref": "https://schemas.gorenku.com/studio/screenplay-block.schema.json"
          }
        }
      },
      "additionalProperties": true
    },
    "sceneSetting": {
      "type": "object",
      "required": ["locationRefs"],
      "properties": {
        "interiorExterior": { "type": "string" },
        "timeOfDay": { "type": "string" },
        "locationRefs": {
          "type": "array",
          "items": {
            "$ref": "https://schemas.gorenku.com/studio/screenplay-reference.schema.json"
          }
        }
      },
      "additionalProperties": true
    }
  }
}
```

### Operations Schema

The operations schema validates the operation envelope and supported operation
families. Its root shape is:

```json
{
  "$id": "https://schemas.gorenku.com/studio/screenplay-operations.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["kind", "operations"],
  "properties": {
    "kind": { "const": "screenplayOperations" },
    "operations": {
      "type": "array",
      "items": {
        "oneOf": [
          { "$ref": "#/$defs/castMemberAdd" },
          { "$ref": "#/$defs/castMemberUpdate" },
          { "$ref": "#/$defs/castMemberDelete" },
          { "$ref": "#/$defs/castMemberMove" },
          { "$ref": "#/$defs/locationAdd" },
          { "$ref": "#/$defs/locationUpdate" },
          { "$ref": "#/$defs/locationDelete" },
          { "$ref": "#/$defs/locationMove" },
          { "$ref": "#/$defs/actAdd" },
          { "$ref": "#/$defs/actUpdate" },
          { "$ref": "#/$defs/actDelete" },
          { "$ref": "#/$defs/actMove" },
          { "$ref": "#/$defs/sequenceAdd" },
          { "$ref": "#/$defs/sequenceUpdate" },
          { "$ref": "#/$defs/sequenceDelete" },
          { "$ref": "#/$defs/sequenceMove" },
          { "$ref": "#/$defs/sceneAdd" },
          { "$ref": "#/$defs/sceneUpdate" },
          { "$ref": "#/$defs/sceneDelete" },
          { "$ref": "#/$defs/sceneMove" }
        ]
      }
    }
  },
  "additionalProperties": true
}
```

The implementation should define the `$defs` for those operation objects in the
schema file rather than in CLI code. Each operation definition should require
only the fields needed for that operation, for example:

- `scene.add` requires `operation`, `sequenceId`, and `scene`;
- `scene.update` requires `operation` and `scene`;
- `scene.delete` requires `operation` and `sceneId`;
- `scene.move` requires `operation`, `sceneId`, and `placement`;
- `castMember.add` requires `operation` and `castMember`.

The shared placement definition should require exactly one placement target:

```json
{
  "placement": {
    "oneOf": [
      {
        "type": "object",
        "required": ["beforeSceneId"],
        "properties": {
          "beforeSceneId": { "type": "string", "minLength": 1 }
        },
        "additionalProperties": true
      },
      {
        "type": "object",
        "required": ["afterSceneId"],
        "properties": {
          "afterSceneId": { "type": "string", "minLength": 1 }
        },
        "additionalProperties": true
      }
    ]
  }
}
```

For operation schemas, use exact operation constants:

```json
{
  "sceneAdd": {
    "type": "object",
    "required": ["operation", "sequenceId", "scene"],
    "properties": {
      "operation": { "const": "scene.add" },
      "sequenceId": { "type": "string", "minLength": 1 },
      "placement": { "$ref": "#/$defs/placement" },
      "scene": { "$ref": "https://schemas.gorenku.com/studio/screenplay-document.schema.json#/$defs/scene" }
    },
    "additionalProperties": true
  }
}
```

Repeat that pattern for cast member, location, act, sequence, and scene
operation definitions in the schema file. The schema file is the source of truth
for command input shape; CLI help text should summarize it, not redefine it.

### AJV Error Mapping

The AJV wrapper maps structural errors into `DiagnosticIssue` values:

- `required` -> `PROJECT_DATA206`;
- `const`, `enum`, and failed operation/block discriminators ->
  `PROJECT_DATA207`;
- `type`, `minLength`, `minimum`, and collection shape errors ->
  `PROJECT_DATA208`;
- `oneOf` failures on reference objects -> `PROJECT_DATA211`.

The unknown-field collector maps fields not present in the relevant schema
`properties` object to `PROJECT_DATA214` warnings. The normalizer then drops
those unknown fields before semantic validation. If AJV reports any
error-severity issue, the command fails before ID allocation or database access.

## Screenplay Document Shape

Whole-screenplay read and create commands use this top-level shape. Read output
uses durable `id` fields and relationship ID arrays. Create input may use
`localKey` fields and relationship refs.

```json
{
  "kind": "screenplay",
  "screenplay": {
    "title": "Urban Basilica",
    "intendedAudience": "adult festival drama",
    "targetLengthLabel": "feature",
    "estimatedMinutes": 110,
    "genrePrimary": "historical drama",
    "genreSecondary": ["siege film"],
    "tone": ["austere", "sacred", "tense"],
    "ratingIntent": "PG-13",
    "boundaries": ["no graphic gore"],
    "logline": "...",
    "summary": "...",
    "premiseOverview": "...",
    "centralConflict": "...",
    "dramaticQuestion": "...",
    "themes": ["faith", "engineering"],
    "historicalBasis": [],
    "dramatizedElements": [],
    "structureModel": "three-act",
    "status": "draft",
    "researchSources": [],
    "assumptionsMade": []
  },
  "cast": [],
  "locations": [],
  "acts": []
}
```

The JSON names are camelCase public contract names. Core maps them to Drizzle
column names such as `genre_secondary`, `key_beats`, and `time_of_day`.

### Cast Member Shape

```json
{
  "localKey": "urban",
  "name": "Urban",
  "role": "cannon founder",
  "age": 45,
  "want": "...",
  "need": "...",
  "arc": "...",
  "voiceNotes": "...",
  "description": "..."
}
```

### Location Shape

```json
{
  "localKey": "foundry",
  "name": "Foundry",
  "timePeriod": "1453",
  "description": "...",
  "visualNotes": "..."
}
```

### Act Shape

```json
{
  "localKey": "act-one",
  "title": "Act I",
  "purpose": "...",
  "keyBeats": [],
  "sequences": []
}
```

### Sequence Shape

```json
{
  "localKey": "commission",
  "title": "The Commission",
  "purpose": "...",
  "scenes": []
}
```

### Scene Shape

```json
{
  "localKey": "urban-enters-foundry",
  "title": "Urban Enters The Foundry",
  "setting": {
    "interiorExterior": "INT",
    "timeOfDay": "NIGHT",
    "locationRefs": [{ "localKey": "foundry" }]
  },
  "storyFunction": ["introduce Urban's dilemma"],
  "blocks": []
}
```

### Block Shape

```json
{
  "localKey": "urban-studies-bronze",
  "type": "action",
  "text": "Urban studies the cracked bronze.",
  "castMemberRefs": [{ "localKey": "urban" }],
  "locationRefs": [{ "localKey": "foundry" }]
}
```

```json
{
  "localKey": "urban-first-line",
  "type": "dialogue",
  "castMemberRef": { "localKey": "urban" },
  "extension": "O.S.",
  "parenthetical": "low",
  "lines": ["No furnace is innocent."],
  "castMemberRefs": [],
  "locationRefs": []
}
```

`lines`, `keyBeats`, `storyFunction`, and other list-like fields are serialized
to canonical JSON text in SQLite.

## Operation Document Shape

Focused changes use an operation envelope:

```json
{
  "kind": "screenplayOperations",
  "operations": [
    {
      "operation": "scene.add",
      "sequenceId": "q2v8jka4",
      "placement": {
        "afterSceneId": "m8q4j2va"
      },
      "scene": {
        "localKey": "urban-tests-mold",
        "title": "Urban Tests The Mold",
        "setting": {
          "interiorExterior": "INT",
          "timeOfDay": "NIGHT",
          "locationRefs": [{ "id": "p7x9k2md" }]
        },
        "storyFunction": ["raise the engineering stakes"],
        "blocks": []
      }
    }
  ]
}
```

`localKey` scope spans the whole operation document, so large chunks can create
new relationship targets and reference them later in the same atomic request:

```json
{
  "kind": "screenplayOperations",
  "operations": [
    {
      "operation": "castMember.add",
      "castMember": {
        "localKey": "young-apprentice",
        "name": "Young Apprentice",
        "role": "foundry assistant"
      }
    },
    {
      "operation": "scene.add",
      "sequenceId": "q2v8jka4",
      "scene": {
        "localKey": "apprentice-warning",
        "title": "The Apprentice Notices The Crack",
        "setting": {
          "interiorExterior": "INT",
          "timeOfDay": "NIGHT",
          "locationRefs": [{ "id": "p7x9k2md" }]
        },
        "storyFunction": ["turn the technical problem into human danger"],
        "blocks": [
          {
            "type": "action",
            "text": "The young apprentice sees the hairline split first.",
            "castMemberRefs": [{ "localKey": "young-apprentice" }],
            "locationRefs": [{ "id": "p7x9k2md" }]
          }
        ]
      }
    }
  ]
}
```

Update operations use full aggregate documents:

```json
{
  "kind": "screenplayOperations",
  "operations": [
    {
      "operation": "scene.update",
      "scene": {
        "id": "m8q4j2va",
        "title": "Urban Enters The Foundry",
        "setting": {
          "interiorExterior": "INT",
          "timeOfDay": "NIGHT",
          "locationRefs": [{ "id": "p7x9k2md" }]
        },
        "storyFunction": ["introduce Urban's dilemma"],
        "blocks": []
      }
    }
  ]
}
```

Move operations do not rewrite content:

```json
{
  "kind": "screenplayOperations",
  "operations": [
    {
      "operation": "scene.move",
      "sceneId": "m8q4j2va",
      "sequenceId": "v4k9j2pm",
      "placement": {
        "beforeSceneId": "x9m2qa7n"
      }
    }
  ]
}
```

Delete operations should fail if they would orphan registered assets or other
metadata relationships outside the screenplay subtree. In this first design,
Renku should prefer explicit errors over hidden cascades.

## Command Reports

Successful JSON commands write to stdout.

Read report:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica"
  },
  "screenplay": {}
}
```

Mutation report:

```json
{
  "valid": true,
  "warnings": [],
  "project": {
    "name": "urban-basilica"
  },
  "changes": [
    {
      "operation": "scene.add",
      "sceneId": "z8q2mx5v"
    }
  ],
  "generatedIds": [
    {
      "kind": "scene",
      "path": ["operations", "0", "scene", "localKey"],
      "localKey": "urban-tests-mold",
      "id": "z8q2mx5v"
    }
  ],
  "resourceKeys": [
    "screenplay",
    "screenplay:sequence:q2v8jka4:scenes"
  ]
}
```

Validation failure writes a structured diagnostic report to stderr and leaves
stdout empty, matching the existing CLI diagnostics policy.

## Structured Diagnostics

Screenplay commands must use the shared `@gorenku/studio-diagnostics`
contracts. Do not invent a screenplay-specific error payload.

The JSON failure shape is the existing CLI structured-error shape:

```json
{
  "valid": false,
  "error": {
    "code": "PROJECT_DATA200",
    "message": "Screenplay JSON failed validation.",
    "suggestion": "Fix the reported screenplay issues and run the command again."
  },
  "issues": [],
  "errors": [],
  "warnings": []
}
```

Rules:

- JSON failures write this object to stderr and leave stdout empty.
- Human failures use the existing CLI formatter with code, location, message,
  and suggestion.
- Successful JSON output includes warning diagnostics in the command report.
- Errors block the operation.
- Warnings do not block the operation.
- Core should collect all actionable validation issues before failing.
- The CLI should not convert diagnostics into local prose-only errors.
- Expected command, validation, current-project, and project-data failures should use
  `StructuredError`, not loose `throw new Error(...)` values at the package
  boundary.

Diagnostic locations should be useful to agents:

- `location.path` uses the JSON input path for input validation problems.
- `location.filePath` is present when the user supplied `--file <path>`.
- stdin input omits `location.filePath`.
- current-project failures use a short path such as `["currentProject"]`;
- database relationship failures use the request path when the bad reference
  came from the request.
- database relationship failures discovered from existing state use the request
  path plus `location.context` naming the existing entity that blocks the
  operation.

Example validation failure:

```json
{
  "valid": false,
  "error": {
    "code": "PROJECT_DATA200",
    "message": "Screenplay JSON failed validation.",
    "suggestion": "Fix the reported screenplay issues and run the command again."
  },
  "issues": [
    {
      "code": "PROJECT_DATA206",
      "message": "scene.blocks is required.",
      "severity": "error",
      "location": {
        "filePath": "screenplay.json",
        "path": ["acts", "0", "sequences", "0", "scenes", "0", "blocks"]
      },
      "suggestion": "Add a blocks array to the scene."
    },
    {
      "code": "PROJECT_DATA214",
      "message": "Unknown field ignored: mood.",
      "severity": "warning",
      "location": {
        "filePath": "screenplay.json",
        "path": ["acts", "0", "mood"]
      },
      "suggestion": "Remove the field or model it through an existing screenplay field."
    }
  ],
  "errors": [
    {
      "code": "PROJECT_DATA206",
      "message": "scene.blocks is required.",
      "severity": "error",
      "location": {
        "filePath": "screenplay.json",
        "path": ["acts", "0", "sequences", "0", "scenes", "0", "blocks"]
      },
      "suggestion": "Add a blocks array to the scene."
    }
  ],
  "warnings": [
    {
      "code": "PROJECT_DATA214",
      "message": "Unknown field ignored: mood.",
      "severity": "warning",
      "location": {
        "filePath": "screenplay.json",
        "path": ["acts", "0", "mood"]
      },
      "suggestion": "Remove the field or model it through an existing screenplay field."
    }
  ]
}
```

Code namespaces:

- Use `CLI...` codes only for CLI adapter problems: missing flags, invalid flag
  combinations, unreadable input files, and invalid command shape before core is
  called.
- Use `PROJECT_DATA...` codes for current authoring project state, screenplay JSON
  validation, relationship resolution, database constraints, and transaction
  failures.
- Do not use `PROJECT_SETUP...` for screenplay commands. That namespace belongs
  to project setup/import input.
- Do not use `STUDIO_SERVER...` for CLI commands. That namespace belongs to the
  HTTP adapter.

Proposed screenplay CLI codes:

| Code | Severity | Meaning | Location | Suggestion |
| --- | --- | --- | --- | --- |
| `CLI080` | error | A screenplay command is missing a required argument, such as `--file` for `create` or `apply`. | The missing argument name, for example `["--file"]`. | Tell the agent which argument to provide. |
| `CLI081` | error | A screenplay command received an unsupported flag or invalid flag combination that is not covered by the shared unknown-flag handler. | The invalid flag path, for example `["--act"]`. | Tell the agent the supported command form. |
| `CLI082` | error | The CLI could not read the JSON input file. | The file argument, with `filePath` set when possible. | Check that the file exists and is readable, or pass `--file -` for stdin. |
| `CLI083` | error | The CLI could not read stdin for `--file -`. | `["stdin"]`. | Send a complete JSON document on stdin. |

Proposed screenplay project-data codes:

| Code | Severity | Meaning | Location | Suggestion |
| --- | --- | --- | --- | --- |
| `PROJECT_DATA200` | error | Top-level screenplay JSON validation failed. This is the `StructuredError.code` when one or more input issues block create/apply/validate. | `["screenplay"]` for whole documents or `["operations"]` for operation documents. | Fix the reported issues and run the command again. |
| `PROJECT_DATA201` | error | Input was not valid JSON or was not a JSON object where an object is required. | Input root path `[]`, with `filePath` when available. | Provide a valid JSON object. |
| `PROJECT_DATA202` | error | A screenplay command was run without a current authoring project. | `["currentProject"]`. | Run `renku project open <project-name>` first. |
| `PROJECT_DATA203` | error | The current authoring project state is invalid, points at a missing database, or no longer matches the current runtime schema. | `["currentProject"]`. | Reopen the current project with `renku project open <project-name>`. |
| `PROJECT_DATA204` | error | `screenplay create` was called after screenplay data already exists. | `["screenplay"]`. | Use `renku screenplay apply` for revisions. |
| `PROJECT_DATA205` | error | A read, apply, or validate-current command requires existing screenplay data, but none exists. | `["screenplay"]`. | Use `renku screenplay create` first. |
| `PROJECT_DATA206` | error | A required field is missing. | Path to the missing field. | Add the required field. |
| `PROJECT_DATA207` | error | A discriminator or command kind is unsupported, such as document `kind`, operation `type`, block `type`, or placement kind. | Path to the unsupported value. | Use one of the documented values. |
| `PROJECT_DATA208` | error | A known field has the wrong scalar or collection type. | Path to the invalid value. | Use the documented type. |
| `PROJECT_DATA209` | error | A durable `id` or request-local `localKey` is duplicated in a scope where it must be unique. | Path to the duplicated value. | Remove the duplicate or use a different request-local key. |
| `PROJECT_DATA210` | error | A reference points to an unknown durable ID or unresolved `localKey`. | Path to the reference object. | Reference an existing object ID or define the target object with that `localKey` in the same request. |
| `PROJECT_DATA211` | error | A reference object is malformed because it provides neither `id` nor `localKey`, or provides both. | Path to the reference object. | Provide exactly one of `id` or `localKey`. |
| `PROJECT_DATA212` | error | A requested move points outside the allowed parent, such as moving a scene before a scene in another sequence. | Path to the placement object. | Use a placement target inside the same parent. |
| `PROJECT_DATA213` | error | A delete would leave existing references or registered assets orphaned. | Path to the delete operation, with `context` naming the blocking relationship. | Remove or move the dependent references/assets first. |
| `PROJECT_DATA214` | warning | An unknown input field was ignored. | Path to the unknown field. | Remove the field or map it to a documented field. |
| `PROJECT_DATA215` | warning | A repeated relationship ref in one array was normalized to one relationship. | Path to the repeated relationship ref. | Remove duplicate refs from the input. |
| `PROJECT_DATA216` | warning | A string was trimmed during normalization. | Path to the string field. | Send already-trimmed text. |
| `PROJECT_DATA217` | warning | Mention-like text did not match explicit relationship refs when mention validation is enabled. | Path to the text field. | Add explicit relationship refs or adjust the text. |
| `PROJECT_DATA218` | error | An update attempts to change the durable ID of an existing object. | Path to the attempted ID change. | Keep the existing ID and change editable fields only. |
| `PROJECT_DATA219` | error | A validated write failed during the short database transaction. | `["transaction"]`, with `context` naming the command. | Retry after reopening the current project; if it repeats, inspect the database error. |

The numeric range above is intentionally outside the project-data codes already
used for project creation, assets, navigation, and production export.

Generic project database lifecycle failures should keep using the existing
project-data codes, such as schema-generation and migration errors. Do not mint
screenplay-specific codes for failures already covered by project database
lifecycle diagnostics.

For multi-issue validation failures, the top-level `StructuredError.code` is
`PROJECT_DATA200` and the granular issues use the specific codes above. For
single non-validation failures, such as no current authoring project, the top-level
`StructuredError.code` may be the same as the single issue code.

## Validation Rules

Core validation should collect all actionable issues before failing.

Required errors:

- `PROJECT_DATA201`: malformed JSON;
- `PROJECT_DATA207`: missing `kind`;
- `PROJECT_DATA207`: unsupported `kind`;
- `PROJECT_DATA206`: missing required fields;
- `PROJECT_DATA208`: invalid scalar types;
- `PROJECT_DATA209`: duplicate IDs within a table scope;
- `PROJECT_DATA209`: duplicate `localKey` values within a request object kind;
- `PROJECT_DATA210`: references to unknown cast members;
- `PROJECT_DATA210`: references to unknown locations;
- `PROJECT_DATA210`: references to unknown acts, sequences, or scenes;
- `PROJECT_DATA211`: reference objects that provide neither `id` nor
  `localKey`;
- `PROJECT_DATA211`: reference objects that provide both `id` and `localKey`;
- `PROJECT_DATA206`: dialogue block without `castMemberRef` or resolved
  `castMemberId`;
- `PROJECT_DATA206`: block type without the fields required by that type;
- `PROJECT_DATA212`: move placement pointing outside the target parent;
- `PROJECT_DATA213`: deleting a cast member that is still referenced by a
  dialogue block, block reference, asset relationship, or future binding;
- `PROJECT_DATA213`: deleting a location that is still referenced by a scene
  setting, block reference, asset relationship, or future binding;
- `PROJECT_DATA213`: deleting an act, sequence, or scene that still has
  registered asset relationships;
- `PROJECT_DATA218`: updating an existing object with a different ID.

Warnings:

- `PROJECT_DATA214`: unknown fields ignored;
- `PROJECT_DATA215`: duplicate relationship refs normalized within one array;
- `PROJECT_DATA216`: strings trimmed during normalization;
- `PROJECT_DATA217`: mention-like text that does not match explicit
  relationship arrays, if mention validation is enabled.

Warnings must appear in successful JSON output. Errors block the operation.

## Core Data Access Layout

The implementation should follow the current `studio-core` server architecture:

- public browser-safe contracts live in `packages/core/src/client`;
- Drizzle table definitions live in `packages/core/src/server/schema`;
- row-level database operations live in `packages/core/src/server/database/access`;
- read projections live in `packages/core/src/server/resources`;
- mutations live in `packages/core/src/server/commands`;
- `ProjectDataService` stays a small facade in
  `packages/core/src/server/project-data-service.ts`;
- CLI code calls core service methods and does not import Drizzle schema,
  database access modules, or `better-sqlite3`.

### Proposed File Structure

```text
packages/core/src/client/screenplay.ts
packages/core/src/client/screenplay-json-schemas.ts

packages/core/src/server/screenplay-json/validator.ts
packages/core/src/server/screenplay-json/diagnostics.ts
packages/core/src/server/screenplay-json/normalization.ts
packages/core/src/server/screenplay-json/id-allocation.ts

packages/core/src/server/database/access/screenplay.ts
packages/core/src/server/database/access/acts.ts
packages/core/src/server/database/access/sequences.ts
packages/core/src/server/database/access/scenes.ts
packages/core/src/server/database/access/blocks.ts
packages/core/src/server/database/access/locations.ts
packages/core/src/server/database/access/cast-members.ts
packages/core/src/server/database/access/scene-locations.ts
packages/core/src/server/database/access/block-cast-members.ts
packages/core/src/server/database/access/block-locations.ts

packages/core/src/server/resources/screenplay.ts
packages/core/src/server/resources/screenplay-status.ts

packages/core/src/server/commands/create-screenplay.ts
packages/core/src/server/commands/apply-screenplay-operations.ts
packages/core/src/server/commands/validate-screenplay-json.ts

packages/core/src/server/database/lifecycle/current-project.ts
```

Use these as current names when implementing. Do not add a `narrative` folder or
generic names such as `items`, `manager`, or `helper`.

### Access Module Responsibilities

Database access modules should be thin Drizzle wrappers over one table or one
join table. They should:

- export internal row types with the `Record` suffix, such as `SceneRecord`;
- export insert/update/delete/list/read functions that take `DatabaseSession`;
- return Drizzle row-shaped records, not public JSON contracts;
- contain no CLI parsing, JSON schema validation, ID allocation, or resource key
  logic;
- avoid direct `sqlite.prepare`; runtime project data access stays on Drizzle;
- work with transaction sessions by accepting the same `DatabaseSession` shape,
  following the existing `registerAsset` transaction pattern.

Examples of responsibility boundaries:

- `database/access/scenes.ts` reads and writes `scene` rows.
- `database/access/blocks.ts` reads and writes ordered block rows for a scene.
- `database/access/scene-locations.ts` maintains scene-to-location rows.
- `database/access/block-cast-members.ts` maintains non-speaker cast
  references for blocks.
- `database/access/block-locations.ts` maintains block-to-location rows.
- `database/access/screenplay.ts` owns the single screenplay row.

### Projection Responsibilities

`server/resources/screenplay.ts` should assemble public `ScreenplayDocument`
aggregates from database records. It should:

- call access modules to read rows;
- build nested act, sequence, scene, and block arrays in position order;
- convert relationship rows into public read fields such as `castMemberIds` and
  `locationIds`;
- parse canonical JSON text columns into arrays or objects for public output;
- fail with structured `PROJECT_DATA...` diagnostics when persisted data is
  internally inconsistent.

It should not mutate the database.

`server/resources/screenplay-status.ts` should return the lightweight status
used by agents before choosing create/apply/show commands. It should not build
the full screenplay aggregate unless the status contract explicitly needs it.

### Command Responsibilities

`server/commands/create-screenplay.ts` should:

- require a current authoring project;
- validate input with AJV;
- normalize input and collect warnings;
- allocate durable IDs in core;
- resolve `localKey` references;
- plan inserts for screenplay, cast, locations, acts, sequences, scenes, blocks,
  and relationship rows;
- write everything in one short transaction;
- return `ScreenplayCommandReport` with warnings, `generatedIds`, changes, and
  scoped resource keys.

`server/commands/apply-screenplay-operations.ts` should do the same pipeline for
operation documents, but it should first read existing IDs and dependency state
needed for relationship validation and protected deletes.

`server/commands/validate-screenplay-json.ts` should run the same AJV,
normalization, ID allocation, and relationship checks as create/apply, but it
must not write. It may return the normalized command plan shape internally for
tests, but the public command report should stay a validation report.

### Service Facade

Add screenplay methods to `ProjectDataService` and
`project-data-service-contracts.ts`, then wire them in
`project-data-service.ts`. Keep the facade small; it should only map method
names to command/resource functions and must not import `session.db`,
`openProjectStore`, or Drizzle schema files.

The current authoring project methods can live on the same service if they are
project-data lifecycle concerns:

- `openCurrentProject`
- `readCurrentProject`
- `closeCurrentProject`

Screenplay resource and command methods should resolve the current authoring
project and open a command-local database session. They should not reintroduce
`projectName` as a parameter on screenplay authoring operations.

## Core Implementation Plan

1. Add current authoring project infrastructure in `studio-core`.

   The current `openProjectStore(... lifetime: 'project')` cache is useful
   inside Studio and other long-lived processes. CLI screenplay authoring only
   needs a persisted current-project pointer that survives separate CLI
   invocations.

   The implementation should amend the existing database lifecycle rather than
   replacing it. `openProjectStore`, `closeProjectStore`, schema-generation
   checks, and Drizzle session creation remain the underlying database
   mechanism. CLI commands may use operation-lifetime database sessions and
   close them before exiting.

   Proposed responsibilities:

   - `openCurrentProject(projectName)`;
   - `readCurrentProject`;
   - `closeCurrentProject`;
   - persist the current authoring project descriptor outside Studio focus;
   - resolve screenplay requests to the current project descriptor;
   - open a command-local SQLite/Drizzle session for CLI command execution;
   - close the command-local session in a `finally` block;
   - reject missing current project state with `PROJECT_DATA202`;
   - reject invalid current project state with `PROJECT_DATA203`.

   Do not add a local IPC session host in this first implementation. The
   important CLI contract is target stability through the persisted current
   project, not connection reuse across commands.

2. Add browser-safe public contracts and JSON schemas in `studio-core`.

   Proposed public names:

   - `Screenplay`
   - `ScreenplayDocument`
   - `CastMember`
   - `Location`
   - `Act`
   - `Sequence`
   - `Scene`
   - `Block`
   - `ScreenplayOperation`
   - `ScreenplayCommandReport`

   These are public JSON contract names and should not use `Dto`.
   `packages/core/src/client/screenplay-json-schemas.ts` should define the AJV
   JSON schemas for the incoming create/apply documents.

3. Add database access modules matching the schema modules.

   Keep row-shaped types internal and use the `Record` suffix:

   - `ScreenplayRecord`
   - `CastMemberRecord`
   - `LocationRecord`
   - `ActRecord`
   - `SequenceRecord`
   - `SceneRecord`
   - `BlockRecord`
   - `SceneLocationRecord`
   - `BlockCastMemberRecord`
   - `BlockLocationRecord`

4. Add screenplay projection queries in core.

   Queries should build the same public contract used by CLI and future Studio
   UI. They should not expose Drizzle rows directly.

5. Add AJV-backed screenplay validation, ID allocation, and normalization in
   core.

   This layer validates incoming JSON with AJV, collects unknown-field warnings
   with a schema-aware traversal, normalizes a cleaned copy of the input,
   allocates durable IDs, resolves `localKey`
   references, checks relationships, normalizes order, and prepares database
   records.

   It should build `DiagnosticIssue` values as it validates, then use
   `buildDiagnosticResult` and `StructuredError` at the package boundary. It
   should not throw on the first bad field when the rest of the JSON can still
   be inspected for additional actionable issues.

6. Add core command handlers.

   Proposed service methods:

   - `openCurrentProject`
   - `readCurrentProject`
   - `closeCurrentProject`
   - `readScreenplayStatus`
   - `readScreenplay`
   - `readCastMember`
   - `listCastMembers`
   - `readLocation`
   - `listLocations`
   - `readAct`
   - `listActs`
   - `readSequence`
   - `listSequencesForAct`
   - `readScene`
   - `listScenesForSequence`
   - `validateScreenplayJson`
   - `createScreenplay`
   - `applyScreenplayOperations`

   Screenplay command handlers should target the current authoring project, not
   a project name. Project-name resolution belongs to `project open` and
   administrative commands.

7. Keep writes transactional.

   Validation and relationship resolution happen before the write transaction.
   The actual database mutation should be short, deterministic, and atomic.

8. Add the CLI adapter.

   `packages/cli` should only parse command names, flags, and JSON files, then
   forward requests through core after resolving the current authoring project.

9. Append Studio refresh events after successful mutations.

   The first resource keys can be coarse:

   - `screenplay`
   - `screenplay:cast`
   - `screenplay:location:<location-id>`
   - `screenplay:cast:<cast-member-id>`
   - `screenplay:acts`
   - `screenplay:act:<act-id>`
   - `screenplay:sequence:<sequence-id>:scenes`
   - `screenplay:scene:<scene-id>`

   These keys can be refined when the UI is built.

## CLI Implementation Notes

Update the project command surface:

- `renku project open <project-name> --json`
- `renku project current --json`, changed to report the current authoring
  project
- `renku project close --json`
- keep `renku project select <project-name>` as a Studio focus request for now;
  it is not used by screenplay authoring commands
- keep `renku project migrate <project-name>` as an administrative command

Add the top-level `screenplay` command to `packages/cli/src/cli.ts`.

Likely new flags:

- `--act`
- `--sequence`
- `--dry-run`

Use existing flags:

- `--file`
- `--json`

Do not add `--project` to screenplay authoring commands. The authoring target
is chosen through `renku project open`.

Support `--file -` for stdin. This matters for agents because it avoids
temporary JSON files when they are not needed.

The CLI should not accept screenplay fields as individual flags. Screenplay
content is structured and should move through JSON files/stdin.

## Test Plan

Core tests:

- AJV schemas compile in strict mode;
- AJV validation collects multiple structural issues with `allErrors`;
- schema-aware unknown-field collection produces `PROJECT_DATA214` warnings
  without blocking otherwise valid JSON;
- whole creation into an empty project;
- whole creation fails when screenplay data already exists;
- generated IDs for new objects;
- duplicate IDs fail;
- unknown fields warn and are ignored;
- cast member add, update, move, and protected delete;
- location add, update, move, and protected delete;
- scene add before/after;
- scene update updates blocks atomically;
- scene delete fails when scene has asset relationships;
- scene move across sequences;
- invalid cast/location references fail;
- no partial writes when a batch contains one invalid operation;
- validation failures collect multiple `DiagnosticIssue` entries before
  throwing;
- missing fields, bad refs, malformed reference objects, protected deletes, and
  ID-change attempts use the documented `PROJECT_DATA20x` codes.

CLI tests:

- `project open <project-name> --json`;
- `project current --json`;
- `project close --json`;
- `project current --json` reports the current authoring project, not Studio
  focus;
- `studio current --json` remains the command for Studio/browser context;
- `project select <project-name> --json` remains a Studio focus request and
  does not set the current screenplay authoring project;
- screenplay commands fail when no current authoring project exists;
- `screenplay status --json`;
- `screenplay show --json`;
- `screenplay cast list --json`;
- `screenplay location list --json`;
- `screenplay scene list --sequence ... --json`;
- `screenplay validate --file ... --json`;
- `screenplay create --file ... --json`;
- `screenplay apply --file ... --json`;
- validation failure writes JSON diagnostics to stderr and stdout remains empty;
- validation failure JSON includes `valid`, `error`, `issues`, `errors`, and
  `warnings`;
- no current authoring project fails with `PROJECT_DATA202`;
- invalid current authoring project state fails with `PROJECT_DATA203`;
- `--file -` reads stdin;
- unreadable input files fail with `CLI082`;
- unknown CLI flags still fail through `CLI005`.

Architecture tests:

- CLI imports no Drizzle schema or database access modules directly;
- screenplay CLI commands resolve the current authoring project through core and
  do not accept `--project`;
- CLI screenplay command database handles are command-local and closed before
  exit;
- browser-safe contracts do not import Node-only modules;
- screenplay command handlers live in core, not CLI.

## Documentation Follow-Up

If this plan is accepted, update the domain vocabulary documentation. The
current vocabulary still describes the older sequence/scene/clip hierarchy and
marks `Act` as future. The accepted screenplay model now uses:

```text
Screenplay
  -> Act
    -> Sequence
      -> Scene
        -> Block
```

Shot list and shot terminology should be documented separately when that model
is designed.
