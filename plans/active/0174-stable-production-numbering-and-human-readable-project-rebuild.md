# 0174 Stable Production Numbering And Human-Readable Project Rebuild

Status: complete
Date: 2026-08-08
Completed: 2026-08-09

Live reconstruction evidence:

- rebuilt Project: `/Users/keremk/renku-movies/urban-basilica`;
- untouched source archive: `/Users/keremk/renku-movies-archive-20260809T082535Z`;
- internal manifest: `/Users/keremk/renku-movies/urban-basilica/.renku/rebuild-manifest.json`;
- external manifest: `/Users/keremk/renku-movies-rebuild-manifest-20260809T082535Z.json`; and
- generation-60 source SHA-256: `ce71a147d01f4faf28e17ca306f2ec875d42b9caeedafd935e8d18f81c9c98e4`.

## Post-Completion Local Sample Correction

On 2026-08-09, after the completed reconstruction, the user explicitly
authorized one additional data-only correction for the single live Urban
Basilica sample. Its Scene numbers predated the new generated-number display
model, so this one local instance was converted from `1..9` to `01..09`; `10`
remained unchanged. This is not a product migration, runtime normalization
rule, FDX behavior, validator, or conversion for any other Project. Supplied
and stored Scene numbers remain opaque in Studio product code.

The correction renamed the four populated Scene-number directories, updated 46
registered Asset File paths and their `s01`/`s02` filename portions, and left
all file contents unchanged. All 86 registered files passed existence, size,
and hash verification afterward. Database generation remained 61,
`quick_check` returned `ok`, foreign-key checking returned no rows, and the
Project, Screenplay, and renamed media opened through Core, CLI, and Studio.
The original source archive was not modified.

- safety backup: `/Users/keremk/renku-movies-scene-number-padding-backup-20260809T084701Z.sqlite`;
- internal audit manifest: `/Users/keremk/renku-movies/urban-basilica/.renku/scene-number-padding-manifest.json`; and
- external audit manifest: `/Users/keremk/renku-movies-scene-number-padding-manifest-20260809T084701Z.json`.

## Post-Completion Product Amendments

On 2026-08-09, the user explicitly approved two focused corrections that
supersede contrary FDX and Scene-path statements in the original completed plan:

- A Screenplay with the existing singleton FDX import row is read-only to Renku
  Screenplay authoring. Core gates create/apply/revision restore with one
  structured error. Reads and downstream production workflows remain available;
  there is no source mode, setting, override, or broader permission system.
- Imported and already-stored Scene numbers remain exact and opaque in domain
  data. When a Scene number is used in a folder or filename, Core derives a
  separate bounded safe path label and falls back to the Scene id when needed.
  It does not rewrite the stored number.

The user also approved reusing the existing narrow Scene Beats check for
obvious absolute filesystem paths in reference-id arrays added through focused
insert/update operations. This adds no reference existence validation or
creative-content inspection.

## Review Attention — Read Before Accepting

This is the short review surface for Plan 0174. The implementation must not add
a consequential product behavior, public surface, database effect, or
filesystem effect that is absent from this section without returning it to the
user for explicit review.

| Attention item | What Plan 0174 does | Why it is here |
| --- | --- | --- |
| Requested numbering scope | Reuse one production-number grammar, display formatter, and ordered allocator for numbers Renku generates for Scenes, Shots, and Beats. Supplied or existing Scene numbers are opaque and never validated, normalized, or deduplicated. Shot Plans use a simpler Scene-local monotonic number because their number names the human-readable Plan folder rather than authored insertion order. | Direct shared-numbering and folder-naming request plus explicit correction on 2026-08-09 |
| Exact insertion behavior | New ordered items use stable suffixes such as `1A`; moves do not renumber; deleted numbers are not reused; generated suffixes continue through `Z`, `AA`, and onward. | Concrete behavior needed to make the shared counter stable and reusable |
| Scene Beats rename | Finish the direct Beat Sheet → Scene Beats rename, retain immutable revision history/active selection, and rename only the existing Project Setting key `generateSceneBeatSheets` → `generateSceneBeats`. No compatibility alias or new Studio reset/restore control is added. | Explicitly accepted naming correction; the setting-key effect is easy to miss |
| Scene Beats document simplification | Remove the aggregate-level `SceneBeats.title`, `summary`, `narrativeProgression`, `lookbookInfluence`, and `openQuestions` fields. Keep every individual Beat's `title` and other Beat creative fields, as well as the existing revision lifecycle and metadata. | Explicit user acceptance on 2026-08-08; this is a separate product-model decision, not an implied consequence of renaming or numbering |
| FDX behavior | Preserve the importer and exact opaque Scene numbers, while making an FDX-backed Screenplay read-only to Renku authoring through one Core gate. Add no source mode, setting, flag, override, or fallback workflow. | Explicit user correction on 2026-08-09 |
| Human-readable files | Replace durable technical roots with the shallow Scene/Plan/Beat-number and owner-handle tree shown below. Generated files use a short `gxxx` collision token; external files keep a safe source basename and use `-2`, `-3`, and so on only on collision. | Direct Plan 0172 folder/filename requirement; exact naming policy needs visible review |
| Supporting path work | Add the focused destination/naming changes needed to place current Lookbook, Cast, Location, Prop, Dialogue, Storyboard, Shot, and Shot Plan media in that tree. Shot Plan media must resolve the exact Plan from stored provenance rather than whichever Plan is currently selected. This includes one focused custom Shot Plan reference attachment purpose; it does not create a general dependency-copy system. | Necessary to make the requested paths deterministic without using filenames as identity |
| Migration 0076 | Remove and regenerate the uncommitted 370-line migration from the accepted 0075 baseline. The replacement owns only schema changes and necessary row-preserving transforms for numbering and Scene Beats. It contains no FDX policy and no Urban Basilica-specific row counts or cleanup. | Direct correction requested after the oversized migration |
| Database source | Build the reconstructed Project from the exact populated generation-60 backup. Never initialize a fresh database and never use the already-migrated generation-61 database as the source. | Explicit user correction |
| Filesystem move | Before the live rebuild, move the complete `/Users/keremk/renku-movies` root to a new timestamped sibling archive, leave it unchanged, and create a fresh `renku-movies/urban-basilica` folder. A second explicit user confirmation is required immediately before this live move. | Explicit Plan 0172 requirement and destructive-operation safety boundary |
| Cleanup in the copied Project | The reconstructed copy keeps the four active Scene Beats baselines, 86 active Assets, 86 primary Asset Files, all 37 current Storyboard Assets, and all six iteration folders. It omits eight inactive Beat revisions, eight stale directional Location files, discarded/Trash data, unattached generation history, old backups, temporary debris, and unregistered loose media. Everything remains recoverable in the untouched archive. | Existing clean-folder requirement; these removals are consequential and must not be hidden in migration prose |
| Relevant edge cases and safety | Keep owning-layer coverage for number collisions, suffix rollover, concurrent file allocation, invalid placement, missing files, hash mismatch, path collision, database integrity, migration failure, and recovery. These are safety and correctness cases for the requested work, not new product workflows. | Required engineering completeness |
| No compatibility/fleet system | Update current callers directly, create no old-path/old-name readers, and build no customer-fleet migration or recovery framework. There is one populated local Project database. | Current pre-customer architecture and explicit local-only scope |

The only approval decisions in this plan are acceptance of the complete Plan
0174 contract and the separate final confirmation before the live filesystem
archive/reconstruction. There is no hidden FDX decision. If implementation
discovers another product choice, it must stop and surface that choice rather
than treating plan acceptance as blanket authorization.

This plan supersedes the implementation direction in
[Plan 0172](0172-human-readable-project-asset-organization.md) and
[Plan 0173](0173-stable-scene-shot-and-beat-numbering.md). Those plans remain
useful design evidence, but they must not be implemented or completed
independently after this plan is accepted.

Plan 0173's current `complete` marker records an implementation attempt, not an
accepted final result. The existing worktree is a partial implementation to
audit and repair. It is not work to discard wholesale, and it is not the
baseline from which the database should be rebuilt.

## Summary

Renku needs one coherent cutover that connects two product requirements which
were incorrectly split across Plans 0172 and 0173:

1. Scenes, Shot Plans, Shots, and Beats need stable, short, human-facing
   numbers which survive insertion, movement, deletion, and revision changes.
2. Durable project media needs to use those numbers in a shallow,
   human-readable folder and filename layout.

The previous split allowed Plan 0173 to grow into an independent screenplay
source-policy and database-conversion project. Its implementation added useful
numbering and Scene Beats work, but invented an FDX policy subsystem: public
source classification, runtime mutation gates, a Project Setting, and a CLI
flag for a missing-number scenario that was not part of the request. It also
produced a 370-line migration that permanently encoded exact Urban Basilica
row counts and cleanup decisions.

This plan keeps the useful implementation and corrects the boundary:

- Core owns one reusable production-number grammar, formatter, and ordered
  allocator for numbers Core generates. Existing Scene numbers are opaque
  occupied labels, not inputs to that grammar.
- Scenes, Shots, and Beats adapt that shared allocator inside their existing
  domain transactions.
- Shot Plans use a focused Scene-local monotonic integer counter because they
  have creation sequence but no authored insertion order.
- `SceneBeats` directly replaces the Beat Sheet product name and document
  shape while preserving immutable revision history and active-revision
  selection.
- All broad FDX policy changes from the rejected attempt are removed. The
  importer mapping, warnings/errors, Agent AI remediation, and Settings remain;
  the later-approved focused Core gate makes an FDX-backed Screenplay read-only
  to Renku authoring.
- Renku-authored Scene creation and insertion receive Core-owned stable numbers
  through the common numbering mechanism.
- Durable Asset Files move to the accepted shallow human-readable tree and use
  short collision-safe filenames without new lineage or version state.
- The current `0076` migration is replaced before commit. The corrected
  Drizzle migration owns only the schema transition and generic preservation of
  populated rows. It does not recognize Urban Basilica by row count and does
  not perform project-specific cleanup.
- Urban Basilica-specific cleanup and file selection belong to one explicit,
  one-time rebuild tool with a complete manifest.
