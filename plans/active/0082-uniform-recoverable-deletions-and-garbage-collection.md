# Uniform Recoverable Deletions And Garbage Collection

Date: 2026-06-19

Status: proposed

## Purpose

Make every user-facing and agent-facing deletion in Renku Studio recoverable by
default.

Today the codebase uses the word "delete" for several different operations:

- hiding or removing a user-visible project item;
- removing durable SQLite metadata;
- removing project media files from disk;
- clearing a selection or active pointer;
- pruning generated export files;
- cleaning temporary runtime files.

Those operations do not have the same safety profile. A user or AI agent should
be able to discard the wrong take, asset, Lookbook image, Inspiration folder,
voice sample, or dialogue audio take and then restore it without losing bytes or
metadata. Permanent removal must be an explicit garbage-collection operation,
with its own preview, structured diagnostics, and irreversible confirmation.

This plan defines the architecture for that behavior. It does not implement the
schema or command changes yet.

## Current Truth Audit

The user-stated rule is partly true as product direction, but not true in the
current implementation.

### Already Mostly True

Media generation specs and generation runs are retained by default.

- `media_generation_spec` and `media_generation_run` have insert/update/read
  accessors and no ordinary delete command.
- Generated output files remain filesystem content until an explicit import
  attaches them as assets.
- This matches `docs/architecture/data-model-and-storage.md`, which says media
  generation specs and runs are SQLite-owned records and generated output files
  are imported separately.

Screenplay and shot-list history already have recovery-oriented concepts.

- Screenplay revisions support restore workflows.
- Scene Shot Lists are history rows with an active pointer, not a single
  mutable list that must be overwritten.
- Plan 0051 explicitly says temporary storyboard sheet output files should be
  left for future garbage collection.

Production export pruning is already explicit.

- Production export can prune stale production handoff files.
- This is an export-tree cleanup operation, not deletion of source project
  working assets.

### Not True Today

Several user-visible deletion paths are irreversible today.

`deleteAsset` removes files and metadata immediately.

- `packages/core/src/server/commands/delete-asset.ts` calls `fs.rm` for asset
  files.
- The same command then deletes asset relationship rows, domain sidecar rows,
  `asset_file` rows, and the `asset` row.
- A wrong agent call can permanently lose project media.

Visual Language Inspiration deletion removes filesystem content immediately.

- `deleteInspirationFolder` calls `fs.rm(..., { recursive: true, force: true })`
  and then deletes the folder row.
- `deleteInspirationImage` calls `fs.rm` on the image path.
- Inspiration images are intentionally not per-image assets, so there is no
  durable row that can be restored after the file is removed.

Lookbook deletion removes files and rows immediately.

- `deleteLookbook`, `deleteLookbookImage`, and `deleteLookbookSheet` remove
  Lookbook asset files with `fs.rm`.
- They then delete Lookbook image/sheet rows, `asset_file` rows, and `asset`
  rows.

Cast Voice removal removes the sample asset immediately.

- `removeCastVoice` deletes the sample asset files.
- It then deletes provider registrations, the Cast Voice row, the asset
  relationship row, `asset_file` rows, and the `asset` row.

Scene Dialogue Audio take deletion removes the take row immediately.

- `deleteSceneDialogueAudioTakeRecord` deletes from
  `scene_dialogue_audio_take`.
- The audio file and asset metadata are not cleaned up in that path, so the
  current behavior is neither fully recoverable nor fully garbage-collected. It
  leaves orphaned metadata/files instead of a deliberate trash entry.

Shot Video Take media input deletion removes files and metadata immediately.

- `deleteShotVideoTakeInput` calls `deleteProjectRelativeFile`.
- `deleteShotVideoTakeInputRecord` then deletes the media-input row,
  `asset_file` rows, and the `asset` row.

Scene Shot Video Take deletion deletes database rows immediately.

- `deleteSceneShotVideoTakeRecord` deletes the take row.
- It also deletes take-owned `asset_file` and `asset` rows for media inputs and
  outputs.
- It currently does not remove files, which creates orphaned files, but adding
  immediate file removal would violate the recoverability policy.

Some replacement paths hard-delete durable rows.

- `replaceCastMemberAuthoringRecords` deletes Cast Members not present in the
  incoming authoring set.
- `replaceLocationAuthoringRecords` deletes Locations not present in the
  incoming authoring set.
