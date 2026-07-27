# 0159 Unified Asset Ownership, Selection, And Existing-Data Migration

Status: complete
Date: 2026-07-26

## Summary

Renku Studio currently represents the same owned-media concept through several
incompatible patterns:

- `project_asset`, `cast_asset`, `location_asset`, `sequence_asset`,
  `scene_asset`, and `shot_asset` repeat the same generic relationship columns;
- Lookbook Images and Sheets use separate owner tables;
- Scene Beat Storyboard Images and Scene Dialogue Audio Takes combine
  Scene-owned Assets with focused Beat and Take records;
- Cast Profiles, Location Heroes, Lookbook card images, and Shot images use
  different selection tables and commands;
- Beat Storyboard Images have no explicit selection and silently treat the
  newest active image as current;
- the public `Asset` shape mixes Asset facts with relationship ids, roles, and
  ordering;
- copying a Shot Plan shares one selected Asset between the source and copy.

This plan replaces those patterns with three concepts:

1. every Asset has exactly one owner through one `asset_membership` row;
2. subjects with a canonical visual representation use one separate
   `selected_asset` pointer;
3. choices that belong to one generation request remain exact references in
   that persisted `GenerationSpec`.

The common membership model covers every durable Asset owner in scope:
Project, Cast Member, Location, Sequence, Scene, Scene Beat, Lookbook, and
Shot. A Scene Beat and a Shot use the same mechanism: each owns multiple
ordinary image Assets and may point to one selected Asset. Scene Dialogue Audio
Takes remain focused records over Scene-owned audio Assets because the Take
stores provider, voice, text, and settings facts beyond Asset ownership. This
plan does not add `ShotImage`, `AssetInfo`, a Shot- or Beat-specific ownership
table, per-purpose selection tables, or another public Asset variant.

Purpose-specific tables remain only when they store additional domain facts.
Examples are Lookbook image placement and ordering and a Dialogue Audio Take's
provider and voice settings. Storyboard sheet generation, visual inspection,
slicing, and grouped import remain a batch workflow, but each accepted slice
enters the same durable ownership and selection path as one accepted Shot
image. No Storyboard association, fingerprint, crop, panel, or carry-forward
record survives after attachment.

This is deliberately a cross-domain Asset consolidation, not a Shot-image-only
patch. Shot image rows were never created in the real sample project, but the
tables this plan replaces already hold Cast, Location, Lookbook, Storyboard,
Dialogue Audio, and generic Asset data. The replacement migration must convert
that existing data in place before Shot images begin using the common model.
The migration preserves existing Asset ids, AssetFile ids, paths, provenance,
real focused detail ids, ordering, placement, Trash state, metadata, and current
canonical display behavior. Existing Storyboard association rows are consumed
only to derive one logical Scene Beat owner and the initial selected Asset, then
the association table is removed.

This plan:

- supersedes plan 0158 in full;
- supersedes only the Shot image ownership, selection, copy, and related Asset
  relationship sections of completed plan 0156;
- retains the accepted non-image Shot Plan authoring, CLI, GenerationSpec, and
  skill behavior from plan 0156;
- updates plan 0157 to consume the corrected Shot Asset projection before its
  UI work begins.

Implementation completed on 2026-07-26. Production code, migration artifacts,
current documentation, and Studio Skills now use the unified ownership and
selection model described here.

The final implementation keeps Asset discard/restore mechanics in the existing
focused Trash lifecycle modules instead of adding an `assets/lifecycle.ts`
wrapper. This preserves the accepted Trash ownership boundary and avoids a
pass-through module. The common Asset module owns owner keys, membership,
projection, metadata, selection, and public resource entrypoints.

## Requirement Ledger

| Requirement | Source | Planned owner |
| --- | --- | --- |
| Use one ownership pattern for Cast, Location, Lookbook, Shot, Beat Storyboard, Dialogue Audio, and other current Assets. | User correction | `packages/core` Asset membership |
| One Asset belongs to exactly one owner and is never shared between copied owners. | User correction | `asset_membership.asset_id` primary key plus Core validation |
| Copy means an independent Asset, AssetFile, project path, and file copy. | User correction | Core owned-Asset copy operation |
| Do not create `shot_image` or another Shot-only membership table. | User correction | Shot images use `asset_membership` |
| Keep selection as a separate pointer rather than a boolean on Asset or membership. | User direction to follow Cast/Location/Lookbook semantics | `selected_asset` |
| Use `selected`, never `representative`, in current contracts and commands. | User correction | Core, CLI, Studio, skills, current docs |
| Cast Profile, Location Hero, Lookbook Image, Shot Image, and Beat Storyboard Image are canonical selections. | User clarification | Core selected-Asset capability |
| Character Sheet, Location Sheet, Lookbook Sheet, Dialogue Audio Take, and other generation references are chosen per GenerationSpec. | User clarification and ADR 0049 | `GenerationSpec.references` |
| A Beat Storyboard selection globally represents one Beat in its Scene rather than one generation request. | User clarification | `AssetSelectionTarget.kind = "sceneBeat"` |
| Beat Storyboard selection is explicit; newest-created must not silently win. | User clarification and current-code defect | Core storyboard projection and selection |
| A Shot or Beat may retain multiple image candidates through the exact same durable mechanism. | User correction | `asset_membership` plus `selected_asset` |
| Storyboard sheet generation and slicing are batch optimizations only; each accepted slice becomes an ordinary Beat-owned Asset. | User correction | grouped Storyboard import delegating to common Asset attachment |
| Beat image ownership is global to the logical `{ sceneId, beatId }`, not a Beat Sheet revision. | User correction | `AssetOwner.kind = "sceneBeat"` |
| Do not retain a Storyboard-only association, fingerprint, staleness, or carry-forward model without a separate accepted product requirement. | User correction and simplification boundary | remove `scene_beat_storyboard_image` runtime storage |
| Generic membership has timestamps but no title, role, reference name, purpose, locale, sort order, or discard state. | User correction and simplification | `asset_membership` |
| Asset metadata uses the same names everywhere. | User correction | one public `Asset` and one `asset` row |
| `files` remains the Asset's file collection because it is the existing common AssetFile name. | Repository evidence and consistency request | public `Asset.files` |
| Relationship `role` must not duplicate Asset `type`. | User objection and real-data evidence | canonical Asset type values |
| Reference name, purpose, and locale remain available where they are real Asset metadata. | User request not to remove common behavior blindly | columns on `asset`, not membership |
| Durable ordering remains only where product behavior is actually ordered. | User objection and current Lookbook behavior | focused Lookbook detail tables |
| One accepted import-and-select intent should require one CLI/Core mutation. | User correction about skill call economy | `media import --select` and grouped storyboard import |
| Do not collapse Preview, approval, execution, inspection, or output acceptance into one call. | Existing generation safety workflow | skills and evals |
| Do not invent conversion work for never-created Shot image rows. | User instruction scoped to the rejected Shot schema | replacement of unapplied migration 0066 |
| Preserve every still-required durable fact from populated Asset, relationship, detail, and canonical-selection rows; explicitly convert populated Storyboard rows without retaining obsolete association fields. | User correction and real sample-project evidence | custom preservation SQL inside replacement migration 0066 |
| Preserve existing AssetFile ids, paths, and bytes during relationship conversion. | Data-integrity boundary | migration changes metadata ownership, not existing files |
| Preserve Core ownership and thin CLI/server/UI adapters. | Architecture hard gate | package boundaries |

## Product Behavior

### Assets And Exclusive Ownership

An Asset is the durable media entity. It owns:

- its stable id;
- one semantic Asset type;
- media kind;
- title and optional one-line summary;
- optional reference name, purpose, and locale;
- origin and availability;
- zero or more Asset Files;
- created, updated, and Trash lifecycle timestamps.

An Asset has exactly one `AssetOwner`. Ownership is persisted separately in
`asset_membership`, but it is projected as `Asset.owner`.

The supported owner contract is:

```ts
export type AssetOwner =
  | { kind: 'project' }
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'sequence'; id: string }
  | { kind: 'scene'; id: string }
  | { kind: 'sceneBeat'; sceneId: string; beatId: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'shot'; id: string };
```

`asset_membership.asset_id` is the primary key. The same Asset cannot be
inserted for two owners. Core validates that the typed owner exists before any
Asset, AssetFile, membership, domain-detail row, or destination file is
committed.

Owner-specific file folders remain owner-specific. Unifying database ownership
does not remove the focused Cast, Location, Lookbook, Storyboard, Shot,
Dialogue Audio, and Project Video destination resolvers. A Storyboard slice
uses the Scene Beat owner even when the optimized composite was generated for
the containing Scene. Dialogue Audio remains Scene-owned, with
`scene_dialogue_audio_take` retaining its separate Take facts.

Generic candidate collections are not authored sequences. Asset listing uses
`createdAt` descending and then Asset id descending for stable presentation.
Only Lookbook detail collections retain durable authored ordering.

### Canonical Asset Types

Generation attachment descriptors and focused import commands use these
canonical Asset type values:

| Product artifact | Asset type |
| --- | --- |
| Character Sheet | `character_sheet` |
| Cast Profile | `cast_profile` |
| Cast Voice Sample | `cast_voice_sample` |
| Location Sheet | `location_sheet` |
| Location Hero | `location_hero` |
| Lookbook Image | `lookbook_image` |
| Lookbook Sheet | `lookbook_sheet` |
| Beat Storyboard Image | `scene_storyboard_image` |
| Scene Dialogue Audio Take media | `scene_dialogue_audio` |
| Shot Image | `shot_image` |
| Project Video | `project_video` |