- The complete current `/Users/keremk/renku-movies` directory is archived
  unchanged. A new `renku-movies/urban-basilica` **folder** is created, but its
  database is not new: the exact generation-60 pre-migration database backup is
  copied into the new folder and migrated there. Only retained registered
  files and accepted user-owned folders are copied from the archive.

The archive remains untouched and recoverable. There is one populated local
project database, no external users, and no database fleet to support.

## Requirement Ledger

Every mechanism in this plan traces to one accepted requirement or hard
boundary. Adjacent policies are excluded unless listed here.

| Requirement | Accepted outcome | Source | Owner |
| --- | --- | --- | --- |
| Reusable numbering | One grammar, display formatter, case-folding rule, suffix sequence, and ordered allocation algorithm for Core-generated values only | Explicit user request | Core production-number module |
| Stable Scene numbers | Renku-authored Scene create/insert allocates; update/move preserves; delete does not recycle; restore reuses the Scene id's reservation | Explicit user request | Core Screenplay commands |
| Supplied Scene numbers | Preserve every supplied or existing value byte-for-byte; do not validate grammar, trim, case-fold, require non-empty, or require uniqueness | Explicit user correction on 2026-08-09 | Core Screenplay contract, persistence, migration, and importer |
| Existing Screenplay/FDX behavior | Preserve importer mapping, warnings, Agent AI remediation, and Settings; preserve exact Scene numbers; gate Screenplay authoring when the singleton FDX import row exists | Explicit user correction on 2026-08-09 | Core Screenplay command boundary |
| Stable Shot numbers | Shots retain their number through moves and use suffixes for non-end insertion | Explicit user request | Core Shot authoring |
| Stable Beat numbers | Beats receive Core-owned numbers; focused revisions preserve surviving numbers and reserve deleted numbers | Explicit user request | Core Scene Beats revisions |
| Stable Shot Plan folders | Each Scene's Shot Plans receive monotonically increasing integers which are not recycled | Human-readable layout requirement | Core Shot Plan authoring |
| Scene Beats naming | Replace Beat Sheet product/code/CLI/skill terminology with `SceneBeats`; keep `Sheet` for visual artifacts | Explicit user acceptance | Core contracts plus direct caller rename |
| Scene Beats document simplification | Remove aggregate-level `title`, `summary`, `narrativeProgression`, `lookbookInfluence`, and `openQuestions`; retain every Beat's own `title` and other creative fields | Explicit user acceptance on 2026-08-08 | Core Scene Beats contracts and migration |
| Scene Beats history | Preserve immutable runtime revisions, exact revision ids, base links, history listing, and active selection | Decisions 0052 and 0073 | Core Scene Beats owner |
| Reset and restore | Reset creates a new revision; restore changes the active revision without deleting either revision | Existing accepted lifecycle | Core Scene Beats owner |
| Human-readable tree | Use production numbers and owner handles in shallow folders | Explicit Plan 0172 outcome | Core project-asset-files destinations |
| Short generated names | Generated durable media receives one `gxxx` collision token, not generation/version folders or counters | Accepted Plan 0172 outcome | Core path allocator |
| External file names | External/imported files keep safe source basenames and use plain numeric collision suffixes | Accepted Plan 0172 outcome | Core path allocator |
| Existing Asset model | Preserve Asset, Asset File, ownership, selection, provenance, and current one-file writers | Current architecture | Existing Core Asset services |
| Storyboard iteration folders | Keep every retained Scene Storyboard `NN-iteration/` batch folder under the production-number Scene folder | Explicit Plan 0172/0173 outcome | Existing Storyboard destination |
| Preserve database lineage | Start the reconstructed folder from the exact generation-60 populated backup, not a newly initialized database | Explicit user correction | One-time rebuild workflow |
| Clean filesystem reconstruction | Archive the complete root and copy only retained registered files plus accepted user-owned folders | Explicit user correction and Plan 0172 | One-time rebuild workflow |
| Sane migration | Permanent SQL owns schema transition and generic row preservation; project-specific cleanup does not live in migration SQL | Explicit user correction | Drizzle schema and migration |
| Reuse current work | Keep and repair valuable implementation rather than reverting to the old codebase | Explicit user correction | All implementation slices |
| Local-only scope | There is one populated local Project database and no user/database fleet | Explicit user statement | Planning and migration boundary |
| Durable lesson | Record the local-only scope and fresh-folder/database distinction in `AGENTS.md` and plan-review memory | Explicit user request | Repository agent guidance |

## Accepted Product Behavior

### One coordinated cutover

The numbering, Scene Beats rename, durable destination rewrite, and Urban
Basilica reconstruction are one accepted cutover. They may be implemented in
reviewable slices, but the live project is not moved until every production
contract and the disposable rebuild pass together.

There is no temporary runtime in which:

- new code reads old Asset paths through a compatibility resolver;
- the new folder tree is written before its required Scene/Plan/Shot/Beat labels
  are available from current domain data;
- old Beat Sheet and new Scene Beats commands coexist;
- the current oversized migration remains in the Drizzle journal; or
- the fresh Urban Basilica folder contains a newly initialized database.

### Generated production-number contract

Core generates a positive integer followed by optional ASCII letters:

```text
[1-9][0-9]*[A-Za-z]*
```

Generated values preserve their letter case. Generated reservations are ASCII
case-insensitive, and Renku-generated suffixes are uppercase. These rules do
not validate, normalize, or deduplicate supplied Scene numbers.

The shared display formatter for Core-generated Beat and Shot labels pads only
a one-digit leading integer:

| Stored | Display/path |
| --- | --- |
| `1` | `01` |
| `1A` | `01A` |
| `4aA` | `04aA` |
| `28A` | `28A` |
| `100` | `100` |

Numbers are labels, not ids or sort keys. Durable ids own identity. Position or
array order owns current authored order.

The ordered allocator follows these rules:

1. A fresh collection receives `1..N`.
2. Appending receives the next whole number above the scope's reserved
   whole-number high-water mark.
3. Inserting before the end uses the nearest preceding leading-integer family,
   or the following family when inserting first.
4. The shortest unused bijective-base-26 suffix is selected: `A..Z`, `AA..`.
5. Move never changes a number.
6. Delete never releases a number within that durable scope.
7. Allocation and persistence commit in the owning domain transaction.

Example:

```text
fresh:                         1, 2, 3
insert between 1 and 2:       1, 1A, 2, 3
insert again in the family:   1, 1B, 1A, 2, 3
append:                        1, 1B, 1A, 2, 3, 4
delete 1A, then insert:       1, 1C, 1B, 2, 3, 4
```

Stable labels intentionally do not attempt to remain lexically sorted after
later insertions or moves.

### Domain-specific persistence

The algorithm is shared; lifecycle persistence is not forced into a universal
registry.

| Domain | Scope and persistence |
| --- | --- |
| Renku-authored Scene | Project Screenplay scope; direct `Scene.productionNumber` plus retained Scene-number reservations for deleted/restored Scene ids |
| Shot Plan | Scene-local monotonic integer counter plus `ShotPlan.number` |
| Shot | Shot Plan scope; direct `Shot.number` plus retained Shot-number reservations |
| Beat | One Scene Beats revision lineage; the immutable revision envelope carries the complete reserved-number set |

The Scene allocator is used by the existing Renku-authored Screenplay commands.
This plan does not add a source-kind branch to it. It considers only its own
reservations when deriving numeric families. Existing Scene values are compared
only by exact string equality to avoid selecting an identical new label; they
are never parsed, normalized, or rejected.

### Screenplay and FDX boundary

The corrected contract is:

- keep the existing FDX importer, warnings, errors, and Settings unchanged
  except for removing Scene-number validation and its duplicate diagnostic;
- keep the existing Agent AI skill warning/remediation workflow unchanged;
- if an FDX has no Scene numbers, the user remains responsible for generating
  them through that existing workflow;
- keep every FDX Scene number exactly as authored, including whitespace, empty
  strings, non-generated forms, and duplicates;
- keep agent-authored Screenplay create/apply/restore behavior for Screenplays
  without an FDX import; and
- reject those authoring mutations with `SCREENPLAY_FDX_BACKED_READ_ONLY` when
  the existing singleton FDX import row is present.

The original FDX-related implementation work in 0174 was targeted removal of
the uncommitted additions made by the rejected Plan 0173 attempt:

- `ScreenplaySourceStatus` and generalized source classification;
- `source-authority.ts` and its broad runtime mutation/restore policy;
- automatic missing-number allocation;
- the new Project Setting, CLI flag, Settings UI, and related diagnostics;
- `sceneNumberSource` schema/contracts; and
- new tests, docs, and skill guidance describing those additions.

After that targeted cleanup, the retained FDX changes are removal of
Scene-number validation that contradicts the opaque-value rule and the simple
Core read-only gate. The common numbering and Asset-path work consumes existing
canonical Scene numbers without rewriting them.

### Scene mutation behavior

- `screenplay create` assigns `1..N`; caller-authored Scene numbers are not
  accepted on agent input.
- `scene.add` appends a whole number or uses a suffix at an explicit insertion
  point.
- `scene.update` and `scene.move` preserve the number.
- `scene.delete` preserves the reservation.
- revision restore reuses reservations by durable Scene id.

### Shot Plan and Shot behavior

Shot Plans have creation sequence, not authored insertion order:

- the first Plan for a Scene is `1`;
- create and copy increment the Scene-local high-water;
- delete, Trash collection, and restore do not reduce or recycle it; and
- Plan numbers never change.

Shots use the shared ordered allocator:

- new and copied Plans number their own Shots `1..N`;
- append uses the next whole number;
- start/before/after insertion uses the next suffix in the relevant family;
- move changes position only;
- delete and collection retain reservations; and
- UI, CLI, and skills display `shot.number`, never `position + 1`.

### Scene Beats

`SceneBeats` is the ordered Scene-owned narrative aggregate. `BeatInput`
contains creative fields only; Core creates Beat ids and numbers.

The accepted public shape remains the useful part of the current
implementation:

```ts
interface Beat extends BeatInput {
  id: string;
  number: string;
}

interface SceneBeats {
  sceneId: string;
  beats: Beat[];
}
```

Runtime behavior:

- initial create assigns `1..N`;
- focused insert/update/delete creates an immutable revision from an explicit
  base revision;
