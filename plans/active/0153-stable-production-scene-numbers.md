# 0153 Stable Production Scene Numbers

Status: implemented
Date: 2026-07-21

## Summary

Renku Studio currently identifies scenes by durable ids and presents them inside
an Act → Sequence → Scene hierarchy. That hierarchy remains useful for story
structure, but it does not give filmmakers or agents the short, stable production
reference they expect. A user should be able to say “work on Scene 22,” see
`22 - Scene Title` in Studio, and have Core resolve `22` to the existing durable
scene id without treating the number as identity.

This plan adds one continuous production scene-number sequence across the whole
screenplay. Initial scenes receive `1`, `2`, `3`, and so on in screenplay order.
Numbers do not change when a scene moves. Deleting a scene reserves its number,
and new scenes inserted into an existing gap receive suffixes such as `22A`,
`22B`, through `22Z`, then `22AA`. Durable scene ids remain unchanged and remain
the value used in URLs, stored relationships, screenplay JSON, and existing
`--scene` CLI arguments.

The smallest useful slice includes:

- a Core-owned, SQLite-backed production scene-number registry;
- Core-owned allocation, synchronization, normalization, formatting, listing,
  and resolution;
- one-time numbering of existing projects in global screenplay order;
- CLI list and resolve commands for humans and agents;
- production numbers in the Studio sidebar and scene panel title;
- source-skill guidance that resolves a user-facing scene number to a durable id
  before running existing id-based commands;
- current architecture, product, CLI, and vocabulary documentation.

This plan does not add shot or take numbering, editable scene numbers, draft or
locked numbering modes, URL aliases, or hierarchical act/sequence/scene numbers.

## Accepted Product Requirements

| Requirement | Accepted behavior | Source |
| --- | --- | --- |
| R1 | Number scenes continuously across the entire screenplay, independent of Act and Sequence nesting. | User request |
| R2 | Keep the existing durable scene id as scene identity and relationship key. | User request |
| R3 | Let a user or agent address a scene with a production number such as `22`. | User request and approved proposal |
| R4 | Preserve later numbers when inserting scenes by allocating `22A`, `22B`, and later suffixes. | User request |
| R5 | Display `01 - Bombardment` in the sidebar and scene title bar; do not prepend the word “Scene.” | User request |
| R6 | Moving a scene keeps its number; deleting it reserves the omitted number instead of recycling it. | Approved proposal |
| R7 | Core owns durable numbering, allocation, resolution, and validation; adapters only transport intent and project results. | Repository architecture rules |
| R8 | Number the current Urban Basilica screenplay `1` through `10` in its existing global screenplay order. | Approved proposal and sample-project evidence |

## Context And Evidence

### Accepted repository constraints

- `AGENTS.md` requires durable metadata rules and mutations to live in
  `packages/core`, with thin CLI, HTTP, and React adapters.
- `docs/architecture/data-model-and-storage.md` defines the project database as
  the canonical store and the screenplay hierarchy as Act → Sequence → Scene.
- `docs/architecture/reference/domain-vocabulary.md` and
  `docs/product/vocabulary.md` define `Scene` as the screenplay unit and durable
  ids as machine identity.
- `docs/architecture/reference/front-end-guidelines.md` requires feature UI to
  consume Core projections and send intent to the server rather than recreate
  domain rules in React.
- `docs/architecture/reference/drizzle-migrations.md` requires Drizzle schema as
  source of truth, Drizzle Kit generation, and generated migration history.
- `docs/architecture/reference/structured-diagnostics.md` requires stable,
  structured diagnostics at package boundaries.
- `docs/decisions/0010-rename-studio-domain-terms.md` rejects compatibility
  aliases during this pre-customer stage.
- `plans/active/0073-takes-tab-and-take-scoped-grouping-restoration.md` and
  `plans/active/0074-remaining-take-production-references-and-final-take-ui.md`
  need production scene references but must consume this plan’s contract rather
  than define a second one.

### Current implementation findings

- `packages/core/src/client/screenplay.ts` defines the creative `Scene` document
  with `id`, `key`, `title`, setting, story function, and blocks. It has no
  production number.
- `packages/core/src/server/schema/scenes.ts` stores scene identity and order
  separately as `id`, `sequence_id`, and `position`.
- `packages/core/src/server/database/access/screenplay-persistence.ts` replaces a
  screenplay by deleting and reinserting screenplay hierarchy rows.
- `packages/core/src/server/database/access/screenplay-revisions.ts` stores the
  creative screenplay document. Revision restore replaces the screenplay from
  that document.
- `createScreenplay`, `applyScreenplayOperations`, and
  `restoreScreenplayRevision` are the Core command paths that can change the
  scene set or its global order. `reviseScreenplayScene` uses the replacement
  mechanism but only updates an existing scene and does not change scene
  identity or placement.
- `SceneNavigationRow` currently carries scene id, sequence id, title, and
  setting. `SceneNarrativeResource` currently returns the creative scene without
  a separate production reference.
- Studio renders `scene.title` in
  `packages/studio/src/features/movie-studio/studio-sidebar/studio-sidebar.tsx`
  and sends `resource.scene.title` to `PanelShell` from
  `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`.
- The existing browser route already reads a scene by durable id. The new number
  can travel in the existing projections; the UI does not require another HTTP
  endpoint.