- `replaceScreenplayDocument` deletes screenplay tables before inserting the
  next document.
- These paths may be acceptable only when protected by revision history and
  dependency checks. They still need explicit audit under the same recoverable
  deletion policy.

### Current Gaps

The project has no uniform trash/discard model.

- There is no shared `discarded_at` lifecycle state.
- There is no trash ledger.
- There is no uniform restore command.
- There is no generic garbage-collection preview.
- There is no architectural test that prevents new user-facing delete commands
  from calling `fs.rm`, `fs.unlink`, or Drizzle `.delete()`.

The result is inconsistent:

- some commands permanently delete files;
- some commands delete metadata but leave files;
- some historical models retain enough data for restore;
- some operations are reversible only because a separate revision system exists;
- Studio and CLI user actions share the same risk as agent commands because
  they call the same core operations.

## Product Rule

User-facing and agent-facing deletion must mean:

> Move the item out of the active working set, preserve all metadata and bytes,
> and return enough information for immediate undo.

Emptying Trash must mean:

> Run an explicit empty-trash command that previews eligible discarded items,
> requires confirmation, writes a recoverable trash package, moves files into
> that package in a dependency-safe order, and cannot be triggered accidentally
> by ordinary delete/discard flows.

## Vocabulary

Use these names consistently in code, contracts, CLI, plans, and docs.

**Discard**

The reversible operation that removes an item from normal project views without
deleting its metadata or project files. This is the default behavior behind UI
trash buttons and agent "delete" requests.

**Restore**

The reversible operation that returns a discarded item to active project views.
Restore must be core-owned and domain-aware.

**Trash**

The area that lists discarded items. Marking an item discarded does not move its
files; ordinary views hide discarded content through lifecycle state and the
trash ledger.

**Garbage Collection**

The explicit final trash operation that stages discarded files and metadata into
a self-contained trash package after preview and confirmation. It is the first
operation allowed to move discarded files out of their original locations.

**Garbage-Collected**

The final lifecycle state for a trash item whose files and metadata have been
staged into an emptied-trash package and removed from ordinary active views.

Avoid using "soft delete" in public contracts. It is an implementation pattern,
not the product vocabulary.

## Architecture Decision

Add one core-owned trash lifecycle service that handles discard, restore,
trash listing, empty-trash preview, and empty-trash execution for every
discardable object kind.

Adapters must stay thin:

- Studio server routes parse HTTP input, call core discard/restore/garbage
  collection commands, and serialize reports.
- CLI handlers parse flags, call the same core commands, and print reports.
- React components send user intent to Studio server routes; they do not decide
  ownership, dependencies, or purge eligibility.
- Agent workflows receive the same core reports as users and cannot bypass the
  trash lifecycle.

Do not add a generic state patch API. The single lifecycle service must operate
through a closed typed registry of discardable object definitions. Each
definition supplies object-specific policy and metadata; it must not duplicate
the discard, restore, listing, preview, staging, manifest, transaction, or
reporting mechanics.

### Single Lifecycle Service

All discardable object kinds must go through one implementation path in
`packages/core/src/server/trash/`.

Proposed files:

- `trash-lifecycle-service.ts`
  Owns the generic discard, restore, trash-list, empty-trash preview, and
  empty-trash run algorithms.
- `trash-object-registry.ts`
  Exports the closed typed registry of supported discardable object kinds.
- `trash-object-definition.ts`
  Defines the object definition contract.
- `trash-manifest.ts`
  Writes the empty-trash package manifest.
- `trash-file-staging.ts`
  Moves files into `.renku/trash/emptied/<operation-id>/files/` only during
  `emptyTrash`.

Domain modules must not implement their own discard/restore/empty-trash loops.
They may only register object definitions with the central registry.

The central lifecycle service owns all repeated mechanics:

- creating `trash_operation` rows;
- creating `trash_item` rows;
- marking lifecycle columns;
- clearing lifecycle columns on restore;
- listing discarded items;
- applying active/default trash filters;
- opening and committing the transaction;
- producing recovery report shapes;
- producing structured restore and empty-trash diagnostics;
- generating confirmation tokens for empty-trash preview/run;
- writing empty-trash manifests;
- moving files during `emptyTrash`;
- finalizing garbage-collected state.

Object definitions own only object-specific facts and policy:

- item kind and owner kind;
- how to read the object by id;
- which lifecycle rows belong to the object;
- which child objects must be discarded with the parent;
- which active references block discard or empty-trash;
- which restore conflicts can occur;
- which side effects are required, such as clearing a picked take or active
  Lookbook pointer;
- which files belong in the empty-trash package;
- which resource keys are affected.

The object definition contract should be typed enough that a definition cannot
issue arbitrary SQL or mutate arbitrary durable state. When a domain needs a
side effect, it should expose a named operation such as
`clearPickedSceneDialogueAudioTakeForDiscard` or
`clearActiveLookbookForDiscard`, and the lifecycle service should call it as a
registered side-effect step. Do not pass raw SQL callbacks, table names from
callers, JSON patch paths, or generic state update functions.

## Schema Direction

Use Drizzle schema as the source of truth and generate migrations with Drizzle
Kit, following `docs/architecture/reference/drizzle-migrations.md`.

The implementation will likely require a new project schema generation because
current read and write paths must filter lifecycle state.

### Lifecycle Columns

Add nullable lifecycle columns to every durable user-visible table that can be
discarded directly:

```text
discarded_at text null
discard_operation_id text null
restored_at text null
```

Use `discarded_at is null` as the active-row predicate. Use
`discarded_at is not null and restored_at is null` as the in-trash predicate.

Candidate tables:

- `asset`
- `asset_file` only if individual files become discardable independently
- `project_asset`
- `cast_asset`
- `location_asset`
- `sequence_asset`
- `scene_asset`
- `cast_voice`
- `cast_voice_provider_registration` if registrations are hidden/restored with
  voices rather than only by parent voice state
- `inspiration_folder`
- `lookbook`
- `lookbook_inspiration`
- `lookbook_image`
- `lookbook_image_section`
- `lookbook_sheet`
- `lookbook_card_image`
- `scene_dialogue_audio_take`
- `scene_shot_storyboard_image`
- `scene_shot_video_take`
- `scene_shot_video_take_shot`
- `scene_shot_video_take_media_input`
- `scene_shot_video_take_media_input_shot`
- `scene_shot_video_take_output`
- `scene_shot_video_take_output_shot`

Do not add lifecycle columns to pure current-state pointer tables unless the row
itself is a recoverable user artifact. For example, clearing active Lookbook
selection is a state update, while discarding the Lookbook is recoverable
content lifecycle.

### Trash Operation Tables

Add a trash ledger:

```text
trash_operation
  id
  command_name
  actor_kind
  actor_label
  reason
  created_at
  restored_at
  garbage_collected_at

trash_item
  id
  operation_id
  item_kind
  item_id
  owner_kind
  owner_id
  title
  original_project_relative_path
  trash_project_relative_path
  restore_snapshot_json
  created_at
  restored_at
  garbage_collected_at
```

`trash_operation` represents one user or agent action.

`trash_item` represents each recoverable item affected by that action.
For example, discarding a Lookbook can create one operation with child trash
items for the Lookbook, its images, its sheets, and affected asset rows.

`restore_snapshot_json` must be validated by item-kind-specific schemas. It is
not an arbitrary data patch format. It records only the domain state needed to
undo side effects that cannot be derived from preserved rows, such as:

- which Lookbook was active before discard;
- which image was the Lookbook card image;
- which take media input was selected before replacement promotion;
- which scene dialogue audio take was picked before promotion;
- original Inspiration image path when the file has no asset row.

### Unique Indexes

Existing unique indexes need to be audited and converted to active-only partial
unique indexes where discarded rows should not block new active rows.

Examples:

- Cast Voice name uniqueness should apply to active voices.
- selected take media input uniqueness should exclude discarded inputs.
- selected take output uniqueness should exclude discarded outputs.
- Lookbook source inspiration ordering should apply to active relationships.

Restore must fail with a structured conflict diagnostic when restoring would
violate an active-only uniqueness rule.

Do not silently rename restored items or guess a new path.

## File Retention Strategy

Never call `fs.rm`, `fs.unlink`, `fs.rename`, or any file-move operation from
an ordinary discard command for user-visible content.

DB-backed assets:

- keep files at their existing `asset_file.project_relative_path`;
- mark the owning rows discarded;
- hide discarded rows from normal reads;
- restore by clearing lifecycle fields and restoring recorded side effects.

Filesystem-only Inspiration images:

- keep the file at its original folder path during discard;
- create a `trash_item` with the original project-relative path;
- hide the file from default Inspiration folder image reads by consulting the
  trash ledger;
- restore by clearing the trash item lifecycle, without moving bytes;
- if the file is missing or changed at restore time, report a structured
  restore diagnostic instead of guessing.

Filesystem-only Inspiration folders:

- mark the `inspiration_folder` row discarded and hide it from normal reads;
- keep folder bytes in place while discarded;
- `emptyTrash` can later move the folder content into a trash package.

Temporary runtime files:

- files under `.renku/tmp`;
- transient voice conversion cache entries;
- Studio runtime descriptors;
- failed-write cleanup before a durable row exists;

may continue to be removed immediately because they are not user-visible project
content and cannot be restored as project artifacts.

Production export files:

- production export pruning remains explicit and separate from Trash;
- it does not remove source working assets;
- it should stay named as production export pruning, not project garbage
  collection.

## Command Contracts

Replace public core delete commands for durable project content with discard
commands.

These commands are thin typed entrypoints. They must normalize input, resolve
the correct object kind, and call the central trash lifecycle service. They must
not each implement their own trash row creation, lifecycle updates, restore
logic, empty-trash file staging, or manifest writing.

The exact TypeScript names should be:

```ts
discardAsset(input): Promise<RecoverableMutationReport>
restoreAsset(input): Promise<RecoverableMutationReport>

discardCastVoice(input): Promise<RecoverableMutationReport>
restoreCastVoice(input): Promise<RecoverableMutationReport>

discardInspirationFolder(input): Promise<RecoverableMutationReport>
restoreInspirationFolder(input): Promise<RecoverableMutationReport>

discardInspirationImage(input): Promise<RecoverableMutationReport>
restoreInspirationImage(input): Promise<RecoverableMutationReport>

discardLookbook(input): Promise<RecoverableMutationReport>
restoreLookbook(input): Promise<RecoverableMutationReport>

discardLookbookImage(input): Promise<RecoverableMutationReport>
restoreLookbookImage(input): Promise<RecoverableMutationReport>

discardLookbookSheet(input): Promise<RecoverableMutationReport>
restoreLookbookSheet(input): Promise<RecoverableMutationReport>

discardSceneDialogueAudioTake(input): Promise<RecoverableMutationReport>
restoreSceneDialogueAudioTake(input): Promise<RecoverableMutationReport>

discardSceneShotVideoTake(input): Promise<RecoverableMutationReport>
restoreSceneShotVideoTake(input): Promise<RecoverableMutationReport>

discardShotVideoTakeInput(input): Promise<RecoverableMutationReport>
restoreShotVideoTakeInput(input): Promise<RecoverableMutationReport>
```

Add trash commands:

```ts
listTrash(input): Promise<TrashListReport>
readTrashItem(input): Promise<TrashItemReport>
restoreTrashItem(input): Promise<RecoverableMutationReport>
emptyTrash(input): Promise<GarbageCollectionReport>
previewGarbageCollection(input): Promise<GarbageCollectionPreview>
```

`restoreTrashItem` must dispatch only through the central typed object registry.
It must not accept table names, SQL snippets, raw JSON patches, or generic
object paths.

`emptyTrash` must require a confirmation token from
`previewGarbageCollection`. It must support dry-run mode.

### Report Shape

All discard reports should include enough data for agents and Studio to offer
undo:

```ts
interface RecoverableMutationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: { id: string; name: string; projectFolder?: string };
  changes: DomainChange[];
  recovery: {
    operationId: string;
    trashItemIds: string[];
    restorable: boolean;
    restoreCommand: {
      name: 'trash.restore';
      trashItemId: string;
    };
  };
  resourceKeys: string[];
}
```

The exact `DomainChange` values should remain domain-specific. Do not collapse
all changes into a generic "deleted" event.

## Read Model Rules

Default reads must exclude discarded content.

Examples:

- `listAssetRelationships` should not return discarded relationship rows or
  assets.
- `listSceneShotVideoTakesForScene` should not return discarded takes.
- take production contexts should not return discarded media inputs or outputs.
- Lookbook lists should not include discarded Lookbooks.
- Inspiration folder lists should not include discarded folders.
- Inspiration folder image listings should not include filesystem-only images
  that have active trash items.

Trash reads are the only normal reads that include discarded content.

