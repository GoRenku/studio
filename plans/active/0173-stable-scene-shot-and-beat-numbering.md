# 0173 Stable Scene, Shot Plan, Shot, And Beat Numbering

Status: superseded by Plan 0174
Date: 2026-08-08

Plan 0174 replaces this plan's rejected FDX policy and migration design while
retaining the accepted shared numbering and Scene Beats work.

## Summary

Renku Studio needs short, stable, human-facing production references before its
media can be organized by Scene and Shot Plan. The current model is uneven:

- FDX Scene numbers are optional and an import with missing numbers succeeds.
- Shot Plans have no number.
- Shots are shown using their mutable array position.
- Beats have neither a stable number nor an explicit full-reset workflow.

This plan adds one small Core-owned numbering vocabulary and applies it through
four focused domain lifecycles and two distinct Screenplay source workflows:

- In an FDX-backed Project, the external screenplay editor remains the
  authority for canonical screenplay content and Scene numbers. Renku preserves
  the exact supported FDX numbers so a future re-import design can associate
  Scenes by the same production references.
- An FDX import requires every Scene Heading to carry a supported Scene number.
  Renku fills missing numbers only when the Project preference permits that
  fallback **and** the user explicitly requests it for the import.
- In an agent-authored Project with no FDX import, the existing
  screenplay-drafter create, focused revision, and revision-restore workflows
  remain supported. Core allocates stable Scene numbers for that workflow.
- FDX-backed Projects reject local screenplay-content edits and restore, while
  still allowing Renku-owned Cast/Location/Prop reference operations. The
  constraints of the external-editor workflow do not remove the agent-authored
  workflow.
- Every Shot Plan receives the next Scene-local integer and never loses or
  reuses that number.
- Every Shot receives a stable number. Moving it does not change the number,
  insertion uses a short alphabetic suffix, and deletion never releases it.
- `SceneBeats` is the ordered set of Beats representing one Scene. The existing
  immutable revision history and active-revision selection remain intact; only
  the misleading Beat Sheet terminology and document contents change.
- During normal runtime, a full reset creates and activates another revision,
  numbers its new Beats afresh from `1`, and retains every earlier and later
  revision.
- Focused Beat insert/update/delete operations continue creating immutable
  revisions from an explicit base revision. They preserve surviving Beat
  numbers, allocate suffixes for inserted Beats, and never recycle deleted
  numbers within that revision lineage.
- Restoring previous Beats uses the existing active-revision selection. It does
  not delete the rejected revision, truncate history, or add a second undo
  mechanism.
- The one-time Urban Basilica rebuild is different from runtime history: it
  seeds each Scene from only its currently active Beat revision and deliberately
  leaves the other eight development-history rows behind in the archive.
- Storyboard imports retain the existing Scene-local `NN-iteration/` folders so
  current Beat image candidates and all future revision work remain recoverable
  and recognizable.

The numbering grammar and display formatter are shared. Persistence remains
domain-specific because agent-authored Scenes, FDX Scenes, Shot Plan Trash,
Shot deletion, and Scene Beats have different lifecycles. There is no
universal numbering table, FDX export, or general-purpose screenplay editor.

This plan is the prerequisite for
[Plan 0172](0172-human-readable-project-asset-organization.md), which uses the
numbers in human-readable folders and filenames.

## Requirement Ledger

| Requirement | Accepted behavior | Owner |
| --- | --- | --- |
| Source authority is explicit | FDX-backed Projects follow Screenplay Editor → FDX → Renku; Projects with no FDX retain agent-authored screenplay creation/revision | Core source classification and screenplay-drafter |
| FDX content stays externally owned | Imported screenplay content and Scene numbers cannot be changed or restored through Renku authoring commands; Renku-owned references remain editable | Core screenplay mutation gate |
| Agent-authored workflow remains | Keep `screenplay create`, focused `screenplay apply`, and `screenplay revision restore` for Projects without an FDX import | Core, CLI, and screenplay-drafter |
| Numbered FDX by default | Missing Scene numbers fail before any Asset or Screenplay write | Core FDX import command |
| Deliberate learning/demo fallback | `allowRenkuSceneNumberGeneration` defaults to `false`; generation additionally requires `--generate-missing-scene-numbers` | Core Project Settings, FDX import, CLI, and skill |
| Future association is preserved | Exact FDX numbers and FDX provenance remain available as the stable external association key; this plan does not implement re-import | FDX importer and import record |
| Fallback limitation is explicit | A Renku-numbered fallback import cannot later be matched safely to an editor export that introduces different Scene numbers | Product diagnostics and skills |
| Exact external references | Supported FDX numbers preserve authored case; display pads only the leading integer | Shared production-number formatter |
| Stable agent Scene references | Core numbers new agent-authored Scenes, preserves numbers through moves/restore, and never recycles deleted numbers | Shared allocator plus agent Scene reservations |
| Stable Shot Plan references | Scene-local monotonically increasing integers, never changed or recycled | Core Shot Plan numbering |
| Stable Shot references | Fresh plan starts `1..N`; append uses the next whole number; insertion uses a suffix; move preserves | Shared allocator plus Shot domain |
| Stable Beat references | Each reset starts `1..N`; focused inserts use suffixes; edits preserve; deletion never recycles within the current aggregate | Shared allocator plus Scene Beats domain |
| Simple Scene Beats | Rename the product aggregate from Beat Sheet to Scene Beats and remove unrelated sheet-level creative fields; revisions remain ordinary saved Scene Beats documents | Core Scene Beats contracts |
| Preserve runtime revision history | After the clean baseline, keep immutable revision rows, list/read, explicit base revision, active selection, and every revision created by normal use | Existing Core Scene Beats history/state owner |
| Reset and restore | Reset creates and activates a fresh revision; restore selects an older revision without deleting any revision | Existing revision writes and `set-active` behavior |
| Clean local migration baseline | Urban Basilica starts the renamed schema with only each Scene's currently active Beat revision; discarded development history stays only in the archived project | One-time local Drizzle conversion |
| Preserve Storyboard iterations | Every Storyboard import batch remains in its Scene-local `NN-iteration/` folder; restoring an older revision can reconnect to its retained Beat images | Existing Core Storyboard destination and Asset ownership |
| No Studio reset action | No Beat reset button, route, hook, or client mutation is added | Scope constraint |
| Core owns numbers | CLI, Studio, and skills consume numbers; they never calculate or reserve them | Architecture boundary |
| Human-readable storage | Scene, Plan, Shot, and current Beat projections feed Plan 0172 | Shared formatter and Core projections |

## Product Boundary

### Two screenplay source workflows

Renku is a previs and AI video-generation tool, not a general screenplay
editor. That product boundary does not mean every screenplay must come from
FDX. The existing product has two valid source workflows.

#### FDX-backed Project

```text
Screenplay Editor → numbered FDX export → Renku import
```

The external editor owns canonical screenplay content and Scene numbers. Renku
preserves each supported FDX `Number` value exactly and must not silently
allocate, normalize, or replace it. `createScreenplay` cannot run because the
Screenplay is non-empty. Core also rejects content-bearing
`applyScreenplayOperations` batches and `restoreScreenplayRevision` when a
retained `screenplay_import` record exists, preventing Renku from diverging from
the external source.

`reference.add` and `reference.delete` remain valid because Cast/Location/Prop
links are Renku production metadata rather than imported screenplay text. A
mixed operation batch containing a reference operation and any opening, Scene,
Section, structure, heading, Block, or dialogue mutation fails atomically.

This plan does not implement re-import, merge, overwrite, FDX export, or
round-tripping. It deliberately preserves exact FDX Scene numbers and source
provenance so a future re-import plan can use the external production reference
as its primary association key rather than discovering that Renku replaced it.

#### Agent-authored Project

```text
User ↔ screenplay-drafter agent → Renku screenplay create/apply/restore
```

When no FDX import record exists, the current screenplay-drafter workflow
remains supported:

- `renku screenplay create` creates the first complete Screenplay;
- `renku screenplay apply` performs focused opening, Scene, Section, structure,
  and reference revisions; and
- `renku screenplay revision restore` restores an earlier agent-authored
  revision.

Core, not the agent or JSON input, allocates stable Scene numbers for this
workflow. New Scenes use the shared whole-number/suffix scheme, moves keep their
numbers, deletion leaves a reservation, and restore reactivates the number
reserved for the same durable Scene id.

An agent-authored non-empty Screenplay cannot later use the existing FDX import
command because that command already requires an empty Screenplay. Converting
between source workflows or reconciling an agent draft with an external editor
is outside this plan.

#### Source classification

Core derives source authority from durable Project state instead of asking an
adapter to guess:

- `fdx`: a retained `screenplay_import` record exists;
- `agent`: no import record exists and the Screenplay has content, revisions,
  or agent Scene-number reservations; and
- `empty`: neither source has established a Screenplay.

`screenplay status` exposes that classification so Studio skills can choose the
valid workflow. The classification does not add a second mutable “mode” field.

The FDX Scene-number fallback exists for learning projects, demos, samples, and
importer tests where an Internet-sourced FDX lacks production numbers. It is
not a substitute for production numbering in Final Draft, Fade In, WriterDuet,
or another source editor, and it is separate from normal Core numbering of a
Screenplay authored entirely in Renku.

### Research conclusion

The interoperability contract must be the number actually present in the FDX,
not the brand of editor that wrote it:

- Final Draft numbers Scene Heading elements sequentially and its “Keep
  Existing Numbers” behavior assigns inserted scenes suffixes such as `28A`
  while retaining existing numbers.
- Final Draft can also number other element types, including Shot elements.
- WriterDuet supports locked Scene numbering and explicitly documents `2A` for
  an inserted Scene after Scene 2.
- Fade In documents exporting Scene numbers to FDX, including unlocked Scene
  numbers, to interoperate with Final Draft.
- The current Renku parser already reads the FDX Scene Heading `Number`
  attribute into `Scene.productionNumber`.

The public documentation for editors is inconsistent about promising every FDX
export detail. Therefore Renku validates the file it receives. Users must enable
and retain Scene numbers in their editor before export; Renku does not assume an
editor exported them merely because the editor supports numbering.

Primary references:

- <https://kb.finaldraft.com/hc/en-us/articles/27810301418132-How-do-I-number-scenes>
- <https://kb.finaldraft.com/hc/en-us/articles/15575278457492-I-want-to-number-other-elements-such-as-shots-characters-or-dialogue>
- <https://www.writerduet.com/article/358-enable-disable-scene-numbering>
- <https://www.fadeinpro.com/page.pl?content=changelog_old>

## Shared Numbering Contract

### Canonical accepted form

Core accepts a positive integer followed by zero or more ASCII letters:

```text
[1-9][0-9]*[A-Za-z]*
```

Examples include `1`, `28A`, `4aA`, and `100`. The canonical stored value
preserves letter case from FDX. Renku-generated suffixes use uppercase letters.
Comparison for uniqueness is ASCII case-insensitive so `1A` and `1a` cannot
coexist in the same scope or collide on a default case-insensitive filesystem.

An FDX number outside this contract fails with
`SCREENPLAY_IMPORT_SCENE_NUMBER_UNSUPPORTED`. Renku does not silently sanitize
or replace an authored production reference.

### Display form

`formatProductionNumberForDisplay` pads only a one-digit leading integer to two
digits and preserves the rest exactly:

| Stored | Display/path segment |
| --- | --- |
| `1` | `01` |
| `1A` | `01A` |
| `4aA` | `04aA` |
| `28A` | `28A` |
| `100` | `100` |

The stored number is never padded. Plan 0172 uses only this formatter; no UI or
destination implements another padding rule.

### Allocation rules

The shared allocator intentionally implements the observable production
behavior, not undocumented private Final Draft internals:

1. A fresh ordered collection receives whole numbers `1..N`.
2. Appending receives the next whole number above the scope's never-decreasing
   whole-number high-water mark.
3. Inserting anywhere except the end uses the leading integer family of the
   nearest preceding item. When there is no preceding item, it uses the leading
   integer family of the nearest following item.
4. The allocator chooses the shortest unreserved uppercase bijective-base-26
   suffix in that family: `A..Z`, then `AA..AZ`, `BA`, and so on.
5. A number is never altered by a later move.
6. A deleted number stays reserved and is never selected again.
7. Allocation and reservation occur in the same database transaction.

Examples:

```text
fresh:                         1, 2, 3
insert between 1 and 2:       1, 1A, 2, 3
insert again in that family:  1, 1B, 1A, 2, 3
append after 3:               1, 1B, 1A, 2, 3, 4
delete 1A, then insert:       1, 1C, 1B, 2, 3, 4
```

The second insertion example is deliberate: stable numbers are references, not
sortable positions. Current order continues to come from `position` or Beat
array order. A move already makes number order diverge from current order, so
Renku does not lengthen identifiers to encode an ordering promise it cannot
preserve. This keeps user-facing references short and avoids deep forms.

### Central system, focused persistence

“Central numbering system” means one shared Core grammar, case-insensitive
uniqueness rule, display formatter, alphabetic suffix generator, and allocation
planner. It does not mean one catch-all database registry.

| Domain | Persistent reservation shape | Reason |
| --- | --- | --- |
| FDX Scene | Direct `Scene.productionNumber`; exact import validation | The external editor owns numbering; Renku does not allocate in the normal path |
| Agent Scene | Direct `Scene.productionNumber` plus durable agent-only reservations | Agent authoring can insert, move, delete, and restore Scenes without recycling references |
| Shot Plan | Scene-local integer high-water row plus `shot_plan.number` | Only monotonically increasing integers are needed |
| Shot | `shot.number` plus durable per-Plan reservations | Individual Shot rows can be collected after deletion |
| Beat | Existing immutable per-Scene revision rows plus active state; each revision stores its reserved-number array | Every saved revision must recover its exact Beat ids, numbers, and future allocation state |

This avoids duplicating grammar while keeping each mutation behind the package
and transaction that owns it.

## Scene Import Behavior

### Default: numbered FDX is required

`screenplayImport.allowRenkuSceneNumberGeneration` is a required boolean in
Project Settings version 2 and defaults to `false`. It is a permission gate,
not an instruction to mutate every unnumbered import automatically.

The CLI adds the explicit per-import flag:

```text
renku screenplay import-fdx --file <path> --generate-missing-scene-numbers --json
```

Core generates missing numbers only when the Project setting is `true` and the
input carries `generateMissingSceneNumbers: true`. The following cases fail
before creating the retained FDX Asset, Screenplay rows, revision, or import
record:

- missing numbers while the Project setting is `false`;
- missing numbers while the setting is `true` but the explicit import request
  is absent; and
- an explicit import request while the Project setting is `false`.

The first two cases report:

```text
SCREENPLAY_IMPORT_SCENE_NUMBERS_MISSING
Missing scene numbers.
```

Issues identify every missing Scene Heading by source paragraph position and
heading text when available. The suggestion says:

```text
Re-export the screenplay from your screenplay editor with Scene numbers, or
enable screenplayImport.allowRenkuSceneNumberGeneration and explicitly request
generation for this one-time learning/demo import.
```

When the setting permits fallback but the per-import request is absent, the
diagnostic additionally explains that Renku will not generate production
references without explicit confirmation. When the flag is present but the
setting is disabled, `SCREENPLAY_IMPORT_SCENE_NUMBER_GENERATION_DISABLED`
explains which Project preference must be enabled. Both gates are required.

### Explicit fallback: Renku fills only missing FDX numbers

When both gates are present, Core:

1. validates and reserves all supported explicit FDX numbers first;
2. walks missing Scenes in screenplay order;
3. allocates the shortest available whole or suffix number at that placement;
4. writes the completed numbers directly to the canonical Scenes;
5. records `sceneNumberSource: 'renku'` on the import because at least one
   number was generated; and
6. returns a warning listing the generated Scene numbers.

When no number was generated, the import record reports
`sceneNumberSource: 'fdx'` even if the Project setting was enabled.

The warning uses `SCREENPLAY_IMPORT_SCENE_NUMBERS_GENERATED` and explicitly
states that a later editor export which introduces different Scene numbers
cannot be matched safely to this Renku-numbered fallback. This limitation
applies to the fallback import, not to a normal FDX import whose exact external
numbers are preserved. Re-import itself remains outside this plan.

### Agent-authored Scene numbering

The FDX preference and import flag do not apply to agent-authored Screenplays.
For `screenplay create`, Core assigns whole numbers `1..N` to the new Scenes in
canonical screenplay order. `SceneInput` does not accept a production number.

For later agent-authored operations:

- an appended Scene receives the next whole number above the agent Scene
  namespace high-water;
- a non-end insertion receives the shared allocator's next suffix;
- `scene.move` and `scene.update` preserve the existing number;
- `scene.delete` keeps the number reserved; and
- revision restore reuses reservations by durable Scene id and fails as an
  integrity error if a restored historical Scene id has no reservation after
  the one-way migration.

Allocation, reservation, Screenplay mutation, and revision creation commit in
one Core transaction. FDX-backed Scenes never enter this reservation table.

### Agent behavior

When an import fails for missing numbers, the existing screenplay-drafter skill
must:

1. warn that the source FDX lacks Scene numbers;
2. ask the user to re-export it with Scene numbers or authorize both enabling
   the Project preference and explicitly generating numbers for this import;
3. explain that Renku-generated numbers are intended for one-time learning,
   demo, sample, or test imports; and
4. explain that a later numbered export cannot be matched or merged.

The skill must not change the setting, pass the generation flag, edit the FDX,
or invent numbers outside Core without user authorization. For a normal FDX
import it must describe the exact external Scene numbers as the preserved
association references. For an agent-authored Project it continues to use
create/apply/restore and never supplies Scene numbers itself.

## Shot Plan And Shot Behavior

### Shot Plans

Each Scene has an independent Shot Plan counter:

- first Plan: `1`;
- each later create or copy: previous high-water plus one;
- deletion and Trash collection do not reduce the high-water mark;
- a Plan number never changes;
- all reports and Studio projections expose `number`;
- display uses `01`, `02`, and so on, enabling `01-shot-plan` folders.

Creating two Plans concurrently must produce distinct numbers or fail the whole
losing transaction cleanly. There is no “renumber Plans” command.

### Shots

A newly created Shot Plan numbers its authored Shots `1..N` in authored order.
A copied Plan receives a new Plan number and its copied Shots receive fresh
numbers `1..N` in copied order; copied Shot numbers are not inherited from the
source Plan.

`AddShotToPlanInput` gains an optional `placement`:

```ts
type ShotPlacement =
  | { position: 'start' | 'end' }
  | { position: 'before' | 'after'; shotId: string };
```

Omission means `{ position: 'end' }`. End placement receives the next whole
number. Other placements receive the shared allocator's next short suffix.
`moveShotInPlan` changes `position` only. `removeShotFromPlan` and later Trash
collection leave the number reservation intact.

Studio and skills display `shot.number`. They may still use position for layout
and ordering but never label a Shot as `position + 1`.

## Scene Beats Revisions And Numbering

### One Scene-owned aggregate

`SceneBeats` is the ordered set of Beats that represents one Scene. A saved
`SceneBeatsRevision` is one immutable version of that set. This renames the
domain without replacing its existing revision history or active-selection
lifecycle.

```ts
interface BeatInput {
  title: string;
  description: string;
  narrativeDevelopment: string;
  narrativePurpose: string;
  castMemberIds: string[];
  locationIds: string[];
  propIds: string[];
  screenplayBlockIds: string[];
}

interface Beat extends BeatInput {
  id: string;
  number: string;
}

interface SceneBeatsInput {
  sceneId: string;
  beats: BeatInput[];
}

interface SceneBeats {
  sceneId: string;
  beats: Beat[];
}

interface SceneBeatsRevisionSummary {
  id: string;
  sceneId: string;
  baseRevisionId?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface SceneBeatsRevision {
  revision: SceneBeatsRevisionSummary;
  sceneBeats: SceneBeats;
}
```

Core assigns Beat ids and numbers. Agents author only the creative Beat input.
The aggregate has no sheet-level title, summary, narrative progression,
lookbook influence, or open questions. Revision identity, history, and active
selection remain revision metadata outside the creative document.

### Initial creation, reset, and revision restore

The CLI surface is:

```text
renku screenplay beats context --scene <scene-id> --json
renku screenplay beats list --scene <scene-id> --json
renku screenplay beats show --scene <scene-id> (--active | --revision <revision-id>) --json
renku screenplay beats validate --file <scene-beats-json> --json
renku screenplay beats create --file <scene-beats-json> --json
renku screenplay beats reset --file <scene-beats-json> --json
renku screenplay beats set-active --scene <scene-id> --revision <revision-id> --json
renku screenplay beats validate-operations --file <operations-json> --json
renku screenplay beats apply --file <operations-json> [--dry-run] --json
renku screenplay beats storyboard status --scene <scene-id> --revision <revision-id> --json
```

`create` requires that the Scene has no Scene Beats revision. `reset` requires
an active revision, creates a new revision with fresh Beat ids and `1..N`
numbers, records the formerly active revision as `baseRevisionId`, and makes the
new revision active. It does not delete or rewrite any older revision.

Restore is the existing `set-active` operation. Selecting the prior revision
makes its Beats current while retaining the rejected later revision, so the user
or agent can move between revisions without losing work. No new two-slot undo,
restore wrapper, redo stack, or retention policy is added.

For the immediate “those regenerated Beats are bad” workflow, the agent reads
the active revision's `baseRevisionId` and passes that exact id to `set-active`.
History listing remains available for selecting any other retained revision.

### Focused edits

Focused operations preserve the existing revision behavior: they apply against
an explicit base revision and create another immutable revision.

```ts
interface SceneBeatsOperationsInput {
  sceneId: string;
  baseRevisionId: string;
  activate: boolean;
  operations: Array<
    | { operation: 'beats.insert'; placement: BeatPlacement; beats: BeatInput[] }
    | { operation: 'beat.update'; beatId: string; beat: BeatInput }
    | { operation: 'beats.delete'; beatIds: string[] }
  >;
}
```

- inserts receive Core-authored ids and the shared allocator's number;
- updates preserve the Beat id and number;
- deletes remove the Beat from the new revision but carry its number forward in
  that revision's reservation set;
- the base revision remains immutable and readable;
- full replacement exists only through `reset`;
- the operation document never carries a Beat number.

Storyboard Assets continue to use `{ sceneId, beatId }`, while Storyboard
status/import and Shot Plan coverage retain the exact Scene Beats revision id
that supplied those Beats. Every Storyboard import batch stays in its allocated
`storyboards/<scene-number>/<NN>-iteration/` folder. Reset and active-revision
changes never delete those Assets or folders. Selecting an older revision makes
its Beat ids, selected images, and exact revision context current again.

## Explicit Non-Goals

- No general-purpose screenplay editor UI, FDX export, round-trip, re-import
  merge, or reconciliation implementation.
- No local canonical screenplay-content mutation or revision restore for an
  FDX-backed Project.
- No conversion between an FDX-backed Project and an agent-authored Project.
- No user-editable Scene, Shot Plan, Shot, or Beat numbers.
- No exact emulation of undocumented private numbering implementation details
  from any screenplay editor.
- No number-derived identity, ordering, ownership, or foreign keys.
- No universal reservation table or generic metadata patch API.
- No Scene Beats reset button or other new Studio mutation surface.
- No public Beat Sheet domain name. Existing revision ids, history listing,
  explicit base revision, and active selection remain under Scene Beats naming.
- No runtime Beat-revision deletion, history truncation, two-slot undo buffer,
  or destructive restore behavior after the clean migration baseline.
- No automatic Storyboard generation as part of reset; the skill may run the
  existing media workflow after the reset report succeeds.
- No rewrite of historical immutable GenerationSpecs or Scene Beats revisions
  merely to change displayed paths.
- No Plan 0172 filesystem move in this plan.

## Context And Current Evidence

### Current Scene and FDX state

- `Scene.productionNumber` is an optional direct Scene property under Decision
  0071.
- Core intentionally exposes `createScreenplay`,
  `applyScreenplayOperations`, and `restoreScreenplayRevision`; the operation
  registry supports Scene add/update/delete/move plus opening, Section, and
  reference mutation for the agent-authored screenplay workflow.
- CLI currently exposes `screenplay create`, `screenplay apply`, and
  `screenplay revision restore`, and the screenplay-drafter skill explicitly
  teaches new agent-authored Screenplays, focused revisions, restore, and FDX
  import. These are current product contracts, not fixture-only backdoors.
- The broad Screenplay operation document also contains `reference.add` and
  `reference.delete`. Those are the only operation variants that remain valid
  on an FDX-backed Project.
- The FDX parser maps a Scene Heading `Number` attribute into that property.
- The importer checks duplicates but allows missing numbers and always returns
  an empty warnings array.
- FDX import already requires an empty Screenplay and stores one retained source
  Asset and one import record. That record is sufficient for Core to recognize
  the FDX-backed mutation boundary without adding a mutable source-mode field.
- Project Settings version 1 has Screenplay Import workflow switches but no
  missing-number policy.
- Urban Basilica has 10 current Scenes and all 10 have production numbers.

### Current Shot state

- `shot_plan` has no number.
- `shot` stores `position` but no stable number.
- Shot creation appends, Shot move rewrites position, and current UI/skills use
  `position + 1` as if it were a stable reference.
- Urban Basilica currently has one active Shot Plan and one active Shot.

### Current Beat state

- `Beat` has eight creative fields plus its durable id and no number.
- `SceneBeatSheetDocument` stores Beats in JSON and optional
  `baseBeatSheetId` lineage.
- every focused operation already creates an immutable history row and may
  change the active pointer; this established revision behavior is retained;
- `beatSheet.replace` currently makes full replacement ambiguous;
- CLI has `validate`, `write`, `validate-operations`, `apply`, and `set-active`,
  but no reset command;
- current guidance treats full write as both first creation and intentional
  replacement, so the renamed surface adds explicit `create` and `reset` intents
  without changing how revisions are stored or selected;
- Storyboard Assets already belong to `{ sceneId, beatId }`, so they do not need
  a Beat Sheet id;
- Shot Plan coverage and Storyboard status/import intentionally retain the exact
  revision id alongside Beat ids so historical context can be restored;
- Urban Basilica has 12 Beat Sheet history rows across four Scenes and four
  active pointers. Read-only inspection confirms each pointer selects that
  Scene's newest row. The clean rebuild converts only those four active/latest
  rows into the renamed Scene Beats schema, clears their legacy base links, and
  omits the other eight development-history rows. This cleanup is confined to
  the one-time archived-project rebuild; runtime revision retention remains
  intact.
- Urban Basilica's one current Shot Plan coverage document names revision
  `scene_beat_sheet_t8mztfa2` and `beat_001`. That revision is the Scene's
  active/latest row and the Beat exists in it, so the clean rebuild can rename
  the coverage field while preserving the relationship exactly.

The repository does not have one reusable cross-domain revision service.
Screenplay, Screenplay Analysis, and department designs each implement their own
history tables and commands. Scene Beats already have the complete history,
read/list, and active-selection owner they need, so this plan leaves that
lifecycle intact instead of creating a parallel undo mechanism or a new generic
framework.

## Right-Sized Decision

### Preserve both Screenplay source workflows

The current screenplay-drafter remains valid for creating and revising a
Screenplay entirely with the user and agent. Core applies the FDX authority gate
only to FDX-backed Projects; agent-authored Projects retain
create/apply/restore.

### Enforce FDX authority once in Core

Core derives FDX authority from the retained import record and rejects
content-bearing apply batches and revision restore before any write. The
existing closed Screenplay operation union still owns reference add/delete, so
there is no second reference command family. CLI, Studio, and skills only
transport and report the Core result.

### Keep FDX and agent Scene persistence distinct

Exact FDX numbers stay directly on current Scenes because the external editor
owns them. Agent-authored Scenes use durable Renku reservations for
insert/delete/restore. Mixing them would make Renku look authoritative for FDX
numbers and complicate future association.

### Share numbering without one generic table

Scene, Shot, and Beat use the same grammar and ordered allocation algorithm,
while their existing owners persist the results. Unrelated lifecycle and
foreign-key behavior does not move into a universal registry.

### Keep Shot Plan numbering as one monotonic counter

Shot Plans have no authored order and no before/after insertion semantics. Their
number records creation sequence only. A Scene-local integer counter is the
complete rule: create/copy increments it, and deletion never decreases it.

### Preserve the existing Scene Beats revision owner

Scene Beats already have immutable revision rows, history listing, read-by-id,
explicit base revisions, and active selection. Reset adds and activates a
revision; set-active restores any retained revision; neither action deletes
history. No two-slot undo store and no new generic revision framework is added.
Other revisioned domains remain under their existing owners.

### Keep Beat allocation in Core

Agents author creative Beat content, not durable references. Core assigns Beat
ids and numbers, stores reserved numbers in the immutable revision document,
and exposes numbered Beats in projections.

### Keep the Asset model outside this numbering change

Numbering does not require an Asset contract change. Plan 0172 keeps the current
smaller one-file-per-written-Asset approach.

## Architecture Shape Gate

### Owning boundaries

`packages/core` owns every grammar, allocation, reservation, import-policy, and
reset rule. Ownership is divided into focused modules:

- `production-numbers/` owns pure shared syntax, display, suffix allocation,
  and placement planning;
- `screenplay/` owns source classification, the FDX content-mutation gate, the
  existing agent authoring commands, and agent Scene-number reservations;
- `screenplay/fdx/` owns exact numbered-import validation and the explicitly
  authorized one-time fallback;
- `shot-plans/` owns Plan and Shot reservation transactions;
- `scene-beats/` owns the existing immutable revision history, active-selection
  state, focused revision creation, reset, Storyboard status, and per-revision
  Beat-number reservations;
- `project-settings/` owns the explicit missing-number policy.

The CLI parses commands and prints reports. Studio renders Core projections and
the existing Project Settings form. Skills follow the contracts and ask for
user intent. None of those adapters allocates, validates, or reserves a number.

### Intended module layout