- `packages/cli/src/commands/screenplay-command.ts` is already a broad screenplay
  command parser. Adding scene-number behavior directly to its nested branches
  would make that file harder to review.

### Real project evidence

The current Urban Basilica database contains ten scenes. Global screenplay
order, using Act position, Sequence position, and Scene position with ids as
deterministic tie-breakers, is:

1. Bombardment
2. The First Patron
3. The Harbor Argument
4. Four Times the Price
5. The Casting
6. The Test
7. The Road
8. Night Repairs
9. Too Soon
10. The Maker's Sound

The expected initial Studio display is therefore `01 - Bombardment` through
`10 - The Maker's Sound`.

### External workflow references

Official Final Draft guidance documents “Keep Existing Numbers” behavior where
an inserted scene can receive a suffix such as `28A`, and omission behavior
where a removed scene keeps its number reserved. The implementation should use
the same production principle without importing Final Draft-specific document
formats or UI modes:

- <https://kb.finaldraft.com/hc/en-us/articles/27810301418132-How-do-I-number-scenes>
- <https://kb.finaldraft.com/hc/en-us/articles/27810683389460-How-do-I-omit-a-scene>

Official Drizzle guidance supports a generated schema migration plus a custom
data migration created with Drizzle Kit for the one-time ordered backfill:

- <https://orm.drizzle.team/docs/drizzle-kit-generate>
- <https://orm.drizzle.team/docs/kit-custom-migrations>
- <https://orm.drizzle.team/docs/drizzle-kit-migrate>

## Options Considered

### Option A: derive the visible number from the current scene array index

Rejected. This would renumber later scenes after insertion, deletion, or move.
It would also invite Studio, CLI, and skills to reproduce an ordering rule that
belongs in Core.

### Option B: add `productionNumber` directly to creative `Scene` JSON or only
to the `scene` table

Rejected. Creative screenplay revisions are replaced wholesale and should not
become the owner of production administration metadata. A number stored only on
the active scene row also cannot reserve an omitted number after that scene is
deleted. Both shapes would make revision restoration and deletion semantics
ambiguous.

### Option C: add a bounded Core production scene-number registry

Accepted. A separate registry preserves numbers independently of scene order and
creative screenplay replacement, keeps an immutable reservation after its scene
is absent, and gives every adapter one list/resolve contract. This is a
purpose-specific scene-number module, not a generic numbering framework.

## Architecture Shape Gate

### Owning package and boundary

`packages/core` owns all production scene-number semantics:

- canonical number syntax and normalization;
- stable display formatting;
- initial and inserted-number allocation;
- immutable number-to-scene-id reservations and derived omitted status;
- transaction-safe synchronization with screenplay mutations;
- list and resolve queries;
- integrity validation and structured diagnostics;
- database schema and migration.

`packages/cli` parses `scene-number` subcommands and serializes Core reports.
`packages/studio` consumes production numbers already attached to Core resource
projections. Source skills teach the agent to resolve a user-facing number and
then use the returned durable scene id.

### Intended Core module layout

```text
packages/core/src/client/
  scene-production-numbers.ts

packages/core/src/server/scene-production-numbers/
  allocation.ts
  persistence.ts
  queries.ts

packages/core/src/server/schema/
  scene-production-numbers.ts
```

- `client/scene-production-numbers.ts` owns browser-safe DTOs, canonical input
  normalization, and the single display formatter used by CLI and Studio.
- `server/scene-production-numbers/allocation.ts` is a pure domain planner. It
  compares the before/after global scene order with current registry records and
  returns the new immutable mappings required for previously unnumbered scene
  ids. It does not open the database or format adapter output.
- `server/scene-production-numbers/persistence.ts` reads registry records and
  inserts an already-validated allocation plan inside the caller's transaction.
  It does not decide allocation policy or update existing reservations.
- `server/scene-production-numbers/queries.ts` implements current-scene listing
  and exact resolution by joining the registry to current scene titles. It owns
  unknown, omitted, and integrity diagnostics.
- `server/schema/scene-production-numbers.ts` contains only the Drizzle table
  declaration.

The existing package/module `index.ts` entrypoints may export the new public
types and service functions. They must remain thin export lists; no number
parsing, allocation, SQL, command routing, or result construction belongs in an
`index.ts`.

### Public entrypoints

Callers use these deliberate Core contracts:

```ts
formatSceneProductionNumber(productionNumber: string): string

ProjectDataService.listSceneProductionNumbers(
  input?: RenkuConfigPathOptions
): Promise<SceneProductionNumberListReport>

ProjectDataService.resolveSceneProductionNumber(
  input: RenkuConfigPathOptions & { productionNumber: string }
): Promise<SceneProductionNumberResolveReport>
```

The existing Core screenplay commands remain the only mutation entrypoints.
There is no public “patch scene number” command and no generic metadata writer.

### Existing files that must remain thin

- `packages/core/src/server/project-data-service-contracts.ts` adds only the two
  focused method signatures.
- `packages/core/src/server/project-data-service-wiring/screenplay.ts` wires the
  methods without implementing them.
- `packages/core/src/server/schema/index.ts` only exports the table.
- `packages/cli/src/commands/screenplay-command.ts` recognizes `scene-number`
  and delegates immediately to a focused handler.
- Existing Studio server scene routes only serialize the enriched Core
  projections. They do not resolve or calculate numbers.