Generic user-created Assets may retain other deliberate type strings. Core does
not create a speculative closed Asset-type registry. Canonical product-owned
types use the existing Asset-type `snake_case` convention; dotted identifiers
remain Generation Purposes and are not reused as Asset types. Current purpose
attachments, UI filters, reference guides, and selection validation use the
canonical values above instead of a second relationship `role`.

Current callers, fixtures, and documentation move directly to these values.
There are no aliases for inconsistent spellings. Migration 0066 converts the
known existing values once, including `profile` to `cast_profile`,
`location-sheet` to `location_sheet`, and Scene Dialogue Audio `audio` to
`scene_dialogue_audio`. Unknown deliberate user Asset types remain unchanged.

Asset File `role` remains. File roles such as `primary`, `composite`, or an
audio file role describe files within one Asset and are not duplicates of Asset
type.

### Canonical Selection

Canonical selection answers:

> Which Asset currently represents this product subject in Studio and
> downstream context?

Exactly these targets support a `selected_asset` row:

| Selection target | Required owned Asset type | Product meaning |
| --- | --- | --- |
| Cast Member | `cast_profile` | selected Cast Profile |
| Location | `location_hero` | selected Location Hero |
| Lookbook | `lookbook_image` | selected Lookbook card image |
| Shot | `shot_image` | selected Shot image |
| Scene Beat | `scene_storyboard_image` | selected Beat-owned Storyboard Image |

A selection:

- is optional;
- points to one active Asset;
- requires the selected Asset's membership to match the target owner directly,
  including the exact `{ sceneId, beatId }` for a Scene Beat;
- requires the canonical Asset type for that target;
- changes only through Core;
- does not influence any GenerationSpec reference automatically;
- is not inferred from creation time, sort order, filename, purpose, or the
  first candidate.

The selection table stores the same internal `owner_key` used by membership,
the Asset pointer, `created_at`, and `updated_at`. It does not introduce a
second selection identity or store a role, type, title, order, selected boolean,
or duplicate public target fields.

Selecting a newly accepted import is optional explicit intent. Import without
`--select` leaves the current selection unchanged.

Discarding an individually selected Asset clears every affected selection
subject pointer in the same Core transaction. Restoring that individual Asset
returns it as an unselected candidate. A parent-owner Trash operation may
preserve its selection pointers while the whole owner aggregate is discarded
so restoring the complete aggregate restores the same canonical
representation.

### Generation-Scoped Choice

Generation-scoped choice answers:

> Which exact AssetFile does this particular request use?

These choices remain only in `GenerationSpec.references`:

- Character Sheets;
- Location Sheets;
- Lookbook Sheets;
- Dialogue Audio Takes;
- any other exact media reference chosen for one request.

There is no global selected Character Sheet, Location Sheet, Lookbook Sheet, or
Dialogue Audio Take. Different GenerationSpecs may choose different exact files
from the same candidate collection.

Purpose guides expose available candidates. They must not read
`selected_asset`, initialize a reference from it, or write it. Generation
Preview continues to replace or clear the exact reference in the saved Spec.

Dialogue Audio Takes remain durable domain records with provider, voice,
authored-text, settings, and exact AssetFile facts. Their playable Asset is
owned by the Scene, while the Take record associates it with the corresponding
Scene Dialogue Audio record. No Dialogue Audio selection table, selected flag,
or canonical pointer is added.

### Beat Storyboard Images

A Scene Beat and a Shot have the same image-candidate behavior. Each accepted
Storyboard slice:

- is an ordinary Asset of type `scene_storyboard_image`;
- is owned directly by `{ kind: 'sceneBeat', sceneId, beatId }` through
  `asset_membership`;
- uses ordinary Asset Files and generation provenance;
- participates in the common candidate list, selection, Trash, restore, and
  resource projection operations.

There is no runtime `scene_beat_storyboard_image` table, Storyboard Image
record, Beat Sheet revision association, source-purpose mirror, Beat-content
fingerprint, or Storyboard-specific staleness state. Asset type distinguishes
Storyboard images from Shot images for generation purpose and filtering; it
does not change their ownership or selection machinery.

One candidate may be explicitly selected for `{ sceneId, beatId }`. That
selection is global Studio state for the logical Scene Beat and survives a Beat
Sheet revision that preserves the Beat id because the owner key does not contain
a Beat Sheet revision id. The selected candidate is what Scene Beat, Sequence
Storyboard, Act Storyboard, Director context, and Shot Plan Beat context use as
the Beat's canonical image. If no candidate is selected, those surfaces show no
canonical image even when candidates exist.

The current `readLatestSceneBeatStoryboardImage` behavior is removed. Creation
time orders the candidate list for presentation only and never changes
selection.

The `scene.storyboard-sheet` workflow may generate one composite, inspect it,
and slice it into several files before import. That optimization is isolated in
the generation and grouped-import workflow:

1. one GenerationSpec and generation receipt describe the composite request;
2. the agent inspects and slices the composite without storing crop, panel, or
   grid metadata in Studio;
3. one grouped import names each accepted slice and its target Beat;
4. Core validates every target Beat, then delegates each slice to the same
   internal Asset attachment operation used for a single owned image;
5. one required `select` boolean controls whether every imported slice becomes
   selected for its Beat in the same transaction.

`select: false` imports all candidates without changing existing selections.
The slices may share provenance to the same generation receipt, but they do not
share an Asset, membership, or selection row.

When a new Beat Sheet revision preserves a Beat id, no Asset row, membership,
selection, association, or file is copied or carried forward. The logical Beat
owner is already unchanged. A newly authored Beat id is a different owner and
starts with no candidates unless images are deliberately imported for it.

### Shot Images And Shot Plan Copy

A Shot's images are ordinary Assets of type `shot_image` owned through
`asset_membership`. There is no `shot_image`, `shot_asset`, or Shot-specific
selection table.

The browser-safe Shot projection is:

```ts
export interface Shot {
  id: string;
  position: number;
  title: string;
  description: string;
  brief: ShotBrief;
  images: Asset[];
  selectedImageId: string | null;
}
```

There is no `ShotImage`, nested Asset wrapper, `representativeImage`,
`selectedImage` mirror, or title on a relationship object.

Copying a Shot Plan copies only each source Shot's selected image. For every
copied selected image, Core creates:

- a new Asset id;
- new AssetFile ids;
- new project-relative destination paths under the copied Shot;
- independent file bytes;
- copied current provenance references;
- a new membership owned by the copied Shot;
- a selected pointer for the copied Shot.

Unselected candidates are not copied. Deleting or discarding either Shot Plan
cannot remove or hide the other's Assets or files.

Copying the Shot Plan's current GenerationSpec remains the existing independent
Spec-copy behavior. Exact reference media named by that Spec is referenced, not
copied.

### Lookbook Details

Lookbook Images and Lookbook Sheets use the common membership:

- an Image Asset is owned by its Lookbook and has a `lookbook_image` detail
  row retaining its current id, Asset id, ordering, timestamps, and placement
  relationships;
- a Sheet Asset is owned by its Lookbook and has a `lookbook_sheet` detail row
  retaining its current id, Asset id, ordering, and timestamps;
- image section and point placements remain focused Lookbook facts;
- the separate `lookbook_card_image` table is removed in favor of
  `selected_asset`.

Existing Lookbook Image and Sheet ids remain because current placement,
discard, CLI, and UI contracts use those durable detail identities. They are
not replaced merely to make the schema look more uniform. Generic Asset
membership and canonical selection use the Asset id; focused Lookbook commands
continue using the Lookbook Image or Sheet id where that domain identity is
meaningful.

Lookbook ordering remains because the authored Lookbook image and sheet
collections are intentionally ordered. That ordering does not move into the
generic membership model.

### Asset Metadata And Public Naming

The public Asset uses the plain domain name:

```ts
export interface Asset {
  id: string;
  owner: AssetOwner;
  localeId: string | null;
  type: string;
  availability: AssetAvailability;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  referenceName: string | null;
  purpose: string | null;
  origin: string;
  files: AssetFile[];
  createdAt: string;
  updatedAt: string;
}
```

The following relationship-derived public fields are removed:

- `assetId` in favor of `id`;
- `relationshipId`;
- `target` in favor of `owner`;
- relationship `role`;
- relationship `sortOrder`.

`referenceName`, `purpose`, and `localeId` move to `asset` because exclusive
ownership means they are no longer relationship-scoped. `updateAsset` replaces
`updateAssetReference`.

Lookbook, Shot, Cast, Location, Storyboard, Dialogue Audio, generation guide,
CLI, Studio, and skill callers use the same `Asset` and `AssetFile` contracts.
There is no `AssetInfo`, `LookbookImageAsset`, `LookbookSheetAsset`, or
relationship-enriched alternate Asset type.

## Explicit Non-Goals

This plan does not:

- create a universal dependency graph or reference-retention system;
- make an Asset shareable between owners;
- add a generic owner-copy framework; Shot Plan copy is the only cross-owner
  Asset copy in scope;
- copy Character Sheets, Location Sheets, Lookbook Sheets, Dialogue Audio
  Takes, or other GenerationSpec references when copying a Shot Plan;
- add global selection for every Asset type;
- add a selected flag to `asset`, `asset_membership`, detail records, or public
  Asset;
- interpret prompt or generated-media contents;
- remove domain-specific destination folders or file naming;
- remove real Lookbook ordering, Dialogue Take, Cast Voice, provenance, or
  AssetFile facts;
- add a generic content-fingerprint or generated-against-owner revision system;
- persist Storyboard composite layout, crop boxes, panels, or slicing metadata;
- add compatibility readers, aliases, fallback owner patterns, or obsolete
  schema diagnostics;