```text
packages/core/src/client/
  production-numbers.ts                 # browser-safe grammar/display contract
  project-settings.ts                   # settings v2 and import policy field
  screenplay/
    source.ts                           # empty/agent/fdx status projection
    model.ts                            # Scene/SceneInput number ownership
  scene-beats/
    model.ts                            # BeatInput, numbered Beat, reset DTOs
    schemas.ts                          # current/reset/operations schemas
  shot-plans.ts                         # numbered Plan/Shot and placement DTO

packages/core/src/server/
  production-numbers/
    syntax.ts                           # parse, validate, case-fold, display
    alphabetic-suffix.ts                # A..Z, AA.. suffix sequence
    allocation.ts                       # pure initial/append/insert planner
  screenplay/
    source-authority.ts                 # derive source and gate FDX mutations
    scene-numbering/
      agent-allocation.ts               # translate Scene placement to pure plan
      agent-reservations.ts             # read/insert durable agent reservations
    commands/screenplay.ts              # create plus agent number transaction
    commands/operations.ts              # existing typed registry plus source gate
    commands/revisions.ts               # read/list and agent-only restore
    commands/fdx-import.ts              # thin import transaction orchestration
    fdx/numbering.ts                    # missing/unsupported/duplicate policy
    fdx/contracts.ts                    # numbered import report/provenance DTO
  shot-plans/
    plan-numbering.ts                   # Scene-local Plan counter
    shot-numbering.ts                   # reservation and placement planning
    plan-authoring.ts                   # focused Plan command orchestration
    shot-authoring.ts                   # focused Shot command orchestration
  scene-beats/
    history.ts                          # existing list/read/active revision behavior
    persistence.ts                      # immutable revision rows and active state
    mutations.ts                        # create/reset/set-active transactions
    numbering.ts                        # adapt base revision values to allocator
    operations.ts                       # focused immutable revision creation
    storyboard-status.ts                # exact revision Beat media status
  project-settings/
    document.ts                         # version 2 validation/default
  schema/
    shot-plans.ts                       # columns and focused reservation tables
    scene-beats.ts                      # renamed existing revision/history state
    screenplay/agent-scene-numbers.ts   # agent-only durable reservations
    screenplay/imports.ts               # Scene number source on import record
```

Existing package and bounded-module `index.ts` files may export the new public
contracts. They must remain thin export lists. No grammar, SQL, allocation,
command dispatch, or report construction belongs in an `index.ts`.

The existing focused authoring modules, closed Screenplay operation union, CLI
`authoring.ts`, revision commands, schemas, samples, and screenplay-drafter
workflow remain. The implementation extends them directly; it does not add a
parallel “agent screenplay” API or duplicate reference command family.

`commands/operations.ts` may keep its current typed handler registry because it
dispatches one closed domain operation union. The new source-authority check
runs before that registry mutates the cloned aggregate. It does not become
another operation switch or duplicate per-handler guard.

The exact files may stay fewer if existing focused files remain small; the stop
conditions below take precedence. Implementation must not manufacture empty
pass-through wrappers merely to mirror this tree.

### Public entrypoints

Browser-safe callers use:

```ts
formatProductionNumberForDisplay(number: string): string

interface ProjectSettingsDocument {
  version: 2;
  screenplayImport: {
    allowRenkuSceneNumberGeneration: boolean;
    generateSceneBeats: boolean;
    // other existing workflow flags remain
  };
}

type ScreenplaySourceStatus =
  | { kind: 'empty' }
  | { kind: 'agent' }
  | {
      kind: 'fdx';
      sceneNumberSource: 'fdx' | 'renku';
    };

interface ShotPlan {
  number: number;
  // existing fields remain
}

interface Shot {
  number: string;
  // existing fields remain
}

interface ImportFdxScreenplayInput {
  // existing fields remain
  generateMissingSceneNumbers?: boolean;
}
```

`Scene.productionNumber` remains required in canonical numbered projections,
but agent-facing `SceneInput` no longer accepts it. The internal FDX mapper has
a dedicated path for preserving exact external values; it does not pass through
the agent authoring input contract.

The existing `ProjectDataService` keeps `createScreenplay`,
`applyScreenplayOperations`, and `restoreScreenplayRevision`. The Beat revision
command family is renamed and tightened under Scene Beats without changing its
history or active-selection lifecycle:

```ts
listSceneBeatsRevisions(input): Promise<SceneBeatsRevisionListReport>
readSceneBeatsRevision(input): Promise<SceneBeatsRevisionReadReport>
validateSceneBeats(input): Promise<SceneBeatsValidationReport>
createSceneBeatsRevision(input): Promise<SceneBeatsRevisionWriteReport>
resetSceneBeats(input): Promise<SceneBeatsRevisionWriteReport>
setActiveSceneBeatsRevision(input): Promise<SceneBeatsRevisionWriteReport>
validateSceneBeatsOperations(input): Promise<SceneBeatsOperationsReport>
applySceneBeatsOperations(input): Promise<SceneBeatsOperationsReport>
readSceneStoryboardStatus(input): Promise<SceneStoryboardStatus>
```

There is no special `restore-previous` wrapper or second undo state. Existing
list, read-by-revision, and set-active behavior provide restore directly.
Numbering is integrated into revision creation inside the same Core owner.

Existing Shot Plan create/copy/add/move/remove methods retain ownership of their
numbering side effects. There is no public “reserve number,” “set number,” or
generic state patch method.

`screenplay status` exposes `ScreenplaySourceStatus`. CLI authoring and revision
handlers remain thin and pass the user intent to Core; they do not implement
source checks or number allocation.

### Database shape

The Drizzle schema is the source of truth. The next generated migration adds:

```text
shot_plan.number                    INTEGER NOT NULL
scene_shot_plan_number              (scene_id PK, last_number NOT NULL)

shot.number                         TEXT NOT NULL
shot_number_reservation             (
  shot_plan_id,
  number,
  number_key,
  shot_id,
  created_at
)

scene_beats_revision                (
  id PRIMARY KEY,
  scene_id,
  document,
  created_at,
  updated_at
)

scene_beats_state                   (
  scene_id PRIMARY KEY,
  active_revision_id
)

screenplay_import.scene_number_source TEXT NOT NULL

agent_scene_number_reservation        (
  number,
  number_key,
  scene_id,
  created_at
)
```

`number_key` is the ASCII-lowercased uniqueness key. Public projections expose
only the case-preserving `number`.

`agent_scene_number_reservation` is unique on `number_key` and `scene_id` and
has no foreign key to `scene`: deleting an agent-authored Scene must not release
its production reference, and restoring the same durable Scene id must recover
that reference. It contains no FDX-backed Scene rows. Current Scene reads still
use the direct `Scene.productionNumber`; the reservation table is an allocation
and lifecycle guard, not a second projection source.

The Shot reservation table deliberately has no foreign key to `shot`: a
collected Shot must not release its reference. It may reference `shot_plan`
with cascade only because a collected Plan's entire private namespace is gone;
the Scene-level Plan counter separately prevents reuse of the Plan number.

This preserves the current Beat persistence shape: immutable JSON document rows
plus one active-revision pointer. The migration directly renames those two
tables, removes the obsolete separate title column, and converts the JSON
document; it does not add another history table, pointer, retention store, or
reservation column. Revision ids remain the exact public handles used by list,
read, operation base selection, Storyboard status/import, Shot Plan coverage,
and set-active.

Each revision document stores a validated internal envelope containing
`SceneBeats`, its existing optional base-revision relationship, and the complete
case-preserving set of numbers that revision may not reuse, including deleted
Beat numbers. The reservation array is revision metadata, not part of the
public creative `SceneBeats` aggregate. Stored-envelope validation requires
every Beat number to appear in that array and requires case-insensitive
uniqueness.

Core never truncates revision rows as part of create, reset, focused editing, or
set-active. Reset inserts a fresh revision with a new numbering namespace and
activates it. Focused edits derive a new revision from the explicit base,
preserve its reservation set, and add newly allocated numbers. Set-active
changes only `scene_beats_state.active_revision_id`; both the previously active
and newly active revisions remain readable.

### Domain branching

The shared allocator branches only on `initial`, `append`, or `insert`
placement and receives plain ordered/reserved values. It never opens SQLite or
knows what a Scene, Shot, or Beat is.

Scene, Shot, and Beat adapters translate their ordered state into that pure
input and persist the result inside the owning transaction. Shot Plans remain
the deliberate exception: their focused counter performs only monotonic
Scene-local integer allocation because Plans have no authored order. There is
no domain-kind switch in the shared allocator and no generic repository.

### Existing files expected to shrink or become clearer

- `packages/core/src/server/screenplay/commands/fdx-import.ts` delegates number
  policy to `fdx/numbering.ts` instead of accumulating more validation.
- `packages/core/src/server/screenplay/commands/screenplay.ts` assigns initial
  agent Scene numbers before committing create and revision state.
- `packages/core/src/server/screenplay/commands/operations.ts` keeps its focused
  registry and adds one pre-write source-authority validation plus agent Scene
  reservation planning.
- `packages/core/src/server/screenplay/commands/revisions.ts` keeps restore and
  delegates the FDX gate/agent reservation reconciliation to focused owners.
- CLI `screenplay/index.ts`, `authoring.ts`, and `revisions.ts` retain their
  current commands and remain transport/report adapters.
- `packages/core/src/server/shot-plans/shot-authoring.ts` stops treating
  position as the human number.
- `packages/core/src/server/scene-beat-sheet/history.ts` moves to Scene Beats
  naming while retaining list/read/set-active behavior.
- Scene Beats operations continue creating immutable derived revisions; the
  numbering adapter supplies preserved and newly allocated numbers.
- Shot Plan coverage and Storyboard import/status rename `beatSheetId` to the
  exact Scene Beats revision id instead of removing revision context.
- CLI `screenplay/beat-sheets.ts` is replaced by `screenplay/beats.ts`, which
  delegates create/reset/list/read/set-active/apply intent without implementing
  policy.
- Studio `scene-label.ts` consumes the shared formatter rather than owning a
  partial one-digit regular expression.

### Forbidden implementation shapes

- No universal `number_registry` table or domain-kind switch.
- No route-local, CLI-local, React-local, or skill-local allocation.
- No Renku allocation or normalization of supported FDX Scene numbers in the
  normal import path.
- No fallback FDX numbering unless the Project setting and explicit import
  request are both present.
- No local content/structure mutation or revision restore when an FDX import
  record exists; reference-only Screenplay operation batches remain valid.
- No removal, renaming, or parallel replacement of the screenplay-drafter or
  its agent-authored create/apply/restore workflow.
- No FDX Scene rows in the agent Scene-number reservation table.
- No position-to-number formatting in UI or skill code.
- No number parsing to recover identity, order, Scene ownership, Plan
  ownership, or Storyboard ownership.
- No generic Asset or project-state patch API.
- No old Beat Sheet command, type, schema, route, resource key, or compatibility
  alias; callers move directly to Scene Beats.
