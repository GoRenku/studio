# 0158 Correct Shot Image Ownership, Selection, And Copy

Status: proposed
Date: 2026-07-26

## Summary

Correct the Shot image model introduced by plan 0156 without discarding the
valid Shot Plan authoring work from that plan.

The corrected model is deliberately small:

- a Shot owns zero or more `shot_image` rows;
- each `shot_image` owns exactly one ordinary Asset;
- an Asset used by a Shot image cannot be shared with another Shot image;
- `selected` is a boolean on `shot_image`, with at most one selected image per
  Shot;
- `shot_image` has timestamps but no title, role, reference name, purpose,
  locale, manual order, discard lifecycle, or separate relationship id;
- copying a Shot Plan copies the selected Shot image into a new Asset, new Asset
  Files, and new project files instead of relating the copied Shot to the
  original Asset;
- generation and import continue to use the common generation, Asset,
  AssetFile, provenance, project-file, Trash, and Studio coordination services;
- agent workflows use coarse commands where one operation is one user intent,
  while preserving the existing preview, approval, execution, inspection, and
  acceptance boundaries.

This plan supersedes only the Shot image storage, selection terminology, copy
semantics, and related lifecycle/skill guidance in
`plans/active/0156-shot-plan-authoring-cli-and-agent-skills.md`. The remaining
Shot Plan authoring, validation, generation-spec, CLI, and skill work from plan
0156 stays in scope and must not be rolled back.

Plan 0157 depends on the contracts defined here. Its Shot image terminology and
projections must be corrected before its Studio UI implementation begins.

## Requirement Ledger

| Requirement | Source | Planned result |
| --- | --- | --- |
| A Shot may contain multiple images. | User correction | `Shot.images: ShotImage[]` backed by one-to-many `shot_image` rows |
| A Shot image is not shared across Shots. | User correction | `shot_image.asset_id` is the primary key, so one Asset can belong to at most one Shot image |
| Copy means an independent copy. | User correction | New Asset id, AssetFile ids, destination paths, and file bytes for the copied selected image |
| Deleting the original must not delete the copy, and deleting the copy must not delete the original. | User correction | Independent Asset trees and owner-local Trash lifecycle |
| Use `selected`, not `representative`. | User correction | `shot_image.selected`, `ShotImage.selected`, `selectShotImage`, and `clearShotImageSelection` |
| Do not bypass the Shot image collection with a separate selected-image relation. | User correction | No `shot_representative_display_asset` table and no duplicate selected-image field on `Shot` |
| Keep timestamps. | User correction | `created_at` and `updated_at` on `shot_image` |
| A Shot image has no title. | User correction | No title column or top-level `ShotImage.title`; display metadata stays on `ShotImage.asset.title` |
| Keep Asset/file naming consistent. | User correction plus existing contracts | `ShotImage.asset` uses the shared `AssetInfo` contract, whose file collection remains the existing canonical `files` |
| Do not add unspecified generic relationship metadata. | User correction | No role, reference name, purpose, locale, sort order, relationship id, or discard columns on `shot_image` |
| Do not blindly remove common Asset behavior. | User correction plus architecture rules | Keep common generation targets, Asset and AssetFile persistence, provenance, file allocation, Trash primitives, diagnostics, and resource events |
| Follow existing media patterns instead of inventing a complete one-off stack. | User correction | Reuse the existing Lookbook-style owned-membership extension point and existing Cast/Location selection commands where their semantics match |
| Explain how multiple Cast profile and Location hero images work. | User question | Preserve their established candidate relationships plus one selected display Asset; add explicit import-and-select support without changing their schema |
| Avoid fragile agent workflows made of unnecessary CLI calls. | User correction | Add explicit `media import --select`; use one aggregate Shot Plan create document; keep focused edit commands only for later deltas |
| Do not collapse meaningful safety steps. | Existing media workflow | Keep save/preview, approval, estimate, execution approval, run, inspect, output acceptance, and import as distinct steps |
| There is no existing data to convert. | User correction | Replace the uncommitted generated 0066 schema migration; do not add a follow-up conversion, backfill, compatibility reader, or migration diagnostic |
| Keep the solution small. | User correction | One purpose-specific child table and focused Core modules; no universal ownership graph, copy framework, or new reference system |

## Product Behavior

### Shot Image Collection

A Shot has a collection of images. The collection is homogeneous: every member
means “an image owned by this Shot.” That is why a generic relationship role is
not needed.

The collection is not manually reorderable. Reads use `created_at, asset_id` for
deterministic output only; that read order does not create a durable editorial
order and does not justify a `sort_order` column.

The public Shot contract exposes the collection once:

```ts
export interface Shot {
  id: string;
  position: number;
  title: string;
  description: string;
  brief: ShotBrief;
  images: ShotImage[];
}

export interface ShotImage {
  asset: AssetInfo;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
}
```