- updates preserve id and number;
- inserts receive Core-owned ids and numbers;
- deletes retain number reservations in the derived revision envelope;
- reset creates and activates a new revision with fresh `1..N` numbering;
- set-active changes only the active revision pointer;
- neither reset nor set-active deletes history; and
- Storyboard status, import, Shot Plan coverage, resource keys, and skills use
  the exact Scene Beats revision id.

The Scene Beats aggregate no longer carries its own `title`, `summary`,
`narrativeProgression`, `lookbookInfluence`, or `openQuestions`. This removal
does not apply to the `title` of an individual Beat: every Beat retains its own
`title` and other creative fields. Revision metadata remains outside creative
Scene Beats content.

### Canonical project tree

Only folders with content are created:

```text
urban-basilica/
  .renku/
    project.sqlite

  screenplay/
    urban-basilica.fdx

  visual-language/
    inspiration/
      <user-owned inspiration folders and files>
    lookbooks/
      production/
        warm-stone-at-dawn-g7k3.png
      storyboard/
        charcoal-pressure-g2n6.png

  cast/
    saruca/
      profile-g3m7.png
      palace-robe-sheet-g7k3.png
      whispering-g2n6.mp3

  locations/
    harbor-quarter/
      hero-g3m7.png
      burned-down-sheet-g4p8.png

  props/
    urbans-great-bombard/
      hero-g3m7.png
      firing-detail-sheet-g7k3.png

  storyboards/
    1/
      00-iteration/
        s1-b01-image-g7k3.png
      01-iteration/
        s1-b01-image-g2n6.png
      tmp/
        bombardment-storyboard-sheet.png

  scenes/
    1/
      dialogues/
        s1-mara-d01-g7k3.mp3
      01-shot-plan/
        shot-images/
          shot01-g7k3.png
          shot01A-g4p8.png
        first-frame-g3m7.png
        last-frame-g2n6.png
        storyboard-g9v5.png
        reference-g6r2.png
        s1-p01-video-g8c4.mp4

  research/
    <user-owned scratch files>

  tmp/
    <temporary specs, receipts, operations, QA, and scratch media>
```

There is no durable top-level `generated/`, `videos/`, `audio/`,
`scene-dialogue-audio/`, `shot-plans/`, `shots/`, or `shotlist/` root in the
new tree.

### Filename and destination matrix

Ordinary semantic path segments are lowercase safe-kebab-case. Scene folders and
Scene filename portions use a separate safe path label derived from the exact
stored Scene number; the stored value itself remains unchanged. Core-generated
Beat and Shot filename portions may use the shared display formatter.

Generated durable files end in `-gxxx`, using exactly three lowercase
Crockford-base32 characters from:

```text
0123456789abcdefghjkmnpqrstvwxyz
```

The token is a collision discriminator only. It is not stored separately and
does not encode order, generation count, version, lineage, Asset id, or
provider information. Core checks the complete destination path and retries an
exclusive write up to 16 times.

External/imported files receive no `gxxx`. Core normalizes the source basename
and uses `-2`, `-3`, and so on only for real collisions.

| Asset family | Destination | Filename |
| --- | --- | --- |
| Screenplay source | `screenplay/` | safe external source basename |
| Production Lookbook media | `visual-language/lookbooks/production/` | `<semantic>[-sheet]-gxxx.<ext>` |
| Storyboard Lookbook media | `visual-language/lookbooks/storyboard/` | `<semantic>[-sheet]-gxxx.<ext>` |
| Cast Profile | `cast/<handle>/` | `profile-gxxx.<ext>` |
| Character Sheet | `cast/<handle>/` | `<variation>-sheet-gxxx.<ext>` |
| Cast voice sample | `cast/<handle>/` | `<descriptor>-gxxx.<ext>` |
| Location Hero/Sheet | `locations/<handle>/` | `hero-gxxx` or `<variation>-sheet-gxxx` |
| Prop Hero/Sheet | `props/<handle>/` | `hero-gxxx` or `<variation>-sheet-gxxx` |
| Dialogue Audio | `scenes/<scene>/dialogues/` | `s<scene>-<speaker>-d<turn>-gxxx.<ext>` |
| Beat Storyboard | `storyboards/<scene>/<NN>-iteration/` | `s<scene>-b<beat>-image-gxxx.<ext>` |
| Shot image | `scenes/<scene>/<plan>-shot-plan/shot-images/` | `shot<shot>-gxxx.<ext>` |
| Plan first/last frame | Shot Plan folder | `first-frame-gxxx` / `last-frame-gxxx` |
| Plan Storyboard/reference | Shot Plan folder | `storyboard-gxxx` / `reference-gxxx` |
| Plan video | Shot Plan folder | `s<scene>-p<plan>-video-gxxx.<ext>` |

Core owns fixed role words such as `profile`, `hero`, `sheet`, `image`, and
`video`. The agent supplies only meaningful semantic variation text. Runtime
code validates its presence and safe envelope, not its creative meaning.

### Existing Asset behavior remains

This plan does not replace Asset identity, Asset Files, exclusive ownership,
canonical selection, generation-reference selection, provenance, or Trash.

Current writers produce one Asset with one primary file. The generic
`Asset.files[]` contract remains because making the entire product singular-file
has no user-visible value in this cutover. The two Urban Basilica Location
Sheet Assets with stale directional files keep their primary files; the eight
directional development leftovers are omitted from the reconstructed project.

Paths remain labels. No runtime code parses a number, handle, filename,
generation token, or folder to recover durable identity or relationships.

## Explicit Non-Goals

- No wholesale revert of the current implementation.
- No newly initialized or empty Urban Basilica database.
- No copying the current generation-61 database as the migration source.
- No mutation of the archived source database.
- No change to FDX mapping, warning behavior, Agent AI remediation, or Settings
  beyond the explicitly approved read-only authoring gate.
- No FDX-versus-agent source modes, fallback allocator, new settings/flags,
  provenance, override, or generalized permission system.
- No user-editable production numbers.
- No universal numbering table or domain-kind allocator switch.
- No compatibility readers for Beat Sheet names, old Project Settings, old
  database tables, or old Asset roots.
- No generalized customer/fleet migration or upgrade workflow.
- No new Asset-series, media bundle, generation-lineage, or version model.
- No generated-media content inspection or creative semantic validation.
- No Scene Beats reset/restore button in Studio.
- No flattening or deletion of retained Storyboard iteration folders.
- No deletion of the timestamped `renku-movies` archive.
- No mobile verification.

## Context And Evidence

### Current implementation footprint

The Plan 0173 attempt currently changes 145 tracked Studio-repository files
with approximately 1,595 insertions and 3,110 deletions, plus new untracked
source, migration, ADR, and plan files. The sister `studio-skills` repository
changes 34 tracked files with approximately 215 insertions and 384 deletions,
plus five renamed Scene Beats files.

The large negative line count is partly legitimate: direct Beat Sheet to Scene
Beats replacement deletes old modules and moves callers to the new name. The
file count is not legitimate evidence that every change belongs to numbering.
The current diff mixes these categories:

| Category | Disposition in Plan 0174 |
| --- | --- |
| Shared production-number grammar, formatter, suffix allocation, and tests | Keep, review, and simplify error ownership |
| Shot Plan counter and Shot reservations/placement | Keep and verify |
| Scene Beats model, revision owner, CLI rename, revision-context rename, and labels | Keep and verify behavior parity |
| Stable number labels in Studio | Keep |
| Scene reservation lifecycle | Keep for Renku-authored Screenplay commands and gate those commands when the singleton FDX import row exists |
| Existing FDX import behavior | Preserve mapping and warnings while removing Scene-number validation; preserve authored numbers unchanged and make the imported Screenplay read-only to Renku authoring |
| Missing-number Project Setting, CLI flag, provenance field, warning policy, and settings UI | Remove |
| `ScreenplaySourceStatus`, generalized source classification, and configurable content/restore policy | Remove; replace only with the focused singleton-import-row authoring gate approved after completion |
| Project Settings version 2 | Keep only for the direct `generateSceneBeatSheets` to `generateSceneBeats` rename |
| 370-line `0076` migration | Replace before commit |
| Plan 0172 durable path implementation | Not yet implemented; complete under this plan |
| Beat/Shot/Scene updates in skills | Keep after restoring prior FDX guidance and aligning new paths |
| Broad docs and ADR edits | Reconcile to this plan; remove rejected policy claims |

Implementation starts from that classification. It must not use a broad Git
restore and then re-create the useful work.

### Exact current FDX implementation to remove

The following is already present in the uncommitted working set and must be
removed as part of 0174. This is targeted hunk/file cleanup, not a reset of the
useful Scene/Shot/Beat numbering or Scene Beats rename.

| Current addition | Required disposition |
| --- | --- |
| `packages/core/src/server/screenplay/source-authority.ts` | Delete the entire new file |
| `packages/core/src/server/screenplay/fdx/numbering.ts` | Delete the entire new file |
| `ScreenplaySourceStatus` and `status.source` additions in Core client/status projections and Studio/CLI response contracts | Remove; restore the previous status response shape |
| `assertScreenplayOperationsAllowed` and `assertScreenplayRevisionRestoreAllowed` calls in Screenplay operation/restore commands | Remove completely, including `SCREENPLAY_FDX_CONTENT_MUTATION_UNSUPPORTED` behavior |
| `allowRenkuSceneNumberGeneration` in Core Project Settings, Settings schemas/defaults/tests, Studio Settings UI/tests, and service fixtures | Remove only this attempted field; preserve the pre-existing Settings contract and the separately accepted Scene Beats key rename |
| `--generate-missing-scene-numbers` in CLI parsing, FDX command input, reports, help, docs, and tests | Remove completely |
| `sceneNumberSource` in `screenplay_import` schema, Core FDX contracts/schemas/persistence, reports, migration SQL/snapshot, and tests | Remove completely |
| `numberFdxScenes(...)`, generated-number warnings/errors, source-policy changes, and the modified representative FDX fixture | Remove the rejected additions; keep only the focused mapper/parser/schema changes required to make supplied Scene numbers opaque |
| FDX source-policy and double-gate text in `docs/architecture/screenplay-fdx-import.md`, `docs/cli/commands.md`, workflow/UI docs, ADR edits, and proposed ADR 0075 | Remove; documentation must describe only the previously accepted behavior |
| FDX source modes, reference-only runtime claims, and double-gate instructions added to `studio-skills` screenplay-drafter/movie-director files and evals | Restore the last accepted warning/remediation guidance while preserving unrelated Scene Beats and stable-number updates |