Domain read commands may support an explicit `includeDiscarded` option only
when the caller is a core-owned trash or restore workflow. Do not expose broad
include-discarded flags to Studio feature code as a shortcut.

## Domain Behavior

### Asset Relationships

Discarding an asset from a Cast Member, Location, Sequence, Scene, or Project
should mark only that relationship discarded.

If the asset has no remaining active owners and no active domain owner rows, the
asset itself should also be marked discarded. Its files remain on disk.

If an asset is still active elsewhere, do not mark the asset discarded.

Shared references must never be discarded as a side effect of discarding a take.

### Scene Shot Video Takes

Discarding a Scene Shot Video Take should:

- mark the take discarded;
- preserve take state, history snapshot, shot membership, media input rows,
  output rows, asset rows, asset file rows, and media files;
- clear picked state if the discarded take was picked;
- create trash items for the take and take-owned generated artifacts;
- leave shared dependency references untouched.

Restoring the take should:

- restore the take row;
- restore its take-owned media input/output visibility;
- restore picked state only when the recorded snapshot says it was picked and
  no conflicting active picked take exists;
- fail with a structured conflict if restoring would violate an active unique
  rule.

The current review issue about orphaned take media files should be handled by
this model: delete/discard does not remove files or metadata, and only
`emptyTrash` stages discarded take-owned artifacts into the trash package.

### Shot Video Take Inputs

Discarding one take media input should:

- mark the input discarded;
- preserve its asset and file;
- record whether it was selected;
- promote or clear current selection according to current product rules;
- record enough restore state to undo the selection change.

Restoring should:

- clear the input discard lifecycle;
- restore selection only if no active conflict exists;
- otherwise restore the input as an unselected take and report the conflict.

### Scene Dialogue Audio Takes

Discarding a dialogue audio take should:

- mark `scene_dialogue_audio_take` discarded;
- preserve its asset row and audio file;
- promote a replacement picked take only through core-owned rules;
- record the previous picked take for undo.

`emptyTrash` later stages discarded audio take rows, asset rows, and files into
the trash package together.


### Lookbooks

Discarding a Lookbook should:

- mark the Lookbook discarded;
- preserve Lookbook sections, source Inspiration relationships, image
  placement, sheets, card image, asset rows, and files;
- clear active Lookbook state if needed;
- record enough state to restore active selection.

Discarding one Lookbook image or sheet should:

- mark only that image/sheet discarded;
- preserve section/default/card placement state for restore;
- preserve asset rows and files;
- update active Lookbook projections to hide the discarded item.

### Inspiration

Discarding an Inspiration folder should:

- mark the folder discarded;
- preserve analysis rows and folder files;
- hide the folder from default folder lists.

Discarding an Inspiration image should:

- create a trash item because the image has no per-image asset row;
- keep the file in place during discard;
- hide it from default folder image listings by filtering paths that have active
  trash items.

### Cast Voices

Discarding a Cast Voice should:

- mark the Cast Voice discarded;
- hide provider registrations through parent lifecycle or their own lifecycle;
- preserve sample asset rows and sample files;
- keep generic asset deletion/discard from bypassing Cast Voice ownership.

### Cast, Location, And Screenplay Replacement

Replacement-style authoring commands must be audited separately from ordinary
discard actions.

The rule should be:

- if a command represents a user/agent request to remove a durable item, it must
  discard, not hard-delete;
- if a command rewrites projection tables from a current document and durable
  undo is provided by a revision system, the plan must document that guarantee
  and add tests proving restore remains possible;
- if a replacement command deletes rows that own assets, references, or child
  domain records without a revision-safe recovery path, change it to lifecycle
  discard.

## Garbage Collection

Garbage collection, through `emptyTrash`, is the only path that moves discarded
content out of normal folders and removes it from active metadata tables.

It must be a core command with these properties:

- disabled by default in ordinary delete/discard flows;
- preview first;
- returns a confirmation token bound to the preview inputs;
- supports dry-run;
- reports every file and row that would be staged into the trash package;
- refuses to collect active or restored items;
- refuses to collect discarded items that still have active references;
- writes a manifest with enough metadata to inspect what was emptied;
- moves files into `.renku/trash/emptied/<operation-id>/files/` in a
  dependency-safe order;
- removes or finalizes active metadata only after the trash package is written;
- records garbage-collected state in the trash ledger;
- reports structured diagnostics for missing files, path escapes, conflicts, and
  partial failures.