There is no `representativeImage`, `selectedImage`, or other mirror on `Shot`.
Callers derive the selected image with
`shot.images.find((image) => image.selected)`.

`ShotImage` itself has no title and no file collection. The nested ordinary
Asset owns descriptive metadata and its Asset Files:

```ts
export interface AssetInfo {
  assetId: string;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  availability: AssetAvailability;
  files: AssetFile[];
  createdAt: string;
  updatedAt: string;
}
```

`AssetInfo` is not a new persistence model. It extracts the existing common
Asset fields already repeated by Lookbook image and sheet projections. The
existing relationship-enriched `Asset` contract composes `AssetInfo` with its
relationship fields. `LookbookImage.asset`, `LookbookSheet.asset`, and
`ShotImage.asset` use `AssetInfo`; the duplicated `LookbookImageAsset`,
`LookbookSheetAsset`, and duplicate AssetFile shapes are removed and their
callers updated directly.

This keeps the public shape consistent without redesigning all existing generic
Asset relationship responses.

### Selection

Selection is explicit:

- a Shot may have no selected image;
- a Shot may have exactly one selected image;
- importing or generating an image without explicit selection leaves it
  unselected;
- selecting an image clears the previous selection and selects the requested
  image in one transaction;
- the requested Asset must be an active `shot_image` owned by that exact Shot
  and must be an image Asset;
- clearing selection changes only the selected flag;
- discarding the selected image leaves the Shot with no selected image.

The database partial unique index is the final invariant preventing two selected
rows for one Shot. Core validation owns the useful structured error before a
write.

### Copying A Shot Plan

Copying a Shot Plan copies only the selected Shot image for each copied Shot,
matching the accepted Shot Plan copy scope from plan 0156. Unselected images
remain in the source plan.

For each selected source image, Core:

1. creates a new Asset id;
2. creates a new AssetFile id for every source Asset File;
3. allocates new destination paths under the copied Shot;
4. copies the file bytes through the project Asset file write-set;
5. copies the Asset metadata without creating a second title on `ShotImage`;
6. preserves existing provenance using the current provenance fields and
   records;
7. inserts a new `shot_image` row owned by the copied Shot with
   `selected = true`;
8. commits database and filesystem work atomically, or rolls both back.

The copy may retain the same content hash because the bytes are the same. It
must not retain the same Asset id, AssetFile id, project-relative path, or
`shot_image` row.

For provenance:

- a source AssetFile with `source_generation_spec_id` gives the copied
  AssetFile the same source Spec id;
- a source AssetFile linked to a managed Run/output artifact gets an equivalent
  AssetFile-generation link for the new AssetFile;
- imported receipt provenance is preserved through the existing provenance
  representation;
- this plan does not add a generic copy-provenance table.

### Deletion And Trash

The ownership rule is simple: a Shot image owns its Asset tree.

- discarding a Shot or Shot Plan discards its owned image Assets and AssetFiles;
- restoring the Shot or Shot Plan restores those same owned Asset trees;
- garbage collection removes only the files belonging to those Assets;
- discarding one Shot image affects only that image's Asset tree;
- a copied Shot image is unaffected because it has a different Asset tree;
- generic owner-count or “last shared owner” logic is not used for Shot images.

The implementation still reuses the current Asset tree discard, restore, file
collection, and garbage-collection primitives. The rejected logic is the
Shot-specific shared-owner counting, not the common lifecycle service.

### Generation, Import, And Explicit Selection

`GenerationTarget { kind: "shot", id }`, `shot:<id>` CLI parsing, and
`shot.image` remain. These are common generation targeting contracts, not proof
that Shot images must use a generic Asset relationship table.

`renku media import` gains a boolean `--select` flag:

```bash
renku media import \
  --purpose shot.image \
  --target shot:<shot-id> \
  --source <project-relative-path> \
  --source-spec <generation-spec-id> \
  --select \
  --json
```

The Core attachment command receives `select?: boolean`. When true, attachment
and selection happen in the same database transaction and the same filesystem
write-set. If either fails, neither the Asset rows nor copied file remain.

The flag is supported only for purposes with an established single-selection
meaning:

- `shot.image` selects the new `shot_image`;
- `cast.profile` calls the existing Cast profile display selection owner;
- `location.hero` calls the existing Location hero display selection owner.

Other purposes fail with a structured unsupported-selection diagnostic. The CLI
does not decide which purposes are selectable.

Without `--select`, all three purposes add the new image and preserve the
current selection. Existing commands or Studio controls remain available for
changing the selection later. This preserves the established Cast and Location
model: multiple profile/hero candidate Assets in their generic relationship
tables, plus one selected display Asset in their existing selection table.

## Explicit Non-Goals

This plan does not:

- redesign generic Cast, Location, Project, Sequence, Scene, or Lookbook
  relationships;
- replace the existing Cast profile or Location hero selection tables;
- create a universal owned-media, clone, dependency, or provenance framework;
- add role, reference-name, purpose, locale, manual ordering, or lifecycle
  fields “for future flexibility”;
- add a generic `media select` command;
- auto-select on import when `--select` is absent;
- copy unselected Shot images with a Shot Plan;
- add a data conversion or preserve the rejected uncommitted schema;
- change the creative contents of Shot briefs, prompts, or images;
- implement the plan 0157 Studio Shot Plan UI.

## Context And Evidence

### Correct Work Retained From Plan 0156

The following plan 0156 direction remains valid:

- Scene-owned mutable Shot Plans and ordered Shots;
- thin Shot Plan and Shot documents;
- Core-owned validation and focused authoring commands;
- immutable generation Spec history and last-Spec linkage;
- `shot.image` generation context and destination path;
- thin CLI handlers and aggregate JSON create documents;
- `shot-planner` and `media-producer` ownership boundaries;
- structured diagnostics and Studio resource notifications.

### Rejected Plan 0156 Image Work

The following implementation must be replaced:

- `shot_asset`;
- `shot_representative_display_asset`;
- Shot participation in the generic relationship-table registry;
- `representativeImage` projection and representative-named commands;
- role, reference name, purpose, locale, sort order, relationship lifecycle,
  and relationship id on Shot images;
- copying a Shot image by reusing its Asset id;
- Shot image lifecycle decisions based on generic active-owner counts.

### Established Analogous Patterns

The repository contains three useful patterns, but none should be copied
wholesale:

- Cast profiles and Location heroes use generic relationship rows because their
  owner collections contain multiple semantic roles. Their separate display
  selection tables support multiple candidates plus one selected candidate.
- `scene_beat_storyboard_image` is a purpose-specific child table. Its extra
  Beat id, AssetFile id, source purpose, fingerprint, and lifecycle fields
  exist because storyboard regeneration and Beat association require them.
  Those requirements do not apply to Shot images.
- Lookbook image and sheet attachment already extend common Asset persistence
  with owner-specific membership records rather than forcing membership into
  every generic relationship shape.

The Shot image model follows the third pattern at the attachment boundary and
the second pattern at the schema boundary, but carries only the fields required
by Shot images.

### Common Services That Remain In Use

The implementation must continue to use:

- `GenerationTarget` and purpose-owned target validation;
- generation context, Spec, Preview, approval, Run, and inspection services;
- Asset and AssetFile record persistence;
- project-relative destination allocation;
- project Asset file write-sets and rollback;
- managed and external provenance persistence;
- common Asset projection fields and AssetFile resolution;
- Asset tree discard, restore, garbage collection, and file collection
  primitives;
- structured diagnostics;
- Studio resource keys and mutation events.

Removing Shot from the generic `AssetTarget` relationship registry is not
permission to duplicate any of these services. It only removes a storage
adapter whose required columns do not describe Shot images.

### Overlapping Active Plan

`plans/active/0157-shot-plans-studio-ui.md` currently uses representative-image
terminology and assumes the rejected projection. It is blocked on this plan.
After the Core contract is corrected, plan 0157 must be revised to consume
`Shot.images` and its `selected` flag before any UI implementation proceeds.

## Right-Sized Change Decision

The smallest architecture-correct correction is:

1. one `shot_image` table;
2. one focused Shot image access module;
3. one focused Shot image copy module that composes existing Asset/file
   primitives;
4. one focused attachment-membership branch registered in the existing bounded
   attachment destination/persistence boundary;
5. one focused selection dispatcher for the three established selectable media
   purposes;
6. direct contract, CLI, test, documentation, and skill corrections.

Do not generalize the Shot copy operation into a reusable Asset clone framework.
If a second accepted product requirement later needs the same complete copying
semantics, compare concrete duplication then.

## Architecture Shape Gate

### Owning Packages And Modules

`packages/core` owns every durable rule:

- `packages/core/src/server/schema/shot-plans.ts` owns `shot_image`;
- `packages/core/src/server/database/access/shot-plans/image-records.ts` owns
  Shot image row reads and writes only;
- `packages/core/src/server/shot-plans/projection.ts` owns `Shot.images`;
- `packages/core/src/server/shot-plans/shot-image-copy.ts` owns independent
  copying of a selected Shot image;
- `packages/core/src/server/shot-plans/image-lifecycle.ts` composes common Asset
  tree lifecycle primitives for exclusive Shot ownership;
- `packages/core/src/server/commands/shot-image-commands.ts` owns public Shot
  selection, clearing, and discard mutations;
- `packages/core/src/server/generation/attachment-persistence.ts` remains the
  common Asset/AssetFile/file transaction owner;