Use a final production-code/current-documentation/sister-skill search for these
rejected names and behaviors. Apart from Plan 0174's removal checklist, a
zero-result search is required for new implementation identifiers such as
`ScreenplaySourceStatus`, `source-authority`,
`allowRenkuSceneNumberGeneration`, `generate-missing-scene-numbers`,
`sceneNumberSource`, and `SCREENPLAY_FDX_CONTENT_MUTATION_UNSUPPORTED`.

### Why the current migration became pathological

`packages/core/drizzle/0076_stable_production_numbers_and_scene_beats.sql` is
370 lines because it combines four different responsibilities:

1. Lines 9-152 build a temporary guard system which deeply validates Scene
   grammar, Shot ownership, exact `12`/`4` Beat-history counts, Beat JSON field
   types, and the exact Project Settings v1 shape.
2. Lines 154-231 add the unrelated Project Setting, public source-mode
   machinery, FDX Scene-number provenance, and runtime mutation policy.
3. Lines 233-292 perform the Urban Basilica-specific four-revision cleanup and
   coverage rename inside permanent migration history.
4. Lines 293-366 rebuild and backfill Shot Plans, Shots, counters, and
   reservations.

This happened because Plan 0173 treated “one checked-in Drizzle migration” as
the owner of both product schema evolution and the complete one-project cleanup.
It also treated the clean-baseline request as a reason to make permanent SQL
recognize one exact database. The automatic backup and the full-folder archive
already provide recovery; the one-time rebuild tool is the correct owner of
project-specific selection and cleanup.

SQLite may still require generated table-rebuild SQL for required columns and
renamed tables. Length caused by real generated DDL is not itself a defect.
The defect is permanent SQL containing project-specific row-count gates,
creative-document validation, unrelated policy, and local cleanup logic.

### Current Urban Basilica database state

The live database is currently generation 61 because the rejected migration
was applied. It contains:

- 10 Scenes;
- 4 `scene_beats_revision` rows and 4 active pointers;
- 1 Shot Plan and 1 Shot;
- 86 active Assets and 94 active Asset Files.

It is not the source for the new folder.

The authoritative pre-attempt source is the automatic generation-60 backup:

```text
/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/
project-before-migration-from-generation-60-to-61-20260808T182017850Z-47c36f.sqlite
```

That populated database contains:

- 10 Scenes with existing production numbers;
- 12 Beat Sheet revisions and 4 active pointers;
- 1 Shot Plan and 1 Shot;
- 86 active Assets and 94 active Asset Files.

The reconstructed database begins as an exact byte copy of that backup. It is
then migrated and cleaned. It is never replaced by a database created from an
empty schema.

### Current filesystem state

`/Users/keremk/renku-movies` is approximately 738 MB and Urban Basilica is
approximately 727 MB. The root contains the Project, `.DS_Store`, and one loose
MP4. The Project contains retired or duplicated roots including `generated/`,
`audio/`, `scene-dialogue-audio/`, `shot-plans/`, `shots/`, `videos/`, old
Storyboard Scene folders, accumulated `tmp/`, and historical database backups.

The populated database audit records:

- 86 active Assets and 94 active Asset Files;
- 8 stale directional files attached to two otherwise-current Location Sheets;
- 37 current Scene Storyboard files in 6 existing iteration folders;
- 4 discarded Assets and 4 discarded Asset Files;
- 11 Trash history rows;
- generation records both with and without retained Asset File provenance.

The complete root is therefore the recovery boundary. Selectively deleting
stale paths in place is not accepted.

### Existing owners to reuse

- `packages/core/src/client/production-numbers.ts` already contains the useful
  browser-safe grammar, formatter, initial allocation, and ordered allocation.
- `packages/core/src/server/shot-plans/plan-numbering.ts` and
  `shot-numbering.ts` already integrate focused persistence.
- `packages/core/src/server/scene-beats/` already contains the renamed history,
  operations, validation, numbering, and Storyboard status owners.
- `packages/core/src/server/project-asset-files/` already owns focused
  destination modules, collision-aware allocation, copying, hashing,
  persistence, and rollback. Plan 0174 extends this structure; it does not
  recreate the module tree proposed by Plan 0172.
- `packages/core/src/server/generation/attachment-destinations.ts` remains a
  broad current attachment mapper. It should be split only along the existing
  purpose groups needed for exact Shot Plan provenance and the new destination
  contract.

### Drizzle workflow

The Drizzle TypeScript schema remains the source of truth. Drizzle Kit compares
the current schema snapshot with the previous migration snapshot and generates
the SQL and new snapshot. Custom SQL is appropriate only for DDL Drizzle cannot
express or required data transformation. The official current references are:

- <https://orm.drizzle.team/docs/drizzle-kit-generate>
- <https://orm.drizzle.team/docs/drizzle-kit-migrate>
- <https://orm.drizzle.team/docs/kit-custom-migrations>

The repository-specific accepted workflow remains
`docs/architecture/reference/drizzle-migrations.md` and Decision 0011.

## Architecture Shape Gate

### Owning boundaries

`packages/core` owns stable numbering, database persistence, durable paths,
filename allocation, and Asset File writes.

- CLI parses flags/documents, calls Core, and formats reports.
- Studio server handlers translate HTTP to Core and serialize results.
- React displays Core projections and sends intent; it calculates no numbers or
  paths.
- Skills author creative fields and semantic variation names; they calculate
  no numbers, tokens, or paths.
- The one-time rebuild tool coordinates an archived source, a copied database,
  the existing Drizzle migration command, exact file copying, and a manifest.
  It is not imported by runtime packages and exposes no product command.

### Intended module layout

Use the existing focused modules as the starting point:

```text
packages/core/src/client/
  production-numbers.ts             # shared pure grammar/display/allocation
  scene-beats/                       # current Scene Beats public contracts
  screenplay/                        # numbered canonical Scene contracts
  shot-plans.ts                      # Plan/Shot numbers and placement

packages/core/src/server/
  production-number-allocation.ts   # structured server-boundary translation only
  screenplay/
    scene-numbering.ts               # Renku-authored Scene reservations/allocation
    commands/                        # existing create/apply/restore with stable Scene allocation
  shot-plans/
    plan-numbering.ts
    shot-numbering.ts
    plan-authoring.ts
    shot-authoring.ts
  scene-beats/
    history.ts
    numbering.ts
    operations.ts
    storyboard-status.ts
    validator.ts
  schema/
    scene-beats.ts
    screenplay/agent-scene-numbers.ts
    shot-plans.ts
  project-asset-files/
    index.ts                         # thin existing entrypoint
    types.ts
    persistence.ts
    path-allocation.ts
    naming/
      safe-segments.ts
      generation-tokens.ts
      source-file-names.ts
    destinations/                   # extend existing focused files and registry
  generation/attachment-destinations/
    index.ts                         # thin entrypoint
    registry.ts                      # bounded purpose dispatch
    continuity.ts
    lookbooks.ts
    shots.ts
    shot-plan.ts

packages/core/drizzle/
  0076_stable_production_numbers_and_scene_beats.sql
  meta/0076_snapshot.json
  meta/_journal.json

scripts/maintenance/
  rebuild-urban-basilica-project.mjs
```

The final exact file count may be smaller when an existing file remains
focused. Do not add pass-through wrappers merely to match the drawing.

The one-time rebuild script is deliberately outside `packages/core/src`. It
may call existing Core/CLI boundaries and contain project-specific selection
rules, but it must not become a runtime export, package script offered as a
normal product command, or generalized migration framework.

### Existing files expected to disappear or shrink

- Delete the public `ScreenplaySourceStatus` contract, generalized
  `source-authority.ts` classification, and every new retained-import
  content-operation or revision-restore gate.
- Keep the Scene numbering owner focused on Renku-authored Screenplay commands.
- Remove the new `screenplay/fdx/numbering.ts` fallback allocator and restore
  every FDX file changed by the attempt to its focused importer behavior, with
  the explicit opaque Scene-number correction.
- Remove the new FDX Project Setting UI row and CLI flag while leaving all
  previously accepted Settings untouched.
- Remove `scene_number_source` from the proposed schema before regenerating
  migration 0076.
- Replace the current 0076 SQL, snapshot, and journal entry from the accepted
  0075 migration baseline.
- Keep Scene Beats direct-renaming deletions; do not restore old Beat Sheet
  modules or add re-export aliases.
- Split the broad attachment destination mapper only where needed to keep exact
  provenance and destination branches reviewable.
- Remove duplicate durable path allocation from
  `packages/core/src/server/files/asset-paths.ts` after callers use
  project-asset-files.

### Public entrypoints

Browser-safe callers use the shared production-number functions and canonical
numbered projections. No public reserve/set-number API is added.

The existing Project Data Service continues to own Screenplay, Shot Plan, Shot,
and Scene Beats mutations. Their existing domain commands acquire numbers as a
side effect inside the same transaction.

The Scene Beats CLI remains under:

```text
renku screenplay beats context
renku screenplay beats list
renku screenplay beats show
renku screenplay beats validate
renku screenplay beats create
renku screenplay beats reset
renku screenplay beats set-active
renku screenplay beats validate-operations
renku screenplay beats apply
renku screenplay beats storyboard status
```

No old `beat-sheets` command remains.

### Database shape

The final TypeScript schema additions/renames contain:

```text
agent_scene_number_reservation       retained Renku-authored Scene reservation

shot_plan.number                     Scene-local positive integer
scene_shot_plan_number               Scene-local high-water

shot.number                          stable production number
shot_number_reservation              per-Plan retained reservation

scene_beats_revision                 renamed immutable revision rows
scene_beats_state                    active revision per Scene
```

It does not change the existing FDX/import schema or add
`screenplay_import.scene_number_source`.

Project Settings version 2 changes only the accepted Beat terminology:
`generateSceneBeatSheets` becomes `generateSceneBeats`. No Scene-number
generation preference is added.

### Domain branching

- The shared allocator knows only ordered values, reserved values, and
  initial/append/insert placement.
- Renku-authored Scene, Shot, and Beat adapters translate their domain state to
  that pure input. Existing import behavior is untouched.