Initial CLI:

```bash
renku trash list --json
renku trash restore --trash-item <trash-item-id> --json
renku trash empty preview --older-than 30d --json
renku trash empty run --confirmation-token <token> --json
```

Studio should expose trash listing and undo before exposing empty-trash.

Agents should never call garbage collection unless the user explicitly asks for
emptying Trash.

## Studio Behavior

Studio UI should continue to use familiar trash affordances, but visible copy
must be accurate:

- "Move to Trash" for ordinary destructive-looking actions.
- "Undo" from the mutation toast when the report includes recovery data.
- "Restore" in the Trash view.
- "Empty Trash" only for the explicit garbage-collection workflow.

Feature components must use local shadcn UI controls from `packages/studio/src/ui`.

No React component may decide whether a dependency is shared or owned. That
logic belongs in core.

## Agent Safety

All agent-facing mutation reports must make recovery explicit.

When an agent discards something, the JSON report should include:

- the trash operation id;
- the trash item ids;
- the restore command;
- whether restore is currently conflict-free;
- resource keys that changed.

AI agent tools and skills should be updated to say:

- ordinary "delete" requests call discard commands;
- recovery is available through trash restore;
- emptying Trash requires explicit user wording; ordinary delete requests only
  discard.

## Architecture Tests

Add tests that prevent regression.

Static architecture tests should fail if user-facing discard command modules
call:

- `fs.rm`;
- `fs.unlink`;
- `fs.rename`;
- Drizzle `.delete()`;
- generic SQL delete helpers.

Allowlist only:

- the named central trash lifecycle, manifest, and file-staging modules;
- production export pruning modules;
- runtime descriptor cleanup;
- temporary file cleanup before durable metadata exists;
- database state-row replacement where the row is not user content and the
  replacement is not a deletion.

Add command-contract tests proving Studio server and CLI use core discard
commands, not route-local delete logic.

Add a centralization architecture test proving only the named central trash
modules contain the generic lifecycle mechanics. Domain modules may register
object definitions, but must not create `trash_operation` rows, create
`trash_item` rows, write empty-trash manifests, move files, or implement their
own restore dispatch loops.

## Implementation Slices

### Slice 1: Audit And Guardrails

- Create a deletion inventory test or script that lists current hard-delete
  paths.
- Add architecture tests that prevent new user-facing hard deletes.
- Add documentation that classifies immediate cleanup exemptions.

### Slice 2: Trash Schema And Core Service

- Add lifecycle columns and trash ledger tables.
- Generate migrations with Drizzle Kit.
- Add typed trash item schemas.
- Add the central `trash-lifecycle-service.ts`.
- Add the closed `trash-object-registry.ts`.
- Add typed object definitions for the first supported discardable kinds.
- Route discard, restore, list, preview, and empty-trash commands through the
  central lifecycle service.

### Slice 3: Asset And File Retention

- Replace `deleteAsset` with `discardAsset` and `restoreAsset`.
- Preserve asset files during discard.
- Add empty-trash staging for discarded asset rows and files.
- Update asset list/read projections to hide discarded rows.

### Slice 4: Visual Language

- Convert Inspiration folder/image deletion to discard/restore.
- Convert Lookbook, Lookbook image, and Lookbook sheet deletion to
  discard/restore.
- Add filesystem-only Inspiration image trash-ledger filtering without moving
  files during discard.

### Slice 5: Audio And Take Media

- Convert Cast Voice removal to discard/restore.
- Convert Scene Dialogue Audio take deletion to discard/restore.
- Convert Shot Video Take input deletion to discard/restore.
- Convert Scene Shot Video Take deletion to discard/restore.
- Ensure take-owned generated artifacts are garbage-collected only through the
  explicit empty-trash command.

### Slice 6: Replacement Commands

- Audit Cast Member, Location, Screenplay, and Scene Shot List replacement
  flows.
- Decide which rows are revision-backed projections and which are recoverable
  user content.
- Convert unsafe replacement deletes to lifecycle discard.

### Slice 7: Studio, CLI, And Agent Surfaces

- Rename Studio services from delete to discard where they call core durable
  project mutations.
- Add Trash list and restore routes.
- Add CLI trash list/restore/empty commands.
- Update skills and agent instructions that currently mention delete for these
  surfaces.

### Slice 8: Garbage Collection