- No source-text architecture tests naming private helpers or method
  inventories.
- No Studio reset button hidden behind a feature flag.
- No second Scene Beats undo table, previous-value columns, retention cap, or
  destructive restore path.
- No removal of Scene Beats revision identity from Shot Plan coverage,
  Storyboard attachment/status, Studio selection, resource keys, CLI input, or
  skill workflow; rename those fields directly to revision terminology.
- No flattening of Scene Storyboard iteration folders.

### Stop conditions

Stop and revise the slice if:

- shared production-number code imports Shot, Beat, Screenplay, database, or
  filesystem modules;
- one persistence function branches across multiple numbering domains;
- FDX import writes the retained source Asset before missing-number validation
  completes;
- a normal numbered FDX import changes an authored number or creates an agent
  Scene reservation;
- missing FDX numbers are generated with only the setting or only the import
  flag instead of both gates;
- reset, set-active, or any runtime cleanup deletes a Scene Beats revision
  after the clean baseline has been created;
- the one-time Urban Basilica conversion retains more than the four active Beat
  revisions or carries a base link to one of the eight omitted rows;
- focused Beat edits mutate their base revision instead of creating a new one;
- revision list/read/set-active behavior is removed or bypassed;
- Storyboard files are flattened out of their existing `NN-iteration/` folder;
- reset or insert accepts a caller-authored Beat id or number;
- set-active mutates, deletes, or rewrites either the revision being selected or
  the revision being left;
- Shot Plan numbering starts using ordered insertion/suffix behavior;
- an agent Scene, Shot, or Beat delete physically removes its reservation;
- a label requires UI position to remain meaningful;
- Project Settings parsing adds a version-1 fallback instead of a one-way
  migration;
- any production service, CLI command, Studio route, or installed skill can
  create/update/delete/move/restore canonical Screenplay content after FDX
  import, except Renku-owned reference add/delete;
- an agent-authored Project can no longer create, revise, or restore its
  Screenplay through the existing public commands;
- a CLI or skill must provide the final number;
- an `index.ts`, service contract, or command handler becomes a broad
  switchboard.

## Contracts And Diagnostics

### Screenplay source-authority contract

The current Screenplay operation document remains the single closed mutation
contract. Before executing a batch, Core derives `ScreenplaySourceStatus` and
applies this matrix:

| Source | Create | Apply content operations | Apply reference-only operations | Revision restore |
| --- | --- | --- | --- | --- |
| Empty | Allowed through `screenplay create` | Existing create/apply preconditions remain | No valid targets yet | No revision to restore |
| Agent | Existing empty-only create rule | Allowed | Allowed | Allowed |
| FDX | Rejected by existing non-empty rule | Rejected before any operation runs | Allowed | Rejected before write |

For this gate, content operations are every current operation except
`reference.add` and `reference.delete`. A mixed batch is content-bearing and
fails as a whole. The rule is implemented once in Core; the operation registry,
CLI, Studio, and skills do not reproduce it.

The existing Screenplay mutation report and revision behavior remain for
agent-authored operations and successful FDX reference-only batches. No second
reference schema, CLI command tree, or mutation report is added.

### FDX import report and provenance

`ScreenplayImport` and `ImportFdxScreenplayReport.screenplayImport` gain:

```ts
sceneNumberSource: 'fdx' | 'renku';
```

`ImportFdxScreenplayInput` gains:

```ts
generateMissingSceneNumbers?: boolean;
```

Omission is `false`. Core does not infer it from the Project setting. The CLI
sets it only from `--generate-missing-scene-numbers`.

The report also returns:

```ts
sceneNumbering: {
  generated: Array<{
    sceneId: string;
    productionNumber: string;
    sourceParagraphIndex: number;
  }>;
};
```

`warnings` remains `DiagnosticIssue[]` and is no longer hard-coded to `[]`.
The technical log may record deterministic parse/mapping facts but must not
become a second product report.

### Scene Beats reports

Revision reports keep the existing behavior and field roles, renamed directly
from Beat Sheet to Scene Beats revision terminology:

```ts
interface SceneBeatsRevisionWriteReport extends SceneBeatsCommandReport {
  revision: SceneBeatsRevisionSummary;
  activeRevisionId: string;
}

interface SceneBeatsOperationsReport extends SceneBeatsCommandReport {
  sceneId: string;
  baseRevisionId: string;
  createdRevisionId: string;
  activatedRevisionId: string | null;
  revision: SceneBeatsRevisionSummary;
  changes: Array<{
    type: 'inserted' | 'updated' | 'deleted';
    beatIds: string[];
  }>;
  storyboard: SceneStoryboardStatus;
}
```

`baseRevisionId` is the immutable revision the operations were applied to;
`createdRevisionId` is the new saved revision; and `activatedRevisionId` is that
new id only when the caller requested activation. These are the existing
revision transitions with deliberate names, not three Beat aggregates or a new
state model.

`SceneStoryboardStatus` is addressed by Scene plus Scene Beats revision id and
returns `beatId`, `beatNumber`, images, and selection for each Beat in that
revision. Asset File paths retain their allocated `NN-iteration/` folder.
`SceneBeatsResource` exposes the active revision and revision summaries through
the existing history/active-selection projection.

### Structured diagnostic matrix

| Code | Condition and correction |
| --- | --- |
| `PRODUCTION_NUMBER_INVALID` | A Core-authored number is outside the shared grammar; report the owning field |
| `PRODUCTION_NUMBER_COLLISION` | A case-insensitive number reservation already exists in the scope; retry or repair before write |
| `PRODUCTION_NUMBER_ALLOCATION_EXHAUSTED` | Bounded suffix allocation cannot produce a short valid number; fail without mutation |
| `SCREENPLAY_FDX_CONTENT_MUTATION_UNSUPPORTED` | A content operation or revision restore was requested for an FDX-backed Project; make the screenplay edit in the external editor and note that updating this Project from a later export requires the separate re-import capability, which this plan does not implement |
| `SCREENPLAY_IMPORT_SCENE_NUMBERS_MISSING` | One or more FDX Scene Headings lack numbers and explicit generation was not fully authorized; re-export or enable the preference and request the fallback |
| `SCREENPLAY_IMPORT_SCENE_NUMBER_GENERATION_DISABLED` | The import requested generated Scene numbers while the Project preference is false; enable it only for the deliberate fallback |
| `SCREENPLAY_IMPORT_SCENE_NUMBER_UNSUPPORTED` | FDX number is not numeric-first production form; renumber in the editor and re-export |
| `SCREENPLAY_IMPORT_SCENE_NUMBER_DUPLICATE` | Two FDX Scenes collide case-insensitively; fix in the editor |
| `SCREENPLAY_IMPORT_SCENE_NUMBERS_GENERATED` | Warning: missing numbers were created and later editor numbering cannot be reconciled |
| `SCREENPLAY_AGENT_SCENE_NUMBER_RESERVATION_CONFLICT` | An agent Scene id or number is already reserved inconsistently; fail the screenplay mutation and revision atomically |
| `SHOT_PLAN_NUMBER_ALLOCATION_FAILED` | Scene-local counter/reservation could not commit; no Plan is created |
| `SHOT_NUMBER_PLACEMENT_INVALID` | Placement Shot is missing, discarded, or belongs to another Plan |
| `SHOT_NUMBER_RESERVATION_CONFLICT` | Transaction could not reserve the allocated Shot number |
| `SCENE_BEATS_ALREADY_EXISTS` | Initial creation was requested for a Scene that already has Beats; use focused operations or reset |
| `SCENE_BEATS_NOT_FOUND` | Read, reset, set-active, or focused mutation was requested before initial Scene Beats exist |
| `SCENE_BEATS_REVISION_NOT_FOUND` | Read, focused editing, Storyboard status, or set-active references a revision that does not exist for the Scene |
| `SCENE_BEATS_OPERATION_TARGET_NOT_FOUND` | A focused operation references a Beat that is not current; reread and retry |
| `SCENE_BEAT_NUMBER_RESERVATION_CONFLICT` | A current Beat id or number conflicts with the current reservation envelope |

Codes follow the repository diagnostic naming conventions at implementation;
if the accepted convention requires an existing domain prefix, update this
table and all callers together before implementation rather than adding aliases.

## Migration And Backfill

### Drizzle workflow

Before schema changes, implementation must consult the current official Drizzle
Kit migration documentation and generate the schema diff from the TypeScript
schema. Use Drizzle Kit's custom-migration flow for the exact data-preservation
SQL that must run between the generated table changes. This is one checked-in
Drizzle migration, not an application-level migration runner.