- Shot Plan numbering remains a separate monotonic counter.
- The Asset destination registry dispatches only to focused destination
  modules. Naming and persistence stay separate.
- The rebuild script may branch by existing Asset type because it is an
  explicit one-time inventory mapper; runtime destination branching remains in
  Core.

### Forbidden implementation shapes

- No wholesale reset of the current useful implementation.
- No universal production-number database registry.
- No FDX production change beyond exact-number opacity and the focused
  singleton-import-row authoring gate.
- No Project Setting/CLI flag combination or application generation path for
  missing FDX numbers.
- No project-specific row counts, ids, paths, or Beat JSON validation in the
  permanent migration.
- No newly initialized Urban Basilica database.
- No schema DDL executed by the rebuild script.
- No runtime old-path resolver or old-name compatibility alias.
- No path construction in CLI, HTTP, React, Engines, or skills.
- No filename parsing for identity, ownership, selection, or provenance.
- No one-file destination switch that also copies, hashes, and persists.
- No generation/version counter, Asset series, or lineage table for `gxxx`.
- No flattening of Storyboard iteration folders.
- No broad destructive cleanup of the archive.

### Stop conditions

Stop and revise before continuing if:

- a new public type, setting, flag, mode, route, or command does not trace to
  the requirement ledger;
- any FDX, Settings, or skill behavior differs from the last accepted
  pre-attempt state beyond the explicit removal of Scene-number validation;
- the migration contains exact Urban Basilica row counts or deep content
  validation;
- the rebuild process initializes a new database rather than copying the
  generation-60 backup;
- the current generation-61 live database becomes the reconstruction source;
- the rebuild script starts applying schema DDL instead of calling the existing
  Drizzle migration boundary;
- a caller outside Core calculates a production number, generation token, or
  durable path;
- project-specific cleanup moves into normal runtime code;
- Storyboard iteration folders or current candidate files are collapsed;
- unregistered old roots are copied merely because they exist;
- a focused implementation again spreads into policy, settings, importer,
  Studio, skills, and documentation without a requirement-ledger entry;
- an `index.ts`, service contract, destination registry, command handler, or
  migration becomes an unreviewable catch-all.

## Contracts And Diagnostics

### Numbering contracts

Keep the existing browser-safe contract, with focused review of names and error
translation:

```ts
isProductionNumber(value: string): boolean
productionNumberKey(value: string): string
formatProductionNumberForDisplay(value: string): string
allocateInitialProductionNumbers(count: number): string[]
allocateOrderedProductionNumber(input): string
```

The pure module may throw internal typed allocation failures. Package-boundary
commands translate known failures into structured diagnostics; they must not
catch every programming error and relabel it as allocation exhaustion.

### Scene contract

- Agent-facing `SceneInput` does not accept a caller-authored production number.
- Renku-authored Scene commands assign and persist stable production numbers.
- `Scene.productionNumber` retains its pre-attempt public/imported contract;
  0174 does not make it globally required or change FDX parsing.
- The imported Scene contract accepts every exact string and performs no
  Scene-number validation; other importer behavior remains unchanged.
- Scene reservations are owned by the Renku-authored Scene commands; there is
  no source-mode API.
- Renku-authored restore by Scene id requires the retained reservation and
  fails before write when database integrity is broken.
- The existing singleton FDX import row gates Screenplay create/apply/revision
  restore. No public source-status contract or override is added.

### Shot contract

```ts
type ShotPlacement =
  | { position: 'start' | 'end' }
  | { position: 'before' | 'after'; shotId: string };
```

Omission remains end placement. Plan and Shot reports expose their numbers.

### Scene Beats contract

Keep the current useful Scene Beats input, aggregate, revision summary,
revision read/list/write reports, focused operation union, and exact-revision
Storyboard status/import contracts. Review the current implementation for
behavioral parity with the former immutable history owner. Remove the
aggregate-level `title`, `summary`, `narrativeProgression`,
`lookbookInfluence`, and `openQuestions` fields from the current contracts and
callers, while retaining `Beat.title` and all other Beat creative fields.

### Asset-file naming contract

```ts
type ProjectAssetFileNamingMode =
  | { kind: 'generated' }
  | { kind: 'external' };
```

The owning Core attachment/import command chooses the mode. The existing
attachment `title` supplies `semanticName` where a purpose needs a variation;
no duplicate title field is added.

Shot Plan media destinations carry the exact `shotPlanId` and a closed role.
The attachment boundary derives the Plan id from frozen GenerationSpec/run
provenance before resolving a path. Titles and current UI selection never
choose the Plan.

### Focused diagnostics

Retain or add only diagnostics required by the final contract:

- production-number invalid, duplicate/reservation collision, and bounded
  allocation failure;
- invalid Shot or Beat placement;
- Scene Beats missing/already exists/revision missing/operation target missing;
- required semantic name missing;
- generated-token allocation failure;
- external-source filename allocation failure; and
- existing path escape, source missing, copy, hash, and persistence failures.

Remove diagnostics whose only purpose is the rejected public source-mode,
double-gated fallback, generated-number path, or compatibility behavior. Keep
only `SCREENPLAY_FDX_BACKED_READ_ONLY` for the approved Core authoring gate; the
existing importer behavior otherwise remains authoritative.

## Corrected Migration Design

### Replace the current uncommitted 0076

Migration 0076 has not been released or committed as accepted history. Replace
it rather than adding 0077 on top of it.

The implementation sequence is:

1. Inspect and record the current 0076 problems in this plan; do not create a
   second migration artifact merely to preserve rejected SQL.
2. Remove only the current uncommitted 0076 SQL/snapshot/journal entry.
3. Finalize the TypeScript schema described by this plan.
4. Generate migration 0076 and its snapshot from the accepted 0075 snapshot
   with Drizzle Kit.
5. Add only the necessary documented data-preservation SQL Drizzle cannot
   generate.
6. Set `PRAGMA user_version = 61` because the runtime schema changes.
7. Run Drizzle's migration consistency check and focused migration tests.

### Permanent migration responsibilities

The corrected migration may perform these generic transformations for any
populated generation-60 database:

1. Change Project Settings v1 to v2 by renaming only
   `generateSceneBeatSheets` to `generateSceneBeats` and preserving every other
   value.
2. Create the Scene reservation storage needed by Renku-authored Core commands,
   and remove the legacy non-empty and uniqueness constraints from the Scene
   production-number column. Do not add
   FDX/source classification. There is no existing local agent-authored
   database state requiring a Scene-reservation backfill.
3. Rename and transform every existing Beat Sheet revision into a numbered
   Scene Beats revision while preserving revision id, Scene id, timestamps,
   Beat ids, every Beat's `title` and other creative fields, order, active
   pointers, and valid base links. Drop the separate aggregate title column and
   omit the aggregate-level `summary`, `narrativeProgression`,
   `lookbookInfluence`, and `openQuestions` JSON fields from the transformed
   current document.
4. Rename Shot Plan coverage to exact `sceneBeatsRevisionId` terminology.
5. Backfill Shot Plan numbers deterministically by Scene and creation order,
   then seed each Scene's Plan high-water.
6. Backfill Shot numbers deterministically by Plan and authored position, then
   seed Shot reservations.
7. Create the final indexes, constraints, and tables required by the TypeScript
   schema.

The permanent migration must preserve all existing Beat revision rows. The
decision to keep only Urban Basilica's four active revisions belongs to the
one-time rebuild cleanup after migration.

### Permanent migration exclusions

The corrected SQL must not:

- test for exactly 10 Scenes, 12 Beat rows, 4 active pointers, 1 Plan, or 1
  Shot;
- identify Urban Basilica by path, id, count, title, or content;
- deeply validate Beat creative JSON field-by-field;
- add the removed Project Setting, CLI flag, public source mode, generated
  FDX-number path, or import number provenance;
- delete inactive Beat revisions;
- remove Trash, discarded Assets, stale Location files, or unattached
  generation history;
- move or copy filesystem content; or
- create a second application-level migration runner.

Source preflight and one-time project cleanup are safer because the full root
is archived and the reconstruction manifest accounts for exact retained and
omitted state.

### Migration tests

Keep migration verification focused:

- the existing migration test harness reaches generation 61 and matches the
  final TypeScript schema;
- the disposable copy of the exact generation-60 Urban Basilica backup retains
  all rows that the schema migration is responsible for preserving;
- Plan/Shot number backfills are deterministic;
- `quick_check` is `ok` and `foreign_key_check` returns no rows; and
- project-specific cleanup is verified only in the separate reconstruction
  rehearsal.

Do not build a compatibility or database-fleet test matrix.

## Urban Basilica Archive And Reconstruction

### Hard boundary: fresh folder, preserved database

“Fresh Urban Basilica” means a fresh filesystem destination, not a fresh
database.

The source database is the exact generation-60 backup. The procedure copies
that populated SQLite file byte-for-byte into the new folder as
`.renku/project.sqlite`, verifies the pre-migration hash matches, and then runs
the corrected migration against that copied database.

The current generation-61 live database is archived for evidence but is never
used as the reconstruction source.

### One-time rebuild tool

`scripts/maintenance/rebuild-urban-basilica-project.mjs` is dry-run by default
and requires `--apply`. It has explicit absolute source/archive/destination
arguments and refuses broad or unresolved paths.

It produces a JSON manifest containing:

- source root, archive root, destination root, and generation-60 database path;
- source backup SHA-256 and copied pre-migration SHA-256;
- pre- and post-migration database generation and hash;
- every retained Asset/File id, old path, new path, media kind, size, and hash;
- every omitted stale directional file id/path;
- every removed discarded/Trash row;
- retained and removed GenerationSpec/Run ids;
- retained and removed Scene Beats revision ids;
- copied Inspiration and Research paths and hashes;
- missing-file and collision diagnostics;
- final table counts and byte totals;
- `quick_check` and `foreign_key_check` results; and
- archive-presence and archive-integrity evidence.

Dry-run writes no project/database/file changes. It may write only its explicit
review manifest to a temporary or user-approved evidence path.

### Preflight

With Studio stopped:

1. Verify no Studio, CLI mutation, or SQLite process has the Project open.
2. Resolve an explicit timestamped sibling archive path and prove it does not
   exist.
3. Verify the generation-60 backup hash, size, `user_version`, `quick_check`,
   and `foreign_key_check`.