- Add preview and run commands.
- Add confirmation-token generation.
- Add dependency-safe empty-trash staging order.
- Add trash package manifests under `.renku/trash/emptied/<operation-id>/`.
- Add file moves only inside the `emptyTrash` module; do not delete bytes
  directly.
- Add tests for shared references, active references, path safety, missing files,
  package manifests, and dry-run output.

## Open Questions

1. Should any discarded files move during discard?

   Proposed answer: no. All discarded files stay in their original locations
   until `emptyTrash`. Default reads hide discarded content through lifecycle
   state and trash-ledger path filtering. `emptyTrash` is responsible for moving
   eligible files into a self-contained trash package that the user can move to
   the operating system Trash as a second safety layer.

2. Should restore reselect previously selected items automatically?

   Proposed answer: yes when conflict-free, no when another active item now
   owns the unique selected slot. On conflict, restore the item as an unselected
   take/candidate and report a structured warning.

3. Should empty-trash have a default age threshold?

   Proposed answer: yes for UI affordances, no for core. Core requires explicit
   inputs. Studio can default the empty-trash preview to items older than 30
   days only after Trash UI exists.

4. Should the HTTP routes keep `DELETE` verbs?

   Proposed answer: route verbs can remain RESTful if the route response and
   core command clearly say discard/trash. TypeScript service names and core
   command names should use `discard*` to prevent architecture drift.

## Completion Checklist

### Review And Architecture

- [x] Confirm this plan is accepted as the uniform deletion architecture.
- [x] Confirm "discard", "restore", "trash", and "garbage collection" are the
      chosen domain terms.
- [x] Confirm ordinary user and agent delete requests must map to discard.
- [x] Confirm file movement out of original locations is allowed only through
      explicit empty-trash finalization.
- [x] Confirm all discardable object kinds go through the same core trash
      lifecycle service.
- [x] Confirm object-specific code is limited to typed object definitions,
      validation, and named side-effect steps.
- [x] Confirm Studio server, CLI, React, and agent code must not own deletion
      business rules.
- [x] Confirm no generic patch/write-anything trash API will be introduced.
- [x] Confirm filesystem-only Inspiration image handling is part of the first
      trash implementation.

### Current Behavior Audit

- [x] Inventory every `fs.rm`, `fs.unlink`, and Drizzle `.delete()` path in
      `packages/core`.
- [x] Classify each path as user-content discard, garbage collection,
      production export pruning, runtime cleanup, temporary failed-write
      cleanup, or projection replacement.
- [x] Document which current paths are allowed to remain immediate cleanup.
- [x] Add a failing architecture test for user-facing discard modules that call
      immediate file deletion.
- [x] Add a failing architecture test for user-facing discard modules that call
      hard DB delete helpers.

### Schema And Migrations

- [x] Add lifecycle columns to accepted discardable tables.
- [x] Add `trash_operation`.
- [x] Add `trash_item`.
- [x] Add validated item-kind-specific restore snapshot schemas.
- [x] Convert affected unique indexes to active-only partial unique indexes.
- [x] Generate migrations with Drizzle Kit from `packages/core`.
- [x] Decide whether the schema generation constant must be incremented.
- [x] Apply migrations to development projects through the documented project
      migration command.

### Core Trash Service

- [x] Add `packages/core/src/server/trash/trash-lifecycle-service.ts` as the
      single implementation path for discard, restore, list, preview, and
      empty-trash run.
- [x] Add `packages/core/src/server/trash/trash-object-registry.ts` as the
      closed typed registry for discardable object kinds.
- [x] Add `packages/core/src/server/trash/trash-object-definition.ts` for the
      object definition contract.
- [x] Add `packages/core/src/server/trash/trash-manifest.ts` for empty-trash
      package manifests.
- [x] Add `packages/core/src/server/trash/trash-file-staging.ts` for file moves
      that are allowed only during `emptyTrash`.
- [x] Add core types for trash operations, trash items, discard reports,
      restore reports, garbage-collection previews, and garbage-collection
      reports.
- [x] Add a typed registry of current trash item kinds.
- [x] Ensure domain modules register object definitions instead of implementing
      their own discard, restore, trash-list, preview, empty-trash, or manifest
      loops.
- [x] Add helpers to read active, discarded, restored, and garbage-collected
      trash items.
- [x] Add structured diagnostics for restore conflicts.
- [x] Add structured diagnostics for garbage-collection blockers.
- [x] Add resource-key helpers for trash list and item updates.