The data conversion exists for exactly one database:
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite`. Rehearse the
migration on a disposable copy, then apply it once to that local Project through
the existing `renku project migrate` boundary. Do not add a product command,
runtime branch, reusable migration framework, compatibility reader, generalized
migration diagnostic family, or fleet/user upgrade behavior. New empty project
databases contain none of the old rows, so the data-preservation statements are
no-ops there.

The expected next migration is `0076`; implementation must verify the actual
Drizzle journal before generation rather than assuming the filename.

### Project Settings

Migrate Urban Basilica's stored version-1 document to version 2 by inserting:

```json
"allowRenkuSceneNumberGeneration": false
```

Rename `generateSceneBeatSheets` to `generateSceneBeats` while preserving its
boolean value. Preserve every other setting exactly. Runtime reads accept only
version 2 and the current name after migration; there is no compatibility
parser.

### Urban Basilica Scenes

The current local database has ten numbered Scenes, zero `screenplay_import`
rows, and zero Screenplay revision rows. The one-time conversion therefore
treats it as the current agent-authored source shape instead of synthesizing FDX
provenance that the database does not contain:

1. validate the ten current production numbers case-insensitively;
2. preserve every value byte-for-byte;
3. create one agent Scene-number reservation for each current Scene id; and
4. seed the whole-number high-water from those ten reservations.

The data step is deliberately scoped to this one local Project. It does not add
a reusable agent-history migration framework or infer a missing FDX import.
Runtime commands still support both accepted source workflows for current and
future Projects.

### Existing Shot Plans and Shots

Within each Scene, sort Shot Plans by `created_at`, then `id`, and assign
`1..N`. Seed `scene_shot_plan_number.last_number` to `N`.

Within each Plan, sort active and discarded Shots by `position`, then
`created_at`, then `id`; assign `1..N`; create a reservation for every Shot; and
preserve the current `position`. The backfill fails if the source has duplicate
positions or corrupt ownership rather than hiding it.

Urban Basilica's one current Plan and Shot become Plan `1`, Shot `1`.

### Urban Basilica Scene Beats

The current database has four active Beat Sheet pointers and twelve history
rows. The clean rebuild creates one baseline Scene Beats revision per Scene:

1. read and validate the four active pointers, confirm each selects that
   Scene's latest row by `created_at` then id, and read those four rows;
2. preserve each selected row's revision id, Scene id, timestamps, Beat
   creative fields, Beat ids, and document order;
3. assign those current Beats fresh `1..N` numbers through the shared initial
   allocator and store exactly those values as the baseline reservation set;
4. clear `baseRevisionId` because none of the eight prior development revisions
   enter the clean database;
5. point each renamed Scene Beats state row at the preserved active revision id;
6. omit the other eight Beat Sheet rows from the reconstructed database; and
7. validate exactly four baseline revisions and four active pointers before
   accepting the rebuilt database.

This is exact one-time cleanup for the archived Urban Basilica project, not a
runtime history policy, traversal framework, or reusable migration command.
Afterward, reset and focused edits use the unchanged immutable revision
lifecycle and retain every newly created revision.

All 37 registered Storyboard Assets belong to Beat ids present in the retained
active revisions. Keep those Assets, selections, and six existing
`NN-iteration/` folder boundaries intact; dropping the eight obsolete revision
rows does not require dropping current Beat image candidates. Rename the one
current Shot Plan coverage reference to Scene Beats revision terminology and
verify that it still resolves the retained revision and Beat before accepting
the rebuilt database.

## Implementation Slices

### Slice 1 — Enforce source authority without removing agent authoring

- Add the Core-derived `ScreenplaySourceStatus` projection and expose it through
  `screenplay status`.
- Gate Screenplay mutations in Core from the retained import record: reject
  content-bearing apply batches and revision restore for FDX-backed Projects
  before writes.
- Keep reference-only apply batches valid for FDX-backed Projects and reject a
  mixed reference/content batch atomically.
- Preserve the existing Core/CLI create, apply, revision restore, schemas,
  samples, and screenplay-drafter commands for agent-authored Projects.
- Keep adapters thin: they report the structured source-authority failure and
  never classify source mode themselves.

Exit when FDX-backed content cannot diverge through a Renku authoring command
and the complete agent-authored create/apply/restore workflow still passes.

### Slice 2 — Add the shared production-number vocabulary

- Add browser-safe grammar, display, case-folding, and suffix contracts.
- Add pure initial/append/insert allocation.
- Cover integer high-water, A→Z→AA rollover, case-insensitive reservations,
  beginning/middle/end placement, deletion reservation, and move independence.
- Replace Studio's local Scene label formatter with the shared formatter.

Exit when all callers can display one authoritative number without importing a
server or database module.

### Slice 3 — Make numbered FDX import an explicit Project policy

- Move Project Settings to version 2 with
  `allowRenkuSceneNumberGeneration: false`.
- Add the setting to the existing Project Settings UI with concise warning copy;
  this is a setting control, not a Beat reset button.
- Add `generateMissingSceneNumbers?: boolean` to the Core import input and
  `--generate-missing-scene-numbers` to the thin CLI handler.
- Validate missing, unsupported, and case-insensitive duplicate Scene numbers
  before any write set or database transaction mutates state.
- Preserve explicit values and allocate only missing values when the setting
  and explicit import request are both present.
- Persist `sceneNumberSource` and return generated-number warnings/details.
- Keep importer empty-Screenplay and one-time-import gates unchanged.

Exit when default imports fail atomically for every missing number and the
double-gated fallback produces a complete numbered Screenplay with a warning.

### Slice 4 — Number agent-authored Scenes without touching FDX numbers

- Add the agent-only Scene reservation schema and focused persistence module.
- Remove `productionNumber` from agent `SceneInput`; keep it on canonical
  `Scene` and in the internal FDX mapping path.
- Allocate `1..N` during agent screenplay create and reserve in the same
  transaction as Screenplay/revision persistence.
- Integrate add/move/delete and revision restore with the shared allocator and
  durable reservations.
- Backfill Urban Basilica's ten current Scene ids while preserving their exact
  values; do not build a general historical-data migration framework.
- Keep FDX-backed Scenes entirely outside the reservation table.

Exit when agent create/insert/move/delete/restore proves stable never-recycled
numbers and normal FDX import proves byte-for-byte preservation.

### Slice 5 — Add Shot Plan numbering

- Add Drizzle Plan number/counter schema and focused access functions.
- Allocate within create and copy transactions.
- Backfill current Plans deterministically.
- Expose Plan numbers in Core, CLI, HTTP, and Studio projections.
- Update existing labels without creating an edit-number action.

Exit when create/copy/delete/collect/concurrency tests prove numbers never
change or recycle.

### Slice 6 — Add stable Shot numbering and placement

- Add Shot number/reservation schema and projection.
- Add `ShotPlacement` to the focused add contract, defaulting to end.
- Allocate initial/copy/add numbers in the owning transactions.
- Preserve number on update and move.
- Preserve reservations on delete and collection.
- Replace every `position + 1` user/agent label with `shot.number`.

Exit when middle insertion, beginning insertion, append, move, delete, Trash
collection, and copy all have explicit stable-number tests.

### Slice 7 — Add numbering without changing Scene Beats revision history

- Rename the existing Beat Sheet revision/state contracts to Scene Beats while
  preserving immutable history, base revision links, list/read, and active
  selection.
- Replace Beat Sheet types with `BeatInput`, numbered `Beat`, `SceneBeatsInput`,
  `SceneBeats`, `SceneBeatsRevisionSummary`, and the focused operation union.
- Add explicit Core create and reset intents on top of the existing revision
  writer; retain set-active as the restore operation.
- Keep focused edits as immutable derived revisions from an explicit base.
- Make Core assign every new Beat id and number.
- Convert only Urban Basilica's four active Beat revisions into four clean
  baseline revisions; preserve their ids and Beat ids, clear their base links,
  and omit the other eight development-history rows.
- Rename existing revision report fields directly and document the base,
  created, and activated roles without changing their behavior.

Exit when reset and focused editing create numbered revisions, set-active can
move backward and forward without deleting runtime history, and the rebuilt
database starts with exactly four active baseline revisions.

### Slice 8 — Preserve revision context and Storyboard iterations

- Rename Shot Plan coverage from `{ beatSheetId, beatIds }` to
  `{ sceneBeatsRevisionId, beatIds }`.
- Rename Storyboard status and grouped image import to the same exact revision
  identity.
- Keep `sceneBeat` Asset ownership as `{ sceneId, beatId }`.
- Validate new coverage and attachments against the named revision, not only
  the currently active one.
- Preserve existing `NN-iteration/` allocation for every imported Storyboard
  batch and keep historical Asset Files in those folders.
- Treat inactive or missing revision/Beat context as weak without deleting Shot
  Plans, Storyboard Assets, or iteration folders.
- Rename resource keys and Studio refresh/selection context from Beat Sheet id
  to Scene Beats revision id.

Exit when selecting any retained revision restores its Beat ids, coverage, and
selected Storyboard media while every iteration folder remains intact.

### Slice 9 — Update Studio projections and labels only

- Show stable Scene, Shot Plan, Shot, and Beat numbers anywhere the
  corresponding label already exists.
- Keep route ids and selected entity ids unchanged.
- Keep desktop UI quiet where there is no meaningful existing label.
- Add no Beat reset button and no number editor.

Exit when desktop flows render Core values and no React code calculates one.

### Slice 10 — Align Studio agent skills

In `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- `screenplay-drafter`: preserve new screenplay creation, focused revision, and
  restore for agent-authored Projects; branch on `ScreenplaySourceStatus`; for
  missing FDX numbers ask re-export versus explicitly enabling and requesting
  the fallback, and state the fallback association limitation;
- `scene-beat-designer`: use `screenplay beats`; distinguish create, focused
  edits, reset, history inspection, and set-active restore; never author Beat
  ids or numbers;
- `shot-planner`: use returned stable Plan/Shot numbers and explicit placement;
  never treat position as a number;
- `media-producer`: consume the exact Scene Beats revision and returned Beat
  numbers for Storyboard context and iteration-folder imports without
  calculating either;
- `movie-director`: route screenplay creation/revision and missing-number import
  decisions to screenplay-drafter and avoid implying that re-import is already
  implemented.

Update exact examples, help text, eval fixtures, and guide validators. Do not
add an agent-only numbering algorithm.

### Slice 11 — Record the accepted decision and unblock Plan 0172

- Add ADR 0075 for dual Screenplay source authority, stable production
  numbering, `SceneBeats`, unchanged runtime revision retention, and the
  one-time four-revision Urban Basilica baseline.
- Amend Decision 0071 through a concise notice: Scene numbers remain direct
  properties; FDX numbers are authoritative for imported Projects; agent Scene
  numbers use a focused reservation lifecycle; and the current authoring
  commands remain valid only for Projects without an FDX import.
- Add a concise naming notice to Decision 0052 while retaining its revision
  history direction. Add a concise notice to Decision 0073 stating that ADR
  0075 narrows it only for the one-time Urban Basilica clean baseline; its weak
  historical-context and runtime-retention behavior remains authoritative after
  that baseline.
- Update current Screenplay, Shot Plan, Scene Beats, Project Settings, data
  model, CLI, and skills documentation.
- Revise Plan 0172 to preserve Scene Storyboard `NN-iteration/` folders under
  the human-readable Scene-number folder.
- Implement Plan 0172 only after every destination input can resolve its number.

## Tests And Guardrails

### Screenplay source-authority tests

- Empty and agent-authored Projects retain public Core/CLI
  create/apply/restore behavior and screenplay-drafter examples.
- FDX-backed Projects reject every content operation and revision restore before
  Screenplay or revision writes.
- FDX-backed Projects accept valid reference-only add/delete batches.
- A mixed reference/content batch fails atomically.
- Reference mutation leaves retained FDX Asset/File hashes, imported Scene
  content, structure, production numbers, and import record unchanged.
- `screenplay status` derives `empty`, `agent`, and `fdx` from durable state and
  reports `sceneNumberSource` for FDX.

### Shared Core tests