4. Confirm the expected source inventory: 10 Scenes, 12 Beat revisions, 4
   active Beat pointers, 1 Plan, 1 Shot, 86 active Assets, and 94 active Asset
   Files.
5. Validate current registered Asset File existence, size, and stored hashes.
6. Resolve the four active Beat revisions and all current Storyboard Beat ids.
7. Resolve every retained generation-provenance relationship.
8. Produce the complete copy/omit/database-cleanup manifest.
9. Refuse to proceed on any missing retained file, path collision, ambiguous
   owner, invalid active pointer, unresolved selected Asset, or integrity
   failure.

### Disposable rehearsal

Before touching the live root:

1. Rehearse the entire process in a temporary directory using a copy of the
   generation-60 backup and archived source files.
2. Apply the corrected migration through the existing Drizzle/Core boundary.
3. Apply project-specific database cleanup only after migration.
4. Copy retained files to their final new paths.
5. Open the reconstructed Project through Core, CLI, and Studio.
6. Exercise representative Scene, Beats, Storyboard, Shot Plan, Shot,
   generation-reference, and media-serving workflows.
7. Compare every manifest count, hash, and relationship with the source.

No live move occurs until this rehearsal passes.

### Live archive and reconstruction

After explicit final confirmation at implementation time:

1. Move the complete `/Users/keremk/renku-movies` directory to an explicit
   timestamped sibling such as
   `/Users/keremk/renku-movies-archive-20260808-220000`.
2. Do not edit, prune, or delete anything in that archive.
3. Create a new `/Users/keremk/renku-movies/urban-basilica` folder.
4. Create only the required `.renku/` directory in the new Project.
5. Copy the archived generation-60 backup file into the new folder as
   `.renku/project.sqlite`.
6. Verify the copied database hash matches the archived backup before any
   migration.
7. Run the corrected Drizzle migration against that populated copy through the
   existing Project migration boundary. A new verified pre-migration backup
   created by that command is allowed; old backup collections are not copied.
8. Run the one-time post-migration cleanup transaction in the copied database.
9. Copy every retained registered Asset File from the archived Project to its
   manifest path in the new tree, verifying size and SHA-256.
10. Copy `visual-language/inspiration/` and `research/` losslessly with hashes.
11. Update retained Asset File paths only to the already verified copied
    targets.
12. Write the final manifest inside the new `.renku/` evidence folder and a
    second copy outside the Project.
13. Keep Studio stopped until every final database and filesystem check passes.

### Post-migration project-specific cleanup

The one-time transaction on the copied, migrated database:

- retains the four Scene Beats revisions selected by the generation-60 active
  pointers;
- clears their base links because omitted revisions are no longer in the clean
  Project;
- deletes the other eight development-history revisions only from the copied
  database;
- retains all 37 current Storyboard Assets and their selected-image state;
- keeps all six Storyboard iteration boundaries while changing the enclosing
  Scene path to its production number;
- retains 86 active Assets;
- retains one primary file per active Asset, producing 86 active Asset Files;
- removes the eight stale directional Location Sheet file rows while retaining
  both primary Location Sheet images;
- removes discarded Asset/File rows and empties obsolete Trash history;
- retains only GenerationSpecs and GenerationRuns required by retained Asset
  File provenance after proving no current consumer needs the omitted rows;
- preserves current Project, Screenplay, Scene, Cast, Location, Prop, Lookbook,
  Dialogue, Shot Plan, Shot, membership, selection, and provenance ids; and
- updates only project-relative Asset File paths required by the new layout.

No immutable retained GenerationSpec or Run payload is rewritten merely
because it contains a historical path snapshot.

### Files deliberately left in the archive

Do not copy:

- the current generation-61 database;
- old `.renku/project-database-backups/` collections;
- old `tmp/`, `.renku/tmp/`, review evidence, receipts, and QA debris;
- retired `generated/`, `audio/`, `scene-dialogue-audio/`, `shot-plans/`,
  `shots/`, `videos/`, and obsolete Storyboard roots except files explicitly
  selected by registered active Asset File rows;
- discarded/Trash files;
- stale directional Location Sheet files;
- unregistered loose media, including the loose root MP4;
- `.DS_Store`; or
- loose root analysis JSON unless it is explicitly proven to be current
  user-owned Research content and added to the manifest before apply.

### Recoverable failure behavior

The archive is never deleted. If reconstruction fails after the live move:

- stop without opening the incomplete new Project;
- preserve the failed new root under an explicit timestamped failed-rebuild
  name rather than deleting it;
- report the exact failed manifest step;
- restore the archive to the original `renku-movies` name only after explicit
  user confirmation; and
- never overwrite either the archive or failed reconstruction.

## Implementation Slices

### Slice 1 — Freeze scope and classify the current implementation

- Record the exact pre-existing unrelated worktree state.
- Map every Plan 0173 changed file to `keep`, `rework`, `remove`, or
  `unrelated/preserve` using the disposition table above.
- Preserve the useful implementation; do not perform a broad reset.
- Mark Plans 0172 and 0173 superseded only after Plan 0174 is accepted.
- Reset Plan 0173's misleading implementation-complete claims when marking it
  superseded; retain historical explanation rather than presenting it as the
  accepted final implementation.

Exit when every current changed file has an explicit owner and disposition.

### Slice 2 — Remove the invented FDX machinery

- Keep agent create/add/move/delete/restore stable numbering.
- Remove public source classification, `source-authority.ts`, all imported-FDX
  mutation/restore gates, the generated-number allocator, attempted Project
  Setting, CLI flag, `sceneNumberSource`, generated fallback warnings, Studio
  setting copy, and tests or skill claims for those invented mechanisms.
- Restore the FDX mapper, contracts, import record, and fixtures to the focused
  importer boundary, then remove only Scene-number trimming, uniqueness
  validation, and the duplicate-number diagnostic.
- Keep every other importer precondition and error behavior unchanged.
- Keep non-FDX create/apply/restore behavior unchanged apart from the requested
  stable Scene-number allocation.

Exit when the invented FDX code is gone, imported values pass through unchanged,
and no new runtime rule distinguishes or restricts an FDX-backed Screenplay.

### Slice 3 — Finish and harden the shared number implementation

- Review the pure production-number module for grammar, display, case-folding,
  suffix rollover, insertion, high-water, and bounded failure.
- Keep supplied Scene values out of generated-number parsing and case folding;
  compare them only as exact occupied strings and never reject them.
- Replace broad catch-and-relabel error handling with typed/known failure
  translation.
- Verify Scene, Shot, and Beat adapters use the same algorithm without a
  domain switch.
- Verify no UI, CLI, HTTP, or skill code calculates numbers.

Exit when the reusable mechanism is owned and tested exactly once.

### Slice 4 — Complete Shot Plan, Shot, and Scene Beats integration

- Retain and review the current Plan counter and Shot reservation transactions.
- Verify create/copy/add/move/delete/collect/restore semantics.
- Finish the Scene Beats direct rename and remove only the aggregate-level
  `title`, `summary`, `narrativeProgression`, `lookbookInfluence`, and
  `openQuestions` fields; retain `Beat.title`, other Beat creative fields,
  create/reset, focused revisions, history, active selection, and exact
  revision context.
- Audit the large Beat Sheet deletions against old behavior so no accepted
  history, Storyboard, coverage, or selection capability disappeared.
- Keep UI/CLI/skills on returned stable values and exact revision ids.

Exit when all domain lifecycles pass without old names or compatibility paths.

### Slice 5 — Replace migration 0076

- Remove the current uncommitted 0076 SQL/snapshot/journal entry after verifying
  the problems already recorded in this plan; create no duplicate rejected-SQL
  artifact.
- Regenerate from the final TypeScript schema and the 0075 snapshot.
- Add only documented generic data-preservation transforms.
- Preserve all Beat revisions during migration.
- Use the existing migration harness and the exact disposable generation-60
  backup rehearsal; do not add a database-fleet compatibility matrix.
- Rehearse against a disposable byte copy of the generation-60 Urban Basilica
  backup; never touch the archived source.

Exit when the migration contains no project-specific cleanup, generated-number
fallback, or public source-mode schema and the populated copied database
reaches generation 61 intact.

### Slice 6 — Implement generated/external naming and the final destination tree

- Extend the existing project-asset-files owner with generated and external
  naming modes.
- Add safe semantic normalization, `gxxx` exclusive allocation, and external
  collision suffixes.
- Remove durable `vNN` allocation and duplicate path allocation.
- Update every existing focused destination to the canonical tree.
- Preserve Storyboard iteration allocation.
- Make Shot Plan media carry exact Plan id/role derived from frozen provenance.
- Add the focused custom Shot Plan reference purpose without copying ordinary
  dependency Assets.

Exit when no new durable file can be written under an obsolete root.

### Slice 7 — Align adapters, Studio, skills, docs, and decisions

- Keep CLI and Studio server adapters thin.
- Keep Studio number labels from the useful current implementation.
- Update `scene-beat-designer`, `shot-planner`, `media-producer`,
  `screenplay-drafter`, and `movie-director` to the final contracts.
- Restore every FDX-related skill hunk to the last accepted version. Make only
  the unrelated Scene Beats, stable-number, and Asset-path skill edits required
  by this plan.
- Teach media-producer to supply semantic variations, not full paths or tokens.
- Revise ADR 0075 to the simplified common numbering and Scene Beats decision.
- Add ADR 0076 for the human-readable folder and filename contract.
- Update current architecture, product, UI, CLI, and skill documentation to one
  final contract.

Exit when docs and skills describe no intermediate or rejected behavior.

### Slice 8 — Build and prove the one-time reconstruction tool

- Implement dry-run manifest generation.
- Implement explicit archive/source/destination safety checks.
- Use the generation-60 backup as the database source.
- Call the existing migration boundary; do not execute schema DDL in the tool.
- Implement post-migration current-state cleanup and path updates.
- Copy/hash retained Asset Files and user-owned Inspiration/Research files.
- Prove the complete workflow in a disposable rehearsal.

Exit when the rehearsal produces the exact accepted current Project and a
complete accounting manifest.

### Slice 9 — Archive and reconstruct Urban Basilica