- move, rename, or duplicate existing Asset files during the relationship-table
  conversion;
- implement the separate Shot Plans Studio UI described by plan 0157.

## Context And Evidence

### Current Schema Duplication

The current schema contains:

- six generic owner relationship tables when `shot_asset` is included;
- three focused canonical-selection tables for Cast, Location, and Shot;
- a fourth Lookbook card-selection table;
- `scene_asset` ownership plus a Storyboard association that duplicates logical
  Beat ownership across Beat Sheet revisions;
- `scene_asset` ownership plus a Dialogue Audio Take association that retains
  real Take-specific facts;
- separate Lookbook membership handling inside common attachment persistence.

The generic relationship tables repeat:

```text
id
owner id
asset_id
locale_id
role
reference_name
purpose
sort_order
created_at
updated_at
discard lifecycle
```

The public `Asset` repeats the same relationship concepts even when an Asset is
not meaningfully shareable.

### Current Selection Conflict

Current canonical choices use different implementations:

- `cast_profile_display_asset`;
- `location_hero_display_asset`;
- `lookbook_card_image`, pointing to a Lookbook Image wrapper id;
- `shot_representative_display_asset`;
- newest active `scene_beat_storyboard_image`, with no explicit pointer.

The product meaning is the same: one current visual representation from an
owned candidate collection.

Generation-scoped choices already have the correct separate owner:
`GenerationSpec.references`. ADR 0049 explicitly prevents focused display
choices from becoming request defaults.

### Current Copy Defects

`packages/core/src/server/shot-plans/copying.ts` inserts a second `shot_asset`
relationship pointing to the source Asset. The source and copy therefore share
Asset and AssetFile lifecycle.

Current Storyboard carry-forward inserts another focused association whenever a
Beat Sheet revision preserves a Beat. That work exists only because ownership
is revision-scoped in the focused table. Once `{ sceneId, beatId }` is the
Asset owner, preserving the Beat id preserves its candidates and selection
without any database mutation.

### Real Project Evidence

Read-only inspection of
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` found:

- 81 Asset rows;
- 22 Cast relationships;
- 11 Location relationships;
- 40 Scene relationships;
- 7 Lookbook Images and 1 Lookbook Sheet;
- 7 selected Cast Profiles;
- 2 selected Location Heroes;
- 1 Lookbook card image;
- 52 Beat Storyboard detail rows;
- 3 Dialogue Audio Takes.

Every one of the 81 Assets resolves to exactly one intended owner after applying
the accepted rules: Storyboard Assets use logical Scene Beat ownership,
Dialogue Audio remains Scene-owned, and other Assets use their current
aggregate relationship. There are no unowned Assets and no Asset linked to two
intended owners.

The 52 Storyboard association rows contain 37 distinct Storyboard Assets across
17 logical `{ sceneId, beatId }` owners. Zero Storyboard Assets map to more than
one logical Beat owner. The repeated rows only connect the same Asset to the
same Beat across Beat Sheet revisions. Migration can therefore collapse those
rows to one ordinary membership per Asset without copying files or preserving a
runtime Storyboard association.

Asset type and relationship role still duplicate or disagree, including:

- `scene_storyboard_image` and `storyboard_image`;
- `character_sheet` and `character-sheet`;
- `cast_profile` or `profile` and `profile`;
- `location_hero` and `hero`;
- `audio` and `dialogue_audio`.

Reference name and purpose contain real authored metadata for Character Sheets,
Cast Profiles, and Cast Voice samples. They are retained on Asset. Generic
relationship ordering mostly supplies list presentation; Lookbook order is the
current domain where ordering is explicitly meaningful.

The project has applied migrations through 0064 and reports schema generation
50. Migrations 0065 and the rejected 0066 Shot-image schema are not applied.
That makes 0066 replaceable, but it does not make the older populated Asset
tables disposable.

Implementation must migrate a verified copy first, then apply the final
replacement migration to `urban-basilica` through the normal backed-up
`renku project migrate` path. Existing Asset and AssetFile ids, paths, bytes,
provenance, metadata, focused detail ids, ordering, placement, and Trash state
must survive where those details remain part of the accepted model. Storyboard
association ids, revision links, and fingerprints are deliberately converted
to direct Beat ownership and selection rather than preserved as runtime facts.

### Current Documentation And Decisions

The implementation is constrained by:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/drizzle-migrations.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- ADR 0013 for Core-owned Assets;
- ADR 0019 for durable Lookbook images and placement;
- ADR 0029 for Cast Voice sample facts;
- ADR 0041 for opaque AI artifacts;
- ADR 0049 for request-scoped exact GenerationSpec choices;
- ADR 0052 for separating Beats from Shots; its exact Beat Sheet
  revision-scoped Storyboard ownership is superseded by logical Scene Beat
  ownership;
- ADR 0059 for Location Sheets;
- ADRs 0061 and 0062 for mutable Shot Plans and independent generated video;
- ADR 0063 for the current, now incorrect, Shot image relationship and copy
  behavior.

Current architecture references disagree about the Storyboard artifact:

- `data-model-and-storage.md` correctly describes durable per-Beat Assets and a
  temporary composite;
- `project-files-and-assets.md` still describes Scene plus Beat attachment;
- `domain-vocabulary.md` describes the composite and all slices as files under
  one Asset;
- ADR 0052 ties images to one exact Beat Sheet revision.

The accepted direction in this plan resolves that conflict: only accepted
slices become durable Assets, each slice is owned by the logical Scene Beat,
and the batch composite/slicing workflow creates no alternative ownership
model.

Current Drizzle documentation and the repository migration policy both require
the TypeScript schema to remain the source of truth, followed by
`drizzle-kit generate` and `drizzle-kit migrate`. Drizzle's custom SQL workflow
is appropriate for the one-way row conversion that a schema diff cannot infer;
it remains inside migration 0066 and is not a runtime compatibility path.

## Right-Sized Change Decision

### Option 1: Reuse The Existing Contracts Unchanged

Rejected. It preserves shared Shot Assets, implicit newest-wins Storyboards,
four selection patterns, duplicated relationship columns, and multiple public
Asset shapes.

### Option 2: Refactor The Existing Asset Owner Boundary

Accepted. The existing Asset, AssetFile, generation attachment, file
destination, provenance, Trash, resource-key, and GenerationSpec systems remain.
The duplicated relationship and canonical-selection implementations are
replaced at their Core owner.

This introduces only:

- one common membership table;
- one common selected pointer;
- one typed owner union;
- one focused Shot image copy operation;
- one grouped Storyboard import adapter that delegates each slice to the common
  owned-Asset attachment operation;
- one custom preservation section in replacement migration 0066 for populated
  existing tables.

### Option 3: Add `shot_image`, `AssetInfo`, Or Another Domain Adapter

Rejected. It would add another pattern beside already inconsistent Cast,
Location, Lookbook, Storyboard, and Dialogue implementations and would not
remove their duplicated code.

## Architecture Shape Gate

### Ownership

`packages/core` owns:

- `AssetOwner`, Asset, selection targets, and mutation reports;
- Asset metadata, exclusive membership, selection, lifecycle, and focused Shot
  copy rules;
- canonical Asset type validation;
- generation attachment integration;
- purpose-specific domain detail records;
- database schema and Drizzle migration;
- project-relative file persistence and rollback;
- structured diagnostics and resource keys.

`packages/cli` owns only:

- parsing `asset` and `media import` flags/documents;
- parsing typed owner and selection targets;
- calling Core once for each user intent;
- formatting reports and emitting refresh events.

`packages/studio/server` owns only:

- HTTP request parsing;
- typed owner and selection-target request parsing;
- Core delegation;
- structured error serialization.

`packages/studio/src` owns only:

- rendering candidate collections and current selected state;
- sending select, clear, import, and discard intent;
- preserving domain-specific visible wording such as Profile, Hero, card
  image, Shot image, and Storyboard image.

Studio Skills own workflow guidance, media inspection, user approval, and
choosing exact GenerationSpec references. They do not infer or write database
state outside CLI commands.

### Intended Core Module Layout

```text
packages/core/src/client/
  assets.ts
  shot-plans.ts
  scene-beat-sheet.ts
  visual-language.ts
  resources.ts

packages/core/src/server/schema/
  assets.ts
  scene-beat-sheets.ts
  scene-dialogue-audio.ts
  visual-language.ts
  shot-plans.ts
  display-assets.ts                 # deleted

packages/core/src/server/database/access/
  assets.ts
  asset-files.ts
  asset-memberships.ts
  selected-assets.ts
  asset-relationships/              # deleted
  display-assets.ts                 # deleted
  shot-plans/image-records.ts       # deleted

packages/core/src/server/assets/
  owner-keys.ts
  ownership.ts
  projection.ts
  selection.ts
  metadata.ts
  resources.ts
  index.ts

packages/core/src/server/generation/
  attachment-destinations.ts
  attachment-persistence.ts
  attachments.ts
  scene-storyboard-attachments.ts
  reference-slots/domain-assets.ts

packages/core/src/server/shot-plans/
  copying.ts
  image-copying.ts
  image-lifecycle.ts
  projection.ts

packages/core/src/server/scene-beat-sheet/
  storyboard-status.ts