- Validate accepted/rejected grammar and exact case preservation.
- Enforce case-insensitive uniqueness.
- Test display padding for `1`, `1A`, `4aA`, `28A`, and `100`.
- Test initial, append, start insert, middle insert, repeated insert, deletion,
  high-water, `Z→AA`, and bounded allocation failure.
- Prove allocation output depends only on explicit ordered/reserved inputs and
  does not import domain or database modules.

### Agent-authored Scene tests

- First screenplay create assigns `1..N` without accepting numbers from
  `SceneInput`.
- Append uses a new whole number and non-end insertion uses the next short
  suffix.
- Update and move preserve the number.
- Delete preserves the reservation; a new Scene never recycles it.
- Restore reactivates the same Scene id's reserved number and rejects a missing
  historical reservation as invalid migrated state.
- Agent allocation and revision writes commit or fail together.
- FDX-backed Scenes never create agent reservation rows.

### FDX import tests

- Default false plus one missing number reports every issue and writes nothing.
- Default false plus all numbers imports successfully.
- Enabled setting without the explicit request reports missing numbers and
  writes nothing.
- Explicit request with the setting disabled reports generation disabled and
  writes nothing.
- Enabled setting plus explicit request preserves explicit values and fills
  only missing values.
- Unsupported and case-insensitive duplicate numbers fail before the source
  Asset write.
- Generated warning and `sceneNumberSource` are serialized through CLI and
  Studio server errors/reports.
- Existing one-time and empty-Screenplay gates remain.
- FDX parser fixtures cover Final Draft, Fade In, and WriterDuet-shaped numbered
  Scene Heading elements where representative fixtures are available.

### Shot Plan and Shot tests

- Create, copy, delete, collect, recreate, and concurrent create cover the Plan
  counter.
- Fresh and copied Plan Shots start `1..N` in their own scope.
- Add placement validates same-Plan active anchors.
- Append uses a new whole number; non-end insertion uses suffixes.
- Move changes position only.
- Delete and collection preserve reservations.
- Reports, CLI JSON, HTTP serialization, and Studio labels carry the same values.

### Scene Beats tests

- Create assigns Core-owned ids and numbers `1..N`; a second create fails
  without changing current state.
- Focused update preserves id/number; insert allocates; delete preserves the
  number in the derived revision's reserved array.
- Focused edits leave their base revision byte-for-byte unchanged and create a
  new revision with the carried reservation set.
- Reset inserts and activates a freshly numbered revision without deleting any
  prior or later runtime revision.
- Set-active can move from revision A to B and back to A while both remain
  readable and B remains available.
- Reactivated Beat ids reconnect to their existing Storyboard Assets and Shot
  Plan coverage.
- New Storyboard attachment and Shot Plan coverage validate against their exact
  named revision; weak inactive/missing context returns warnings rather than
  deleting dependent work.
- Storyboard imports preserve one shared `NN-iteration/` folder per batch, and
  revision changes never flatten or delete those folders.
- The Urban Basilica conversion keeps only the four formerly active revisions,
  clears their base links, preserves all four active pointers, and preserves the
  37 current-Beat Storyboard Asset files in their six iteration folders.

### Architecture guardrails

- Import-boundary test: browser-safe production-number code imports no server,
  database, Node, or filesystem module.
- Import-boundary test: Studio features import no Core server/database module.
- Runtime boundary tests prove FDX source state rejects content mutation before
  writes while agent source state retains the public authoring contract; do not
  freeze private helper or service inventories.
- Runtime tests prove invalid import/reset/set-active/placement fails before writes.
- Static capability check rejects path/number allocation in CLI and Studio using
  stable forbidden imports or APIs, not private helper-name needles.
- Complexity checks keep FDX import, Shot authoring, Scene Beats operations, and CLI
  handlers below accepted review thresholds.
- Do not commit source-text tests for retired Beat Sheet names or implementation
  helpers. Current-contract runtime tests and import boundaries are the durable
  guardrails.

## Documentation

Update:

- `docs/decisions/0075-use-stable-production-numbering-and-scene-beats.md`;
- `docs/decisions/0071-use-scene-first-screenplay-and-direct-project-story-metadata.md`
  with a superseding notice only;