- Obtain explicit final confirmation before moving the live root.
- Archive the entire root unchanged.
- Create the fresh folder.
- Copy and migrate the populated generation-60 database backup.
- Apply project-specific cleanup to the copied database.
- Copy only manifest-retained files into their new names and folders.
- Preserve the archive and final evidence.

Exit only after automated integrity checks and representative desktop workflows
pass on the reconstructed Project.

### Slice 10 — Verify durable planning constraints

Preserve and verify the rules recorded in `AGENTS.md` during this plan
correction:

- Urban Basilica is currently the only populated local Studio Project database
  unless the user explicitly says otherwise;
- there are no external users or database fleet to support;
- do not turn a one-local-project correction into fleet compatibility,
  fallback, or generalized recovery infrastructure;
- a fresh Project folder does not authorize a fresh database when the accepted
  workflow requires preserving a backed-up populated database;
- the accepted FDX importer, warnings/errors, Agent AI remediation, Settings,
  and workflow are an unchanged boundary for numbering/path work;
- existing FDX Scene numbers are never changed, and the existing missing-number
  warning leaves generation to the user;
- directly relevant edge cases, validation, warnings, structured errors, and
  migration safety remain required at their owning boundaries;
- an adjacent product workflow, setting, flag, mode, provenance model, or
  policy that does not trace to the requirement ledger must be surfaced as a
  separate scope proposal rather than embedded in implementation; and
- every substantial plan and handoff must prominently summarize new public
  surfaces, behavior changes, migration/data/file effects, unchanged behavior,
  material assumptions, and decisions requiring approval.

Strengthen the existing plan-review memory rather than adding a duplicate
lesson. Accepted product and architecture docs continue to outrank memory.

## Tests And Guardrails

### Shared owning-layer tests

- Generated-number grammar accepts positive integer plus letters and rejects
  malformed values produced or reserved by Renku.
- Generated-number case is preserved and generated reservation uniqueness is
  case-insensitive.
- Display formatting covers `1`, `1A`, `4aA`, `28A`, and `100`.
- Initial, append, start/middle insertion, repeated insertion, deletion,
  high-water, `Z -> AA`, and bounded failure are covered once in the pure
  allocator.
- Known allocation failures map to structured errors without masking unrelated
  programming failures.

### Scene tests

- Agent create assigns `1..N` without caller-authored numbers.
- Prove supplied/imported whitespace, empty, non-generated, and duplicate Scene
  numbers are preserved exactly and accepted without validation.
- Append/insert/move/update/delete/restore preserve the accepted lifecycle.
- Renku-authored commands use the Scene allocator; the FDX importer does not use
  it to replace source values.
- None of the attempted Project Setting, CLI flag, public source status,
  generated-number path, provenance field, or generated-fallback warning
  machinery survives. The focused singleton-import-row authoring gate is
  covered for apply and restore; existing importer warnings remain.

### Shot Plan and Shot tests

- Plan create/copy/delete/collect/restore and concurrent allocation preserve the
  Scene-local high-water.
- Fresh and copied Shots start `1..N` in their own Plan scope.
- Start/before/after/end placement, move, delete, collection, and copy preserve
  stable references.
- Reports, CLI, HTTP, and Studio serialize/display the same values.

### Scene Beats tests

- Create/reset assign Core-owned Beat ids/numbers.
- Focused edits create immutable derived revisions and leave bases unchanged.
- Updates preserve id/number; insert allocates; delete retains reservations.
- Set-active moves backward and forward without deleting either revision.
- Storyboard Assets and Shot Plan coverage reconnect by exact revision/Beat ids.
- Iteration folders are retained across reset and active-revision changes.
- Current Scene Beats create/read/revision contracts omit the five removed
  aggregate fields while requiring and preserving each individual Beat's
  `title`.
- Current-contract tests contain no retired Beat Sheet compatibility behavior.

### Asset destination tests

- Cover the full destination/filename matrix in Core.
- Test safe semantic names, empty required names, 32-character bounds, and
  extension normalization.
- Test `gxxx` alphabet, length, collision redraw, bounded failure, concurrency,
  exclusive no-overwrite, and rollback.
- Test external `-2`/`-3` collisions without `g` or `v`.
- Test exact Shot Plan provenance and reject title/current-selection mismatch.
- Test one current Asset File per accepted writer and no directional Location
  Sheet outputs.
- Test Storyboard batch folders and production-number paths without duplicating
  the allocator matrix.

### Migration tests

- Use the existing migration harness plus the disposable generation-60 backup;
  do not add a database-fleet compatibility matrix.
- Preserve all existing Beat revisions during migration, not only the four-row
  reconstruction result.
- Run `quick_check`, `foreign_key_check`, Drizzle consistency, and schema
  snapshot comparison.
- Test the corrected migration on a disposable copy of the exact generation-60
  backup.

### Reconstruction tests

- Dry-run writes nothing to the Project/database/archive.
- Apply refuses non-explicit paths, existing archive targets, non-empty
  destinations, missing retained files, collisions, and hash mismatches.
- The copied database hash equals the generation-60 backup before migration.
- The tool never calls database initialization.
- The tool never executes schema DDL.
- The manifest accounts for every copied, omitted, and database-removed item.
- The archive remains byte-for-byte untouched.
- The final Project contains the exact accepted row/file counts and paths.

### Architecture guardrails

- Browser-safe production-number code imports no server, database, Node, or
  filesystem module.
- CLI/Studio import boundaries prevent database/filesystem internals.
- Runtime boundary tests prove invalid writes fail before persistence.
- Architecture tests protect stable capabilities/imports, not helper names.
- Search current production code for removed policy names, old Beat Sheet
  runtime names, old durable roots, and durable `-vNN` allocation.
- Confirm the FDX-related production diff is only removal of the rejected
  working-set additions, then inspect complexity and file size for Scene
  numbering, Shot authoring, Scene Beats operations, destination registry, and
  rebuild script.

Edge-case matrices belong at the owning layer. Adapter/UI/integration tests
cover delegation, serialization, visible labels, and representative journeys
rather than repeating the full matrix.

## Documentation And Decisions

Update the current accepted contract in:

- revised ADR 0075 for common numbering and Scene Beats, with all attempted FDX
  policy text removed;