- `studio-sidebar.tsx` and `scene-panel.tsx` only combine the shared formatted
  number with the title for display.

### Domain branches and bounded dispatch

The only domain branching belongs in the pure allocation planner and is limited
to these scene-set cases:

- existing scene id with a reserved number;
- restored scene id with a reserved number;
- newly inserted scene;
- newly appended scene;
- absent scene id whose existing reservation remains untouched.

No registry or dispatcher is needed for other entity kinds. If implementation
starts adding shot, take, slate, asset, provider, or arbitrary hierarchical
numbering cases, stop and redesign that work under its own product decision.

### Forbidden code shapes

- No production number field in creative `Scene`, screenplay authoring JSON, or
  stored screenplay revision JSON.
- No number derived from React array indices, Act/Sequence positions, titles,
  or route structure at runtime.
- No allocation, normalization, or omitted-number interpretation in Studio,
  HTTP handlers, CLI handlers, or skills.
- No new number-based scene URL and no change to existing durable-id URLs.
- No compatibility alias that changes the meaning of current `--scene`; it
  continues to mean a durable scene id.
- No generic numbering service intended for scenes, shots, takes, slates, and
  future entities.
- No catch-all database helper that patches arbitrary production metadata.
- No monolithic `scene-production-numbers.ts` server file that combines pure
  policy, SQL, service reports, migrations, and command integration.
- No architecture test that freezes private helper names or inventories every
  service method.

### Shape stop conditions

Stop implementation and revise this plan if:

- the pure allocator cannot be tested without a database session;
- any adapter needs to know how a suffix is allocated or how omitted status is
  derived;
- screenplay command integration duplicates the same synchronization sequence
  in several large command-local blocks rather than calling the focused module;
- the Core module begins absorbing shot/take production-reference behavior;
- an `index.ts`, `screenplay-command.ts`, route, or React component starts
  implementing domain policy;
- stable numbering appears to require changing creative screenplay documents or
  durable scene ids.

## Contracts

### Canonical production number

The canonical stored value is unpadded and uppercase:

- initial and appended scenes: `1`, `2`, `23`;
- inserted after a numeric anchor: `22A`, `22B`, `22Z`, `22AA`.

The accepted canonical grammar is:

```text
[1-9][0-9]*[A-Z]*
```

Input resolution trims surrounding whitespace, uppercases letters, and removes
leading zeros from the numeric portion. Therefore `01`, `1`, and ` 01 ` resolve
to canonical `1`; `022a` resolves to `22A`. Invalid syntax fails rather than
being guessed from a title or hierarchy.

Display formatting pads only the numeric portion to a minimum width of two:

| Canonical | Display |
| --- | --- |
| `1` | `01` |
| `9A` | `09A` |
| `22A` | `22A` |
| `100` | `100` |

`formatSceneProductionNumber` is the only shared formatter. Padding is never
stored in the database.

### Database schema

Add this project-database table through Drizzle schema:

```text
scene_production_number
  production_number TEXT PRIMARY KEY
  scene_id           TEXT NOT NULL UNIQUE
```

There is intentionally no foreign key from `scene_id` to `scene.id`:

- a reservation must outlive deletion of the scene row;
- screenplay replacement temporarily deletes and reinserts scene rows inside
  one transaction;
- a restored revision automatically becomes active when the same durable scene
  id exists again.

Do not store an `active`/`omitted` state column. Scene existence is already the
canonical fact: a reserved scene id present in `scene` is active, and a reserved
scene id absent from `scene` is omitted. This avoids a second lifecycle state
machine and means deletion, restore, and move do not update the registry.

This absence is not an escape hatch. The Core synchronizer owns and tests these
invariants at transaction boundaries:

- every current scene has exactly one production-number reservation;
- a reservation joined to a current scene is active;
- a reservation with no current scene is omitted and remains reserved;
- a production number is never reused for another scene id;
- one scene id never owns more than one production number.

### Browser-safe client DTOs

Add deliberate public shapes in
`packages/core/src/client/scene-production-numbers.ts`:

```ts
export interface SceneProductionNumberReference {
  productionNumber: string;
  sceneId: string;
  title: string;
}

export interface SceneProductionNumberListReport extends ScreenplayCommandReport {
  sceneNumbers: SceneProductionNumberReference[];
}

export interface SceneProductionNumberResolveReport extends ScreenplayCommandReport {
  scene: SceneProductionNumberReference;
}
```

Import and extend the existing `ScreenplayCommandReport`; do not create a
duplicate report envelope.

Extend the existing resource projections:

```ts
interface SceneNavigationRow {
  // existing fields
  productionNumber: string;
}

interface SceneNarrativeResource {
  // existing fields
  productionNumber: string;
}
```

The production number is deliberately projection metadata beside the creative
scene, not a field inside `Scene`.

### Allocation and lifecycle rules

The allocator receives:

- the before screenplay’s global ordered scene ids;
- the after screenplay’s global ordered scene ids;
- all immutable registry reservations, including rows for absent scenes.

Global order is Act position → Sequence position → Scene position, with durable
ids as deterministic tie-breakers where stored positions tie.

It produces all required new mappings before any write, so an unsupported or
invalid placement fails before `replaceScreenplayDocument` mutates the project.

Rules:

1. Initial screenplay creation assigns canonical whole numbers `1..N`.
2. A surviving scene keeps its current production number regardless of move.
3. Removing a scene does not update the registry. Its immutable row remains, and
   the missing scene join makes the number omitted.