- `packages/core/src/server/generation/attachment-selection.ts` owns the small
  purpose-to-existing-selection-owner dispatch used only when attachment
  explicitly requests selection.

`packages/cli` parses flags and calls Core. It does not revalidate ownership,
media kind, selectable purpose, or atomicity.

`studio-skills` describes the coarse agent workflow. It does not create a
parallel data model or repair invalid responses.

### Public Entrypoints

Callers use the existing `ProjectDataService` boundary with these corrected
names:

- `selectShotImage`;
- `clearShotImageSelection`;
- existing `discardShotImage`;
- existing `copyShotPlan`;
- existing `attachGenerationMedia`, extended with `select?: boolean`.

The browser-safe Core entrypoint exports `AssetInfo`, `ShotImage`, and the
corrected `Shot`. Package `index.ts` files remain export lists only.

### Internal Module Shape

`shot-image-copy.ts` may orchestrate:

- reading the selected source image;
- allocating new ids and destination paths;
- invoking common Asset/file copy primitives inside the parent transaction and
  write-set;
- copying existing provenance;
- inserting the selected target `shot_image`.

It must not own Shot Plan record copying, generation Spec copying, CLI
formatting, or Trash registry dispatch. `copying.ts` remains the thin Shot Plan
copy coordinator and delegates the image step.

`attachment-selection.ts` may dispatch only the explicit selection requested by
an attachment destination. It must call the existing Cast/Location selection
access owners and the new Shot image selection access owner. It must not become
a generic post-import workflow engine.

### Files Expected To Shrink Or Lose Branches

- `database/access/asset-relationships/targets.ts` loses its Shot table branch;
- `database/access/asset-relationships/index.ts` loses Shot relationship
  assumptions;
- `trash/asset-tree-lifecycle.ts` loses Shot from generic relationship owner
  counting;
- `shot-plans/copying.ts` loses inline relationship-copy logic;
- `shot-plans/image-lifecycle.ts` loses shared-owner calculations;
- `client/shot-plans.ts` loses `representativeImage`;
- `client/assets.ts` loses Shot from `AssetTarget` while retaining Shot in the
  separate `GenerationTarget`;
- the CLI and skills lose all representative terminology and avoidable
  import-then-select guidance.

### Forbidden Shapes

Stop and revise before implementation continues if:

- `shot_image` gains a column not traced to this plan's requirement ledger;
- the same Asset id or AssetFile id appears in source and copied Shot images;
- Shot selection is stored both on `shot_image` and elsewhere;
- Core attachment persistence starts hard-coding CLI behavior;
- the CLI decides selection eligibility or mutates a second command after
  import;
- copy logic becomes a generic framework before a second concrete requirement
  exists;
- common Asset/file/provenance/Trash behavior is duplicated in Shot modules;
- one function performs target parsing, validation, database writes, file
  copying, provenance copying, event formatting, and CLI output;
- an `index.ts` gains implementation logic;
- architecture tests name private functions or inventory allowed command names.

## Contracts

### Database Contract

The only new Shot image table is:

```text
shot_image
  asset_id   text primary key
             references asset(id) on delete cascade
  shot_id    text not null
             references shot(id) on delete cascade
  selected   integer/boolean not null default false
  created_at text not null
  updated_at text not null
```

Indexes:

- `shot_image_shot_idx` on `shot_id`;
- `shot_image_selected_unique_idx` unique on `shot_id` where
  `selected = true`.

The primary key on `asset_id` is intentional. It enforces that an Asset can be
owned by only one Shot image. There is no separate `shot_image.id`.

The table has no discard columns. A Shot image is not an independently restored
relationship record; its lifecycle follows the Shot and its owned Asset tree.
The focused discard-image command operates on the owned Asset and membership as
one Core mutation.

### Core Public Inputs

```ts
export interface SelectShotImageInput {
  projectName: string;
  shotId: string;
  assetId: string;
}

export interface ClearShotImageSelectionInput {
  projectName: string;
  shotId: string;
}

export interface AttachGenerationMediaInput {
  // existing fields remain
  select?: boolean;
}
```

No compatibility aliases for representative-named commands or response fields
remain.

### CLI Contract

Retain:

```text
renku shot-plan shot image select --shot <shot-id> --asset <asset-id> --json
renku shot-plan shot image clear --shot <shot-id> --json
renku shot-plan shot image discard --shot <shot-id> --asset <asset-id> --json
```

Add:

```text
renku media import ... --select --json
```

The word `select` is the user action; `selected` is the persisted and response
state. No command or help text uses `representative`.

### Structured Diagnostics

Reuse current diagnostic families where their meaning remains correct. Rename
representative-specific Shot diagnostics directly. At minimum Core must report:

- Shot not found;
- Shot image Asset not found for that Shot;
- Shot image Asset has non-image media kind;
- explicit selection is unsupported for the requested generation purpose;
- copy source Asset/File/provenance state is structurally invalid;
- file copy or database mutation failure with rollback.

Diagnostics describe only the corrected current contract. They do not mention
`shot_asset`, representative rows, old owner sharing, or conversion advice.

## Implementation Slices

### Slice 1: Replace The Uncommitted Schema

Files:

- `packages/core/src/server/schema/shot-plans.ts`;
- `packages/core/src/server/schema/index.ts` if its direct exports change;
- `packages/core/drizzle/0066_*.sql`;
- `packages/core/drizzle/meta/0066_snapshot.json`;
- `packages/core/drizzle/meta/_journal.json`;
- `packages/core/src/server/database/lifecycle/migration-0066.test.ts`;
- `packages/core/src/server/entity-ids.ts`.

Work:

- replace both rejected tables with `shot_image`;
- remove the unused `shot_asset` entity id;
- generate the corrected 0066 SQL and snapshot with Drizzle Kit;
- assert the exact minimal columns, foreign keys, normal index, and partial
  unique selection index;
- verify the generated SQL never creates the rejected tables.

There is no 0067 conversion. The current uncommitted 0066 artifacts are replaced
because no project database contains them.

### Slice 2: Correct Public Projections And Shared Asset Naming

Files:

- `packages/core/src/client/assets.ts`;
- `packages/core/src/client/visual-language.ts`;
- `packages/core/src/client/shot-plans.ts`;
- `packages/core/src/client/index.ts`;
- direct Core, CLI, and Studio callers of removed Lookbook-specific Asset
  shapes or `representativeImage`.

Work:

- extract `AssetInfo` from fields already present in the existing Asset and
  Lookbook projections;
- keep the canonical nested property name `files`;
- make the existing relationship-enriched `Asset` compose `AssetInfo`;
- update Lookbook image and sheet projections to use `AssetInfo`;
- add `ShotImage` with nested `asset`, `selected`, and row timestamps;
- replace `Shot.representativeImage` with `Shot.images`;
- update callers directly with no re-export facade or compatibility field.

### Slice 3: Add Focused Shot Image Persistence And Selection

Files:

- `packages/core/src/server/database/access/shot-plans/image-records.ts`;
- `packages/core/src/server/shot-plans/projection.ts`;
- `packages/core/src/server/commands/shot-image-commands.ts`;
- `packages/core/src/server/project-data-service-contracts.ts`;
- `packages/core/src/server/project-data-service-wiring/shot-plans.ts`;
- focused Shot Plan tests.

Work:

- replace representative table access with `shot_image` reads and writes;
- project every active owned image with its common Asset info;
- select by clearing the Shot's current flag and setting the exact owned image
  inside one transaction;
- clear without changing the Shot's images;
- discard through the exclusive-owner lifecycle;
- rename contracts and callers directly.

### Slice 4: Preserve Common Attachment Services With Shot Membership

Files:

- `packages/core/src/server/generation/attachment-destinations.ts`;
- `packages/core/src/server/generation/attachment-persistence.ts`;
- `packages/core/src/server/generation/attachment-selection.ts`;
- `packages/core/src/server/generation/attachments.ts`;
- `packages/core/src/server/generation/purposes/shot-image.ts`;
- attachment and purpose tests.

Work:

- keep `GenerationTarget.kind = "shot"` and the existing `shot.image` purpose;
- model Shot membership as an owner-specific destination, parallel to the
  existing Lookbook membership extension;
- insert the Asset, AssetFiles, provenance, project files, and `shot_image` in
  one attachment transaction;
- add optional explicit selection in that same transaction;
- route Cast profile, Location hero, and Shot image selection through their
  existing/focused Core owners;
- reject `select: true` for other purposes before durable writes;
- keep omitted or false selection non-mutating.

### Slice 5: Remove Rejected Generic Relationship Logic

Files:

- `packages/core/src/client/assets.ts`;
- `packages/core/src/server/database/access/asset-relationships/targets.ts`;
- `packages/core/src/server/database/access/asset-relationships/index.ts`;
- `packages/core/src/server/trash/asset-tree-lifecycle.ts`;
- `packages/core/src/server/trash/trash-object-registry.ts`;
- related generic relationship and Trash tests.

Work:

- remove Shot from `AssetTarget` and generic relationship table configuration;
- retain Shot in `GenerationTarget`;
- remove Shot owner-count branches from generic Asset relationship lifecycle;
- preserve and call common Asset tree lifecycle primitives from the focused Shot
  owner;
- remove tests whose only purpose was the rejected shared relationship model;
- add behavior tests for exclusive ownership instead.

### Slice 6: Implement Independent Copy And Lifecycle

Files:

- `packages/core/src/server/shot-plans/shot-image-copy.ts`;
- `packages/core/src/server/shot-plans/copying.ts`;
- `packages/core/src/server/shot-plans/image-lifecycle.ts`;
- existing project Asset file and provenance access modules only where a focused
  reusable primitive is missing;
- Shot Plan copy, Trash, rollback, and provenance tests.

Work:

- delegate selected-image copying from the Shot Plan coordinator;
- clone Asset metadata, every AssetFile row, file bytes, and existing
  provenance into new identities and paths;
- insert only the copied selected image on the copied Shot;
- roll back database and file writes together;
- make discard, restore, and garbage collection owner-local;
- remove every Shot-specific active-owner count.

### Slice 7: Correct CLI Call Economy

Files:

- `packages/cli/src/cli.ts`;
- `packages/cli/src/commands/media-command.ts`;
- `packages/cli/src/commands/media-import-command-handlers.ts`;
- `packages/cli/src/commands/media-import-command-handlers.test.ts`;
- `packages/cli/src/commands/shot-plan-image-command-handlers.ts`;
- Shot Plan command documents, handlers, help text, and tests.

Work:

- parse `--select` as a boolean and pass it unchanged to Core;
- do not add CLI-local selectable-purpose rules;
- keep Shot image `select`, `clear`, and `discard` for later edits to existing
  images;
- remove representative terminology;
- keep aggregate `shot-plan create --file` as the initial creation path;
- keep focused add, update, move, remove, select, clear, and discard commands
  for actual later deltas.

### Slice 8: Correct Skills And Agent Evals

Files in `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- `skills/shot-planner/SKILL.md`;
- `skills/shot-planner/references/shot-plan-cli-workflow.md`;
- the representative-image workflow file, renamed directly to selected-image
  terminology;
- Shot Planner samples and evals;
- `skills/media-producer/references/shot-image.md`;
- Cast profile and Location hero references that benefit from explicit
  import-and-select;
- `skills/media-producer/references/workflow.md`;
- focused media-producer evals;
- `skills/movie-director` Shot Plan handoff guidance and evals where affected.

Agent workflow:

1. Resolve the project and obtain one aggregate `director context` for the
   selected Scene.
2. Read only missing purpose-specific context not already present in that
   response.
3. Author all initial Shots in one JSON document.
4. create the Shot Plan once with `shot-plan create --file`;
5. read the resulting Shot Plan once with `shot-plan show`;
6. use focused commands only for later user-requested deltas;
7. after media preview, approvals, execution, inspection, and user acceptance,
   import an image with `--select` when selection is the explicit intent;
8. do not import and then call a separate selection command for that same
   accepted intent;
9. use the focused selection command only when selecting an already imported
   image.

Evals must reject:

- creating an empty plan and adding each initial Shot separately;
- repeated full context calls between unchanged steps;
- importing and then separately selecting when `--select` expresses the same
  accepted intent;
- automatically selecting without user intent;
- skipping Preview, approval, inspection, or output acceptance to reduce call
  count.

### Slice 9: Correct Current Documentation And Plan Dependencies

Files:

- new ADR `docs/decisions/0064-use-exclusively-owned-shot-images.md`;
- `docs/decisions/0063-use-thin-shot-documents-and-shot-owned-images.md`;
- current architecture and CLI documents changed by plan 0156;
- `plans/active/0156-shot-plan-authoring-cli-and-agent-skills.md`;
- `plans/active/0157-shot-plans-studio-ui.md`.

Work:

- record the corrected ownership, selection, copy, and common-service decision
  in ADR 0064;
- add a concise supersession notice to ADR 0063 without rewriting its
  historical body;
- correct current architecture and CLI docs directly;
- add a concise notice to plan 0156 identifying the sections superseded here;
- revise plan 0157 to consume `Shot.images` and `selected`, then leave its UI
  implementation as separate work;
- remove obsolete terms from current docs, code, help, and skills while
  retaining them only in the historical superseded documents.

## Tests And Guardrails

### Schema And Persistence

- migration 0066 creates only `shot_image` for Shot image ownership;
- schema contains exactly the five planned columns;
- Asset primary key enforces one Shot owner per image Asset;
- partial unique index prevents two selected images for one Shot;
- Shot cascade removes membership rows;
- attaching a Shot image creates one Asset, its AssetFiles, and one
  `shot_image`;
- attaching without selection does not change current selection;
- explicit attach-and-select is atomic;
- unsupported explicit selection fails before database or file writes.

### Selection

- first selection succeeds;
- selecting another image clears the previous flag;
- clearing leaves all images unselected;
- selecting an Asset from another Shot fails;
- selecting a non-image Asset fails;
- selecting a missing or discarded image fails;
- discarding the selected image clears selection by removing that owned image;
- Cast profile and Location hero import-and-select call their established
  selection owners;
- non-selectable purposes reject `--select` in Core.

### Copy

- a copied Shot Plan with no selected images creates no image copies;
- each copied selected image has a new Asset id;
- every copied file has a new AssetFile id and new project-relative path;
- source and copied bytes and content hashes match;
- source and copy preserve supported provenance;
- unselected images are not copied;
- deleting/discarding the source does not affect the copy;
- deleting/discarding the copy does not affect the source;
- forced file-copy, provenance, row-insert, and selection failures leave no
  partial database rows or destination files.

### Lifecycle

- Shot discard/restore affects only its owned Asset trees;
- Shot Plan discard/restore handles every owned Shot image exactly once;
- garbage collection returns only owner-local files;
- no Shot lifecycle path reads generic Asset owner counts;
- generic Cast/Location/Project/Sequence/Scene relationship lifecycle remains
  unchanged.

### Projection And Naming

- `Shot.images` returns every owned image with nested `asset`;
- exactly zero or one image has `selected = true`;
- `ShotImage` has no title or direct `files`;
- `ShotImage.asset.files` uses the same AssetFile shape as other common Asset
  projections;
- current runtime code, CLI help, and skills contain no representative
  terminology;
- current runtime code contains no rejected Shot table names.

### CLI And Skills

- CLI forwards `--select` and prints the single Core report;
- CLI does not maintain a selectable-purpose list;
- one initial Shot Plan document creates multiple Shots in one command;
- focused later edits do not rewrite the entire plan;
- skill evals enforce coarse mutation calls and retain safety/approval steps.

Architecture tests protect stable behavior and import boundaries. They must not
search source for private helper names or freeze a complete command/service
inventory.

## Documentation

Update the current accepted descriptions of:

- Shot image ownership and selection;
- Shot Plan copy semantics;
- Asset versus owner-membership responsibilities;
- generated-media attachment and explicit selection;
- CLI commands and examples;
- agent skill workflow and call economy;
- Studio plan 0157's dependency on the corrected Core projection.

Historical plan 0156 and ADR 0063 receive only concise supersession notices.
Their original reasoning stays visible.

## Final Verification

Run focused checks first:

```bash
pnpm build:core
pnpm test:core
pnpm test:cli
cd /Users/keremk/Projects/aitinkerbox/studio-skills
node skills/media-producer/scripts/validate-image-prompt-guides.mjs \
  --project urban-basilica