```

Responsibilities:

- `owner-keys.ts` is the only persistence encoder/decoder for typed
  `AssetOwner` values.
- `ownership.ts` validates owners and creates or reads membership.
- `projection.ts` assembles the one public Asset shape and paginated lists.
- `selection.ts` owns the five canonical-selection capabilities.
- `metadata.ts` owns Asset metadata updates.
- existing focused Trash lifecycle modules own individual Asset and
  owner-aggregate discard/restore interaction; the Asset module supplies
  ownership and selection operations to those modules.
- `image-copying.ts` performs the one concrete cross-owner copy required by
  Shot Plan copy through existing file write-set and provenance access.
- `scene-storyboard-attachments.ts` is a bounded batch adapter: it validates the
  grouped document and delegates every accepted slice to the common owned-Asset
  attachment operation. It does not own a second persistence model.
- `storyboard-status.ts` projects common Beat-owned Asset candidates and the
  common selected pointer; it does not infer freshness or newest-wins state.
- existing purpose and domain modules remain responsible for their real detail
  rows and resource keys.

`packages/core/src/server/assets/index.ts` is the only index in this module. It
may export the focused server operations but contains no validation,
persistence, dispatch, or filesystem logic.

### Owner Key Boundary

SQLite cannot attach one polymorphic foreign key to several owner tables.
Persistence therefore stores one internal `owner_key`:

```text
project
castMember:<encoded-id>
location:<encoded-id>
sequence:<encoded-id>
scene:<encoded-id>
sceneBeat:<encoded-scene-id>:<encoded-beat-id>
lookbook:<encoded-id>
shot:<encoded-id>
```

Each id segment is encoded and decoded by `owner-keys.ts`. Owner keys never
appear in public contracts, CLI JSON, HTTP requests, UI state, or skills.

Core validates the decoded typed owner before writes. A Scene Beat owner must
identify a Beat in the Scene's current Beat Sheet when a new Asset is attached
or selected. Corrupt persisted owner keys fail with a structured storage
diagnostic; they are not guessed or repaired.

`selected_asset.owner_key` reuses this exact encoding. There is no separate
selection-key codec or Beat-specific identity. Core restricts canonical
selection to the accepted owner/type combinations, but the pointer still
belongs to the same owner that owns the candidate.

### Bounded Dispatch

Two bounded discriminations are allowed:

- owner existence and resource-key resolution switch on `AssetOwner.kind`;
- canonical selection validation maps the five accepted owner kinds to their
  Asset type and validates direct membership for all five.

Generation purpose-to-destination mapping remains in the existing focused
attachment descriptor table. It supplies an Asset owner and Asset type rather
than a relationship role or Lookbook-only membership branch.

No plugin framework, generic callbacks, dependency registry, or arbitrary
state patch API is added.

### Files Expected To Shrink Or Disappear

The following disappear:

- `packages/core/src/server/database/access/asset-relationships/`;
- `packages/core/src/server/schema/display-assets.ts`;
- `packages/core/src/server/database/access/display-assets.ts`;
- `packages/core/src/server/commands/display-asset-commands.ts`;
- `packages/core/src/server/database/access/shot-plans/image-records.ts`;
- `packages/core/src/server/database/access/scene-beat-storyboard-images.ts`;
- the `scene_beat_storyboard_image` schema and its insert/read/delete paths;
- Beat Sheet Storyboard carry-forward writes;
- Shot-specific image-selection command implementations after callers move to
  common Asset selection.

The following lose branches or duplicated shape assembly:

- `schema/assets.ts`;
- `schema/visual-language.ts`;
- `schema/scene-beat-sheets.ts`;
- `schema/shot-plans.ts`;
- `generation/attachment-persistence.ts`;
- `generation/attachment-destinations.ts`;
- `generation/scene-storyboard-attachments.ts`;
- `generation/references.ts`;
- `database/access/generation-references.ts`;
- `resources/screenplay-ui.ts`;
- `resources/scene-beats.ts`;
- `resources/storyboard-overviews.ts`;
- `trash/asset-tree-lifecycle.ts`;
- `trash/trash-object-registry.ts`;
- Studio Asset routes and service clients, which retain product-facing route
  names but lose purpose-specific selection business logic.

### Explicitly Forbidden Shapes

Stop implementation if it introduces:

- another owner-specific membership or canonical-selection table;
- `ShotImage`, `AssetInfo`, or a second generic Asset projection;
- a selected boolean on Asset, membership, or detail rows;
- sharing one Asset between copied owners;
- owner counts used to decide whether a copied Asset may be discarded;
- a new relationship id, role, sort order, or Trash lifecycle on membership;
- a generic detail callback or switchboard inside attachment persistence;
- a Storyboard-only durable association, fingerprint, staleness, ownership, or
  selection path after slices are imported;
- a CLI-, route-, UI-, or skill-local selection capability list;
- any global selected state for Character Sheets, Location Sheets, Lookbook
  Sheets, or Dialogue Audio Takes;
- a fallback reader for old relationship tables;
- a source-text architecture test that freezes private function names;
- a runtime compatibility reader, repair path, or second migration framework;
- a migration that drops still-required ownership, detail, metadata, selection,
  ordering, placement, Trash, or provenance facts instead of mapping them to
  the accepted model;
- a migration that changes existing AssetFile ids, paths, or bytes.

### Stop Conditions

Pause and revise before continuing when:

- one file begins implementing owner validation, selection, copy, lifecycle,
  projection, and file persistence together;
- a purpose-specific detail record starts duplicating its owner or selection;
- the common model requires a new public wrapper for one owner;
- adding one purpose requires changing CLI or Studio selection business logic;
- request-scoped references begin reading canonical selected state;
- Shot copy can succeed without allocating new Asset and AssetFile identities;
- Beat Sheet revision creation writes, copies, or re-associates an image for an
  unchanged logical Beat;
- grouped Storyboard import bypasses the common owned-Asset attachment and
  selection services;
- `attachment-persistence.ts` retains special owner-table inserts instead of
  delegating to common membership and focused detail owners;
- the schema can represent one Asset in more than one membership;
- a checklist item can pass only by accepting a god file or broad dispatcher.

## Contracts

### Database Contract

`asset` adds:

```text
locale_id       text null references project_locale(id)
reference_name  text null
purpose         text null
```

`asset_membership`:

```text
asset_id    text primary key references asset(id) on delete cascade
owner_key   text not null
created_at  text not null
updated_at  text not null
```

Index:

- `asset_membership_owner_idx` on `(owner_key, asset_id)`.

`selected_asset`:

```text
owner_key   text primary key
asset_id    text not null references asset(id) on delete cascade
created_at  text not null
updated_at  text not null
```

Core validates the typed selectable owner, direct Asset membership,
availability, and canonical Asset type before writing the pointer. Adapters
enforce none of those rules.

Removed tables:

- `project_asset`;
- `cast_asset`;
- `location_asset`;
- `sequence_asset`;
- `scene_asset`;
- `shot_asset`;
- `cast_profile_display_asset`;
- `location_hero_display_asset`;
- `lookbook_card_image`;
- `shot_representative_display_asset`.

Focused detail changes:

- `lookbook_image` retains its existing id, unique `asset_id`, `sort_order`,
  timestamps, and placement relationships; membership replaces its duplicated
  `lookbook_id`;
- `lookbook_sheet` retains its existing id, unique `asset_id`, `sort_order`,
  and timestamps; membership replaces its duplicated `lookbook_id`;
- `scene_dialogue_audio_take` retains its Take id and every domain fact; its
  Asset uses the existing Scene membership;
- Shot Plans add no image table.

`scene_beat_storyboard_image` is removed after migration derives one
`sceneBeat` membership and initial selected pointer for every logical Beat.
Its row id, Beat Sheet revision id, source-purpose mirror, exact-file mirror,
fingerprint, and association lifecycle fields are not copied into another
runtime table because Asset, AssetFile, provenance, membership, and selection
already own the durable facts the accepted product uses.

Generic membership does not contain `id`, title, locale, role, reference name,
purpose, sort order, availability, selection, or discard columns.

### Public Core Inputs And Reports

```ts
export type AssetSelectionTarget =
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'shot'; id: string }
  | { kind: 'sceneBeat'; sceneId: string; beatId: string };

export interface SelectAssetInput {
  projectName: string;
  target: AssetSelectionTarget;
  assetId: string;
}

export interface ClearAssetSelectionInput {
  projectName: string;
  target: AssetSelectionTarget;
}

export interface AssetSelectionReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: ProjectReport;
  target: AssetSelectionTarget;
  selectedAssetId: string | null;
  resourceKeys: string[];
}