4. Restoring that durable scene id requires no registry update. Its existing row
   resolves as active again as soon as the scene exists.
5. A contiguous run of new scenes at the end receives consecutive whole numeric
   bases after the highest base ever reserved, including rows for absent scenes.
   If the screenplay currently has no scenes but has historical reservations,
   its new scenes follow the same rule rather than reusing the old bases.
6. For a non-final inserted run, use the immediately preceding current scene as
   its anchor. Whether that reference is `22` or `22A`, its numeric stem is
   `22`; allocate the next unused suffixes in that family: `22A`, `22B`, …
   `22Z`, `22AA`. Reservations for absent scenes count as used.
7. Allocate several new scenes in final global order. An inserted run can yield
   `22A`, `22B`, and `22C`; an appended run can yield `23`, `24`, and `25`.
8. A new run before the first current scene receives consecutive whole numbers
   after the highest base ever reserved. Those scenes keep the new numbers when
   placed at the beginning; this preserves every existing reference without
   inventing an `A1` prefix form.
9. Insertion between `22` and `22A`, or before another already inserted reference
   in the same family, cannot be represented by this slice's single
   number-plus-suffix grammar. Fail before write with `PROJECT_DATA449`. Do not
   renumber existing scenes or invent compound forms.
10. This plan does not expose manual assignment or renumbering. A compound
    revision-number convention is a later explicit product decision if real
    projects require one.

### Structured diagnostics

Use these new Core diagnostic codes:

| Code | Condition | Required suggestion |
| --- | --- | --- |
| `PROJECT_DATA447` | The normalized production number is invalid or unknown. | List current numbers with `renku screenplay scene-number list --json`. |
| `PROJECT_DATA448` | The number exists but its scene is omitted. | Select an active production number; the omitted number remains reserved. |
| `PROJECT_DATA449` | Stable simple insertion numbering cannot represent the requested placement. | Place the scene after the last inserted scene in the numeric family, or defer until a broader convention is designed. |
| `PROJECT_DATA450` | Registry integrity is broken, such as a current scene with no reservation or a noncanonical stored number. | Run project validation and repair the project through a Core-owned maintenance decision; do not guess a number. |

Invalid CLI shape such as a missing `--number` continues to use the CLI's
existing structured argument diagnostic family. Do not duplicate these Core
conditions with CLI-only error codes.

### ProjectDataService and CLI

Add the two `ProjectDataService` query methods named in the Architecture Shape
Gate. They return current scenes in global screenplay order; reservations for
absent scenes are retained internally but not returned by the normal list
command.

Add these exact CLI commands:

```text
renku screenplay scene-number list --json
renku screenplay scene-number resolve --number 22 --json
```

The resolve report returns:

```json
{
  "scene": {
    "productionNumber": "22",
    "sceneId": "scene_...",
    "title": "Bombardment"
  }
}
```

Implement parsing and report serialization in a focused new file:

```text
packages/cli/src/commands/screenplay-scene-number-command.ts
```

`screenplay-command.ts` delegates to that handler. Existing commands such as
`screenplay scene show <scene-id>` keep their current durable-id meaning.
Existing `--scene` flags on scene revision, Beat Sheet, generation, and other
commands also remain durable-id inputs. Agents explicitly resolve a number
first; there is no overloaded argument that sometimes accepts an id and
sometimes accepts a number.

### Studio projection and copy

Enrich existing scene navigation and narrative resources in Core. Keep the
existing durable-id route paths and Studio data services.

Studio displays the exact shared format:

```text
01 - Bombardment
22A - Inserted Scene Title
```

- Sidebar scene row label: formatted number, spaces around a hyphen, title.
- Scene panel header: the same formatted number and title.
- Sidebar secondary copy may continue to say `Scene`; the instruction against
  prepending `Scene` applies to the primary label and title.
- Do not store or mutate `scene.title` with the number.
- Do not add a new UI control or mobile-specific layout in this slice.

## Implementation Slices

### Slice 1: Decision record and contract lock

Create `docs/decisions/0060-use-stable-production-scene-numbers.md` before
production implementation. Record:

- durable id versus production reference responsibilities;
- separate registry ownership;
- immutable reservations and omitted status derived from scene absence;
- canonical and display forms;
- simple suffix allocation, before-first whole-number allocation, and the
  deliberate failure of compound placements;
- the deliberate rejection of draft/locked/manual numbering in this slice;
- the deliberate failure for deeper compound insertion;
- the no-foreign-key rationale and Core-owned integrity invariant;
- revision and restore behavior.

Update the status of this plan only after that decision is accepted. Do not let
implementation invent a different public syntax or lifecycle model.

### Slice 2: Schema and one-time backfill

Files:

- `packages/core/src/server/schema/scene-production-numbers.ts`
- `packages/core/src/server/schema/index.ts`
- generated files under `packages/core/drizzle/`
- a focused migration lifecycle test beside current migration tests

Work:

1. Add the Drizzle table with a production-number primary key and unique scene
   id. Do not add a stored lifecycle state.
2. From `packages/core`, run the repository's Drizzle Kit generate command with
   the Core config and name `scene_production_numbers`. The expected next normal
   migration is `0062`; accept the generated name rather than hand-writing it.
3. Run Drizzle Kit's official custom migration command with name
   `backfill_scene_production_numbers`. The expected next migration is `0063`.