- new ADR 0076 for human-readable Asset folders and generated/external naming;
- concise supersession notices in affected older ADRs without rewriting their
  historical bodies;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/drizzle-migrations.md` only if the corrected
  migration exposes a reusable rule not already documented;
- `docs/architecture/screenplay-fdx-import.md` only to remove the rejected
  working-set additions and restore its last accepted content;
- current Project Settings, media-generation, product-workflow, vocabulary,
  CLI, and Studio Screenplay documentation; and
- the exact affected files in `/Users/keremk/Projects/aitinkerbox/studio-skills`.

Mark Plans 0172 and 0173 superseded by this plan after acceptance. Do not
rewrite historical plans merely for a naming sweep.

## Final Verification

### Automated

Run focused checks while implementing, followed by repository gates:

```bash
pnpm --dir packages/core test
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm check
pnpm build
```

Run the affected Studio skill validators and focused evals.

### Disposable functional verification

Exercise:

1. agent Screenplay create and Scene insert/move/delete/restore;
2. the existing representative FDX import, confirming its authored Scene
   numbers are unchanged and no new FDX options or restrictions exist;
3. Shot Plan create/copy/delete and Shot placement/move/delete;
4. Scene Beats create, focused edits, reset, history, and backward/forward
   active selection;
5. every durable destination with generated and external files;
6. Scene Storyboard iteration preservation;
7. exact Shot Plan generation provenance; and
8. representative Studio desktop labels/media loading.

### Urban Basilica final state

After reconstruction:

- the archive exists unchanged;
- the new database descends from the exact generation-60 backup and the
  pre-migration copied hash was identical;
- `user_version` is 61;
- `quick_check` returns `ok`;
- `foreign_key_check` returns no rows;
- all 10 Scene numbers are preserved byte-for-byte;
- the active Plan/Shot are numbered `1`/`1`;
- Scene Beats contains exactly 4 clean baseline revisions and 4 active
  pointers, with no base link to an omitted revision;
- the other 8 former Beat revisions remain available only in the archived
  generation-60 database;
- all 37 Scene Storyboard Assets and 6 iteration folders remain;
- there are 86 active Assets and 86 active Asset Files;
- every active Asset has one current file and one exclusive membership;
- selected Assets and retained provenance still resolve;
- stale directional, discarded, Trash, unattached-generation, old backup, and
  temporary data is absent from the new Project as specified by the manifest;
- every registered file exists and matches stored size/hash;
- no registered path starts with an obsolete durable root; and
- Project, Screenplay, Cast, Locations, Props, Lookbooks, Storyboards,
  Dialogue, Shot Plans, Shots, images, videos, and generation context open in
  Studio.

### Architecture and diff inspection

- Inspect `git diff --stat` and the complete diff.
- Compare the final file disposition with the Slice 1 inventory.
- Inspect every new or heavily modified number, Scene Beats, migration,
  destination, attachment, and rebuild file.
- Confirm the current implementation was repaired selectively rather than
  discarded and recreated.
- Confirm migration 0076 contains no exact-project guards or rejected policy.
- Confirm the rebuild script never initializes a database or runs schema DDL.
- Confirm `index.ts` files remain thin.
- Confirm no broad dispatcher, catch-all service, compatibility layer, source
  mode, or path parser was added.
- Confirm no checklist item was satisfied by accepting unreviewable code.

## Completion Checklist

### Review Area

- [x] Reconcile implementation with the Review Attention table and stop if a consequential unlisted effect appears.
- [x] Confirm Plan 0174 is the sole implementation plan for the combined numbering, Scene Beats, path, migration, and reconstruction cutover.
- [x] Confirm every mechanism traces to the requirement ledger.
- [x] Confirm useful current implementation is retained and repaired rather than broadly reverted.
- [x] Confirm every invented FDX source-mode, fallback, and runtime read-only enforcement mechanism is removed.
- [x] Confirm the final module shape matches the Architecture Shape Gate.
- [x] Confirm no god file, broad dispatcher, catch-all helper, or compatibility layer survives.

### Shared Numbering

- [x] Keep one browser-safe grammar, case-folding rule, display formatter, suffix generator, and ordered allocator for Core-generated values only.
- [x] Cover initial, append, insertion, move, deletion reservation, high-water, and suffix rollover once in the shared owner.
- [x] Translate only known allocation failures into structured package-boundary diagnostics.
- [x] Keep numbers as labels rather than identity or current order.
- [x] Keep Shot Plan numbering as a focused monotonic counter rather than forcing it through ordered allocation.

### Scenes And Rejected FDX Work

- [x] Keep Scene reservations focused on Renku-authored Scenes.
- [x] Assign initial and inserted agent Scene numbers in Core transactions.
- [x] Preserve Scene numbers through update, move, delete, and revision restore.
- [x] Keep supplied and stored Scene numbers opaque: no grammar, trimming, case folding, non-empty, or uniqueness validation.
- [x] Keep existing Scene values out of generated-number family parsing and compare them only as exact occupied labels.
- [x] Restore the focused FDX mapper/import boundary and remove Scene-number trimming, uniqueness validation, and its duplicate diagnostic.
- [x] Preserve the existing FDX importer, warnings, Agent AI remediation, Settings, and user workflow apart from removing Scene-number validation and its duplicate diagnostic.
- [x] Remove every retained-import content/restore gate and its enforcement tests.
- [x] Remove `ScreenplaySourceStatus`, the attempted Project Setting, CLI flag, generated-number path, provenance field, generated-number diagnostics, UI setting row, and related invented skill guidance.
- [x] Keep existing empty-Screenplay and one-import FDX preconditions.

### Shot Plans And Shots

- [x] Keep Scene-local stable Plan number and high-water persistence.
- [x] Allocate Plan numbers in create/copy transactions.
- [x] Preserve Plan high-water through delete, collection, and restore.
- [x] Keep per-Plan Shot reservations and stable Shot numbers.
- [x] Number fresh and copied Shots `1..N` in their own Plan scope.
- [x] Support start/before/after/end placement through Core.
- [x] Preserve Shot numbers through update, move, delete, collection, and restore.
- [x] Replace every position-derived Shot label with `shot.number`.

### Scene Beats

- [x] Complete the direct Beat Sheet to Scene Beats contract/code/CLI/route/resource/skill rename with no alias.
- [x] Remove aggregate-level `title`, `summary`, `narrativeProgression`, `lookbookInfluence`, and `openQuestions` from Scene Beats contracts, persistence, projections, CLI, Studio, skills, fixtures, and current documentation.
- [x] Retain every individual Beat's `title` and other Beat creative fields through create, read, focused revision, migration, and reconstruction.
- [x] Keep immutable revision rows, revision ids, base links, history listing, and active selection.
- [x] Keep BeatInput free of caller-authored ids and numbers.
- [x] Assign Beat ids/numbers in Core create/reset/insert transactions.
- [x] Preserve numbers on update and retain reservations on delete.
- [x] Keep focused operations as immutable derived revisions from an explicit base.
- [x] Make reset create/activate without deleting history.
- [x] Make set-active move backward/forward without deleting either revision.
- [x] Keep exact Scene Beats revision identity in Storyboard and Shot Plan coverage.
- [x] Preserve Storyboard ownership, selection, and iteration folders.
- [x] Add no Studio reset/restore control.

### Migration 0076

- [x] Use this plan and the current diff as the audit evidence for the rejected 370-line migration; create no duplicate migration artifact.
- [x] Remove the current uncommitted 0076 SQL/snapshot/journal entry.
- [x] Finalize the Drizzle TypeScript schema as source of truth.
- [x] Regenerate 0076 and its snapshot from the 0075 baseline with Drizzle Kit.
- [x] Keep only necessary generic data-preservation SQL.
- [x] Migrate Project Settings v1 to v2 only for the Scene Beats setting rename.
- [x] Preserve and number all Beat revisions during the generic migration, dropping only the five accepted aggregate fields and retaining every Beat's `title` and other creative fields.
- [x] Create Scene reservation storage, remove Scene-number uniqueness/non-empty constraints without changing existing values, and backfill Plan and Shot reservations/counters deterministically.
- [x] Remove all exact Urban Basilica row-count/content guards.
- [x] Remove all public source-mode/generated-number fallback schema and data changes.
- [x] Set and verify schema generation 61.
- [x] Pass the existing migration harness, exact-backup rehearsal, Drizzle consistency, quick check, and foreign-key check without adding a fleet compatibility matrix.
- [x] Rehearse the corrected migration on a disposable copy of the generation-60 backup.

### Asset Naming And Destinations

- [x] Reuse project-asset-files as the sole durable path/copy/hash/persistence owner.
- [x] Add generated and external naming modes without a duplicate creative title field.
- [x] Implement safe-kebab semantic segments and normalized extensions.
- [x] Implement `gxxx` bounded exclusive collision allocation with no persisted counter or lineage.
- [x] Implement external source basename allocation with plain numeric collision suffixes.
- [x] Remove durable `vNN` allocation and duplicate path functions.
- [x] Move Screenplay source, Lookbooks, Cast, Locations, Props, Dialogue, Storyboards, Shots, and Shot Plan media to the complete canonical tree.
- [x] Preserve Scene Storyboard `NN-iteration/` allocation and temporary Scene Storyboard sheets.
- [x] Resolve every Shot Plan destination from exact frozen Plan provenance.
- [x] Add the focused custom Shot Plan reference purpose without copying ordinary dependencies.
- [x] Keep paths non-authoritative and unparsed.

### CLI, Studio, And Skills

- [x] Keep adapters free of number/path allocation and business policy.
- [x] Keep Studio labels on Core values and durable ids.
- [x] Update scene-beat-designer for final Scene Beats create/edit/reset/history/set-active contracts.
- [x] Update shot-planner for stable Plan/Shot numbers and placement.
- [x] Update media-producer for exact revision context and concise semantic variation names.
- [x] Restore every FDX-related screenplay-drafter and movie-director hunk to its last accepted state, then retain only unrelated Scene Beats/stable-number/path updates.
- [x] Ensure skills never calculate ids, numbers, tokens, or paths.
- [x] Run affected skill validators and focused evals.

### Urban Basilica Preflight And Rehearsal

- [x] Stop Studio and verify no process has the Project/database open.
- [x] Verify the exact generation-60 backup path, hash, size, user version, quick check, and foreign keys.
- [x] Inventory every database row family and filesystem source needed by the manifest.
- [x] Account for 86 active Assets, 94 source active Asset Files, 37 Storyboard files, and 6 Storyboard iteration folders.
- [x] Resolve every selected Asset and retained provenance relationship.
- [x] Produce a complete dry-run copy/omit/cleanup manifest.
- [x] Refuse missing files, hash mismatches, collisions, ambiguous owners, invalid pointers, or broad paths.
- [x] Complete the entire migration/cleanup/copy/open workflow in a disposable rehearsal.

### Urban Basilica Live Reconstruction

- [x] Obtain explicit final user confirmation before moving the live root.
- [x] Move the complete `renku-movies` root to an explicit non-existing timestamped sibling.
- [x] Keep the archive unchanged and never delete it.
- [x] Create a fresh `renku-movies/urban-basilica` folder.
- [x] Copy the exact generation-60 populated backup as the new `.renku/project.sqlite`.
- [x] Verify byte hash equality before migration.
- [x] Apply the corrected migration through the existing Drizzle/Core boundary.
- [x] Never initialize a new database.
- [x] Apply project-specific cleanup only to the copied migrated database.
- [x] Retain only 4 active Scene Beats baselines in the reconstructed database and keep the other 8 in the archive.
- [x] Retain 86 active Assets and 86 active primary Asset Files.
- [x] Preserve all 37 Storyboard Assets and 6 iteration boundaries.
- [x] Omit 8 stale directional Location files while retaining both primary files.
- [x] Remove discarded/Trash rows and unattached generation history only after referential proof.
- [x] Copy only registered retained files plus user-owned Inspiration and Research.
- [x] Do not copy old backups, tmp/review debris, retired roots, loose media, or `.DS_Store`.
- [x] Write final manifests inside and outside the reconstructed Project.

### Tests And Guardrails

- [x] Run shared numbering owning-layer tests.
- [x] Run Scene, Shot Plan/Shot, and Scene Beats lifecycle tests plus the unchanged existing FDX regression suite.
- [x] Run the complete Asset destination/naming matrix at the Core owner.
- [x] Run generic migration tests and exact reconstruction tests at their separate boundaries.
- [x] Keep adapter tests limited to delegation/serialization and UI tests to visible behavior.
- [x] Keep architecture tests based on stable imports/capabilities rather than implementation names.
- [x] Inspect complexity and large changed files before completion.

### Documentation And Durable Lessons

- [x] Revise ADR 0075 for the common numbering and Scene Beats contract, exact imported Scene values, and the later-approved focused FDX read-only gate.
- [x] Add ADR 0076 for the final human-readable folder and filename contract.
- [x] Restore FDX documentation/skill hunks to the focused importer boundary and document the opaque Scene-number exception; update only the numbering, Scene Beats, Project Settings Beat-key rename, media, CLI, and UI documentation in scope.
- [x] Add concise supersession notices without rewriting historical ADR bodies.
- [x] Mark Plans 0172 and 0173 superseded by Plan 0174 after acceptance.
- [x] Keep the nuanced scope-expansion, Review Attention, and local fresh-folder-versus-backed-up-database rules in `AGENTS.md`.
- [x] Strengthen the existing plan-review memory without duplicating accepted product truth.

### Final Verification

- [x] Run focused Core, CLI, Studio, and skill checks.
- [x] Run `pnpm check` and `pnpm build`.
- [x] Verify the disposable project and final Urban Basilica filesystem trees.
- [x] Verify database integrity, exact row counts, file existence, sizes, hashes, memberships, selections, and provenance.
- [x] Open and exercise representative desktop workflows on reconstructed Urban Basilica.
- [x] Confirm the archive remains unchanged and recoverable.
- [x] Review `git diff --stat` and the complete diff.
- [x] Confirm every current implementation file has its planned keep/rework/remove disposition.
- [x] Confirm migration 0076 is generic and the rebuild tool owns project-specific cleanup.
- [x] Confirm the reconstructed database is the migrated generation-60 backup, not a fresh database.
- [x] Confirm `index.ts` files remain thin and no broad dispatcher or catch-all helper was added.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [x] Only then mark Plan 0174 complete.