cd /Users/keremk/Projects/aitinkerbox/studio
```

Then run the root workspace checks:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Also:

- generate and inspect the Drizzle 0066 SQL and snapshot;
- inspect a real Shot Plan create, image import with and without `--select`,
  selection change, copy, discard/restore, and garbage-collection journey;
- verify source/copy ids, paths, hashes, provenance, and deletion independence;
- run the affected skill validators and evals;
- inspect `git diff --stat` and the complete diff;
- compare the diff against the valid non-image work from plan 0156 so that the
  correction does not erase accepted authoring behavior;
- inspect every new or heavily modified file;
- confirm `index.ts` files remain thin export entrypoints;
- confirm `attachment-persistence.ts`, `copying.ts`, and Trash registries did
  not become broad switchboards;
- confirm no unrelated user changes or formatting churn entered the diff;
- confirm the rejected table and representative terminology remain only in
  explicit historical supersession context.

## Completion Checklist

### Review Area

- [ ] Confirm every persisted `shot_image` column traces to the Requirement
      Ledger.
- [ ] Confirm the correction preserves the accepted non-image Shot Plan work
      from plan 0156.
- [ ] Confirm the implementation preserves Core, CLI, Studio, and skill
      ownership boundaries.
- [ ] Confirm common services are reused at the correct layer instead of being
      removed or duplicated.
- [ ] Confirm centralized ownership did not become a monolithic implementation.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no new broad dispatcher, catch-all helper, copy framework, or god
      file was added.

### Architecture And Contracts

- [ ] Define only the `shot_image` table for Shot image membership and
      selection.
- [ ] Enforce exclusive Asset ownership with `asset_id` as the primary key.
- [ ] Enforce at most one selected image per Shot with a partial unique index.
- [ ] Keep `created_at` and `updated_at`.
- [ ] Omit title, role, reference name, purpose, locale, sort order,
      relationship id, and discard columns.
- [ ] Export `AssetInfo`, `ShotImage`, and `Shot.images`.
- [ ] Nest common Asset information at `ShotImage.asset`.
- [ ] Keep the canonical AssetFile collection name `files`.
- [ ] Remove the duplicate selected-image projection.
- [ ] Rename public commands and responses to selected terminology.
- [ ] Remove Shot from generic `AssetTarget` while retaining
      `GenerationTarget.kind = "shot"`.
- [ ] Extend `attachGenerationMedia` with explicit `select?: boolean`.
- [ ] Keep package-boundary failures structured.
- [ ] Add no compatibility aliases, fields, readers, or diagnostics.

### Schema And Generated Artifacts

- [ ] Correct the Drizzle TypeScript schema first.
- [ ] Replace the uncommitted generated 0066 SQL and snapshot with Drizzle Kit.
- [ ] Add no 0067 data conversion or backfill.
- [ ] Update the migration test for the exact current schema.
- [ ] Confirm no project database needs conversion.
- [ ] Confirm generated artifacts do not create or convert the rejected tables.

### Shot Image Persistence And Projection

- [ ] Replace representative access with focused `shot_image` access.
- [ ] Project all owned images deterministically without durable manual order.
- [ ] Select an exact owned image atomically.
- [ ] Clear selection without deleting images.
- [ ] Reject another Shot's Asset and non-image Assets.
- [ ] Remove representative terminology from current runtime code.
- [ ] Remove rejected Shot table names from current runtime code.

### Common Media Attachment

- [ ] Keep `shot.image` in the common purpose and generation-target
      architecture.
- [ ] Add focused Shot membership to common attachment persistence.
- [ ] Reuse Asset, AssetFile, destination, provenance, write-set, rollback,
      diagnostic, and resource-event services.
- [ ] Make attach-and-explicit-select one atomic Core mutation.
- [ ] Support explicit selection for Shot image, Cast profile, and Location
      hero through their domain owners.
- [ ] Leave selection unchanged when `select` is absent or false.
- [ ] Reject unsupported purpose selection before writes.
- [ ] Keep the CLI free of purpose-selection business rules.

### Copy And Lifecycle

- [ ] Copy only each source Shot's selected image.
- [ ] Allocate a new Asset id for every copied image.
- [ ] Allocate new AssetFile ids and project-relative paths for every copied
      file.
- [ ] Copy file bytes through the common write-set.
- [ ] Preserve current supported provenance without a new generic framework.
- [ ] Insert the copied image as selected on the copied Shot.
- [ ] Roll back database and filesystem state on every copy failure.
- [ ] Remove Shot-specific shared-owner counts.
- [ ] Reuse common Asset tree discard, restore, file collection, and garbage
      collection primitives.
- [ ] Prove source and copied images can be deleted independently.

### CLI And Agent Surfaces

- [ ] Add `media import --select`.
- [ ] Keep focused Shot image select, clear, and discard commands for existing
      images.
- [ ] Remove representative terminology from CLI help and JSON examples.
- [ ] Use one create document for an initial multi-Shot plan.
- [ ] Use one aggregate context read where it already contains the required
      facts.
- [ ] Avoid import followed by a separate select for one accepted explicit
      selection intent.
- [ ] Preserve Preview, approval, estimate, execution approval, run, inspect,
      output acceptance, and import boundaries.
- [ ] Update Shot Planner, Media Producer, and Movie Director guidance.
- [ ] Add skill evals for both call economy and retained safety boundaries.

### Tests And Guardrails

- [ ] Add exact schema and index tests.
- [ ] Add owning-layer selection and invalid-state tests.
- [ ] Add attachment-and-selection rollback tests.
- [ ] Add independent copy identity, bytes, path, provenance, and rollback
      tests.
- [ ] Add discard, restore, and garbage-collection independence tests.
- [ ] Update projection and naming tests.
- [ ] Update CLI adapter tests without duplicating Core's full invalid-state
      matrix.
- [ ] Add or update stable architecture/import-boundary tests where useful.
- [ ] Do not encode private implementation names or service inventories in
      architecture tests.
- [ ] Run the shape-review checks listed in Final Verification.

### Documentation

- [ ] Add ADR 0064 for the corrected accepted direction.
- [ ] Add a concise supersession notice to ADR 0063 without rewriting its body.
- [ ] Correct current architecture, CLI, and skill docs.
- [ ] Add a concise supersession notice to plan 0156.
- [ ] Revise plan 0157 to consume `Shot.images` and `selected`.
- [ ] Keep obsolete terms only in explicit historical context.

### Final Verification

- [ ] Run focused Core, CLI, and skill checks.
- [ ] Run root `build`, `test`, `lint`, and `check`.
- [ ] Inspect generated Drizzle SQL and snapshot.
- [ ] Verify a realistic import/select/copy/delete journey.
- [ ] Inspect source and copied ids, paths, hashes, bytes, and provenance.
- [ ] Review `git diff --stat` and the complete diff.
- [ ] Inspect large and heavily modified files.
- [ ] Confirm `index.ts` files remain thin.
- [ ] Confirm no accepted plan 0156 behavior was removed accidentally.
- [ ] Confirm no unrelated user changes or formatting churn entered the work.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [ ] Only then mark this plan complete.