- Decision 0052 with a concise Scene Beats naming notice;
- Decision 0073 with a concise notice for the one-time clean-baseline exception
  while preserving its runtime weak-history direction;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/project-settings.md` or the current owning settings doc;
- `docs/architecture/screenplay-import.md` or the current FDX import reference;
- `docs/product/workflows.md`, domain vocabulary, and current Shot Plan/Scene
  Beats references so `Sheet` remains reserved for visual artifacts;
- CLI help/reference for `import-fdx`, Screenplay source behavior, existing
  authoring/revision commands, Project Settings, Shot placement, and Scene Beats
  create/reset/list/read/set-active/apply;
- the five affected Studio skills and their evals/fixtures.

Document the actual FDX validation behavior and the fallback warning. State
that exact externally authored numbers are preserved for future association,
while re-import is not implemented by this plan. Document agent-authored
create/apply/restore as a separate workflow. Do not claim every
editor/version/export configuration always emits numbers.

## Final Verification

### Automated

Run focused checks while implementing:

```text
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm --filter @gorenku/studio test
```

Then run repository gates:

```text
pnpm check
pnpm build
```

Run the affected skill validators and eval suites from
`/Users/keremk/Projects/aitinkerbox/studio-skills`.

### Disposable-project behavior

Verify on clean disposable Projects:

1. numbered FDX with the default setting;
2. unnumbered FDX with the default setting and zero writes;
3. unnumbered FDX with only the preference and with only the explicit flag,
   confirming zero writes in both cases;
4. mixed-number FDX with both fallback gates and the warning;
5. FDX-backed reference-only apply succeeds while content apply, mixed apply,
   and revision restore fail atomically;
6. agent-authored screenplay create, Scene append/insert/move/delete, revision
   restore, and never-recycled Scene numbers;
7. Plan create/copy/delete/recreate;
8. Shot start/middle/end insertion, move, deletion, and collection;
9. Scene Beats create, focused derived revisions, two resets, revision history,
   backward/forward set-active changes, and exact-revision Storyboard status;
10. no Studio Scene Beats reset/restore control; and
11. every visible label remains tied to an id while using the stable number.

### Urban Basilica migration

On a disposable copy of
`/Users/keremk/renku-movies/urban-basilica`:

- run the generated/custom Drizzle migration through the existing Project
  migration boundary;
- confirm all 10 Scene numbers remain byte-for-byte unchanged;
- confirm its zero-import-record source classification remains agent-authored;
- confirm ten agent Scene-number reservations preserve the exact values;
- confirm its active Plan/Shot become `1`/`1`;
- confirm the four formerly active Beat Sheet rows become the only four Scene
  Beats revisions, keep their revision/Beat ids, have no base links, and remain
  selected by the four active pointers;
- confirm the other eight Beat Sheet history rows are absent from the rebuilt
  database but remain available in the archived source database;
- confirm all existing Storyboard iteration folders and Asset File paths remain;
- run `quick_check` and `foreign_key_check`;
- open Scene, Beat, Shot Plan, Shot, and Storyboard desktop views;
- only after this passes allow Plan 0172's clean rebuild to consume the numbers.

### Architecture and diff inspection

- Inspect `git diff --stat` and the complete diff.
- Inspect every new or heavily modified numbering/import/Shot/Beat file.
- Confirm shared allocation stays pure and domain persistence stays focused.
- Confirm `index.ts` files remain thin entrypoints.
- Confirm no universal registry, broad switchboard, compatibility parser, or
  screenplay-editing behavior was added.
- Confirm normal FDX numbers remain exact and fallback generation requires both
  explicit gates.
- Confirm FDX-backed Projects reject content mutation while agent-authored
  Projects retain create/apply/restore.
- Confirm the existing screenplay-drafter workflow was updated rather than
  removed, renamed, or shadowed by a parallel API.
- Confirm the CLI and Studio server handlers only transport Core intent/results.
- Confirm React displays numbers but does not calculate them.
- Confirm Shot Plans still use only their focused monotonic counter.
- Confirm Scene Beats retains immutable history, exact revision identity,
  active selection, and every Storyboard iteration folder.
- Confirm no checklist item was satisfied by accepting unreviewable structure.

### Completion Evidence

- Core owns the shared production-number grammar, case-folded uniqueness,
  display formatting, bounded suffix allocation, and each domain's focused
  persistence lifecycle. The CLI, Studio server, React features, and Studio
  skills only transport intent or display Core projections.
- The exact package commands pass: Core 326 tests, CLI 60 tests, and Studio 323
  tests. Core, CLI, and Studio integration suites also pass with 3, 31, and 51
  tests respectively.
- `pnpm check` and `pnpm build` pass. Architecture checks confirm the public
  entrypoints remain export surfaces and no raw feature controls, forbidden
  re-export stubs, broad compatibility paths, or implementation-name
  architecture tests were introduced.
- A generation-60 Urban Basilica backup was migrated through the real CLI on a
  disposable full-project copy after the final guard changes. Its Scene,
  Scene Beats, Shot Plan, Shot, counter, reservation, and Project Settings
  state matches the live generation-61 Project semantically; `quick_check` is
  `ok` and `foreign_key_check` returns no rows.
- The live Urban Basilica Project has ten exact agent Scene-number
  reservations, four active clean-baseline Scene Beats revisions, the migrated
  Plan/Shot numbers `1`/`1`, all 37 Storyboard Assets, and all six existing
  Scene-local iteration folders. Its automatic pre-migration backup is retained
  under `.renku/project-database-backups/`.
- Desktop verification opened the migrated Project in the current Studio
  runtime and confirmed the Settings double-gate, padded Scene labels, stable
  Beat labels, and migrated Plan/Shot labels without browser console warnings.
- The seven affected Studio skill packages pass `quick_validate.py`; the media
  producer's image and video prompt-guide validators pass, and the updated eval
  cases cover FDX authorization, source routing, stable Scene/Plan/Shot/Beat
  references, revision restore, and exact-revision Storyboard handoff.

## Completion Checklist

### Review Area

- [x] Confirm FDX-backed and agent-authored Screenplay source workflows remain distinct.
- [x] Confirm Screenplay Editor → FDX → Renku authority is enforced only for FDX-backed Projects.
- [x] Confirm create/apply/restore remain available for agent-authored Projects.
- [x] Confirm FDX Scene numbers are preserved exactly in the normal workflow.
- [x] Confirm fallback FDX numbering requires both the Project preference and an explicit import request.
- [x] Confirm Shot Plan numbers are Scene-local, increasing, stable, and never recycled.
- [x] Confirm Shot and Beat references stay short and stable without claiming to encode current order.
- [x] Confirm Shot Plans remain outside the ordered insertion allocator because they have no authored order.
- [x] Confirm Scene Beats revisions remain Scene-owned saved documents rather than a separate Beat Sheet product entity.
- [x] Confirm reset starts fresh numbering and preserves every prior revision.
- [x] Confirm restore uses set-active and never deletes the restored or rejected revision.
- [x] Confirm the one-time Urban Basilica rebuild keeps only four active baseline revisions without changing the runtime retention policy.
- [x] Confirm Storyboard images remain grouped in Scene-local `NN-iteration/` folders.
- [x] Confirm Scene Beats reset/restore has no Studio button.
- [x] Confirm Plan 0172 receives every required number projection.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Keep Core/CLI public Screenplay create, apply, and revision-restore contracts for agent-authored Projects.
- [x] Add Core-derived `ScreenplaySourceStatus` without a second mutable source-mode field.
- [x] Gate FDX-backed content mutation and restore before writes while retaining existing reference operations.
- [x] Add the shared grammar, formatter, uniqueness key, and pure allocator in Core.
- [x] Keep Scene, Shot Plan, Shot, and Beat persistence in focused domain owners.
- [x] Add focused agent Scene-number reservations and keep FDX Scenes outside them.
- [x] Keep public number contracts browser-safe.
- [x] Add Project Settings version 2 and `allowRenkuSceneNumberGeneration: false`.
- [x] Add explicit `generateMissingSceneNumbers` Core/CLI import intent.
- [x] Add `sceneNumberSource` and generated-number report details.
- [x] Add `ShotPlan.number`, `Shot.number`, `ShotPlacement`, `BeatInput`, `Beat.number`, and `SceneBeats`.
- [x] Add focused Scene Beats create/reset/list/read/set-active/apply contracts.
- [x] Rename Beat Sheet types, revision ids, commands, schemas, routes, and resources directly with no alias or shim while retaining revision behavior.
- [x] Keep package-boundary failures structured.
- [x] Keep prompts and creative Beat contents opaque.

### Shared Numbering Implementation

- [x] Implement numeric-first validation and exact case preservation.
- [x] Implement case-insensitive scope uniqueness.
- [x] Implement one shared display formatter.
- [x] Implement fresh `1..N`, append high-water, and short insertion suffix allocation.
- [x] Implement A→Z→AA rollover and bounded failure.
- [x] Prove moves never mutate numbers and deletes never release reservations.

### FDX Import And Settings

- [x] Validate all missing, unsupported, and duplicate Scene numbers before any write.
- [x] Fail with `Missing scene numbers` when the default setting is false.
- [x] Fail without generation when only the preference or only the explicit import request is present.
- [x] Preserve explicit values and fill only missing values when both gates are present.
- [x] Return the association-limitation warning for Renku-assisted imports without applying it to normal numbered FDX imports.
- [x] Keep the import one-time-only and empty-Screenplay-only.
- [x] Add the setting to the existing Project Settings surface with intentional copy.
- [x] Do not let a skill or adapter change the setting or pass the generation flag without user authorization.

### Screenplay Source Authority

- [x] Derive `empty`, `agent`, or `fdx` from durable Project state in Core.
- [x] Preserve existing authoring handlers, schemas, CLI routing/help, samples, and restore for agent Projects.
- [x] Reject FDX-backed content operations, mixed batches, and revision restore atomically.
- [x] Preserve Cast/Location/Prop linking through existing reference-only operation batches.
- [x] Prove reference mutations cannot change imported Screenplay content or numbers.
- [x] Preserve screenplay-drafter and teach it to branch on source authority.

### Agent-Authored Scenes

- [x] Remove caller-authored production numbers from agent `SceneInput`.
- [x] Assign initial Scene numbers in the same transaction as screenplay create.
- [x] Allocate inserts and append through the shared Core allocator.
- [x] Preserve numbers on Scene update and move.
- [x] Preserve reservations through Scene delete and restore.
- [x] Backfill Urban Basilica's ten current agent Scene ids without inventing FDX provenance or a generic history migration.

### Shot Plans And Shots

- [x] Add and migrate the Scene-local Plan high-water and Plan number.
- [x] Allocate Plan numbers in create and copy transactions.
- [x] Preserve Plan high-water through deletion and collection.
- [x] Add and migrate Shot number reservations.
- [x] Number fresh/copied Shots independently in authored order.
- [x] Add explicit Shot placement and Core-owned insertion allocation.
- [x] Preserve Shot number on update and move.
- [x] Preserve reservations through Shot deletion and collection.
- [x] Replace every position-derived Shot label.

### Scene Beats Revisions

- [x] Rename the existing Beat Sheet revision/state persistence without changing its immutable-history or active-selection lifecycle.
- [x] Preserve every runtime-created revision row and store its complete reserved-number array.
- [x] Rename revision, base revision, created revision, activated revision, and active revision fields deliberately without changing their existing roles.
- [x] Keep `SceneBeatsInput` free of caller-authored Beat ids and numbers.
- [x] Assign Beat ids and initial `1..N` numbers in Core create/reset transactions.
- [x] Keep focused insert/update/delete operations as immutable revisions derived from an explicit base revision.
- [x] Preserve deleted Beat numbers in each derived revision's reservation array.
- [x] Make reset insert and activate a fresh revision without deleting history.
- [x] Make set-active restore any retained revision without deleting the revision being left.
- [x] Keep history list, read-by-revision, base links, and active selection.
- [x] Rename `beatSheetId` to Scene Beats revision identity in Shot Plan coverage, Storyboard status/import, Studio refresh, and skills.
- [x] Keep Storyboard ownership on `{ sceneId, beatId }`, preserve iteration-folder paths, and reconnect reactivated Beats to existing media.
- [x] Add no Studio reset or restore mutation surface.

### Database Migration

- [x] Consult current Drizzle Kit documentation before schema work.
- [x] Update the TypeScript schema as source of truth.
- [x] Generate the next schema diff and the one intentional custom data-preservation migration with Drizzle Kit.
- [x] Rehearse, then run once, that migration on Urban Basilica for settings, current Scenes, Plan/Shot, and the four active Scene Beats revisions.
- [x] Convert only the four active Beat revisions, clear their base links, retain their ids/Beat ids, and omit the other eight rows.
- [x] Preserve all 37 current-Beat Storyboard Assets and their six iteration-folder boundaries while removing old revision rows.
- [x] Preserve the current Shot Plan coverage relationship to its retained Scene Beats revision and Beat.
- [x] Abort the local conversion on unsupported Scene numbers, invalid Shot state, a missing/invalid active Beat revision, or an invalid active pointer.
- [x] Do not add an application-level converter, fixture, reusable migration command, compatibility reader, or runtime Beat-lineage machinery.
- [x] Verify Urban Basilica's expected backfill on a disposable copy.

### Studio And Agent Surfaces

- [x] Replace Studio's local Scene padding with the shared formatter.
- [x] Display Plan, Shot, and Beat numbers in existing meaningful labels.
- [x] Keep routes and relationships on durable ids.
- [x] Rename Beat Sheet product/code/CLI/resource terminology to Scene Beats; retain `Sheet` only for visual artifacts.
- [x] Add no number editor and no Scene Beats reset/restore button.
- [x] Update screenplay-drafter source-mode and missing-number decision guidance without removing its authoring workflow.
- [x] Update scene-beat-designer create/focused/reset/history/set-active guidance; Core creates Beat ids and numbers.
- [x] Update shot-planner stable number and placement guidance.
- [x] Update media-producer to pass the exact Scene Beats revision and preserve Storyboard iteration folders.
- [x] Update movie-director routing for both agent authoring and import decisions.
- [x] Run affected skill validators and evals.

### Tests And Guardrails

- [x] Cover shared grammar, display, allocation, rollover, collision, and high-water behavior.
- [x] Cover preservation of agent Screenplay writers and the FDX content-mutation gate.
- [x] Cover agent Scene create/insert/move/delete/restore reservations.
- [x] Cover FDX atomic failure and double-gated fallback reports.
- [x] Cover Plan and Shot concurrency, move, delete, collect, and copy.
- [x] Cover Scene Beats create, immutable focused revisions, reset history preservation, and backward/forward set-active behavior.
- [x] Cover Storyboard and Shot Plan revision references before reset, after reset, after restoring an older revision, and after returning to the later revision.
- [x] Cover preservation of Storyboard `NN-iteration/` folders and Asset File paths.
- [x] Cover the exact local migration conversion.
- [x] Keep adapter tests limited to delegation and serialization.
- [x] Add stable import-boundary and runtime architecture checks.
- [x] Avoid tests that freeze private helper or service inventories.

### Documentation And ADRs

- [x] Add ADR 0075 with the runtime-retention rule and the one-time four-revision clean baseline stated separately.
- [x] Add concise notices to Decisions 0052, 0071, and 0073 without rewriting their bodies; narrow Decision 0073 only for the local clean-baseline conversion.
- [x] Update current product workflow, vocabulary, data model, Project Settings, FDX import, Shot, Scene Beats, CLI, and skill docs.
- [x] Revise Plan 0172 to keep Scene-local Storyboard iteration folders while replacing Beat Sheet terminology with Scene Beats revision terminology.
- [x] Link official editor guidance without claiming undocumented guarantees.
- [x] Leave historical plans and old ADR bodies unchanged.

### Final Verification

- [x] Run focused Core, CLI, and Studio tests.
- [x] Run `pnpm check` and `pnpm build`.
- [x] Run affected skill validation and eval suites.
- [x] Exercise all disposable-project scenarios.
- [x] Migrate and inspect a disposable Urban Basilica copy.
- [x] Review `git diff --stat` and every large or heavily modified file.
- [x] Confirm shared ownership did not become monolithic implementation.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no universal registry, compatibility path, or general screenplay editor UI was introduced.
- [x] Confirm FDX-backed content cannot diverge while agent-authored create/apply/restore remains intact.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [x] Only then mark this plan complete and unblock Plan 0172's live rebuild.