4. Put only the required one-time data SQL in the generated custom migration:
   insert all current scenes as `1..N` ordered by Act position/id,
   Sequence position/id, and Scene position/id; set the project schema version
   to the next accepted value, expected `49` after current migration `0061`.
5. Do not update screenplay revision JSON or creative scene data.
   Scene ids that exist only inside an old revision have no historical
   production number to backfill; if later restored, Core treats them as
   never-numbered ids and allocates them only when their restored placement is
   supported.
6. Apply migrations only through the normal project migration workflow.

If Drizzle Kit produces different migration numbers because another accepted
migration lands first, update this plan and the migration test to the actual
generated sequence. Do not manually force filenames or snapshots.

### Slice 3: Core client contracts and pure domain planner

Files:

- `packages/core/src/client/scene-production-numbers.ts`
- the intentional Core client entrypoint
- `packages/core/src/server/scene-production-numbers/allocation.ts`
- focused tests beside the allocator

Work:

- implement canonical parsing/normalization and the shared display formatter;
- implement global screenplay scene-id projection as a focused internal input
  to the planner;
- implement deterministic whole-number, suffix, and multi-suffix allocation;
- preserve reserved numbers across moves, removals, and restores;
- allocate before-first runs from the next whole number and fail before write
  for unsupported compound placements;
- keep the allocator pure and independent of Drizzle/session types.

### Slice 4: Registry persistence, queries, and screenplay synchronization

Files:

- `packages/core/src/server/scene-production-numbers/persistence.ts`
- `packages/core/src/server/scene-production-numbers/queries.ts`
- `packages/core/src/server/commands/create-screenplay.ts`
- `packages/core/src/server/commands/apply-screenplay-operations.ts`
- `packages/core/src/server/commands/screenplay-revision-commands.ts`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/core/src/server/project-data-service-wiring/screenplay.ts`
- focused Core command and service tests

Work:

- read all registry records before planning a screenplay mutation;
- validate and plan every new immutable mapping before the database write
  begins;
- inside the existing screenplay transaction, replace the screenplay, then
  insert the prevalidated production-number mappings, then write the creative
  revision record;
- synchronize initial creation, operation apply, and revision restore;
- leave `reviseScreenplayScene` number-neutral because it cannot change scene id
  or placement; add a representative regression proving its replacement write
  preserves the existing registry;
- implement list and resolve with normalized input and structured diagnostics;
- validate reservation/current-scene invariants at Core boundaries that read or
  add registry rows;
- return the existing `studioScreenplayResourceKey()` in list and resolve
  reports; do not add a second coordination resource for the same screenplay
  mutation boundary.

Keep the transaction orchestration shallow. If the same multi-step integration
starts growing in three commands, add one focused internal synchronization
function under `server/scene-production-numbers/`; do not move entire screenplay
commands into that module.

### Slice 5: Navigation and narrative projections

Files:

- `packages/core/src/client/resources.ts`
- `packages/core/src/server/database/access/navigation.ts`
- `packages/core/src/server/resources/screenplay-ui.ts`
- their focused tests

Work:

- add canonical `productionNumber` to `SceneNavigationRow`;
- add canonical `productionNumber` beside `scene` on
  `SceneNarrativeResource`;
- join current scenes through the registry and fail with `PROJECT_DATA450` if a
  current scene lacks a valid mapping;
- do not add the field to the creative `Scene` contract;
- do not add a new HTTP route.

### Slice 6: Focused CLI surface

Files:

- `packages/cli/src/commands/screenplay-scene-number-command.ts`
- `packages/cli/src/commands/screenplay-command.ts`
- `packages/cli/src/cli.ts`
- focused CLI tests

Work:

- add `scene-number list --json`;
- add `scene-number resolve --number <production-number> --json`;
- delegate immediately from the existing screenplay command file;
- serialize Core reports without reimplementing normalization or resolution;
- document that existing `--scene` inputs remain durable ids.

### Slice 7: Studio labels

Files:

- `packages/studio/src/features/movie-studio/studio-sidebar/studio-sidebar.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`
- focused component tests where present
- `packages/studio/e2e/tests/regression/screenplay-navigation.regression.spec.ts`

Work:

- use the Core client formatter for sidebar scene labels;
- use the same formatter and canonical narrative-resource number for the panel
  title;
- keep scene routes and selection state keyed by durable id;
- verify exact copy, including two-digit minimum padding, hyphen spacing, and no
  `Scene` prefix in the primary label/title;
- verify on the supported desktop layout only.

### Slice 8: Agent and skill addressing

Update the source files in the sister project
`/Users/keremk/Projects/aitinkerbox/studio-skills` that accept or hand off scene
references:

- `skills/screenplay-drafter/SKILL.md`
- `skills/screenplay-drafter/references/screenplay-json-workflow.md`
- `skills/screenplay-analyst/SKILL.md`
- `skills/screenplay-analyst/references/screenplay-analysis-cli-workflow.md`
- `skills/scene-beat-designer/SKILL.md`
- `skills/scene-beat-designer/references/beat-sheet-cli-workflow.md`
- `skills/movie-director/SKILL.md`
- `skills/movie-director/references/specialist-handoff-checklists.md`
- `skills/movie-director/references/department-map.md`
- `skills/casting-director/SKILL.md`
- `skills/casting-director/references/cast-design.md`
- `skills/media-producer/references/scene-storyboard-sheet.md`

Required workflow:

1. If the user supplies a production reference such as `Scene 22` or `22A`,
   call `renku screenplay scene-number resolve --number ... --json`.
   Movie Director performs this resolution before department dispatch; a
   specialist that receives an unresolved production number performs it before
   reading or writing scene-scoped data.
2. Carry the returned durable `sceneId` into existing JSON contracts and
   `--scene` command arguments.
3. If no number is supplied and selection is required, call the list command
   and present current production numbers with meaningful titles.
4. Never parse an Act/Sequence/Scene hierarchy, search titles, or infer ids from
   the number.
5. Persisted JSON contracts continue to carry only the durable `sceneId`; do
   not add a duplicate `productionNumber` convenience field to Beat Sheets,
   Screenplay Analyses, scene-scoped Cast Design costume variants, Generation
   Specs, or other artifacts. Both values may appear together only in transient
   CLI output, human-facing handoff prose, or an agent summary.

Update installed/generated skill copies only through the repository's accepted
skill packaging workflow if one exists; do not hand-edit cache directories.

### Slice 9: Real-project migration and desktop acceptance

Use `/Users/keremk/renku-movies/urban-basilica` as the real acceptance project.

- create the normal project backup used by the current migration command;
- migrate with the accepted `renku project migrate urban-basilica` workflow;
- verify ten reservations, all joined to current scenes;
- verify Bombardment resolves from `1` and `01` to `scene_djkfgf9p`;
- verify The Maker's Sound resolves from `10` to its existing durable id;
- verify sidebar and panel title render the expected production labels;
- create a temporary test fixture, not a destructive change to the real story,
  for insertion/deletion/move/restore acceptance scenarios.

## Tests And Guardrails

### Core pure behavior tests

- initial allocation creates `1..N` in global order;
- display formatting yields `01`, `09A`, `22A`, and `100`;
- normalization accepts padded/lowercase input and rejects malformed values;
- append uses the next whole base after all current and absent reservations;
- first insertion in a gap yields `22A`, then `22B`;
- suffix allocation crosses `Z` to `AA`;
- suffixes reserved for absent scenes are never reused;
- several scenes added in one operation receive deterministic ordered suffixes;
- moving a scene keeps its number;
- deleting a scene leaves its reservation untouched and derives omitted status
  from scene absence;
- restoring the same durable id automatically resolves through its old number;
- before-first insertion receives the next whole number without changing
  existing references;
- insertion before an already inserted scene in the same numeric family fails
  with `PROJECT_DATA449` before any write;
- tie-breaker order is deterministic when stored positions collide.

### Core persistence and command tests

- schema constraints reject duplicate production numbers and duplicate scene
  ids;
- `createScreenplay` numbers all scenes in the same transaction as screenplay
  and revision creation;
- `applyScreenplayOperations` preserves moves and deletion reservations, and
  allocates inserts in one transaction;
- nested `act.add` and `sequence.add` operations allocate every contained new
  scene atomically;
- nested `act.delete` and `sequence.delete` operations retain every removed
  scene's reservation without adapter-specific handling;
- a failed allocation leaves screenplay, revisions, and registry unchanged;
- `restoreScreenplayRevision` reuses reservations for restored ids, creates
  mappings for never-numbered historical ids at supported placements, fails
  atomically for an unsupported placement, and leaves reservations untouched
  for scenes absent from the restored revision;
- `reviseScreenplayScene` preserves its existing number through wholesale scene
  row replacement;
- exact resolution returns canonical number, durable id, and current title;
- unknown, omitted, and integrity cases use `PROJECT_DATA447` through `450`;
- list order follows current global screenplay order while values remain
  stable;
- projection reads fail fast if any current scene lacks a reservation.

### Migration tests

Build a generation-48 fixture containing multiple Acts, Sequences, scenes,
position ties, and no production-number table. Apply the generated schema and
custom backfill migrations, then assert:

- ordered current-scene numbers are exactly `1..N`;
- every scene id occurs exactly once;
- expected project schema version is set;
- `PRAGMA quick_check` succeeds;
- `PRAGMA foreign_key_check` succeeds;
- the migration is exercised by the same Drizzle lifecycle as other project
  migrations.

Do not create a compatibility test for an obsolete runtime shape. This is a
one-way development-data migration to the current model.

### CLI tests

- list delegates to Core and emits the Core report;
- resolve requires `--number` and delegates the raw value for Core
  normalization;
- omitted/unknown structured diagnostics survive CLI serialization;
- existing `scene show <id>` behavior and existing id-based `--scene` flags are
  unchanged;
- the screenplay command entrypoint remains a shallow delegator.

Do not duplicate the allocation edge-case matrix in CLI tests.

### Studio tests

- Scene panel unit coverage expects `01 - Bombardment` from canonical `1`;
- sidebar/navigation coverage expects the same label;
- desktop E2E asserts the number is prominent in both locations;
- E2E asserts navigation still uses `/scenes/<durable-scene-id>`;
- an inserted fixture scene displays `22A - Title` without a `Scene` prefix.

Do not duplicate Core normalization or omitted-status policy in React tests.

### Architecture guardrails

- existing package import-boundary tests continue to prove Studio feature code
  does not import server/database modules;
- add a focused runtime test proving unsupported insertion fails before any
  screenplay or registry write;
- inspect imports to confirm the UI uses the Core client formatter;
- inspect all `replaceScreenplayDocument` call sites so every scene-set-changing
  path synchronizes the registry;
- do not add source-text tests that name private allocator helpers, command
  inventories, or implementation-local symbols;
- keep migration/schema tests behavioral rather than freezing generated SQL
  formatting.

## Documentation

### Studio repository

- Add `docs/decisions/0060-use-stable-production-scene-numbers.md`.
- Update `docs/architecture/data-model-and-storage.md` with the production
  reference registry, its relationship to Scene identity, and omission
  semantics.
- Update `docs/architecture/reference/domain-vocabulary.md` with Production
  Scene Number as a reference, not identity.
- Update `docs/product/vocabulary.md` with the same user-facing term and display
  examples.
- Update `docs/product/workflows.md` so examples use continuous `Scene 22` /
  `Scene 22A` language instead of hierarchical scene numbers such as `5.1`.
- Update `docs/cli/commands.md` with list/resolve examples and the unchanged
  durable-id meaning of `--scene`.
- Add concise coordination notices to active plans 0073 and 0074 so their later
  shot/take work consumes this plan's scene-number contract and does not add
  draft/locked/manual alternatives.
- No front-end-guideline update is needed unless implementation discovers a
  reusable projection/label pattern beyond this domain-specific display.

### Studio skills repository

Update only the current source skill files listed in Slice 8. Do not edit plugin
cache copies, generated installed bundles, or unrelated skills merely for a
naming sweep.

## Out Of Scope

- shot, take, slate, or clip production numbering;
- draft, locked, unlocked, blue-page, or revision-color production modes;
- manual number editing, bulk renumbering, or omission-management UI;
- compound deep-insertion syntax such as `22aA`;
- changing scene ids, relationship columns, URLs, or current `--scene` meaning;
- adding production numbers to screenplay JSON or revision documents;
- preserving hierarchical Act.Sequence.Scene numbers as aliases;
- mobile layout or mobile verification;
- a generic framework for numbering arbitrary domain entities.

## Final Verification

### Focused commands

Run the repository-owned focused commands appropriate to touched packages,
including at minimum:

```bash
pnpm build:core
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio check
```

Run the exact focused Core migration, allocator, screenplay-command, resource,
CLI handler, and Studio component/E2E test files during implementation. Use the
actual repository script names discovered at that time; do not install new
dependencies.

Run the source skill repository's accepted validation command for each changed
skill. If that repository has no unified package script, run its existing
per-skill validator/check mechanism and record the commands in the plan
completion notes.

### Root verification

Because this slice changes Core schema, service contracts, CLI, Studio, docs,
and skills, run all root gates:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

### Manual and data verification

- Run the CLI list and resolve commands against Urban Basilica.
- Confirm canonical storage is unpadded while UI/CLI presentation uses the
  shared minimum-two-digit formatter where display formatting is intended.
- Confirm exact sidebar and panel labels on desktop.
- Confirm browser URLs and durable relationships still use scene ids.
- In a disposable fixture, verify move, delete, append, insertion, restore, and
  unsupported deep-insertion behavior.
- Verify an omitted number is not returned by the current-scene list and
  resolves with the omitted diagnostic rather than being reused.

### Architecture-shape review

- Inspect `git diff --stat` and the complete diff in both repositories.
- Inspect every newly large or heavily modified file.
- Confirm `allocation.ts` is pure, `persistence.ts` owns SQL only, and
  `queries.ts` owns list/resolve reports without absorbing mutations.
- Confirm `index.ts` files remain thin public entrypoints.
- Confirm `screenplay-command.ts`, Studio routes, and React components remain
  shallow adapters.
- Confirm no production number entered creative `Scene` or screenplay revision
  JSON.
- Confirm every scene-set-changing `replaceScreenplayDocument` path is covered.
- Confirm no generic numbering framework, broad dispatcher, catch-all helper,
  compatibility alias, or god file was created.
- Confirm no checklist item was satisfied by accepting unreviewable structure.

## Completion Checklist

### Review Area

- [x] Reconfirm R1–R8 against the final implementation and acceptance evidence.
- [x] Confirm the implementation preserves Core, CLI, HTTP, React, and skill
      ownership boundaries.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, generic numbering service,
      or god file was added.
- [x] Confirm production labels match `01 - Bombardment` exactly and do not add
      a noisy `Scene` prefix.

### Architecture And Contracts

- [x] Accept ADR 0060 before implementing a divergent lifecycle or syntax
      model.
- [x] Add the separate registry without adding production metadata to creative
      `Scene` or screenplay revisions.
- [x] Keep scene ids as identity in storage, relationships, URLs, screenplay
      JSON, existing CLI inputs, and skill artifacts.
- [x] Add the deliberate client DTOs, formatter, ProjectDataService methods, and
      projection fields named in this plan.
- [x] Keep allocation, synchronization, normalization, and integrity validation
      in Core.
- [x] Keep package-boundary diagnostics structured with the accepted codes.
- [x] Keep CLI and Studio as projection/intent adapters.
- [x] Add no compatibility aliases, runtime fallbacks, title guesses, or
      hierarchical-number parsing.
- [x] Confirm the intentional no-foreign-key design is protected by tested Core
      invariants.
- [x] Derive omitted status from current scene existence; do not add a duplicate
      active/omitted lifecycle column.

### Schema And Migration

- [x] Add the Drizzle schema as the source of truth.
- [x] Generate the schema migration with Drizzle Kit; do not hand-write it.
- [x] Generate the custom backfill migration with Drizzle Kit and add only the
      required deterministic data SQL.
- [x] Number existing scenes using the documented global order and tie-breakers.
- [x] Update project schema version through the accepted migration convention.
- [x] Add generation-48-to-current migration coverage, quick check, and foreign
      key check.
- [x] Do not modify stored creative revisions during backfill.

### Core Implementation Slices

- [x] Implement canonical parsing, normalization, and display formatting in the
      browser-safe Core client module.
- [x] Implement the pure allocation planner and full supported/unsupported edge
      matrix.
- [x] Implement focused registry persistence without policy branching.
- [x] Implement focused list/resolve queries and integrity diagnostics.
- [x] Integrate initial creation, screenplay operation apply, and revision
      restore in their existing transactions.
- [x] Cover nested Act and Sequence additions/deletions through the same complete
      before/after scene-set planner.
- [x] Prove scene revision replacement preserves number-neutral registry state.
- [x] Enrich scene navigation and narrative resources with canonical numbers.
- [x] Split modules before adding more responsibilities if any planned file
      becomes difficult to review.

### CLI, Studio, And Agent Surfaces

- [x] Add the exact `scene-number list` and `scene-number resolve --number`
      commands through a focused CLI handler.
- [x] Preserve the durable-id meaning of all existing `--scene` inputs.
- [x] Display the shared formatted number in the sidebar primary label.
- [x] Display the same formatted number in the scene panel header.
- [x] Keep routes and selection state keyed by durable id.
- [x] Update relevant source skills to resolve user-facing numbers before
      invoking id-based workflows.
- [x] Update Movie Director's top-level dispatch and Casting Director's
      scene-scoped Cast Design workflow, not only downstream screenplay
      specialists.
- [x] Keep persisted Beat Sheet, Screenplay Analysis, Generation Spec, and other
      artifact JSON contracts durable-id-only; show both references only in
      transient human-facing output.
- [x] Keep installed/cache skill copies untouched except through an accepted
      packaging workflow.
- [x] Perform Studio acceptance only at the supported desktop viewport.

### Tests And Guardrails

- [x] Add the complete pure allocation and lifecycle test matrix.
- [x] Add transaction tests proving failures occur before writes.
- [x] Add create/apply/restore/revise command regression coverage.
- [x] Add query, normalization, omitted, unknown, and integrity tests.
- [x] Add projection tests for missing and valid mappings.
- [x] Add focused CLI delegation and serialization tests without duplicating
      Core policy cases.
- [x] Add focused Studio label tests and representative desktop E2E coverage.
- [x] Verify existing import-boundary tests still protect Studio from Core
      server/database imports.
- [x] Avoid architecture tests that freeze implementation names or private
      helper inventories.

### Documentation

- [x] Add and accept ADR 0060.
- [x] Update storage architecture, domain vocabulary, product vocabulary,
      workflows, and CLI documentation.
- [x] Remove current hierarchical scene-number examples from active product
      guidance where they conflict with this contract.
- [x] Add coordination notices to plans 0073 and 0074.
- [x] Update only relevant current source skill instructions and references.
- [x] Do not edit historical plans or unrelated skills for a naming sweep.

### Real Project And Final Verification

- [x] Migrate Urban Basilica through the normal backed-up project workflow.
- [x] Verify its ten exact initial scene mappings, all joined to current scenes.
- [x] Verify `1` and `01` both resolve Bombardment to `scene_djkfgf9p`.
- [x] Verify sidebar, panel, CLI, and skills agree on the same number-to-id
      mapping.
- [x] Run focused package, migration, CLI, Studio, E2E, and skill checks.
- [x] Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [x] Review `git diff --stat` and the complete diff in both repositories.
- [x] Inspect all newly large or heavily modified files.
- [x] Confirm `index.ts` files remain thin and no adapter owns domain policy.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark this plan complete and record the verification evidence.

## Completion Evidence

Completed on 2026-07-21.

- Drizzle Kit generated schema migration `0062` and custom backfill migration
  `0063`; generation-48 lifecycle coverage verifies deterministic ordering,
  uniqueness, schema generation 49, quick check, and foreign-key check.
- Core lifecycle, query, projection, transaction, CLI, and Studio tests cover
  stable allocation, omitted reservations, `Z` to `AA`, nested structural edits,
  number-neutral revisions, resolution diagnostics, and fail-before-write deep
  insertion behavior.
- Desktop Playwright regression and compatibility coverage verifies numbered
  sidebar and Scene headers while durable Scene ids remain in routes.
- Urban Basilica was migrated from generation 48 to 49 with a pre-migration
  backup at
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-48-to-49-20260721T140948995Z-b4f58e.sqlite`.
  Its ten current Scenes map exactly to canonical numbers `1` through `10`;
  `01` resolves Bombardment to `scene_djkfgf9p`, and `10` resolves The Maker's
  Sound to `scene_njux6ad9`.
- `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` passed. Lint retained
  only the pre-existing `console` warning in `packages/studio/server/bin.ts`.
- The Studio and source-skill repository diffs passed `git diff --check` and
  were inspected for ownership, file shape, entrypoint thickness, and unrelated
  formatting churn.