### Asset And Relationship Implementation

- [x] Replace `deleteAsset` with `discardAsset`.
- [x] Add `restoreAsset`.
- [x] Preserve asset files during discard.
- [x] Mark asset relationships discarded instead of deleting them.
- [x] Mark asset rows discarded only when no active owner remains.
- [x] Hide discarded assets and relationships from default asset reads.
- [x] Keep generic asset discard from bypassing Cast Voice, Lookbook, Scene
      Dialogue Audio, Storyboard, or Take ownership rules.

### Visual Language Implementation

- [x] Convert Inspiration folder delete to discard.
- [x] Convert Inspiration folder restore.
- [x] Convert Inspiration image delete to filesystem-only trash discard.
- [x] Convert Inspiration image restore.
- [x] Convert Lookbook delete to discard.
- [x] Convert Lookbook restore.
- [x] Convert Lookbook image delete to discard.
- [x] Convert Lookbook image restore.
- [x] Convert Lookbook sheet delete to discard.
- [x] Convert Lookbook sheet restore.
- [x] Preserve Lookbook asset rows and files until garbage collection.
- [x] Hide discarded Lookbook content from default reads.

### Voice, Dialogue, And Take Implementation

- [x] Convert Cast Voice removal to discard.
- [x] Convert Cast Voice restore.
- [x] Convert Scene Dialogue Audio take delete to discard.
- [x] Convert Scene Dialogue Audio take restore.
- [x] Convert Shot Video Take input delete to discard.
- [x] Convert Shot Video Take input restore.
- [x] Convert Scene Shot Video Take delete to discard.
- [x] Convert Scene Shot Video Take restore.
- [x] Preserve take-owned generated assets and files until empty-trash.
- [x] Keep shared dependency references untouched when discarding takes.
- [x] Add tests for selected/picked replacement and restore conflicts.

### Replacement Flow Audit

- [x] Audit Cast Member authoring replacement deletes.
- [x] Audit Location authoring replacement deletes.
- [x] Audit Screenplay document replacement deletes.
- [x] Audit Scene Shot List active/history behavior.
- [x] Document which replacement flows are safely revision-backed.
- [x] Convert any unsafe replacement hard delete to discard lifecycle state.

### Garbage Collection

- [x] Add `previewGarbageCollection`.
- [x] Add confirmation-token generation.
- [x] Add `emptyTrash`.
- [x] Add dry-run output.
- [x] Add file moves only inside the `emptyTrash` module; do not delete bytes
      directly.
- [x] Add dependency-safe staging order.
- [x] Add tests that active references block garbage collection.
- [x] Add tests that shared assets are not collected while any active owner
      remains.
- [x] Add tests for missing file diagnostics.
- [x] Add tests for path escape diagnostics.
- [x] Add tests for trash package manifest contents.
- [x] Add tests for partial failure reporting.

### Studio Surface

- [x] Rename durable project service calls from delete to discard where
      appropriate.
- [x] Update Studio server routes to call core discard commands.
- [x] Return recovery data from mutation routes.
- [x] Add undo toast handling for recoverable mutation reports.
- [x] Add a Trash view or panel for listing and restoring discarded items.
- [x] Add Empty Trash UI only after preview/run empty-trash support exists.
- [x] Use local shadcn UI controls for all new controls.
- [x] Keep React code free of ownership/dependency deletion rules.

### CLI And Agent Surface

- [x] Rename CLI durable project deletion commands to discard/move-to-trash
      language.
- [x] Add `renku trash list --json`.
- [x] Add `renku trash restore --trash-item <id> --json`.
- [x] Add `renku trash empty preview --json`.
- [x] Add `renku trash empty run --confirmation-token <token> --json`.
- [x] Ensure discard command JSON reports include restore command details.
- [x] Update agent-facing skills and docs to use discard and restore.
- [x] Document that agents must not empty Trash without explicit
      user instruction.

### Verification

- [x] Run focused core tests for assets, visual language, cast voices, dialogue
      audio, and shot-video takes.
- [x] Run Studio server route tests for discard and restore endpoints.
- [x] Run CLI tests for discard, restore, and garbage collection.
- [x] Run architecture tests.
- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --dir packages/studio test` for affected Studio surfaces.
- [x] Run root `pnpm check` before calling the implementation complete.