export interface AssetPage {
  items: Asset[];
  nextCursor: string | null;
  selectedAssetId: string | null;
}
```

Public Core operations:

- `listAssets` and `listAssetPage` accept `owner: AssetOwner` and optional
  `type` and `mediaKind` filters;
- `listAssetPage` returns candidate Assets and the owner's selected Asset id in
  the same read; unsupported or currently unselected owners return `null`;
- `updateAsset` mutates Asset metadata by Asset id;
- `selectAsset`;
- `clearAssetSelection`;
- existing Asset discard/restore operations derive and validate membership;
- `attachGenerationMedia` accepts `select?: boolean`;
- `attachSceneStoryboardImages` reads the document's required `select`.

Removed public operations:

- `updateAssetReference`;
- `setCastProfileDisplayAsset`;
- `clearCastProfileDisplayAsset`;
- `setLocationHeroDisplayAsset`;
- `clearLocationHeroDisplayAsset`;
- `setLookbookCardImage`;
- `clearLookbookCardImage`;
- `setShotRepresentativeImage`;
- `clearShotRepresentativeImage`;
- Shot-specific discard behavior that depends on shared-owner counts.

There are no aliases for removed operations.

### Domain Projection Changes

- Cast and Location candidate panels read selection from
  `AssetPage.selectedAssetId`; their navigation imagery resolves that same
  selected Profile or Hero instead of a separate display choice.
- Lookbook resources expose `selectedImageId`; card projection resolves that
  exact Lookbook Image Asset.
- `Shot.images` contains ordinary Assets and `Shot.selectedImageId` contains
  the separate pointer.
- Beat Storyboard status returns ordinary Beat-owned Assets and one
  `selectedImageId`, matching the Shot projection pattern.
- Sequence, Act, Director, and Shot Plan Beat context resolve only the selected
  current Storyboard Image.
- `ScreenplayImageReference` removes `relationshipId`.
- public Lookbook Image and Sheet wrappers use the common `Asset` contract and
  contain
  only their real placement/order facts.
- Dialogue Audio projections remain Take-oriented and gain no selected field.

### CLI Contract

Current Asset commands become:

```text
renku asset list --owner <owner> [--type <asset-type>] --json
renku asset update <asset-id> [metadata flags] --json
renku asset select --target <selection-target> --asset <asset-id> --json
renku asset clear-selection --target <selection-target> --json
```

Owner syntax:

```text
project
cast:<cast-member-id>
location:<location-id>
sequence:<sequence-id>
scene:<scene-id>
beat:<scene-id>:<beat-id>
lookbook:<lookbook-id>
shot:<shot-id>
```

Selection target syntax:

```text
cast:<cast-member-id>
location:<location-id>
lookbook:<lookbook-id>
shot:<shot-id>
beat:<scene-id>:<beat-id>
```

`media import` adds:

```text
--select
```

Core accepts explicit selection only for the five canonical purpose/target
combinations. CLI forwards the boolean and does not own the capability matrix.

The grouped `sceneStoryboardImagesImport` document adds required:

```json
{
  "select": true
}
```

Removed command paths:

- `lookbook card-image set|clear`;
- `shot-plan shot image select|clear`;
- relationship `--role` filters and `asset reference-update`.

Domain-specific image discard and Lookbook placement commands may remain where
they express domain-specific lifecycle or placement intent. They delegate Asset
ownership and selected-pointer effects to Core.

### Studio HTTP Contract

Keep domain-named Studio selection routes for Profile, Hero, Lookbook Image,
Shot Image, and Beat Storyboard interactions. Rename current `display` and
`representative` wording directly to `selected` where those routes already
exist. Every handler constructs one typed `AssetSelectionTarget`, calls
`selectAsset` or `clearAssetSelection`, and serializes the common report. No
route owns capability, membership, type, or lifecycle rules, and no new generic
selection endpoint is required merely to make the URLs uniform.

Owner Asset listing uses one typed Asset resource route. Asset files use the
existing owner-independent Asset id and AssetFile id route. Owner-specific
image URLs and response builders are removed when their only job is to
repackage the same AssetFile route.

### Structured Diagnostics

Core owns:

- `CORE_ASSET_OWNER_INVALID` for a missing, malformed, or mismatched owner;
- `CORE_ASSET_OWNERSHIP_CONFLICT` when an Asset already has a different
  membership;
- `CORE_ASSET_SELECTION_UNSUPPORTED` when the target kind has no canonical
  selection;
- `CORE_ASSET_SELECTION_INVALID` when the Asset is missing, discarded, belongs
  to another owner, has the wrong type, or is otherwise unavailable;
- `CORE_ASSET_STORAGE_INVALID` for a malformed persisted owner key or broken
  membership/selection invariant.

Existing file, provenance, GenerationSpec, Trash, and destination diagnostics
remain responsible for their boundaries. CLI and HTTP adapters serialize Core
diagnostics instead of replacing them.

## Schema And Migration Policy

The Drizzle TypeScript schema remains the source of truth. The existing
`0066_concerned_the_fury.sql` and snapshot remain immutable migration history.
The unified ownership change is additive migration
`0067_unified_asset_ownership.sql`, generated from the 0066 snapshot, and
advances the schema to generation 53. It preserves 0066's accepted non-image
Shot title, Shot Trash, Shot Plan indexes, authored-from-Plan GenerationSpec
changes, and existing Shot Asset ownership and selection while converting the
rejected Shot-specific tables into the common contracts.

Drizzle Kit cannot infer how rows from several relationship and selection
tables map into the common tables. Migration 0067 therefore contains a
documented custom preservation section inside the generated SQL. This is the
repository's accepted custom-migration mechanism, not a TypeScript migration
registry or runtime fallback.

The conversion must:

1. fail transactionally unless every existing Asset resolves to exactly one
   intended owner across Project, Cast, Location, Sequence, Scene, Scene Beat,
   Lookbook, and Shot sources;
2. copy `locale_id`, `reference_name`, and `purpose` from the one generic
   relationship into its Asset row;
3. insert one `asset_membership` row from each generic relationship, plus
   Lookbook ownership from `lookbook_image` and `lookbook_sheet`, except that a
   Storyboard Asset's repeated Scene relationship is replaced by one
   `sceneBeat:<sceneId>:<beatId>` membership derived from its focused rows;
4. preserve membership timestamps from the source relationship or Lookbook
   detail, using the earliest active Storyboard association timestamp for a
   collapsed Beat-owned Asset;
5. convert Cast Profile, Location Hero, and Lookbook card selections with their
   original Asset ids and timestamps;
6. seed explicit Storyboard selections from the newest active image that the
   current implementation would display for each active logical
   `{ sceneId, beatId }`;
7. normalize only the known inconsistent product-owned Asset type values;
8. rebuild Lookbook detail tables while preserving ids, Asset ids, order,
   placement, timestamps, and Trash lifecycle;
9. preserve every Dialogue Audio Take row and its Asset/File, Cast Voice,
   provider, text, settings, language, and Trash facts;
10. assert that every Storyboard Asset's focused rows agree on exactly one
    logical `{ sceneId, beatId }` owner before dropping
    `scene_beat_storyboard_image`;
11. assert post-copy row counts and foreign-key integrity before dropping the
    superseded relationship and focused selection tables.

Only fields deliberately removed from the product contract are not copied as
standalone values: relationship ids, relationship roles after their known
meaning is normalized into Asset type, generic relationship sort order, and
relationship-level Trash columns already represented by the Asset tree.
Migration asserts that relationship and Asset Trash state agree before dropping
the duplicate columns. Lookbook order and the focused detail ids retained by
the accepted Lookbook, Dialogue Audio, and Cast Voice models remain.

The conversion does not move or copy project files. Existing Assets already map
to one intended owner, including all 37 Storyboard Assets mapping unambiguously
to one of 17 logical Scene Beats, so Asset ids, AssetFile ids,
project-relative paths, bytes, hashes, dimensions, provenance, and generation
references remain unchanged. Storyboard association ids, revision links, and
fingerprints are intentionally retired rather than migrated as compatibility
state. If another development database violates the ownership precondition,
migration fails after the standard verified database backup instead of guessing
or sharing an Asset between owners.

There is no 0067 compatibility migration, legacy reader, migration-at-read
path, alias, or repair branch. Obsolete table and type names appear only in the
one-way SQL conversion and historical documentation.

Verification proceeds in this order:

1. generate and inspect replacement migration 0066, snapshot, and journal;
2. run fresh-schema migration tests;
3. run the migration against a copy of the real `urban-basilica` project
   database and compare pre/post inventories;
4. verify every referenced AssetFile still exists at the same path and matches
   its stored hash;
5. after those checks pass, migrate the real project through
   `renku project migrate urban-basilica`, which creates the standard verified
   pre-migration database backup;
6. run post-migration Core, CLI, and Studio reads against the real project.

## Implementation Slices

### Slice 1: Record The Unified Decision

Files:

- new ADR `docs/decisions/0064-use-exclusive-asset-membership-and-scoped-selection.md`;
- concise notices in affected older ADRs;
- current Asset architecture documentation.

Work:

- record exclusive Asset membership;
- distinguish canonical selected Assets from GenerationSpec references;
- record independent copy semantics;
- record the internal owner-key boundary;
- supersede ADR 0063's Shot relationship, representative naming, shared-copy,
  and owner-count clauses;
- narrow ADRs 0013, 0019, 0029, 0049, 0052, and 0059 only where their table,
  role, or selection implementation changes;
- preserve each older ADR's historical body.

Plan 0157 currently reserves ADR number 0064 for its future UI decision. Update
that unimplemented reservation to 0065 so the accepted Asset decision uses the
next actual decision number without collision.

### Slice 2: Replace The Public Asset Contract

Files:

- `packages/core/src/client/assets.ts`;
- `packages/core/src/client/shot-plans.ts`;
- `packages/core/src/client/scene-beat-sheet.ts`;
- `packages/core/src/client/visual-language.ts`;
- `packages/core/src/client/resources.ts`;
- direct Core, CLI, Studio, and test callers.

Work:

- add `AssetOwner` and `AssetSelectionTarget`;
- include logical Scene Beat ownership in both contracts;
- replace the relationship-enriched Asset with the one public Asset;
- use `id`, `owner`, canonical type, and Asset-owned metadata;
- retain `files` and the existing AssetFile contract;
- remove `AssetReference`, `relationshipId`, relationship role/order, and
  duplicated Lookbook Asset shapes;
- project Shot image lists and selected ids;
- project Beat Storyboard candidate lists and selected ids;
- keep domain wrappers only for real detail facts.

### Slice 3: Replace The Schema Through Drizzle Kit

Files:

- `packages/core/src/server/schema/assets.ts`;
- `packages/core/src/server/schema/visual-language.ts`;
- `packages/core/src/server/schema/scene-beat-sheets.ts`;
- `packages/core/src/server/schema/scene-dialogue-audio.ts`;
- `packages/core/src/server/schema/shot-plans.ts`;
- `packages/core/src/server/schema/index.ts`;
- `packages/core/drizzle/0066_*.sql`;
- `packages/core/drizzle/meta/0066_snapshot.json`;
- `packages/core/drizzle/meta/_journal.json`;
- schema lifecycle tests.

Work:

- add `asset_membership` and `selected_asset`;
- move Asset-owned metadata to `asset`;
- remove generic relationship and focused selection tables;
- preserve real Lookbook and Dialogue Audio detail tables;
- remove `scene_beat_storyboard_image` after converting its populated rows to
  Beat memberships and selections;
- remove `shot_asset` and `shot_representative_display_asset`;
- retain every accepted non-image Shot and GenerationSpec schema change from
  the replaced 0066 migration;
- generate the replacement migration with Drizzle Kit;
- add the documented custom SQL preservation section;
- migrate every populated relationship, metadata, selection, Lookbook,
  Storyboard, and Dialogue Audio row before dropping old tables;
- preserve existing Asset/File ids and paths;
- add no compatibility schema or runtime legacy reader.

### Slice 4: Add Focused Asset Ownership Modules

Files:

- new `packages/core/src/server/assets/*`;
- new database access modules for membership and selected Assets;
- `packages/core/src/server/entity-ids.ts`;
- current Asset command/resource/service wiring.

Work:

- implement typed owner-key encoding and decoding;
- reuse the owner-key encoding for `selected_asset`;
- validate every owner kind at Core;
- insert Asset plus membership atomically;
- list and project Assets through one path;
- update Asset metadata at the Asset row;
- select and clear through one capability owner;
- remove relationship access, display access, and their ids;
- keep the public and server `index.ts` files thin.

### Slice 5: Unify Generation Attachment And Purpose Guides

Files:

- `packages/core/src/server/generation/attachment-destinations.ts`;
- `packages/core/src/server/generation/attachment-persistence.ts`;
- `packages/core/src/server/generation/attachments.ts`;
- focused purpose modules;
- reference-slot and generation-reference access modules;
- attachment and purpose-guide tests.

Work:

- make every attachment descriptor supply one Asset owner and canonical Asset
  type;
- remove `relationshipRole` and the Lookbook membership exception;
- persist Asset, AssetFile, provenance, membership, and optional selection in
  one database/filesystem write set;
- keep focused Lookbook detail inserts outside generic membership logic;
- filter candidate guides by owner and Asset type;
- prove Character/Location/Lookbook Sheets and Dialogue Audio use only saved
  GenerationSpec references;
- reject unsupported `select` before writing database rows or files.

### Slice 6: Make Storyboard Slices Ordinary Beat-Owned Images

Files:

- `packages/core/src/server/generation/scene-storyboard-attachments.ts`;
- `packages/core/src/server/scene-beat-sheet/storyboard-status.ts`;
- `packages/core/src/server/scene-beat-sheet/operations.ts`;
- `packages/core/src/server/scene-beat-sheet/history.ts`;
- delete
  `packages/core/src/server/database/access/scene-beat-storyboard-images.ts`;
- Scene Beat, Sequence, Act, Director, and Shot Plan Beat projections.

Work:

- make every accepted slice an ordinary Asset owned by its logical Scene Beat;
- delegate single-slice persistence to the same internal owned-image attachment
  operation used by Shot images;
- import grouped candidates with explicit `select`;
- replace newest-wins reads with selected-pointer reads;
- return ordinary Asset candidates for Beat review;
- use selected current images in downstream canonical projections;
- remove fingerprint freshness checks and revision-association writes;
- remove carry-forward calls from Beat Sheet create/history paths because an
  unchanged logical owner needs no image mutation;
- keep composite generation, inspection, slicing, and grouped document parsing
  separate from durable ownership;
- remove Scene relationship and Storyboard detail rows only after migration
  creates equivalent Beat memberships and initial selections.

### Slice 7: Correct Shot Copy And Asset Lifecycle

Files:

- `packages/core/src/server/assets/lifecycle.ts`;
- `packages/core/src/server/shot-plans/copying.ts`;
- `packages/core/src/server/shot-plans/image-copying.ts`;
- `packages/core/src/server/shot-plans/image-lifecycle.ts`;
- `packages/core/src/server/shot-plans/projection.ts`;
- Trash registry and Asset tree lifecycle modules.

Work:

- implement the focused Shot Asset-to-new-Shot copy;
- allocate new Asset ids, AssetFile ids, paths, and bytes;
- preserve current provenance references without inventing new generation
  history;
- copy only selected Shot images;
- remove shared-owner counts;
- clear selection for individual selected-Asset discard;
- preserve aggregate selection across whole-owner Trash restore;
- prove source and copy deletion independence;
- roll back database and filesystem work together.

### Slice 8: Replace CLI And Studio Adapter Duplication

Files:

- `packages/cli/src/commands/asset-command.ts`;
- common CLI owner parsing;
- media import command/document handlers;
- Lookbook and Shot image command handlers;
- `packages/studio/server/routes/assets.ts`;
- Studio HTTP request parsers;
- Studio Asset service clients;
- Cast, Location, Lookbook, Beat, and affected overview projections/components.

Work:

- add `asset select`, `asset clear-selection`, and `media import --select`;
- require grouped Storyboard import `select`;
- remove relationship role flags and domain selection command duplicates;
- keep domain-named HTTP routes thin over the common Core selection operation;
- update current UI surfaces to send selected-Asset intent;
- show all Beat Storyboard candidates and one explicit selected state;
- keep sheets and Dialogue Audio Takes free of global selected styling;
- keep UI wording domain-specific and never expose raw owner keys or Asset type
  strings as visible copy.

Plan 0157 remains responsible for building the future Shot Plan Studio UI. This
slice updates only existing Studio callers and the contracts plan 0157 will
consume.

### Slice 9: Update Skills For Coarse Intent

Files in `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- `skills/media-producer/SKILL.md`;
- Profile, Hero, Lookbook Image, Shot Image, Storyboard, Sheet, Dialogue, and
  workflow references;
- grouped Storyboard import sample;
- `skills/shot-planner/SKILL.md`;
- selected-image workflow, CLI workflow, samples, and evals;
- `skills/scene-beat-designer` workflow and samples;
- `skills/lookbook-designer` workflow and samples;
- affected casting, production-design, and movie-director handoffs;
- focused forward evals.

Workflow rules:

1. retain Preview, approval, execution, inspection, and acceptance steps;
2. after acceptance, import a canonical image with `--select` in one call when
   selection is the explicit intent;
3. import a grouped Storyboard with one document and one `select` choice;
4. use `asset select` only when choosing an already imported candidate;
5. never create global selection for Character Sheets, Location Sheets,
   Lookbook Sheets, or Dialogue Audio Takes;
6. store those exact choices only in the consuming GenerationSpec;
7. do not re-read unchanged context or perform one small mutation per initial
   aggregate member.

Rename current representative-image skill files and evals directly to selected
terminology. Do not leave forwarding files or aliases.

### Slice 10: Documentation And Dependent Plans

Files:

- current Asset, storage, generation, CLI, and domain-vocabulary docs;
- plan 0156 supersession notice;
- plan 0157 contract dependency;
- plan 0158 supersession notice;
- current Studio Skills documentation.

Work:

- document the one Asset and ownership model;
- document canonical versus request-scoped selection;
- document independent copy semantics;
- remove current role-based and newest-wins descriptions;
- add concise notices to older plans without rewriting their history;
- keep rejected names only in historical supersession context.

## Tests And Guardrails

### Schema And Ownership

- fresh schema contains `asset`, `asset_file`, `asset_membership`, and
  `selected_asset`;
- removed relationship and selection tables do not exist;
- one Asset can have exactly one membership;
- Core rejects a selected pointer whose target owner, direct membership, and
  Asset type do not match;
- every Core-created Asset receives one membership in the same transaction;
- missing or malformed owners fail before database or file writes;
- membership has only the planned fields and timestamps;
- reference name, purpose, and locale persist on Asset;
- generic membership has no role or sort order;
- canonical purpose attachment writes the expected Asset type.

### Canonical Selection

- each supported target can have zero or one selected Asset;
- selecting a second candidate replaces the pointer atomically;
- clearing leaves all candidates active;
- another owner's Asset fails;
- an unsupported owner kind fails;
- an unsupported Asset type fails;
- missing, discarded, or unavailable Assets fail;
- selecting does not modify Asset metadata, membership, or GenerationSpecs;
- Cast, Location, Lookbook, Shot, and Scene Beat all use the same Core
  operation;
- individual selected-Asset discard clears selection;
- individual restore does not reselect;
- parent discard/restore preserves aggregate selection.

### Request-Scoped Generation Choice

- Character Sheet candidates are filtered by `character_sheet`;
- Location Sheet candidates are filtered by `location_sheet`;
- Lookbook Sheet candidates are filtered by `lookbook_sheet`;
- Dialogue Audio candidates resolve exact Take AssetFiles;
- choosing any of these updates only one saved GenerationSpec;
- two Specs may choose different candidates;
- no guide or Preview initialization reads `selected_asset`;
- no request-scoped candidate type is accepted by `selectAsset`.

### Storyboard

- Beat and Shot candidates use the same membership, listing, selection,
  discard, and restore operations;
- one Beat retains multiple candidates;
- import with `select: false` changes no pointer;
- import with `select: true` selects each exact imported Beat image;
- importing a newer candidate does not silently select it;
- Beat, Sequence, Act, Director, and Shot Plan context use only the selected
  current image;
- every imported slice has its own Asset, AssetFile, Beat membership, and
  optional selected pointer while retaining provenance to the grouped
  generation;
- Beat Sheet revision creation performs no Storyboard Asset, membership,
  selection, association, or file write for preserved Beat ids;
- no Storyboard association, fingerprint, staleness, crop, panel, or grid state
  exists after import;
- Shot copy tests, not Beat revision tests, prove cross-owner Asset
  independence.

### Shot Copy

- a Shot exposes ordinary Asset candidates plus `selectedImageId`;
- a copied plan with no selected images creates no image Assets;
- every copied selected image has new Asset and AssetFile ids;
- every copied file has a new destination path;
- bytes and content hashes match the source;
- current provenance remains traceable;
- unselected candidates are not copied;
- source and copy can be discarded, restored, and garbage-collected
  independently;
- forced row, path, byte-copy, provenance, membership, or selection failure
  leaves no partial rows or files.

### Focused Detail Records

- Lookbook Image/Sheet ids, order, and placement remain unchanged;
- Lookbook selected card resolution uses `selected_asset`;
- Storyboard images need no focused detail record after Beat ownership and
  provenance are represented by common Asset facts;
- Dialogue Audio Take retains every existing provider and settings fact;
- Cast Voice retains its provider registration and sample link;
- no detail table stores a selected boolean or generic relationship metadata.

### Existing-Data Migration

- migration 0066 upgrades a fixture at the same 0064/schema-generation-50 state
  as `urban-basilica`;
- all pre-migration Asset and AssetFile ids, paths, hashes, provenance, and
  generation references are identical afterward;
- every pre-migration Asset receives exactly one membership;
- Cast, Location, Sequence, Scene, Scene Beat, Project, and Lookbook ownership
  counts match the explicit conversion map, with Storyboard Scene relationships
  replaced rather than duplicated;
- Asset metadata and known type normalization match the explicit conversion
  map;
- retired relationship ids, roles, generic sort order, and duplicate Trash
  columns do not survive as compatibility state;
- Cast, Location, and Lookbook canonical selections preserve exact Assets and
  timestamps;
- each active Beat that previously displayed a latest Storyboard receives that
  exact Asset as its explicit selection;
- all Storyboard Assets map to one logical Beat membership, repeated
  revision-association rows are removed, and no file identities or paths
  change;
- Lookbook detail ids, ordering, placements, Dialogue Audio Takes, and Trash
  state survive exactly;
- foreign-key and quick checks pass before superseded tables are dropped;
- ambiguous or multiply owned fixture data aborts the migration transaction;
- no project file is created, moved, renamed, or removed by migration.

### CLI And Studio

- CLI parses every supported owner form;
- CLI forwards `--select` without a local capability matrix;
- grouped Storyboard import requires one explicit selection boolean;
- import-and-select returns one Core report and one refresh event;
- selecting an existing candidate needs one command;
- removed command paths are absent rather than aliased;
- HTTP routes parse and delegate only;
- UI canonical cards display selected state;
- Character/Location/Lookbook Sheet and Dialogue Take pickers display only
  request-scoped Spec state;
- adapters test translation and visible behavior without duplicating Core's
  invalid-state matrix.

### Skills

Forward evals reject:

- import followed by a separate selection call for the same accepted canonical
  output;
- one selection call per Beat after a grouped selected Storyboard import;
- treating the first or newest candidate as selected;
- creating global Character Sheet, Location Sheet, Lookbook Sheet, or Dialogue
  Audio selection;
- skipping Preview, approval, execution approval, inspection, or output
  acceptance merely to reduce calls;
- using representative terminology or removed commands.

### Architecture Guardrails

Stable tests protect:

- browser-safe packages do not import server/database modules;
- one Asset cannot acquire two memberships;
- invalid selection fails before writes;
- request-scoped GenerationSpec changes do not mutate `selected_asset`;
- server and CLI adapters call focused Core operations;
- generated schema matches the public persistence contract.

Architecture tests must not list private helpers, complete service inventories,
or retired function names as source-text needles.

## Documentation

Add ADR 0064 and update:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- current CLI reference and examples;
- Studio Skills references and samples.

Add concise supersession or narrowing notices to affected ADRs. Do not rewrite
their historical reasoning.

Plan 0158 becomes superseded by this plan. Plan 0156 retains its completed
non-image Shot Plan work. Plan 0157 is updated to use `Shot.images`,
`selectedImageId`, the common Asset contract, and common selection service.

## Final Verification

Run focused checks:

```bash
pnpm build:core
pnpm test:core
pnpm test:cli
pnpm --filter @gorenku/studio test
```

Run the affected skill validators and evals from:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

Then run:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Migration verification:

- generate additive migration 0067 through Drizzle Kit;
- inspect generated SQL, documented custom preservation section, snapshot, and
  journal;
- apply it to a fresh project database;
- apply it to a copy of the real schema-generation-50 project database;
- compare pre/post Asset, AssetFile, owner, metadata, type, selection, detail,
  placement, Trash, provenance, and generation-reference inventories;
- verify every existing AssetFile path and hash against the unchanged project
  files;
- verify schema generation 53 and SQLite foreign-key/quick checks;
- migrate the real `urban-basilica` project through `renku project migrate`
  after the copy passes;
- record and verify the standard pre-migration backup;
- verify no compatibility schema, reader, alias, or runtime repair path was
  added.

Behavior verification on a disposable project:

1. import several Character and Location Sheets and choose different exact
   files in two GenerationSpecs;
2. import and select Profile, Hero, and Lookbook Images;
3. import a grouped Storyboard with `select: true`, verify each slice is an
   ordinary Beat-owned Asset, add an unselected candidate, change the explicit
   selection, and preserve it across an unchanged logical Beat without any
   carry-forward write;
4. create Shot image candidates, select one, copy the Shot Plan, and verify
   independent ids, paths, bytes, and deletion;
5. create multiple Dialogue Audio Takes and choose different exact Takes in
   separate GenerationSpecs;
6. discard and restore selected candidates and whole owners;
7. verify Studio refresh and canonical imagery.

Architecture-shape review:

- inspect `git diff --stat` and the complete diff;
- inspect every new or heavily modified file;
- confirm `index.ts` files remain thin;
- confirm `attachment-persistence.ts`, Asset lifecycle, Trash registry, Studio
  routes, and CLI dispatch did not become god files;
- confirm focused detail tables store only real domain facts;
- confirm no second Asset projection, owner relationship path, or selection
  path remains;
- confirm no unrelated formatting churn or user changes entered the diff;
- confirm no checklist item was satisfied through unreviewable code structure.

## Completion Checklist

### Review Area

- [x] Confirm every concept maps to the Requirement Ledger.
- [x] Confirm the plan 0156 non-image Shot behavior remains intact.
- [x] Confirm plan 0158 is superseded rather than partially implemented.
- [x] Confirm exclusive ownership and separate selection are applied uniformly.
- [x] Confirm Shot and Scene Beat images use the same durable membership,
      selection, lifecycle, and projection mechanism.
- [x] Confirm Storyboard batching and slicing remain import orchestration only.
- [x] Confirm request-scoped generation choices remain separate.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Public Contracts

- [x] Add `AssetOwner` with the exact supported owner kinds.
- [x] Add `AssetSelectionTarget` with only the five canonical target kinds.
- [x] Add logical Scene Beat as an `AssetOwner`.
- [x] Use the same Scene Beat owner identity for membership and selection.
- [x] Replace relationship-enriched Asset with one public `Asset`.
- [x] Use `Asset.id`, `Asset.owner`, and `Asset.files`.
- [x] Return `AssetPage.selectedAssetId` with each owner candidate page.
- [x] Retain Asset title, summary, reference name, purpose, locale, origin,
      availability, files, and timestamps.
- [x] Remove `AssetInfo`, alternate Lookbook Asset shapes, and `ShotImage`.
- [x] Remove public relationship id, relationship role, and relationship order.
- [x] Add `Shot.images` and `Shot.selectedImageId`.
- [x] Add Beat Storyboard candidates and `selectedImageId`.
- [x] Keep package-boundary diagnostics structured.
- [x] Add no compatibility aliases or fallback readers.

### Schema And Drizzle Artifacts

- [x] Add Asset metadata columns to `asset`.
- [x] Add `asset_membership` with Asset primary key, owner key, and timestamps.
- [x] Add the owner/Asset lookup index.
- [x] Add `selected_asset` with one row per selectable owner key and one Asset
      pointer.
- [x] Remove all six generic relationship tables.
- [x] Remove Cast, Location, Lookbook, and Shot selection tables.
- [x] Preserve Lookbook Image/Sheet ids while removing duplicated ownership.
- [x] Convert Storyboard association rows to direct Scene Beat membership and
      remove the focused Storyboard table.
- [x] Retain Dialogue Audio Take domain facts without duplicate ownership.
- [x] Confirm Shot Plans have no image table.
- [x] Preserve accepted Shot title/Trash, Shot Plan, and GenerationSpec DDL
      from the replaced migration.
- [x] Generate replacement migration 0066 with Drizzle Kit.
- [x] Add and inspect the documented custom data-preservation SQL.
- [x] Inspect SQL, snapshot, journal, and schema generation.
- [x] Add no 0067 compatibility migration or runtime legacy path.

### Asset Ownership And Metadata

- [x] Implement the exact internal owner-key encoding.
- [x] Include logical `{ sceneId, beatId }` in owner-key encoding.
- [x] Reuse owner keys in `selected_asset`; add no selection-key codec.
- [x] Keep owner keys out of public contracts and UI.
- [x] Validate every owner kind before writes.
- [x] Enforce exactly one membership per Asset.
- [x] Insert Asset and membership atomically.
- [x] List and paginate by owner through one Core path.
- [x] Order generic candidates by Asset creation time and id without persisted
      generic sort state.
- [x] Filter by canonical Asset type rather than relationship role.
- [x] Move reference name, purpose, and locale updates to Asset.
- [x] Replace `updateAssetReference` with `updateAsset`.
- [x] Delete the old asset-relationship access folder.

### Canonical Selection

- [x] Implement `selectAsset` and `clearAssetSelection`.
- [x] Map each supported target to its exact canonical Asset type in Core.
- [x] Reject missing, discarded, wrong-owner, and wrong-type Assets before
      writes, with no Storyboard-specific association branch.
- [x] Persist selection separately from membership.
- [x] Keep selection timestamps.
- [x] Replace Cast Profile selection with common selection.
- [x] Replace Location Hero selection with common selection.
- [x] Replace Lookbook card selection with common selection.
- [x] Replace Shot image selection with common selection.
- [x] Replace newest-wins Beat Storyboard behavior with common selection.
- [x] Clear selection on individual selected-Asset discard.
- [x] Restore individually discarded Assets as unselected.
- [x] Preserve selection through whole-owner discard/restore.

### Generation-Scoped References

- [x] Keep Character Sheet choices only in GenerationSpec references.
- [x] Keep Location Sheet choices only in GenerationSpec references.
- [x] Keep Lookbook Sheet choices only in GenerationSpec references.
- [x] Keep Dialogue Audio Take choices only in GenerationSpec references.
- [x] Filter purpose candidates by owner and canonical Asset type.
- [x] Prove two Specs can choose different exact candidates.
- [x] Prove guide and Preview code never reads or writes `selected_asset`.
- [x] Add no global selection fields or commands for request-scoped media.

### Purpose-Specific Detail Records

- [x] Keep Lookbook ordering only in Lookbook detail.
- [x] Keep Lookbook sections and point placement.
- [x] Preserve existing Lookbook Image and Sheet ids.
- [x] Remove Storyboard source-purpose mirrors, exact-file mirrors,
      fingerprints, detail ids, and Beat Sheet revision associations.
- [x] Replace Storyboard Scene relationships with common Scene Beat membership.
- [x] Keep generation source and exact files in common provenance and AssetFile
      records.
- [x] Replace Dialogue Scene relationship rows with common Scene membership.
- [x] Keep every Dialogue Audio Take provider and settings fact.
- [x] Keep Cast Voice provider registration and playable sample link.
- [x] Confirm no detail table duplicates selected state.

### Generation Attachment

- [x] Make every attachment descriptor supply owner and Asset type.
- [x] Remove relationship role from attachment persistence.
- [x] Remove the Lookbook membership exception.
- [x] Reuse AssetFile destination, provenance, write-set, rollback, diagnostic,
      and resource-key services.
- [x] Support atomic import-and-select for canonical purposes.
- [x] Reject unsupported `select` before any durable write.
- [x] Keep focused domain-detail inserts outside generic membership logic.
- [x] Keep attachment entrypoints shallow and reviewable.

### Storyboard

- [x] Require grouped Storyboard import `select`.
- [x] Import one candidate per listed Beat in one call.
- [x] Attach every accepted slice through the common owned-image operation.
- [x] Give every slice its own Asset, AssetFile, and Scene Beat membership.
- [x] Select all imported Beat images atomically when requested.
- [x] Leave selection unchanged when not requested.
- [x] Return all Beat candidates and one selected id.
- [x] Remove latest-created selection inference.
- [x] Use selected current Storyboards in Scene, Sequence, Act, Director, and
      Shot Plan Beat context.
- [x] Preserve candidates and global selection automatically when Scene and Beat
      ids remain unchanged.
- [x] Remove all Storyboard carry-forward writes from Beat Sheet revision paths.
- [x] Remove the Storyboard detail table, fingerprint/staleness rules, and
      revision-association access code.
- [x] Keep composite generation, inspection, and slicing outside durable Beat
      image storage.

### Shot Copy And Lifecycle

- [x] Copy only each source Shot's selected image.
- [x] Allocate new Asset and AssetFile ids.
- [x] Allocate new owner-specific destination paths.
- [x] Copy bytes through the common filesystem write-set.
- [x] Preserve current provenance references.
- [x] Create copied membership and selection atomically.
- [x] Remove shared-owner counts and shared-Asset assumptions.
- [x] Prove source and copy delete independently.
- [x] Roll back all rows and files on forced copy failure.
- [x] Keep Shot image copying focused; do not add a generic copy framework.

### CLI

- [x] Replace `--target` relationship language with `--owner`.
- [x] Parse Project, Cast, Location, Sequence, Scene, Lookbook, and Shot owner
      forms, plus the logical Scene Beat owner form.
- [x] Parse Cast, Location, Lookbook, Shot, and Scene Beat selection targets
      separately.
- [x] Add `asset update`.
- [x] Add `asset select`.
- [x] Add `asset clear-selection`.
- [x] Add `media import --select`.
- [x] Remove `asset reference-update` and relationship `--role`.
- [x] Remove Lookbook card-image selection commands.
- [x] Remove Shot representative selection commands.
- [x] Keep domain-specific placement and discard commands only where their
      intent remains real.
- [x] Emit one report and refresh event per mutation.
- [x] Keep selection capability rules out of CLI.

### Studio Server And UI

- [x] Rename existing display/representative route wording to selected.
- [x] Keep domain-named selection routes thin over common Core operations.
- [x] Keep server handlers limited to parsing, delegation, serialization, and
      structured error translation.
- [x] Use owner-independent AssetFile URLs.
- [x] Drive Cast Profile selected state and navigation image from the common
      selected pointer.
- [x] Drive Location Hero selected state and navigation image from the common
      selected pointer.
- [x] Update Lookbook selected card image.
- [x] Update Beat Storyboard candidate and selected state.
- [x] Keep request-scoped sheets and Dialogue Takes out of global selection UI.
- [x] Use local shadcn controls only.
- [x] Keep visible labels domain-specific and avoid raw ids, filenames, owner
      keys, and Asset type strings.
- [x] Update plan 0157's future Shot UI contract without implementing that UI.

### Agent Skills

- [x] Update Media Producer canonical import guidance to use `--select` when
      explicitly intended.
- [x] Update grouped Storyboard import sample with required `select`.
- [x] Update Shot Planner to selected terminology and common commands.
- [x] Rename representative workflow and eval files directly.
- [x] Update Scene Beat Designer Storyboard handoff.
- [x] Update Lookbook Designer image selection and placement workflow.
- [x] Update Cast and Location handoffs where canonical selection is relevant.
- [x] Keep sheets and Dialogue Takes request-scoped.
- [x] Avoid import followed by a second select call for one accepted intent.
- [x] Preserve Preview, approval, execution, inspection, and acceptance gates.
- [x] Add forward evals for call economy and selection-scope correctness.

### Tests And Guardrails

- [x] Add fresh-schema and exact-membership tests.
- [x] Add schema-generation-52 to 53 data-preservation migration tests and
      verify the full generation-50 to 53 chain.
- [x] Compare complete pre/post Asset, AssetFile, ownership, metadata,
      selection, detail, placement, Trash, and provenance inventories.
- [x] Prove migration leaves existing AssetFile paths and hashes unchanged.
- [x] Prove ambiguous existing ownership aborts the migration transaction.
- [x] Add owner-key round-trip and invalid-storage tests.
- [x] Prove selected rows use the exact owner-key encoding.
- [x] Add complete Core selection behavior tests.
- [x] Add request-scoped isolation tests.
- [x] Add Storyboard candidate, global selection, common-operation, and
      no-carry-forward tests.
- [x] Add Shot independent-copy and rollback tests.
- [x] Add individual and aggregate Trash lifecycle tests.
- [x] Add Lookbook placement/order regression tests.
- [x] Add Dialogue Audio Take regression tests.
- [x] Add thin CLI and HTTP adapter tests.
- [x] Add current desktop UI interaction tests.
- [x] Add stable import-boundary and runtime architecture tests where useful.
- [x] Do not freeze private names or service inventories in architecture tests.
- [x] Run every shape-review check from Final Verification.

### Documentation And Decisions

- [x] Add ADR 0064 for exclusive ownership and scoped selection.
- [x] Add concise notices to affected older ADRs without rewriting history.
- [x] Update current Asset, storage, generation, CLI, and vocabulary docs.
- [x] Add a supersession notice to plan 0158.
- [x] Narrow plan 0156 only for its incorrect image sections.
- [x] Update plan 0157's contracts and ADR reservation.
- [x] Update current Studio Skills docs and samples.
- [x] Keep rejected names only in explicit historical context.

### Final Verification

- [x] Run focused Core, CLI, Studio, and skill checks.
- [x] Run root build, test, lint, and check.
- [x] Inspect generated Drizzle SQL, custom preservation section, snapshot,
      journal, and schema generation.
- [x] Apply to fresh and copied-real-project databases first.
- [x] Compare the copied project's complete pre/post inventories and file
      integrity.
- [x] Migrate real `urban-basilica` through the backed-up project migration
      command after the copy passes.
- [x] Verify the backup, schema generation, foreign keys, quick check, current
      CLI reads, and Studio reads against the migrated real project.
- [x] Complete the realistic ownership, selection, request-reference, copy, and
      Trash journeys.
- [x] Inspect copied ids, paths, hashes, bytes, and provenance.
- [x] Review `git diff --stat` and the complete diff.
- [x] Inspect every new or heavily modified file.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no duplicate membership, selection, or Asset projection remains.
- [x] Confirm no unrelated user changes or formatting churn entered the diff.
- [x] Confirm no checklist item was satisfied through unreviewable code
      structure.
- [x] Only then mark this plan complete.
